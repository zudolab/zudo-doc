// Test fixture — a minimal-but-complete fake `ChromeContext` for the factory
// unit tests (epic Collapse Wiring Shells #2420, FACTORIES #2424).
//
// The public factories now DERIVE their bag from the unified `ChromeContext`
// and rebuild their chrome sub-tree from it, so a factory test must hand them a
// context shaped like the one `createRouteContext` + `createChrome` produce:
// `settings` + every reconstructed callable + `components` allowlist +
// `hostBindings`. Every callable here is a safe stub (empty arrays / maps /
// undefined) so factory CONSTRUCTION and vnode building never throw; the bodies
// of the rebuilt chrome components are not invoked by these tests (they are JSX
// element types until rendered).

import type { ChromeContext } from "../../factory-context/index.js";

/** A broad fake settings object (cast to the package `Settings`). Carries every
 *  field read at factory construction time or in the page-view bodies. */
function makeFakeSettings(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    siteName: "Test Site",
    base: "/",
    docsDir: "src/content/docs",
    defaultLocale: "en",
    locales: {},
    versions: false,
    docTags: true,
    noindex: false,
    dynamicPageTransition: false,
    sidebarToggle: false,
    sidebarResizer: false,
    colorScheme: "default",
    colorMode: null,
    headerNav: [],
    headerRightItems: [],
    githubUrl: false,
    htmlPreview: null,
    docMetainfo: true,
    docHistory: true,
    bodyFootUtilArea: false,
    frontmatterPreview: true,
    tagVocabulary: false,
    tagGovernance: "off",
    aiAssistant: false,
    imageEnlarge: false,
    mermaid: false,
    designTokenPanel: false,
    metaTags: { description: true },
    footer: false,
    ...overrides,
  };
}

const EMPTY_NAV_SOURCE = {
  docs: [],
  navDocs: [],
  categoryMeta: new Map(),
  localeSlugSet: new Set<string>(),
};

export interface FakeChromeContextOptions {
  /** Per-collection docs returned by `stableDocs` (key = collection name). */
  collections?: Record<string, unknown[]>;
  /** `collectTags` implementation (defaults to an empty map). */
  collectTags?: ChromeContext["collectTags"];
  /** Settings field overrides. */
  settings?: Record<string, unknown>;
  /** Any direct ChromeContext field overrides (callables, hostBindings, …). */
  overrides?: Partial<ChromeContext>;
}

/**
 * Build a fake `ChromeContext` for factory unit tests. All callables are safe
 * stubs; `hostBindings` and `components` default to `{}` so the factories fall
 * back to their package stub defaults.
 */
export function makeFakeChromeContext(opts: FakeChromeContextOptions = {}): ChromeContext {
  const settings = makeFakeSettings(opts.settings);
  const collections = opts.collections ?? {};

  const ctx = {
    settings,
    colorSchemes: null,
    i18n: { defaultLocale: "en", locales: ["en"], getLocaleLabel: (l: string) => l.toUpperCase() },
    defaultLocale: "en",
    locales: ["en"],
    getLocaleConfig: () => undefined,
    getLocaleLabel: (l: string) => l.toUpperCase(),
    t: (key: string) => key,
    urlHelpers: {},
    withBase: (p: string) => p,
    stripBase: (p: string) => p,
    docsUrl: (slug: string, lang?: string) => `/${lang ?? "en"}/docs/${slug}`,
    versionedDocsUrl: (slug: string, v: string, lang?: string) =>
      `/v/${v}/${lang ?? "en"}/docs/${slug}`,
    navHref: (path: string) => path,
    isDefaultLocaleOnlyPath: () => false,
    absoluteUrl: () => undefined,
    isExternal: (href: string) => /^https?:\/\//.test(href),
    resolveHref: (href: string) => href,
    buildLocaleLinks: () => undefined,
    getCategoryOrder: () => [],
    getNavSectionForSlug: () => undefined,
    getNavSubtree: (tree: unknown) => tree,
    extractHeadings: () => [],
    resolveTagBound: (raw: string) => ({ canonical: raw, known: false }),
    collectTags: opts.collectTags ?? (() => new Map()),
    // nav-source API
    resolveNavSource: () => EMPTY_NAV_SOURCE,
    resolveVersionedLocaleSource: () => EMPTY_NAV_SOURCE,
    loadNavSourceDocs: () => EMPTY_NAV_SOURCE,
    stableMergeCategoryMeta: () => new Map(),
    stableNavDocs: (docs: unknown) => docs,
    // doc-route-entries API
    buildDocRouteEntries: () => [],
    // route-enumerators API
    enumerateDocsRoutes: () => [],
    enumerateTagsRoutes: () => [],
    enumerateVersionedRoutes: () => [],
    enumerateAllRoutes: () => new Map(),
    // pure nav/slug helpers
    buildNavTree: () => [],
    groupSatelliteNodes: (tree: unknown) => tree,
    findNode: () => undefined,
    firstRoutedHref: () => undefined,
    collectAutoIndexNodes: () => [],
    isNavVisible: () => true,
    stableDocs: (collectionName: string) => collections[collectionName] ?? [],
    toRouteSlug: (id: string) => id,
    toSlugParams: (slug: string) => (slug === "" ? [] : slug.split("/")),
    // ChromeContext extras
    components: {},
    hostBindings: {},
    ...opts.overrides,
  };

  return ctx as unknown as ChromeContext;
}
