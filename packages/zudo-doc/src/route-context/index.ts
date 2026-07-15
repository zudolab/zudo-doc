// route-context — public `createRouteContext(payload)` builder (epic Collapse
// Wiring Shells #2420, CTX #2423; promoted from `routes/_context.ts`).
//
// Rebuilds the FULL runtime route context from the SERIALIZABLE payload
// (`settings`, `translations`, `tagVocabulary`, `colorSchemes`) by calling the
// already-importable package factories — never raw host functions, never `@/`
// aliases. The package route entrypoints reach this through the thin
// `routes/_context.ts` shim (which feeds it the `virtual:zudo-doc-route-context`
// payload and re-exports the named bindings); the host (HOSTCOLLAPSE wave) will
// call it directly with its own serializable payload + content bridge.
//
// PURE FUNCTION — it takes the payload as an argument (it does NOT import the
// virtual module) and takes the content-bridge handle as an optional parameter
// whose default is the package `stableDocs` (reads `@takazudo/zfb/content`).
// This builder is NOT in the preset eval graph (preset.ts does not import it),
// so its `@takazudo/zfb/content` dependency never touches the node-free config
// surface guarded by the preset eval-graph test.

import type {
  RouteContext,
  RouteContextPayload,
  TagInfo,
  FactoryI18n,
} from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { makeUrlHelpers } from "../url-helpers/index.js";
import { loadCategoryMeta, type CategoryMeta } from "../sidebar-tree/index.js";
import { extractHeadings as extractHeadingsBase } from "../extract-headings/index.js";
import { toRouteSlug, toSlugParams } from "../slug/index.js";
import { resolveTag } from "../tag-helpers/index.js";
import type { TagVocabularyEntry } from "../settings.js";
import {
  getCategoryOrder as getCategoryOrderBase,
  getNavSectionForSlug as getNavSectionForSlugBase,
  getNavSubtree as getNavSubtreeBase,
} from "../nav-scope/index.js";
import { mergeLocaleDocs } from "../locale-merge/index.js";
import {
  createNavSourceDocs,
  type NavSourceDocsContext,
} from "../nav-source-docs/index.js";
import {
  createDocRouteEntries,
  type DocRouteEntriesContext,
} from "../doc-route-entries/index.js";
import {
  createRouteEnumerators,
  type RouteEnumeratorsContext,
  type DocsEntryForTags,
  type TagInfoForEnum,
} from "../route-enumerators/index.js";
import type { DocNavNode, DocPageEntry } from "../doc-page-props/index.js";
import type { HeadingItem } from "../extract-headings/index.js";
import {
  stableDocs as defaultStableDocs,
  isNavVisible,
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  groupSatelliteNodes,
  findNode,
  firstRoutedHref,
} from "../routes/_docs-helpers.js";

export type {
  RouteContext,
  RouteContextPayload,
  TagInfo,
} from "../factory-context/index.js";

/** A content-bridge handle: identity-stable, draft-filtered docs loader. */
export type ContentBridge = (collectionName: string) => DocPageEntry[];

export interface CreateRouteContextOptions {
  /**
   * The content-bridge handle (`stableDocs`). Default: the package
   * `stableDocs` from `routes/_docs-helpers` (reads `@takazudo/zfb/content`,
   * snapshot-anchored for per-build identity stability). The host may inject
   * its own content loader here.
   */
  stableDocs?: ContentBridge;
}

// Local alias so the `mergeLocaleDocs` cast below reads clearly.
type RouteEnumeratorsAPIDeps = Parameters<typeof createRouteEnumerators>[0];

/**
 * Reconstruct the full runtime route context from the serializable payload.
 * Called ONCE per build (the route entrypoints share the returned singleton via
 * the `routes/_context.ts` module), so the memoized closures inside
 * (`createNavSourceDocs` / `createDocRouteEntries` / `createRouteEnumerators`)
 * and the snapshot-anchored `stableDocs` keep array identity stable across all
 * routes.
 */
export function createRouteContext<S extends Settings = Settings>(
  payload: RouteContextPayload<S>,
  options: CreateRouteContextOptions = {},
): RouteContext<S> {
  const settings = payload.settings;
  const translations = payload.translations;
  const tagVocabulary = payload.tagVocabulary;
  const colorSchemes = payload.colorSchemes;
  const stableDocs: ContentBridge = options.stableDocs ?? defaultStableDocs;

  // ── i18n ────────────────────────────────────────────────────────────────
  const defaultLocale: string = settings.defaultLocale;
  const locales: readonly string[] = [
    defaultLocale,
    ...Object.keys(settings.locales),
  ];

  function getLocaleConfig(
    locale: string,
  ): { label: string; dir: string } | undefined {
    return (
      settings.locales as Record<string, { label: string; dir: string } | undefined>
    )[locale];
  }

  function getLocaleLabel(locale: string): string {
    if (locale === defaultLocale) return defaultLocale.toUpperCase();
    return getLocaleConfig(locale)?.label ?? locale.toUpperCase();
  }

  function t(key: string, locale: string = defaultLocale): string {
    return (
      translations[locale]?.[key] ?? translations[defaultLocale]?.[key] ?? key
    );
  }

  const i18n: FactoryI18n = { defaultLocale, locales, getLocaleLabel, t };

  // ── URL helpers ───────────────────────────────────────────────────────────
  const urlHelpers = makeUrlHelpers(settings, i18n);
  const { withBase, docsUrl, versionedDocsUrl, navHref, isDefaultLocaleOnlyPath } =
    urlHelpers;

  // ── nav-scope (parameterized by settings.headerNav) ──────────────────────
  function getCategoryOrder(): string[] {
    return getCategoryOrderBase(settings.headerNav);
  }
  function getNavSectionForSlug(slug: string): string | undefined {
    return getNavSectionForSlugBase(slug, settings.headerNav);
  }
  function getNavSubtree(
    tree: DocNavNode[],
    categoryMatch?: string,
  ): DocNavNode[] {
    return getNavSubtreeBase(tree, categoryMatch, settings.headerNav);
  }

  // ── extract-headings (bound to the settings depth window) ────────────────
  function extractHeadings(body: string): HeadingItem[] {
    return extractHeadingsBase(body, {
      tocMinDepth: settings.tocMinDepth,
      tocMaxDepth: settings.tocMaxDepth,
    });
  }

  // ── tag-helpers (collectTags reconstructed from vocabulary + governance) ──
  function getVocab(): readonly TagVocabularyEntry[] | false {
    return settings.tagVocabulary ? tagVocabulary : false;
  }

  function resolveTagBound(raw: string) {
    return resolveTag(raw, getVocab(), settings.tagGovernance);
  }

  function collectTags(
    entries: ReadonlyArray<{
      id: string;
      data: { slug?: string; title?: string; description?: string; tags?: string[] };
    }>,
    slugFn: (id: string, data: { slug?: string }) => string,
  ): Map<string, TagInfo> {
    const tagMap = new Map<string, TagInfo>();
    for (const entry of entries) {
      const rawTags = entry.data.tags ?? [];
      const slug = slugFn(entry.id, entry.data);
      const seen = new Set<string>();
      for (const raw of rawTags) {
        const resolved = resolveTagBound(raw);
        if (resolved.deprecated) continue;
        if (seen.has(resolved.canonical)) continue;
        seen.add(resolved.canonical);
        if (!tagMap.has(resolved.canonical)) {
          tagMap.set(resolved.canonical, {
            tag: resolved.canonical,
            count: 0,
            docs: [],
          });
        }
        const info = tagMap.get(resolved.canonical)!;
        info.count++;
        info.docs.push({
          slug,
          title: entry.data.title ?? "",
          description: entry.data.description,
        });
      }
    }
    return tagMap;
  }

  // ── Base context ──────────────────────────────────────────────────────────
  // The unified context the data factories now DERIVE their bag from (FACTORIES
  // #2424). It carries settings + i18n + URL helpers + the pure nav/slug helpers
  // — everything the three data factories read EXCEPT the nav-source resolvers,
  // which are assembled onto it before the route enumerators run. The factory
  // results are then spread onto this same object so the returned RouteContext
  // is byte-for-byte the previous shape (same function instances, same memo
  // closures, same array identities).
  const base = {
    settings,
    colorSchemes,
    i18n,
    defaultLocale,
    locales,
    getLocaleConfig,
    getLocaleLabel,
    t,
    urlHelpers,
    ...urlHelpers,
    getCategoryOrder,
    getNavSectionForSlug,
    getNavSubtree,
    extractHeadings,
    resolveTagBound,
    collectTags,
    buildNavTree,
    groupSatelliteNodes,
    findNode,
    firstRoutedHref,
    collectAutoIndexNodes,
    isNavVisible,
    stableDocs,
    toRouteSlug,
    toSlugParams,
  };

  // ── nav-source resolver ───────────────────────────────────────────────────
  // Derives docsDir/getVersions off settings + imports loadCategoryMeta itself.
  const navSourceDocs = createNavSourceDocs(base as unknown as NavSourceDocsContext);

  // ── doc-route-entries ─────────────────────────────────────────────────────
  // Binds the 4-arg buildNavTree → docsUrl + the package buildBreadcrumbs itself.
  const docRouteEntries = createDocRouteEntries(base as unknown as DocRouteEntriesContext);

  // ── route-enumerators ─────────────────────────────────────────────────────
  // Needs the nav-source resolvers, so it sees the context WITH them assembled.
  const baseWithNav = { ...base, ...navSourceDocs };
  const routeEnumerators = createRouteEnumerators(
    baseWithNav as unknown as RouteEnumeratorsContext,
  );

  return {
    ...baseWithNav,
    ...docRouteEntries,
    ...routeEnumerators,
  } as unknown as RouteContext<S>;
}
