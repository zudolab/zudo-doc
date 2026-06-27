// routes/_context — the route-context reconstruction seam (epic Package-First
// Finale #2356, A1 #2361; ADR docs/adr/route-injection-seam.md, Decision 1).
//
// Every package route entrypoint imports `{ routeContext }` from the virtual
// module `virtual:zudo-doc-route-context` (SERIALIZABLE DATA ONLY: `settings`,
// `translations`, `tagVocabulary`) and rebuilds the full injected context by
// calling the ALREADY-EXISTING package factories with importable package
// subpaths — never raw host functions, never `@/` aliases. This module does
// that reconstruction ONCE and exposes the wired runtime context so each
// entrypoint stays a thin `paths()` + default-export shell (mirroring the kept
// `pages/*.tsx` stubs).
//
// The host-dep → package-subpath map this wires (ADR table):
//   buildNavTree/collectAutoIndexNodes/groupSatelliteNodes/isNavVisible/
//     findNode/firstRoutedHref/buildBreadcrumbs ... ./routes/_docs-helpers
//     (the package `docs` helpers, on `@takazudo/zudo-doc/sidebar-tree`)
//   loadCategoryMeta ........................... @takazudo/zudo-doc/sidebar-tree
//   extractHeadings ............................ @takazudo/zudo-doc/extract-headings
//   toRouteSlug/toSlugParams/toTitleCase/toHistorySlug ... @takazudo/zudo-doc/slug
//   resolveTag / collectTags ................... @takazudo/zudo-doc/tag-helpers
//   getNavSectionForSlug/getNavSubtree/getCategoryOrder .. @takazudo/zudo-doc/nav-scope
//   url helpers ................................ @takazudo/zudo-doc/url-helpers
//   mergeLocaleDocs ............................ @takazudo/zudo-doc/locale-merge
//   stableDocs (content bridge) ................ ./routes/_docs-helpers (zfb/content)
//   resolveNavSource/… ......................... @takazudo/zudo-doc/nav-source-docs
//   buildDocRouteEntries ....................... @takazudo/zudo-doc/doc-route-entries
//   route enumeration .......................... @takazudo/zudo-doc/route-enumerators
//   i18n (t/getLocaleLabel/defaultLocale/locales) reconstructed from settings +
//     translations as a FactoryI18n.

// Virtual module, resolved by the routes plugin at build via
// addVirtualModule("virtual:zudo-doc-route-context", …). Not present on disk;
// the package ships ambient typings for it (routes/_virtual.d.ts).
import { routeContext } from "virtual:zudo-doc-route-context";

import type { Settings } from "../settings.js";
import type { ColorScheme } from "../color-scheme-utils.js";
import type { FactoryI18n } from "../factory-context/index.js";
import { makeUrlHelpers, type UrlHelpers } from "../url-helpers/index.js";
import {
  loadCategoryMeta,
  type CategoryMeta,
} from "../sidebar-tree/index.js";
import { extractHeadings as extractHeadingsBase } from "../extract-headings/index.js";
import { toRouteSlug, toSlugParams } from "../slug/index.js";
import { resolveTag, type TagVocabularyEntry } from "../tag-helpers/index.js";
import {
  getCategoryOrder as getCategoryOrderBase,
  getNavSectionForSlug as getNavSectionForSlugBase,
  getNavSubtree as getNavSubtreeBase,
} from "../nav-scope/index.js";
import { mergeLocaleDocs } from "../locale-merge/index.js";
import {
  createNavSourceDocs,
  type NavSourceDocsAPI,
} from "../nav-source-docs/index.js";
import {
  createDocRouteEntries,
  type DocRouteEntriesAPI,
} from "../doc-route-entries/index.js";
import {
  createRouteEnumerators,
  type RouteEnumeratorsAPI,
  type DocsEntryForTags,
  type TagInfoForEnum,
} from "../route-enumerators/index.js";
import type { DocNavNode, DocPageEntry } from "../doc-page-props/index.js";
import type { HeadingItem } from "../extract-headings/index.js";
import {
  stableDocs,
  isNavVisible,
  buildNavTree,
  buildBreadcrumbs,
  collectAutoIndexNodes,
  groupSatelliteNodes,
  findNode,
  firstRoutedHref,
} from "./_docs-helpers.js";

// ---------------------------------------------------------------------------
// The serializable route-context payload (re-exported for entrypoints).
// ---------------------------------------------------------------------------

export interface RouteContextPayload {
  settings: Settings;
  translations: Record<string, Record<string, string>>;
  tagVocabulary: readonly TagVocabularyEntry[];
  colorSchemes: Record<string, ColorScheme> | null;
}

/** The serializable route-context (from the virtual module). */
export const ctx = routeContext as unknown as RouteContextPayload;
export const settings: Settings = ctx.settings;
const translations = ctx.translations;
const tagVocabulary = ctx.tagVocabulary;
/** Host color-scheme palette map. `null` when not supplied — `_chrome.tsx`
 *  falls back to `DEFAULT_SCHEME` in that case. */
export const colorSchemes: Record<string, ColorScheme> | null = ctx.colorSchemes;

// ---------------------------------------------------------------------------
// i18n — reconstruct a FactoryI18n from settings + translations (Decision 1).
// ---------------------------------------------------------------------------

export const defaultLocale: string = settings.defaultLocale;
export const locales: readonly string[] = [
  defaultLocale,
  ...Object.keys(settings.locales),
];

export function getLocaleConfig(locale: string): { label: string; dir: string } | undefined {
  return (settings.locales as Record<string, { label: string; dir: string } | undefined>)[locale];
}

export function getLocaleLabel(locale: string): string {
  if (locale === defaultLocale) return defaultLocale.toUpperCase();
  return getLocaleConfig(locale)?.label ?? locale.toUpperCase();
}

export function t(key: string, locale: string = defaultLocale): string {
  return translations[locale]?.[key] ?? translations[defaultLocale]?.[key] ?? key;
}

export const i18n: FactoryI18n = {
  defaultLocale,
  locales,
  getLocaleLabel,
  t,
};

// ---------------------------------------------------------------------------
// URL helpers (@takazudo/zudo-doc/url-helpers).
// ---------------------------------------------------------------------------

export const urlHelpers: UrlHelpers = makeUrlHelpers(settings, i18n);
export const {
  withBase,
  stripBase,
  docsUrl,
  versionedDocsUrl,
  navHref,
  isDefaultLocaleOnlyPath,
  absoluteUrl,
  isExternal,
  resolveHref,
  buildLocaleLinks,
} = urlHelpers;

// ---------------------------------------------------------------------------
// nav-scope (@takazudo/zudo-doc/nav-scope) — parameterized by settings.headerNav.
// ---------------------------------------------------------------------------

export function getCategoryOrder(): string[] {
  return getCategoryOrderBase(settings.headerNav);
}
export function getNavSectionForSlug(slug: string): string | undefined {
  return getNavSectionForSlugBase(slug, settings.headerNav);
}
export function getNavSubtree(tree: DocNavNode[], categoryMatch?: string): DocNavNode[] {
  return getNavSubtreeBase(tree, categoryMatch, settings.headerNav);
}

// ---------------------------------------------------------------------------
// extract-headings — bound to settings depth window + id strategy.
// ---------------------------------------------------------------------------

export function extractHeadings(body: string): HeadingItem[] {
  return extractHeadingsBase(body, {
    tocMinDepth: settings.tocMinDepth,
    tocMaxDepth: settings.tocMaxDepth,
    strategy: settings.headingIdStrategy,
  });
}

// ---------------------------------------------------------------------------
// tag-helpers — collectTags reconstructed package-side (the host version lives
// in src/utils/tags.ts because it depends on the host DocsEntry; here it is
// parameterized by the virtual-module tagVocabulary + settings.tagGovernance).
// ---------------------------------------------------------------------------

export interface TagInfo {
  tag: string;
  count: number;
  docs: { slug: string; title: string; description?: string }[];
}

function getVocab(): readonly TagVocabularyEntry[] | false {
  return settings.tagVocabulary ? tagVocabulary : false;
}

export function resolveTagBound(raw: string) {
  return resolveTag(raw, getVocab(), settings.tagGovernance);
}

export function collectTags(
  entries: ReadonlyArray<{ id: string; data: { slug?: string; title?: string; description?: string; tags?: string[] } }>,
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
        tagMap.set(resolved.canonical, { tag: resolved.canonical, count: 0, docs: [] });
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

// ---------------------------------------------------------------------------
// Nav-source resolver (@takazudo/zudo-doc/nav-source-docs).
// ---------------------------------------------------------------------------

const navSourceDocs: NavSourceDocsAPI = createNavSourceDocs({
  defaultLocale,
  docsDir: settings.docsDir,
  getVersions: () => settings.versions,
  getLocaleConfig,
  loadCategoryMeta: loadCategoryMeta as (dir: string) => Map<string, CategoryMeta>,
  isNavVisible,
  isDefaultLocaleOnlyPath,
  stableDocs,
});

export const {
  resolveNavSource,
  resolveVersionedLocaleSource,
  loadNavSourceDocs,
} = navSourceDocs;

// ---------------------------------------------------------------------------
// doc-route-entries (@takazudo/zudo-doc/doc-route-entries).
// ---------------------------------------------------------------------------

const docRouteEntries: DocRouteEntriesAPI = createDocRouteEntries({
  buildNavTree: (docs: DocPageEntry[], locale: string, categoryMeta: Map<string, unknown>) =>
    buildNavTree(
      docs,
      locale,
      categoryMeta as Map<string, CategoryMeta>,
      (slug, loc) => docsUrl(slug, loc),
    ),
  buildBreadcrumbs: (tree: DocNavNode[], slug: string, locale: string, urlFor?: (slug: string) => string) =>
    buildBreadcrumbs(
      tree,
      slug,
      locale === defaultLocale ? withBase("/") : withBase(`/${locale}/`),
      urlFor,
    ),
  collectAutoIndexNodes,
  getNavSectionForSlug,
  getNavSubtree,
  toRouteSlug,
  toSlugParams,
  extractHeadings,
});

export const { buildDocRouteEntries } = docRouteEntries;

// ---------------------------------------------------------------------------
// route-enumerators (@takazudo/zudo-doc/route-enumerators).
// ---------------------------------------------------------------------------

const routeEnumerators: RouteEnumeratorsAPI = createRouteEnumerators({
  defaultLocale,
  getLocaleKeys: () => Object.keys(settings.locales),
  getVersions: () => settings.versions,
  getDocTags: () => settings.docTags,
  docsUrl,
  versionedDocsUrl,
  withBase,
  loadDocs: (collectionName: string) => stableDocs(collectionName) as unknown as DocsEntryForTags[],
  isDefaultLocaleOnlyPath,
  collectTags: (docs: DocsEntryForTags[], slugFn): Map<string, TagInfoForEnum> =>
    collectTags(docs as unknown as Array<{ id: string; data: { slug?: string; title?: string; description?: string; tags?: string[] } }>, slugFn) as unknown as Map<string, TagInfoForEnum>,
  toRouteSlug,
  buildNavTree: (docs: DocPageEntry[], locale: string, categoryMeta: Map<string, unknown>) =>
    buildNavTree(docs, locale, categoryMeta as Map<string, CategoryMeta>, (slug, loc) => docsUrl(slug, loc)),
  collectAutoIndexNodes,
  resolveNavSource,
  resolveVersionedLocaleSource,
  mergeLocaleDocs: mergeLocaleDocs as RouteEnumeratorsAPIDeps["mergeLocaleDocs"],
});

// Local alias so the `mergeLocaleDocs` cast above reads clearly.
type RouteEnumeratorsAPIDeps = Parameters<typeof createRouteEnumerators>[0];

export const {
  enumerateDocsRoutes,
  enumerateTagsRoutes,
  enumerateVersionedRoutes,
  enumerateAllRoutes,
} = routeEnumerators;

// Re-export the pure nav-tree helpers entrypoints reach for directly.
export {
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
