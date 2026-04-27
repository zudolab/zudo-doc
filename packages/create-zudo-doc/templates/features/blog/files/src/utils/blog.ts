import { getCollection, type CollectionKey } from "astro:content";
import { extractExcerptFromMarkdown } from "@/plugins/remark-excerpt";
import type { BlogEntry } from "@/types/blog-entry";
import { settings } from "@/config/settings";
import type { BlogConfig } from "@/config/settings";
import { toRouteSlug } from "@/utils/slug";
import { withBase } from "@/utils/base";
import type { NavNode } from "@/utils/docs";
import { t } from "@/config/i18n";

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
 * Returns the list of non-default locale codes that have blog content
 * registered (i.e., locales explicitly listed in `settings.blog.locales`).
 *
 * Routes under `[locale]/blog/*` MUST iterate over this list — not over
 * `settings.locales`, which is the docs locale list. Iterating the docs
 * locale list would call `getCollection("blog-${docsLocale}")` for locales
 * that were never registered in `content.config.ts`, which crashes the
 * build. Returns an empty array when the blog feature is disabled or has
 * no `locales` mapping.
 */
export function getBlogLocales(): string[] {
  const blog = getBlogConfig();
  if (!blog || !blog.locales) return [];
  return Object.keys(blog.locales);
}

/**
 * Returns the resolved blog config with all documented defaults applied, or
 * `null` when the blog feature is disabled (`settings.blog === false`).
 *
 * The leading `...blog` spread keeps any future `BlogConfig` field passed
 * through verbatim; explicit `??` fallbacks cover the documented defaults.
 */
export function getBlogConfig(): ResolvedBlogConfig | null {
  const blog = settings.blog;
  // Defensive: treat `false` (explicit disable), missing/undefined (field
  // omitted in fixture / generated settings.ts), AND an explicit
  // `enabled: false` flag as disabled. The TS type is `BlogConfig | false`,
  // but runtime-only consumers (e2e fixtures, generated downstream projects
  // mid-scaffold) often omit the field entirely — that should opt out, not
  // crash on `blog.dir`. The `enabled: boolean` field on BlogConfig is the
  // documented kill switch ("Must be true to activate blog routes and
  // sidebar"), so honor it here as the single source of truth.
  if (!blog || blog.enabled === false) return null;
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

/**
 * Defensive variant of {@link getBlogCollection} that returns an empty array
 * when the collection is not registered. Used for locale-specific blog
 * collections, which may be absent when `settings.blog.locales` does not
 * include a given code (or when a downstream project leaves the blog locale
 * map empty entirely). Treating "no collection" as "no posts" lets the
 * locale-merge logic short-circuit cleanly without a build crash.
 */
async function getBlogCollectionOrEmpty(
  name: CollectionKey | string,
): Promise<BlogEntry[]> {
  try {
    return await getBlogCollection(name);
  } catch {
    return [];
  }
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
  // its dir; the collection name is always `blog-${code}`. If the locale
  // collection is not registered (lang not in blog.locales), treat it as
  // empty rather than crashing — the EN fallback list still resolves.
  const localeCollectionName = `blog-${lang}`;

  const localePosts = filterDrafts(
    await getBlogCollectionOrEmpty(localeCollectionName),
  );
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
// Blog sidebar tree
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// URL helpers — consolidated single source of truth for blog routes.
// ---------------------------------------------------------------------------

/**
 * Build the URL path prefix for blog routes in a given language. Returns the
 * path under the base, e.g. `/blog` for the default locale or `/ja/blog` for
 * a non-default locale. The trailing slash is applied by `withBase` when
 * `settings.trailingSlash` is enabled.
 */
function blogPathPrefix(lang: string): string {
  return lang === settings.defaultLocale ? "/blog" : `/${lang}/blog`;
}

/**
 * Href to the blog listing root for a locale (page 1 lives at this URL).
 */
export function blogIndexHref(lang: string): string {
  return withBase(blogPathPrefix(lang));
}

/**
 * Href for a specific blog listing page (`n >= 1`). Page 1 always resolves
 * to the listing root (no `/page/1/` URL is generated).
 */
export function blogPageHref(n: number, lang: string): string {
  if (n <= 1) return blogIndexHref(lang);
  return withBase(`${blogPathPrefix(lang)}/page/${n}`);
}

/**
 * Build a blog post URL for the given post slug and language. Mirrors the
 * routing in `src/pages/blog/[...slug].astro` and the locale variant.
 */
export function blogPostUrl(postSlug: string, lang: string): string {
  return withBase(`${blogPathPrefix(lang)}/${postSlug}`);
}

/** Href for the blog archives page in a given language. */
export function blogArchivesHref(lang: string): string {
  return withBase(`${blogPathPrefix(lang)}/archives`);
}

/**
 * Build the synthesized sidebar tree for blog routes:
 *
 *   Blog
 *     ├ <recent post 1>
 *     ├ <recent post 2>
 *     ├ ...up to N (default 30, configurable via settings.blog.sidebarRecentCount)
 *     └ Archives
 *
 * Returns an empty array when the blog feature is disabled, so callers can
 * treat the result uniformly.
 *
 * Posts come from `loadBlogPosts(lang)`, which already merges locale posts
 * with EN fallbacks (locale wins by slug) and sorts newest-first. The post
 * label uses the entry's title — this is the locale title when available,
 * otherwise the EN fallback title.
 *
 * `recentCount` overrides the configured `settings.blog.sidebarRecentCount`.
 * When omitted, the resolved config default (30) is used.
 */
export async function buildBlogSidebar(
  lang: string,
  recentCount?: number,
): Promise<NavNode[]> {
  const blog = getBlogConfig();
  if (!blog) return [];

  const limit = recentCount ?? blog.sidebarRecentCount;
  const { allPosts } = await loadBlogPosts(lang);

  const visiblePosts = allPosts.filter((p) => !p.data.unlisted);
  const recent = limit > 0 ? visiblePosts.slice(0, limit) : [];

  const postNodes: NavNode[] = recent.map((entry, index) => {
    const slug = entry.data.slug ?? toRouteSlug(entry.id);
    return {
      slug: `blog/${slug}`,
      label: entry.data.title,
      position: index,
      href: blogPostUrl(slug, lang),
      hasPage: true,
      children: [],
    };
  });

  const archivesNode: NavNode = {
    slug: "blog/archives",
    label: t("blog.archives", lang),
    position: postNodes.length,
    href: blogArchivesHref(lang),
    hasPage: true,
    children: [],
  };

  const blogRoot: NavNode = {
    slug: "blog",
    label: t("blog.title", lang),
    position: 0,
    href: blogIndexHref(lang),
    hasPage: true,
    children: [...postNodes, archivesNode],
  };

  return [blogRoot];
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
