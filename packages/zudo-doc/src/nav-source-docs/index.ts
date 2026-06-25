// nav-source-docs — identity-stable nav-source resolver factory (epic #2344, S6).
//
// Moved from the showcase's `pages/lib/_nav-source-docs.ts` into the shared
// package. Previously this imported host singletons (`@/config/settings`,
// `@/config/i18n`, `@/utils/docs`) directly — imports that would not resolve
// in downstream consumers. The package version accepts all host-specific
// dependencies as injected context via `createNavSourceDocs(ctx)`.
//
// IDENTITY STABILITY (why this is not a thin wrapper)
// ---------------------------------------------------
// Every returned `docs` / `navDocs` array and `categoryMeta` Map is memoized
// so repeat callers within one build get the SAME instances. That is what lets
// `buildNavTree`'s identity fast-path skip the O(n log n) key computation on
// the ~900 calls a 251-page build makes. See nav-source-cache for the
// snapshot-anchored memo and the original-issue trace (zudolab/zudo-doc#1902
// / #1882).
//
// FACTORY PATTERN: `createNavSourceDocs(ctx)` returns the resolver functions.
// The host stub calls this once with its concrete singletons and re-exports
// the result.

import type { CategoryMeta } from "../sidebar-tree/index.js";
import type { DocPageEntry } from "../doc-page-props/index.js";
import { memoizeDerived } from "../nav-source-cache/index.js";
import { mergeLocaleDocs } from "../locale-merge/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { CategoryMeta, DocPageEntry };

export interface NavSourceDocs {
  /** Full doc list (merged + draft-filtered; unlisted retained per options). */
  docs: DocPageEntry[];
  /** `docs.filter(isNavVisible)` — stable instance for buildNavTree. */
  navDocs: DocPageEntry[];
  /** Stable category-meta Map for the active (locale, version). */
  categoryMeta: Map<string, CategoryMeta>;
  /** Slugs that came from the locale collection (for isFallback). Empty for
   *  default-locale / single-collection cases. */
  localeSlugSet: ReadonlySet<string>;
}

/**
 * How to filter the merged doc list.
 */
export interface NavSourceOptions {
  /** Drop base docs matching `defaultLocaleOnlyPrefixes` (route/sidebar nav). */
  applyDefaultLocaleOnlyFilter?: boolean;
  /** Retain `unlisted: true` docs (route enumeration + nav). */
  keepUnlisted?: boolean;
}

// ---------------------------------------------------------------------------
// Injected context for createNavSourceDocs
// ---------------------------------------------------------------------------

/**
 * Optional locale config returned by `getLocaleConfig(lang)`.
 * Structural interface so the package does not import the host's concrete type.
 */
export interface LocaleConfig {
  /** Content directory path for this locale. */
  dir?: string;
}

/**
 * Optional version config entry from `settings.versions`.
 * Structural interface for the package.
 */
export interface VersionConfigEntry {
  slug: string;
  docsDir?: string;
  locales?: Record<string, { dir?: string }>;
}

/**
 * Injected context for `createNavSourceDocs`.
 *
 * All host-specific singletons are passed in so the package factory never
 * imports `@/` aliases. The host stub calls `createNavSourceDocs(ctx)` once
 * and re-exports the returned resolver functions.
 */
export interface NavSourceDocsContext {
  /**
   * Default locale code (served from the un-prefixed `/docs/...` routes).
   * E.g. `"en"`.
   */
  defaultLocale: string;
  /**
   * The configured docs content directory (e.g. `"src/content/docs"`).
   * Used as the base dir for `loadCategoryMeta`.
   */
  docsDir: string;
  /**
   * Getter for the configured versions list (or false if versioning is not
   * active). Called on every `resolveNavSource` invocation so test code that
   * mutates `settings.versions` between calls sees the updated value.
   * Structural equivalent of a getter for `settings.versions`.
   *
   * Pass `() => settings.versions` from the host stub.
   */
  getVersions: () => VersionConfigEntry[] | false | undefined;
  /**
   * Look up locale-specific config (dir, etc.) for a locale code.
   * Host passes `getLocaleConfig` from `@/config/i18n`.
   */
  getLocaleConfig: (lang: string) => LocaleConfig | undefined;
  /**
   * Load category metadata for a content dir.
   * Host passes `loadCategoryMeta` from `@/utils/docs` (re-exported from
   * `@takazudo/zudo-doc/sidebar-tree`).
   */
  loadCategoryMeta: (dir: string) => Map<string, CategoryMeta>;
  /**
   * Filter predicate: true when a doc should appear in navigation.
   * Host passes `isNavVisible` from `@/utils/docs`.
   */
  isNavVisible: (doc: DocPageEntry) => boolean;
  /**
   * Returns true for paths that are only shown in the default locale.
   * Host passes `isDefaultLocaleOnlyPath` from `@/utils/base`.
   */
  isDefaultLocaleOnlyPath: (path: string) => boolean;
  /**
   * Identity-stable, draft-filtered docs array for a collection.
   * Host passes `stableDocs` from `pages/lib/_nav-source-cache.ts`.
   * The function must anchor memoization on the zfb snapshot so the SAME
   * array instance is returned on every call within one build.
   */
  stableDocs: (collectionName: string) => DocPageEntry[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function optionSig(o: NavSourceOptions): string {
  return `dlo=${o.applyDefaultLocaleOnlyFilter ? 1 : 0};ku=${o.keepUnlisted ? 1 : 0}`;
}

const EMPTY_SLUG_SET: ReadonlySet<string> = new Set();

// ---------------------------------------------------------------------------
// NavSourceDocs factory
// ---------------------------------------------------------------------------

/**
 * Result of `createNavSourceDocs`. Contains the resolver functions bound to
 * the injected context.
 */
export interface NavSourceDocsAPI {
  /**
   * Identity-stable nav source for an EN/locale (optionally versioned) context.
   * Every field is memoized so repeated calls with the same logical inputs
   * return the same instances.
   */
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: NavSourceOptions,
  ) => NavSourceDocs;

  /**
   * Identity-stable nav source for a versioned non-default-locale context —
   * locale-specific version collection over the version's EN base.
   */
  resolveVersionedLocaleSource: (
    versionSlug: string,
    versionDocsDir: string | undefined,
    lang: string,
    localeDir: string | undefined,
    options?: NavSourceOptions,
  ) => NavSourceDocs;

  /**
   * Per-page nav source for the desktop sidebar and mobile SidebarToggle.
   *
   * Thin adapter over `resolveNavSource` with the sidebar's filter options
   * (`applyDefaultLocaleOnlyFilter`, `keepUnlisted`). Returns `navDocs`
   * already filtered so callers pass it straight to `buildSidebarForSection`
   * without a fresh `.filter(isNavVisible)` that would defeat the nav-tree
   * fast-path.
   */
  loadNavSourceDocs: (
    lang: string,
    currentVersion: string | undefined,
  ) => NavSourceDocs;

  /**
   * Merge category metadata for two dirs (base + locale). Result is stable per
   * (baseDir, localeDir) pair within a build.
   */
  stableMergeCategoryMeta: (
    baseDir: string,
    localeDir: string,
  ) => Map<string, CategoryMeta>;

  /**
   * `docs.filter(isNavVisible)`, memoized on the stable `docs` identity so the
   * filtered array also has stable identity for the nav-tree fast-path.
   */
  stableNavDocs: <T extends DocPageEntry>(docs: T[]) => T[];
}

/**
 * Create the identity-stable nav-source resolver functions bound to the host's
 * injected context. Call this once from the host stub with the concrete
 * singletons; re-export the returned functions.
 *
 * @example
 * ```ts
 * // pages/lib/_nav-source-docs.ts (thin stub)
 * import { createNavSourceDocs } from "@takazudo/zudo-doc/nav-source-docs";
 * import { settings } from "@/config/settings";
 * import { defaultLocale, getLocaleConfig } from "@/config/i18n";
 * import { loadCategoryMeta, isNavVisible } from "@/utils/docs";
 * import { isDefaultLocaleOnlyPath } from "@/utils/base";
 * import { stableDocs } from "./_nav-source-cache";
 *
 * export const {
 *   resolveNavSource,
 *   resolveVersionedLocaleSource,
 *   loadNavSourceDocs,
 *   stableMergeCategoryMeta,
 *   stableNavDocs,
 * } = createNavSourceDocs({
 *   defaultLocale,
 *   docsDir: settings.docsDir,
 *   getVersions: () => settings.versions,
 *   getLocaleConfig,
 *   loadCategoryMeta,
 *   isNavVisible,
 *   isDefaultLocaleOnlyPath,
 *   stableDocs,
 * });
 * ```
 */
export function createNavSourceDocs(ctx: NavSourceDocsContext): NavSourceDocsAPI {
  const {
    defaultLocale,
    docsDir,
    getVersions,
    getLocaleConfig,
    loadCategoryMeta,
    isNavVisible,
    isDefaultLocaleOnlyPath,
    stableDocs,
  } = ctx;

  // ---------------------------------------------------------------------------
  // Stable category-meta merge
  // ---------------------------------------------------------------------------

  const mergedCategoryMetaCache = new Map<string, Map<string, CategoryMeta>>();

  function stableMergeCategoryMeta(
    baseDir: string,
    localeDir: string,
  ): Map<string, CategoryMeta> {
    const key = `${baseDir}\n${localeDir}`;
    const cached = mergedCategoryMetaCache.get(key);
    if (cached) return cached;
    const merged = new Map<string, CategoryMeta>([
      ...loadCategoryMeta(baseDir),
      ...loadCategoryMeta(localeDir),
    ]);
    mergedCategoryMetaCache.set(key, merged);
    return merged;
  }

  // ---------------------------------------------------------------------------
  // Stable navDocs (isNavVisible filter)
  // ---------------------------------------------------------------------------

  function stableNavDocs<T extends DocPageEntry>(docs: T[]): T[] {
    return memoizeDerived([docs], "navVisible", () =>
      docs.filter(isNavVisible),
    ) as T[];
  }

  // Shared empty array for the "no locale collection" branch — stable identity
  // keeps the merge memo consistent.
  const EMPTY_DOCS: DocPageEntry[] = [];

  // ---------------------------------------------------------------------------
  // resolveVersionedLocaleSource
  // ---------------------------------------------------------------------------

  function resolveVersionedLocaleSource(
    versionSlug: string,
    versionDocsDir: string | undefined,
    lang: string,
    localeDir: string | undefined,
    options: NavSourceOptions = {},
  ): NavSourceDocs {
    const sig = optionSig(options);
    const baseDocs = stableDocs(`docs-v-${versionSlug}`);
    const localeDocs = localeDir
      ? stableDocs(`docs-v-${versionSlug}-${lang}`)
      : EMPTY_DOCS;

    const merged = memoizeDerived(
      localeDir ? [baseDocs, localeDocs] : [baseDocs],
      `vmerge;${lang};${sig}`,
      () =>
        mergeLocaleDocs({
          baseDocs,
          localeDocs,
          applyDefaultLocaleOnlyFilter: options.applyDefaultLocaleOnlyFilter,
          keepUnlisted: options.keepUnlisted,
          isDefaultLocaleOnlyPath,
        }),
    );
    const docs = merged.docs;

    const resolvedVersionDocsDir = versionDocsDir ?? docsDir;
    const categoryMeta = localeDir
      ? stableMergeCategoryMeta(resolvedVersionDocsDir, localeDir)
      : loadCategoryMeta(resolvedVersionDocsDir);
    const navDocs = stableNavDocs(docs);

    return { docs, navDocs, categoryMeta, localeSlugSet: merged.localeSlugSet };
  }

  // ---------------------------------------------------------------------------
  // resolveNavSource
  // ---------------------------------------------------------------------------

  function resolveNavSource(
    lang: string,
    currentVersion: string | undefined,
    options: NavSourceOptions = {},
  ): NavSourceDocs {
    const sig = optionSig(options);

    // --- Versioned.
    if (currentVersion) {
      const versions = getVersions();
      const versionConfig = Array.isArray(versions)
        ? versions.find((v) => v.slug === currentVersion)
        : undefined;
      const localeDir = versionConfig?.locales?.[lang]?.dir;
      if (lang !== defaultLocale && localeDir) {
        return resolveVersionedLocaleSource(
          currentVersion,
          versionConfig?.docsDir,
          lang,
          localeDir,
          options,
        );
      }
      const docs = stableDocs(`docs-v-${currentVersion}`);
      const categoryMeta = loadCategoryMeta(
        versionConfig?.docsDir ?? docsDir,
      );
      const navDocs = stableNavDocs(docs);
      return { docs, navDocs, categoryMeta, localeSlugSet: EMPTY_SLUG_SET };
    }

    // --- Default locale: the "docs" collection directly.
    if (lang === defaultLocale) {
      const docs = stableDocs("docs");
      const categoryMeta = loadCategoryMeta(docsDir);
      const navDocs = stableNavDocs(docs);
      return { docs, navDocs, categoryMeta, localeSlugSet: EMPTY_SLUG_SET };
    }

    // --- Non-default locale: locale-first merge with EN fallback.
    const baseDocs = stableDocs("docs");
    const localeDocs = stableDocs(`docs-${lang}`);

    const merged = memoizeDerived(
      [baseDocs, localeDocs],
      `merge;${sig}`,
      () =>
        mergeLocaleDocs({
          baseDocs,
          localeDocs,
          applyDefaultLocaleOnlyFilter: options.applyDefaultLocaleOnlyFilter,
          keepUnlisted: options.keepUnlisted,
          isDefaultLocaleOnlyPath,
        }),
    );
    const docs = merged.docs;

    const localeDir = getLocaleConfig(lang)?.dir ?? docsDir;
    const categoryMeta = stableMergeCategoryMeta(docsDir, localeDir);
    const navDocs = stableNavDocs(docs);

    return { docs, navDocs, categoryMeta, localeSlugSet: merged.localeSlugSet };
  }

  // ---------------------------------------------------------------------------
  // loadNavSourceDocs
  // ---------------------------------------------------------------------------

  function loadNavSourceDocs(
    lang: string,
    currentVersion: string | undefined,
  ): NavSourceDocs {
    return resolveNavSource(lang, currentVersion, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
  }

  return {
    resolveNavSource,
    resolveVersionedLocaleSource,
    loadNavSourceDocs,
    stableMergeCategoryMeta,
    stableNavDocs,
  };
}
