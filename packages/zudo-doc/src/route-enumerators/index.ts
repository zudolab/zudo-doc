// route-enumerators — pure URL-enumeration helpers shared by both page paths()
// functions and the sitemap (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/route-enumerators.ts` into the shared
// package. Previously this imported host singletons (`@/config/settings`,
// `@/config/i18n`, `@/utils/base`, `@/utils/tags`, `@/utils/slug`,
// `@/utils/docs`) directly — imports that would not resolve in downstream
// consumers. The package version accepts all host-specific dependencies via
// injected context through `createRouteEnumerators(ctx)`.
//
// Each enumerator returns absolute paths (with settings.base prefix and
// trailing slash applied) as expected by the sitemap and page modules.
// `enumerateAllRoutes()` composes the others and returns a deduped
// Map<url, lastmod> that the sitemap renderer wraps directly.
//
// Design principles (unchanged):
//   - Draft pages are always excluded (never built).
//   - Unlisted pages ARE included — they have real HTML files.
//   - toRouteSlug() is applied to all entry ids.
//   - Auto-generated category index pages are emitted via collectAutoIndexNodes.

import type { NavSourceDocs } from "../nav-source-docs/index.js";
import type { DocPageEntry, DocNavNode } from "../doc-page-props/index.js";

export type { DocPageEntry, DocNavNode, NavSourceDocs };

// ---------------------------------------------------------------------------
// DocsEntry shape (structural subset used by route enumerators)
// ---------------------------------------------------------------------------

/**
 * Minimal docs entry shape needed for tag enumeration (no Content/module_specifier).
 */
export interface DocsEntryForTags {
  id: string;
  data: {
    slug?: string;
    draft?: boolean;
    unlisted?: boolean;
    category_no_page?: boolean;
    tags?: string[];
    [key: string]: unknown;
  };
}

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
// Injected context for createRouteEnumerators
// ---------------------------------------------------------------------------

/**
 * Injected context for `createRouteEnumerators`.
 *
 * All host-specific singletons and utilities are passed in so the package
 * factory never imports `@/` aliases.
 */
export interface RouteEnumeratorsContext {
  /** Default locale code. Host passes `defaultLocale` from `@/config/i18n`. */
  defaultLocale: string;
  /**
   * Getter for all non-default locale codes.
   * Host passes `() => Object.keys(settings.locales)`.
   * Called per invocation so mutations to settings.locales are picked up.
   */
  getLocaleKeys: () => readonly string[];
  /**
   * Getter for the configured versions list (or false/undefined).
   * Host passes `() => settings.versions`.
   * Called per invocation so mutations to settings.versions are picked up.
   */
  getVersions: () => VersionConfigForEnum[] | false | undefined;
  /**
   * Getter for whether tag pages are enabled.
   * Host passes `() => settings.docTags`.
   */
  getDocTags: () => boolean | undefined;
  /** `docsUrl(slug, lang)` from `@/utils/base` (resolved with settings). */
  docsUrl: (slug: string, lang?: string) => string;
  /** `versionedDocsUrl(slug, versionSlug, lang)` from `@/utils/base`. */
  versionedDocsUrl: (slug: string, versionSlug: string, lang?: string) => string;
  /** `withBase(path)` from `@/utils/base`. */
  withBase: (path: string) => string;
  /**
   * Load docs from a named collection.
   * Host passes `loadDocs` from `pages/_data.ts`.
   */
  loadDocs: (collectionName: string) => DocsEntryForTags[];
  /**
   * Returns true for paths that are only shown in the default locale.
   * Host passes `isDefaultLocaleOnlyPath` from `@/utils/base`.
   */
  isDefaultLocaleOnlyPath: (path: string) => boolean;
  /**
   * Collect tags from a docs array.
   * Host passes `collectTags` from `@/utils/tags`.
   */
  collectTags: (
    docs: DocsEntryForTags[],
    slugFn: (id: string, data: { slug?: string }) => string,
  ) => Map<string, TagInfoForEnum>;
  /**
   * Convert a content entry slug to a canonical route slug.
   * Host passes `toRouteSlug` from `@/utils/slug`.
   */
  toRouteSlug: (id: string) => string;
  /**
   * Build the nav tree for a locale.
   * Host passes `buildNavTree` from `@/utils/docs`.
   */
  buildNavTree: (
    docs: DocPageEntry[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => DocNavNode[];
  /**
   * Collect auto-generated index nodes.
   * Host passes `collectAutoIndexNodes` from `@/utils/docs`.
   */
  collectAutoIndexNodes: (tree: DocNavNode[]) => DocNavNode[];
  /**
   * Resolve the identity-stable nav source for an EN/locale context.
   * Host passes `resolveNavSource` from `pages/lib/_nav-source-docs.ts`.
   */
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: {
      applyDefaultLocaleOnlyFilter?: boolean;
      keepUnlisted?: boolean;
    },
  ) => NavSourceDocs;
  /**
   * Resolve the identity-stable nav source for a versioned non-default-locale
   * context.
   * Host passes `resolveVersionedLocaleSource` from `pages/lib/_nav-source-docs.ts`.
   */
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
  /**
   * Merge locale docs with base-locale fallbacks.
   * Host passes `mergeLocaleDocs` from `pages/lib/locale-merge.ts`.
   */
  mergeLocaleDocs: (options: {
    baseDocs: DocsEntryForTags[];
    localeDocs: DocsEntryForTags[];
    applyDefaultLocaleOnlyFilter?: boolean;
    keepUnlisted?: boolean;
    isDefaultLocaleOnlyPath?: (path: string) => boolean;
  }) => { docs: DocsEntryForTags[]; localeSlugSet: ReadonlySet<string> };
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
   * Compose all route enumerators into a deduped Map<url, lastmod>.
   *
   * Covers site root, default-locale docs + tags, per-locale docs + tags,
   * versioned EN docs, and versioned locale docs.
   */
  enumerateAllRoutes: () => Map<string, string>;
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
 * import { toRouteSlug } from "@/utils/slug";
 * import { loadDocs } from "../_data";
 * import { resolveNavSource, resolveVersionedLocaleSource } from "./_nav-source-docs";
 * import { mergeLocaleDocs } from "./locale-merge";
 *
 * export const {
 *   enumerateDocsRoutes,
 *   enumerateTagsRoutes,
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
  const {
    defaultLocale,
    getLocaleKeys,
    getVersions,
    getDocTags,
    docsUrl,
    versionedDocsUrl,
    withBase,
    loadDocs,
    isDefaultLocaleOnlyPath,
    collectTags,
    toRouteSlug,
    buildNavTree,
    collectAutoIndexNodes,
    resolveNavSource,
    resolveVersionedLocaleSource,
    mergeLocaleDocs,
  } = ctx;

  // ---------------------------------------------------------------------------
  // enumerateDocsRoutes
  // ---------------------------------------------------------------------------

  function enumerateDocsRoutes(locale: string): string[] {
    const urls: string[] = [];

    // Identity-stable nav source — same instances the doc routes use, so the
    // nav-tree fast-path applies here too (#1902).
    const { docs: allDocs, navDocs, categoryMeta } = resolveNavSource(
      locale,
      undefined,
      { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true },
    );
    const tree = buildNavTree(navDocs, locale, categoryMeta);

    for (const doc of allDocs) {
      if (doc.data.category_no_page === true) continue;
      urls.push(docsUrl(doc.data.slug ?? toRouteSlug(doc.id), locale));
    }
    for (const node of collectAutoIndexNodes(tree)) {
      urls.push(docsUrl(node.slug, locale));
    }

    return [...new Set(urls)];
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

    const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));

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
        const slug = doc.data.slug ?? toRouteSlug(doc.id);
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
        const slug = doc.data.slug ?? toRouteSlug(doc.id);
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

  function enumerateAllRoutes(): Map<string, string> {
    const today = new Date().toISOString().split("T")[0] ?? "";
    const routes = new Map<string, string>();
    const localeKeys = getLocaleKeys();
    const versions = getVersions();

    function add(url: string): void {
      if (!routes.has(url)) {
        routes.set(url, today);
      }
    }

    // Site root
    add(withBase("/"));

    // Default locale docs
    for (const url of enumerateDocsRoutes(defaultLocale)) {
      add(url);
    }

    // Default locale tags
    for (const url of enumerateTagsRoutes(defaultLocale)) {
      add(url);
    }

    // Non-default locales
    for (const locale of localeKeys) {
      add(withBase(`/${locale}`));

      for (const url of enumerateDocsRoutes(locale)) {
        add(url);
      }

      for (const url of enumerateTagsRoutes(locale)) {
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

  return {
    enumerateDocsRoutes,
    enumerateTagsRoutes,
    enumerateVersionedRoutes,
    enumerateAllRoutes,
  };
}
