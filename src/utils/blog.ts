import { getCollection, type CollectionKey } from "astro:content";
import { extractExcerptFromMarkdown } from "@zudo-doc/md-plugins";
import type { BlogEntry } from "@/types/blog-entry";
import { settings } from "@/config/settings";
import type { BlogConfig } from "@/config/settings";
import { toRouteSlug } from "@/utils/slug";

// ---------------------------------------------------------------------------
// Resolved blog config
// ---------------------------------------------------------------------------

/**
 * Documented defaults for `BlogConfig`. Single source of truth so callers do
 * not repeat the fallbacks. Adjust here if the documented defaults change.
 */
const BLOG_DEFAULTS = {
  dir: "src/content/blog",
  sidebarRecentCount: 30,
  postsPerPage: 10,
} as const;

/**
 * Resolved blog config returned by {@link getBlogConfig}. Fields with a
 * documented default are required (non-optional) so callers can rely on them
 * being populated. Optional `BlogConfig` fields without a default (currently
 * `locales`) remain optional.
 */
export type ResolvedBlogConfig = Omit<
  BlogConfig,
  "dir" | "sidebarRecentCount" | "postsPerPage"
> & {
  dir: string;
  sidebarRecentCount: number;
  postsPerPage: number;
};

/**
 * Returns the resolved blog config with all documented defaults applied, or
 * `null` when the blog feature is disabled (`settings.blog === false`).
 *
 * The leading `...blog` spread keeps any future `BlogConfig` field passed
 * through verbatim; explicit `??` fallbacks cover the documented defaults.
 */
export function getBlogConfig(): ResolvedBlogConfig | null {
  const blog = settings.blog;
  if (blog === false) return null;
  return {
    ...blog,
    dir: blog.dir ?? BLOG_DEFAULTS.dir,
    sidebarRecentCount: blog.sidebarRecentCount ?? BLOG_DEFAULTS.sidebarRecentCount,
    postsPerPage: blog.postsPerPage ?? BLOG_DEFAULTS.postsPerPage,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Typed wrapper around getCollection() for blog collections.
 *
 * The unsafe boundary is confined to a single location, mirroring
 * the pattern in get-docs-collection.ts.
 */
async function getBlogCollection(name: CollectionKey | string): Promise<BlogEntry[]> {
  return (await getCollection(name as CollectionKey)) as unknown as BlogEntry[];
}

/** Filter drafts in production builds, aligned with the docs behaviour. */
function filterDrafts(posts: BlogEntry[]): BlogEntry[] {
  return import.meta.env.PROD ? posts.filter((p) => !p.data.draft) : posts;
}

/** Sort posts newest-first by date. */
function sortNewestFirst(posts: BlogEntry[]): BlogEntry[] {
  return [...posts].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface BlogPostsResult {
  /** All posts: locale-first, then EN fallbacks (includes unlisted — filter as needed). */
  allPosts: BlogEntry[];
  /** Slugs that come from the EN (base) collection, not the locale. */
  fallbackSlugs: Set<string>;
}

// ---------------------------------------------------------------------------
// Module-level cache — stable within a single build
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<BlogPostsResult>>();

// ---------------------------------------------------------------------------
// loadBlogPosts
// ---------------------------------------------------------------------------

/**
 * Load and merge blog posts for a given language.
 * Results are memoized by language for the duration of the build.
 *
 * For English (default locale), returns the base `blog` collection directly.
 * For other locales, merges locale posts with EN fallbacks:
 *   - Locale posts take priority (matched by slug)
 *   - EN posts fill in for missing translations
 *   - Draft filtering applied in production
 *   - Posts sorted newest-first
 */
export function loadBlogPosts(lang: string): Promise<BlogPostsResult> {
  const cached = cache.get(lang);
  if (cached) return cached;
  const promise = loadBlogPostsImpl(lang);
  cache.set(lang, promise);
  return promise;
}

async function loadBlogPostsImpl(lang: string): Promise<BlogPostsResult> {
  const defaultLang = settings.defaultLocale;

  if (lang === defaultLang) {
    const posts = sortNewestFirst(filterDrafts(await getBlogCollection("blog")));
    return { allPosts: posts, fallbackSlugs: new Set<string>() };
  }

  // Determine the locale collection name. When blog.locales is configured, use
  // its dir; the collection name is always `blog-${code}`.
  const localeCollectionName = `blog-${lang}`;

  const localePosts = filterDrafts(await getBlogCollection(localeCollectionName));
  const basePosts = filterDrafts(await getBlogCollection("blog"));

  const localeSlugSet = new Set<string>(
    localePosts.map((p) => p.data.slug ?? toRouteSlug(p.id)),
  );

  const fallbackPosts = basePosts.filter(
    (p) => !localeSlugSet.has(p.data.slug ?? toRouteSlug(p.id)),
  );

  const allPosts = sortNewestFirst([...localePosts, ...fallbackPosts]);

  const fallbackSlugs = new Set<string>(
    fallbackPosts.map((p) => p.data.slug ?? toRouteSlug(p.id)),
  );

  return { allPosts, fallbackSlugs };
}

// ---------------------------------------------------------------------------
// getBlogExcerpt — fallback for the <!-- more --> marker
// ---------------------------------------------------------------------------

/**
 * Result of `getBlogExcerpt()`.
 *
 * `source` reflects which path was taken so callers (and templates) can decide
 * whether to render a "Continue reading" link.
 */
export interface BlogExcerpt {
  /** Excerpt HTML (rendered) OR the manual frontmatter string when source === "manual". */
  excerpt: string;
  /** True iff the body contained a `<!-- more -->` marker. */
  hasMore: boolean;
  source: "manual" | "marker" | "none";
}

const excerptCache = new WeakMap<BlogEntry, BlogExcerpt>();

/**
 * Resolve the excerpt for a blog entry, with this precedence:
 *
 *   1. Manual `entry.data.excerpt` set in frontmatter — wins, never
 *      overwritten. `hasMore` reflects whether the body also has a marker.
 *   2. `<!-- more -->` marker in `entry.body` — re-parsed at render time and
 *      rendered to HTML.
 *   3. Neither — returns `{ excerpt: "", hasMore: false, source: "none" }`
 *      so callers can fall back to a description or the rendered body.
 *
 * This is the documented fallback path from issue #442. The companion remark
 * plugin still runs at build time (it strips the marker from the rendered
 * detail page), but Astro 6 Content Collections do NOT propagate
 * `vfile.data.astro.frontmatter` mutations to `entry.data`, so we re-parse
 * the body here at listing-render time. Slower but bulletproof.
 *
 * Memoized per-entry via a WeakMap, so repeated lookups within a single build
 * pay the parse cost once.
 */
export async function getBlogExcerpt(entry: BlogEntry): Promise<BlogExcerpt> {
  const cached = excerptCache.get(entry);
  if (cached) return cached;

  const manual = entry.data.excerpt;
  const body = entry.body ?? "";
  const parsed = await extractExcerptFromMarkdown(body);
  const hasMore = parsed?.hasMore ?? false;

  let result: BlogExcerpt;
  if (manual !== undefined && manual !== null && manual !== "") {
    result = { excerpt: manual, hasMore, source: "manual" };
  } else if (parsed) {
    result = { excerpt: parsed.excerpt, hasMore: true, source: "marker" };
  } else {
    result = { excerpt: "", hasMore: false, source: "none" };
  }
  excerptCache.set(entry, result);
  return result;
}
