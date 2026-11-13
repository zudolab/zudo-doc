// route-enumerators — pure URL-enumeration helpers shared by both page paths()
// functions and the sitemap (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/route-enumerators.ts` into the shared
// package. Previously this imported host singletons (`@/config/settings`,
// `@/config/i18n`, `@/utils/base`, `@/utils/tags`, the package slug helpers,
// `@/utils/docs`) directly — imports that would not resolve in downstream
// consumers. The package version accepts all host-specific dependencies via
// injected context through `createRouteEnumerators(ctx)`.
//
// Each enumerator returns absolute paths (with settings.base prefix and
// trailing slash applied) as expected by the sitemap and page modules.
// `enumerateAllRoutes()` composes the others and returns a deduped
// Map<url, buildDate>; `enumerateSitemapEntries()` walks the same routes and
// attaches each page's doc-history `updatedDate` (or no date) for the sitemap.
//
// Design principles (unchanged):
//   - Draft pages are always excluded (never built).
//   - Unlisted pages ARE included — they have real HTML files.
//   - toRouteSlug() is applied to all current zfb entry slugs.
//   - Auto-generated category index pages are emitted via collectAutoIndexNodes.

import type { NavSourceDocs } from "../nav-source-docs/index.js";
import type { DocPageEntry, DocNavNode } from "../doc-page-props/index.js";
import type { CategoryMeta } from "../sidebar-tree/index.js";
import type { Settings } from "../settings.js";
import { assetViewerHref } from "../asset-path/index.js";
import type { AssetManifest } from "../route-context-payload/types.js";
import { mergeLocaleDocs } from "../locale-merge/index.js";
import { toHistorySlug } from "../slug/index.js";

export type { DocPageEntry, DocNavNode, NavSourceDocs };

// ---------------------------------------------------------------------------
// DocsEntry shape (structural subset used by route enumerators)
// ---------------------------------------------------------------------------

/** Current zfb docs entry used by tag enumeration. */
export type DocsEntryForTags = DocPageEntry;

// ---------------------------------------------------------------------------
// VersionConfig shape (structural)
// ---------------------------------------------------------------------------

/**
 * Minimal version config shape needed for route enumeration.
 */
export interface VersionConfigForEnum {
  slug: string;
  docsDir?: string;
  locales?: Record<string, { dir?: string }>;
}

// ---------------------------------------------------------------------------
// TagInfo shape
// ---------------------------------------------------------------------------

/**
 * Minimal tag info shape — only the keys the tag URL enumerator needs.
 */
export interface TagInfoForEnum {
  tag: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Sitemap entry shapes
// ---------------------------------------------------------------------------

/**
 * Minimal doc-history manifest entry read by {@link RouteEnumeratorsAPI.enumerateSitemapEntries}
 * — a structural subset of `.zfb/doc-history-meta.json` values.
 */
export interface DocHistoryDateEntry {
  /** ISO date or git `%aI` timestamp of the page's most recent commit. */
  updatedDate?: string;
}

/** Doc-history manifest keyed like the visible Created/Updated block. */
export type DocHistoryDateManifest = Readonly<Record<string, unknown>>;

/** Options for {@link RouteEnumeratorsAPI.enumerateSitemapEntries}. */
export interface SitemapEntriesOptions {
  /**
   * The build's doc-history manifest. Absent, `null`, or `{}` means no page
   * has a known date, so every entry omits `lastmod`.
   */
  docHistoryMeta?: DocHistoryDateManifest | null;
}

/**
 * One locale variant of a page, for `hreflang` alternates. `url` is the
 * base-prefixed path (callers make it absolute with `siteUrl`). `hreflang` is
 * the locale code (the same value as the page's `<html lang>`) or `x-default`.
 */
export interface LocaleAlternate {
  hreflang: string;
  url: string;
}

/** One sitemap URL with its last-modified date, when one is known. */
export interface SitemapEntry {
  url: string;
  /** `YYYY-MM-DD` (UTC), or absent when the page has no known date. */
  lastmod?: string;
  /**
   * Locale variants of this page, including itself and `x-default`. Present
   * only for pages that exist as real content in more than one locale.
   */
  alternates?: LocaleAlternate[];
}

/**
 * Reduce a manifest date to the UTC calendar day, the same day the visible
 * "Updated" label shows (`formatDate` renders in UTC). Unparseable → undefined.
 */
function toSitemapDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : new Date(time).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Injected context for createRouteEnumerators
// ---------------------------------------------------------------------------

/**
 * Context slice `createRouteEnumerators` derives its bag from (epic Collapse
 * Wiring Shells #2420, FACTORIES #2424 — breaking signature). STRUCTURAL SUBSET
 * of the unified `RouteContext`/`ChromeContext`: `getLocaleKeys`/`getVersions`/
 * `getDocTags` read off `settings`, `loadDocs` is the content-bridge `stableDocs`,
 * `mergeLocaleDocs` is imported directly, and the rest are reconstructed
 * callables already on the context (including the nav-source resolvers, which
 * `createRouteContext` assembles BEFORE the enumerators).
 */
export interface RouteEnumeratorsContext {
  /** The host's resolved settings object (reads `locales`/`versions`/`docTags`). */
  settings: Settings;
  /** Asset index manifest, or `null` when the asset viewer is disabled. */
  assetManifest: AssetManifest | null;
  /** Default locale code. */
  defaultLocale: string;
  /** Build a docs URL for the given slug and locale. */
  docsUrl: (slug: string, lang?: string) => string;
  /** Build a versioned docs URL. */
  versionedDocsUrl: (slug: string, versionSlug: string, lang?: string) => string;
  /** Prefix a path with the configured base directory. */
  withBase: (path: string) => string;
  /** Identity-stable, draft-filtered docs array for a collection. */
  stableDocs: (collectionName: string) => DocPageEntry[];
  /** Returns true for paths that are only shown in the default locale. */
  isDefaultLocaleOnlyPath: (path: string) => boolean;
  /** Aggregate a `tag → docs` index from a doc collection. */
  collectTags: (
    docs: DocsEntryForTags[],
    slugFn: (entrySlug: string, data: { slug?: string }) => string,
  ) => Map<string, TagInfoForEnum>;
  /** Convert a content entry slug to a canonical route slug. */
  toRouteSlug: (entrySlug: string) => string;
  /** Build the nav tree for a locale (4-arg form with an explicit href builder). */
  buildNavTree: (
    docs: DocPageEntry[],
    locale: string,
    categoryMeta: Map<string, CategoryMeta> | undefined,
    buildHref: (slug: string, locale: string) => string,
  ) => DocNavNode[];
  /** Collect auto-generated index nodes. */
  collectAutoIndexNodes: (tree: DocNavNode[]) => DocNavNode[];
  /** Resolve the identity-stable nav source for an EN/locale context. */
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: {
      applyDefaultLocaleOnlyFilter?: boolean;
      keepUnlisted?: boolean;
    },
  ) => NavSourceDocs;
  /** Resolve the identity-stable nav source for a versioned non-default-locale context. */
  resolveVersionedLocaleSource: (
    versionSlug: string,
    versionDocsDir: string | undefined,
    lang: string,
    localeDir: string | undefined,
    options?: {
      applyDefaultLocaleOnlyFilter?: boolean;
      keepUnlisted?: boolean;
    },
  ) => NavSourceDocs;
}

// ---------------------------------------------------------------------------
// RouteEnumeratorsAPI
// ---------------------------------------------------------------------------

export interface RouteEnumeratorsAPI {
  /**
   * Enumerate all doc page URLs for a locale.
   *
   * For the default locale: loads the "docs" collection directly.
   * For non-default locales: locale-first merge with EN fallback, with
   * default-locale-only paths excluded. A nav-tree pass adds auto-generated
   * category index pages.
   */
  enumerateDocsRoutes: (locale: string) => string[];

  /**
   * Enumerate tag-index and per-tag URLs for a locale.
   *
   * Returns `/docs/tags/` and `/docs/tags/{tag}/` for each unique tag.
   */
  enumerateTagsRoutes: (locale: string) => string[];

  /**
   * Enumerate asset-viewer URLs for a locale.
   *
   * Asset routes are emitted only when asset viewing and sitemap indexing are
   * both enabled and a scanned asset manifest is available. The default locale
   * uses unprefixed routes; non-default locales omit paths configured as
   * default-locale-only.
   */
  enumerateAssetRoutes: (locale: string) => string[];

  /**
   * Enumerate doc URLs for a single (version, locale) combination.
   *
   * For the default locale: loads the versioned EN collection.
   * For non-default locales: locale-first merge over the version's EN base.
   */
  enumerateVersionedRoutes: (
    version: VersionConfigForEnum,
    locale: string,
  ) => string[];

  /**
   * Compose all route enumerators into a deduped Map<url, buildDate>.
   *
   * Covers site root, default-locale docs + tags, per-locale docs + tags,
   * asset-viewer routes, versioned EN docs, and versioned locale docs. Every
   * value is the current build date; the sitemap uses
   * {@link RouteEnumeratorsAPI.enumerateSitemapEntries} instead.
   */
  enumerateAllRoutes: () => Map<string, string>;

  /**
   * The same deduped route set as `enumerateAllRoutes()`, in the same order,
   * with each latest (unversioned) doc page's `lastmod` taken from the
   * doc-history manifest — the date the page's visible "Updated" label shows.
   * Routes with no known date (site roots, tags, assets, versioned pages,
   * pages missing from the manifest) carry no `lastmod`.
   */
  enumerateSitemapEntries: (options?: SitemapEntriesOptions) => SitemapEntry[];

  /**
   * `hreflang` alternates for a latest (unversioned) doc page. Non-empty only
   * when the page in `locale` is real content (its own locale file, not an
   * EN fallback or auto-index) and at least one other locale also has real
   * content at the same slug. Lists every such locale, then `x-default` (the
   * default locale's URL) when the default locale is one of them.
   */
  getDocLocaleAlternates: (slug: string, locale: string) => LocaleAlternate[];

  /**
   * `hreflang` alternates for the home pages: every configured locale's home,
   * then `x-default`. Empty for single-locale sites.
   */
  getHomeLocaleAlternates: () => LocaleAlternate[];
}

// ---------------------------------------------------------------------------
// createRouteEnumerators factory
// ---------------------------------------------------------------------------

/**
 * Create the route-enumeration functions bound to the host's injected context.
 *
 * @example
 * ```ts
 * // pages/lib/route-enumerators.ts (thin stub)
 * import { createRouteEnumerators } from "@takazudo/zudo-doc/route-enumerators";
 * import { settings } from "@/config/settings";
 * import { defaultLocale } from "@/config/i18n";
 * import { docsUrl, versionedDocsUrl, withBase, isDefaultLocaleOnlyPath } from "@/utils/base";
 * import { buildNavTree, collectAutoIndexNodes } from "@/utils/docs";
 * import { collectTags } from "@/utils/tags";
 * import { toRouteSlug } from "@takazudo/zudo-doc/slug";
 * import { loadDocs } from "../_data";
 * import { resolveNavSource, resolveVersionedLocaleSource } from "./_nav-source-docs";
 * import { mergeLocaleDocs } from "@takazudo/zudo-doc/locale-merge";
 *
 * export const {
 *   enumerateDocsRoutes,
 *   enumerateTagsRoutes,
 *   enumerateAssetRoutes,
 *   enumerateVersionedRoutes,
 *   enumerateAllRoutes,
 * } = createRouteEnumerators({
 *   defaultLocale,
 *   getLocaleKeys: () => Object.keys(settings.locales),
 *   getVersions: () => settings.versions,
 *   getDocTags: () => settings.docTags,
 *   docsUrl,
 *   versionedDocsUrl,
 *   withBase,
 *   loadDocs,
 *   isDefaultLocaleOnlyPath,
 *   collectTags,
 *   toRouteSlug,
 *   buildNavTree,
 *   collectAutoIndexNodes,
 *   resolveNavSource,
 *   resolveVersionedLocaleSource,
 *   mergeLocaleDocs,
 * });
 * ```
 */
export function createRouteEnumerators(ctx: RouteEnumeratorsContext): RouteEnumeratorsAPI {
  // Derive the old narrow bag from the unified context: the locale/version/tags
  // getters read off `settings` (re-read per call so mutations are picked up),
  // `loadDocs` is the content bridge `stableDocs`, `mergeLocaleDocs` is the
  // package import, and `buildNavTree` binds the 4-arg form to `docsUrl`.
  const defaultLocale = ctx.defaultLocale;
  const getLocaleKeys = (): readonly string[] => Object.keys(ctx.settings.locales);
  const getVersions = (): VersionConfigForEnum[] | false | undefined =>
    ctx.settings.versions as VersionConfigForEnum[] | false | undefined;
  const getDocTags = (): boolean | undefined => ctx.settings.docTags;
  const assetManifest = ctx.assetManifest;
  const docsUrl = ctx.docsUrl;
  const versionedDocsUrl = ctx.versionedDocsUrl;
  const withBase = ctx.withBase;
  const loadDocs = (collectionName: string): DocsEntryForTags[] =>
    ctx.stableDocs(collectionName);
  const isDefaultLocaleOnlyPath = ctx.isDefaultLocaleOnlyPath;
  const collectTags = ctx.collectTags;
  const toRouteSlug = ctx.toRouteSlug;
  const buildNavTree = (
    docs: DocPageEntry[],
    locale: string,
    categoryMeta: Map<string, CategoryMeta>,
  ): DocNavNode[] =>
    ctx.buildNavTree(docs, locale, categoryMeta, (slug, loc) => ctx.docsUrl(slug, loc));
  const collectAutoIndexNodes = ctx.collectAutoIndexNodes;
  const resolveNavSource = ctx.resolveNavSource;
  const resolveVersionedLocaleSource = ctx.resolveVersionedLocaleSource;
  // ---------------------------------------------------------------------------
  // enumerateDocsRoutes
  // ---------------------------------------------------------------------------

  /**
   * Doc URLs for a locale, each paired with the doc-history manifest key the
   * page's visible Created/Updated block looks up (`DocMetainfoArea`): bare
   * slug for the default locale and EN-fallback pages, `<locale>/<slug>` for
   * pages whose source is the locale's own file.
   */
  function enumerateKeyedDocsRoutes(
    locale: string,
  ): Array<{ url: string; historyKey: string; slug: string; autoIndex: boolean }> {
    const entries: Array<{ url: string; historyKey: string; slug: string; autoIndex: boolean }> = [];
    const seen = new Set<string>();
    const isDefault = locale === defaultLocale;

    // Identity-stable nav source — same instances the doc routes use, so the
    // nav-tree fast-path applies here too (#1902).
    const { docs: allDocs, navDocs, categoryMeta, localeSlugSet } = resolveNavSource(
      locale,
      undefined,
      { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
    );
    const tree = buildNavTree(navDocs, locale, categoryMeta);

    function push(slug: string, isFallback: boolean, autoIndex: boolean): void {
      const url = docsUrl(slug, locale);
      if (seen.has(url)) return;
      seen.add(url);
      const historySlug = toHistorySlug(slug);
      entries.push({
        url,
        historyKey: isDefault || isFallback ? historySlug : `${locale}/${historySlug}`,
        slug,
        autoIndex,
      });
    }

    for (const doc of allDocs) {
      if (doc.data.category_no_page === true) continue;
      const slug = doc.data.slug ?? toRouteSlug(doc.slug);
      push(slug, !isDefault && !localeSlugSet.has(slug), false);
    }
    // Auto-index routes render with isFallback=false (site-schema
    // doc-route-entries), so their lookup uses the locale-prefixed key.
    for (const node of collectAutoIndexNodes(tree)) {
      push(node.slug, false, true);
    }

    return entries;
  }

  function enumerateDocsRoutes(locale: string): string[] {
    return enumerateKeyedDocsRoutes(locale).map((entry) => entry.url);
  }

  // ---------------------------------------------------------------------------
  // Locale alternates (hreflang)
  // ---------------------------------------------------------------------------

  // Slugs with real content per locale, memoized on the identity-stable nav
  // source array so one build computes each set once.
  const realSlugCache = new WeakMap<object, Set<string>>();

  /** Slugs routed in `locale` from that locale's own source files. */
  function realContentSlugs(locale: string): Set<string> {
    const source = resolveNavSource(locale, undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    const cached = realSlugCache.get(source.docs);
    if (cached) return cached;
    const isDefault = locale === defaultLocale;
    const slugs = new Set<string>();
    for (const doc of source.docs) {
      if (doc.data.category_no_page === true) continue;
      const slug = doc.data.slug ?? toRouteSlug(doc.slug);
      if (!isDefault) {
        // A non-default route only counts when it renders the locale's own
        // file; default-locale-only paths resolve to the default URL anyway.
        if (!source.localeSlugSet.has(slug)) continue;
        if (isDefaultLocaleOnlyPath(`/docs/${slug}`)) continue;
      }
      slugs.add(slug);
    }
    realSlugCache.set(source.docs, slugs);
    return slugs;
  }

  function getDocLocaleAlternates(slug: string, locale: string): LocaleAlternate[] {
    const localeKeys = getLocaleKeys();
    if (localeKeys.length === 0) return [];
    if (!realContentSlugs(locale).has(slug)) return [];
    const candidates = [defaultLocale, ...localeKeys.filter((code) => code !== defaultLocale)];
    const alternates: LocaleAlternate[] = [];
    for (const code of candidates) {
      if (realContentSlugs(code).has(slug)) {
        alternates.push({ hreflang: code, url: docsUrl(slug, code) });
      }
    }
    if (alternates.length < 2) return [];
    if (alternates[0]?.hreflang === defaultLocale) {
      alternates.push({ hreflang: "x-default", url: alternates[0].url });
    }
    return alternates;
  }

  function homeUrl(locale: string): string {
    return locale === defaultLocale ? withBase("/") : withBase(`/${locale}`);
  }

  function getHomeLocaleAlternates(): LocaleAlternate[] {
    const localeKeys = getLocaleKeys().filter((code) => code !== defaultLocale);
    if (localeKeys.length === 0) return [];
    const alternates: LocaleAlternate[] = [
      { hreflang: defaultLocale, url: homeUrl(defaultLocale) },
      ...localeKeys.map((code) => ({ hreflang: code, url: homeUrl(code) })),
    ];
    alternates.push({ hreflang: "x-default", url: homeUrl(defaultLocale) });
    return alternates;
  }

  // ---------------------------------------------------------------------------
  // enumerateTagsRoutes
  // ---------------------------------------------------------------------------

  function enumerateTagsRoutes(locale: string): string[] {
    if (!getDocTags()) return [];

    const urls: string[] = [];

    const tagsBase =
      locale === defaultLocale ? "/docs/tags" : `/${locale}/docs/tags`;
    urls.push(withBase(tagsBase));

    // Collect tags from the same merged doc set the tag pages use.
    // Filter unlisted + draft + category_no_page — mirrors the tag [tag].tsx
    // pages so the sitemap lists exactly the tag pages that get built.
    let docs: DocsEntryForTags[];
    if (locale === defaultLocale) {
      docs = loadDocs("docs").filter(
        (d) => !d.data.unlisted && !d.data.draft && !d.data.category_no_page,
      );
    } else {
      const result = mergeLocaleDocs({
        baseDocs: loadDocs("docs").filter((d) => !d.data.draft),
        localeDocs: loadDocs(`docs-${locale}`).filter((d) => !d.data.draft),
        applyDefaultLocaleOnlyFilter: true,
        isDefaultLocaleOnlyPath,
      });
      docs = result.docs.filter((d) => !d.data.category_no_page);
    }

    const tagMap = collectTags(
      docs,
      (entrySlug, data) => data.slug ?? toRouteSlug(entrySlug),
    );

    for (const tag of tagMap.keys()) {
      const encoded = encodeURIComponent(tag);
      const tagPath =
        locale === defaultLocale
          ? `/docs/tags/${encoded}`
          : `/${locale}/docs/tags/${encoded}`;
      urls.push(withBase(tagPath));
    }

    return urls;
  }

  // ---------------------------------------------------------------------------
  // enumerateAssetRoutes
  // ---------------------------------------------------------------------------

  function enumerateAssetRoutes(locale: string): string[] {
    const indexing = ctx.settings.assetViewerIndexing;
    if (
      ctx.settings.assetViewer !== true ||
      !indexing ||
      typeof indexing !== "object" ||
      indexing.sitemap !== true ||
      assetManifest === null
    ) {
      return [];
    }

    const routePrefix =
      assetManifest.routePrefix ?? ctx.settings.assetViewerRoutePrefix;
    const urls: string[] = [];
    const isDefaultLocale = locale === defaultLocale;

    if (ctx.settings.assetViewerIndex) {
      const indexPath = isDefaultLocale
        ? `/${routePrefix}/`
        : `/${locale}/${routePrefix}/`;
      if (isDefaultLocale || !ctx.isDefaultLocaleOnlyPath(`/${routePrefix}/`)) {
        urls.push(withBase(indexPath));
      }
    }

    for (const entry of assetManifest.entries) {
      if (
        !isDefaultLocale &&
        ctx.isDefaultLocaleOnlyPath(`/${routePrefix}/${entry.path}`)
      ) {
        continue;
      }
      urls.push(
        assetViewerHref({
          base: ctx.settings.base,
          routePrefix,
          path: entry.path,
          ...(isDefaultLocale ? {} : { locale }),
        }),
      );
    }

    return [...new Set(urls)];
  }

  // ---------------------------------------------------------------------------
  // enumerateVersionedRoutes
  // ---------------------------------------------------------------------------

  function enumerateVersionedRoutes(
    version: VersionConfigForEnum,
    locale: string,
  ): string[] {
    const urls: string[] = [];

    if (locale === defaultLocale) {
      const { docs: allDocs, navDocs, categoryMeta } = resolveNavSource(
        defaultLocale,
        version.slug,
      );
      const tree = buildNavTree(navDocs, defaultLocale, categoryMeta);

      for (const doc of allDocs) {
        if (doc.data.category_no_page === true) continue;
        const slug = doc.data.slug ?? toRouteSlug(doc.slug);
        urls.push(versionedDocsUrl(slug, version.slug));
      }
      for (const node of collectAutoIndexNodes(tree)) {
        urls.push(versionedDocsUrl(node.slug, version.slug));
      }
    } else {
      const localeDir = version.locales?.[locale]?.dir;

      const { docs: allDocs, navDocs, categoryMeta } = resolveVersionedLocaleSource(
        version.slug,
        version.docsDir,
        locale,
        localeDir,
        { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
      );
      const tree = buildNavTree(navDocs, locale, categoryMeta);

      for (const doc of allDocs) {
        if (doc.data.category_no_page === true) continue;
        const slug = doc.data.slug ?? toRouteSlug(doc.slug);
        urls.push(versionedDocsUrl(slug, version.slug, locale));
      }
      for (const node of collectAutoIndexNodes(tree)) {
        urls.push(versionedDocsUrl(node.slug, version.slug, locale));
      }
    }

    return [...new Set(urls)];
  }

  // ---------------------------------------------------------------------------
  // enumerateAllRoutes
  // ---------------------------------------------------------------------------

  /**
   * Walk every route once, in sitemap order. `historyKey` is set only for
   * latest (unversioned) doc pages; the doc-history manifest covers the
   * latest content dirs only, so versioned pages never get one.
   */
  type CollectedRoute = { url: string; historyKey?: string; alternates?: LocaleAlternate[] };

  function collectAllRoutes(): CollectedRoute[] {
    const seen = new Set<string>();
    const routes: CollectedRoute[] = [];
    const localeKeys = getLocaleKeys();
    const versions = getVersions();
    const homeAlternates = getHomeLocaleAlternates();

    function add(url: string, historyKey?: string, alternates?: LocaleAlternate[]): void {
      if (seen.has(url)) return;
      seen.add(url);
      const route: CollectedRoute = { url };
      if (historyKey !== undefined) route.historyKey = historyKey;
      if (alternates !== undefined && alternates.length > 0) route.alternates = alternates;
      routes.push(route);
    }

    function addDocs(locale: string): void {
      for (const { url, historyKey, slug, autoIndex } of enumerateKeyedDocsRoutes(locale)) {
        add(url, historyKey, autoIndex ? undefined : getDocLocaleAlternates(slug, locale));
      }
    }

    // Site root
    add(withBase("/"), undefined, homeAlternates);

    // Default locale docs
    addDocs(defaultLocale);

    // Default locale tags
    for (const url of enumerateTagsRoutes(defaultLocale)) {
      add(url);
    }

    // Default locale assets
    for (const url of enumerateAssetRoutes(defaultLocale)) {
      add(url);
    }

    // Non-default locales
    for (const locale of localeKeys) {
      add(withBase(`/${locale}`), undefined, homeAlternates);

      addDocs(locale);

      for (const url of enumerateTagsRoutes(locale)) {
        add(url);
      }

      for (const url of enumerateAssetRoutes(locale)) {
        add(url);
      }
    }

    // Versions listing pages
    if (versions) {
      add(withBase("/docs/versions"));
      for (const locale of localeKeys) {
        add(withBase(`/${locale}/docs/versions`));
      }
    }

    // Versioned docs
    if (versions) {
      for (const version of versions as VersionConfigForEnum[]) {
        for (const url of enumerateVersionedRoutes(version, defaultLocale)) {
          add(url);
        }
        for (const locale of localeKeys) {
          for (const url of enumerateVersionedRoutes(version, locale)) {
            add(url);
          }
        }
      }
    }

    return routes;
  }

  function enumerateAllRoutes(): Map<string, string> {
    const today = new Date().toISOString().split("T")[0] ?? "";
    return new Map(collectAllRoutes().map(({ url }) => [url, today]));
  }

  // ---------------------------------------------------------------------------
  // enumerateSitemapEntries
  // ---------------------------------------------------------------------------

  function enumerateSitemapEntries(options: SitemapEntriesOptions = {}): SitemapEntry[] {
    const meta = options.docHistoryMeta ?? {};
    return collectAllRoutes().map(({ url, historyKey, alternates }) => {
      const sitemapEntry: SitemapEntry = { url };
      if (historyKey !== undefined && Object.hasOwn(meta, historyKey)) {
        const entry = meta[historyKey] as DocHistoryDateEntry | null | undefined;
        const lastmod = toSitemapDate(entry?.updatedDate);
        if (lastmod !== undefined) sitemapEntry.lastmod = lastmod;
      }
      if (alternates !== undefined) sitemapEntry.alternates = alternates;
      return sitemapEntry;
    });
  }

  return {
    enumerateDocsRoutes,
    enumerateTagsRoutes,
    enumerateAssetRoutes,
    enumerateVersionedRoutes,
    enumerateAllRoutes,
    enumerateSitemapEntries,
    getDocLocaleAlternates,
    getHomeLocaleAlternates,
  };
}
