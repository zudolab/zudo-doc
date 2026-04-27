import type { BlogEntry } from "@/types/blog-entry";
import { type Locale } from "@/config/i18n";
import {
  getBlogConfig,
  getBlogExcerpt,
  loadBlogPosts,
  type BlogExcerpt,
} from "@/utils/blog";

// ---------------------------------------------------------------------------
// Listing data loaders
//
// URL helpers (`blogIndexHref`, `blogPageHref`, `blogPostUrl`,
// `blogArchivesHref`) live in `@/utils/blog` — that's the single source of
// truth for blog route shapes. Import them directly from there.
// ---------------------------------------------------------------------------

export interface BlogListingPage {
  /** Posts visible on this page, newest-first (already sorted by `loadBlogPosts`). */
  posts: BlogEntry[];
  /** Pre-resolved excerpts keyed by `entry.id`. Always populated for every post on the page. */
  excerpts: Map<string, BlogExcerpt>;
  /** 1-based page number. */
  currentPage: number;
  /** Total page count (>= 1, even when there are no posts). */
  lastPage: number;
}

/**
 * Filter out unlisted posts before pagination so they never surface in the
 * listing UI. Detail-page routes still build them — direct URLs keep working.
 */
function visiblePosts(posts: BlogEntry[]): BlogEntry[] {
  return posts.filter((p) => !p.data.unlisted);
}

/**
 * Load and slice posts for a given listing page. Returns `null` when the blog
 * feature is disabled — callers should opt out via `getStaticPaths()`.
 *
 * Excerpts are pre-resolved here so the rendered page can read from a
 * synchronous `Map` instead of awaiting per-card.
 */
export async function loadBlogListingPage(
  lang: Locale,
  page: number,
): Promise<BlogListingPage | null> {
  const cfg = getBlogConfig();
  if (!cfg) return null;

  const { allPosts } = await loadBlogPosts(lang);
  const visible = visiblePosts(allPosts);
  const perPage = Math.max(1, cfg.postsPerPage);
  const lastPage = Math.max(1, Math.ceil(visible.length / perPage));
  const safePage = Math.min(Math.max(1, page), lastPage);
  const start = (safePage - 1) * perPage;
  const posts = visible.slice(start, start + perPage);

  const excerptEntries = await Promise.all(
    posts.map(async (p) => [p.id, await getBlogExcerpt(p)] as const),
  );

  return {
    posts,
    excerpts: new Map(excerptEntries),
    currentPage: safePage,
    lastPage,
  };
}

/**
 * Build static-paths entries for the `/blog/page/[page]` route (pages 2..N).
 * Returns an empty array when the blog feature is disabled or there's only
 * one page worth of posts.
 */
export async function getBlogExtraPagePaths(
  lang: Locale,
): Promise<{ params: { page: string } }[]> {
  const cfg = getBlogConfig();
  if (!cfg) return [];

  const { allPosts } = await loadBlogPosts(lang);
  const visible = visiblePosts(allPosts);
  const perPage = Math.max(1, cfg.postsPerPage);
  const lastPage = Math.max(1, Math.ceil(visible.length / perPage));

  const paths: { params: { page: string } }[] = [];
  for (let n = 2; n <= lastPage; n++) {
    paths.push({ params: { page: String(n) } });
  }
  return paths;
}
