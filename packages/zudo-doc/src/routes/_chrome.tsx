/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// routes/_chrome — package-default chrome wiring for the package-owned page
// route entrypoints (epic Package-First Finale #2356, A1 #2361).
//
// The page routes (index / 404 / docs / versions / tags) render through the
// package's render factories (`doc-page-renderer`, `versions-page`,
// `tag-pages`) + chrome factories (`head/header/footer/sidebar-with-defaults`,
// `doc-page-shell`, …). The HOST stubs (`pages/lib/_*`) wire those factories
// with host singletons AND a handful of host-only bindings the ADR's
// serializable virtual module deliberately does NOT carry:
//
//   - the project `colorSchemes` palette map (HeadWithDefaults CSS generation),
//   - the `sidebars` config (sidebar section resolution),
//   - the `#doc-history-meta` JSON manifest (DocMetainfoArea / DocHistoryArea),
//   - the project `frontmatter-preview-renderers`,
//   - project island bootstraps wired through `BodyEndIslands`.
//
// Those are host-content / project-config bindings, NOT serializable settings,
// so per the ADR (Decision 1: "components are package defaults"; showcase-only
// slots resolve to a package stub) this module supplies PACKAGE DEFAULTS for
// them: an empty default color scheme, an auto-generated (empty) sidebars
// config, an empty doc-history manifest, empty frontmatter renderers, and a
// package no-op `BodyEndIslands` stub. The seam (data-context + paths()
// enumeration) is fully reconstructed in `_context`; the END-TO-END render
// proof of a stub-less injected route — including re-homing these host-only
// bindings — is A2's job (#2363). With `packageOwnedRoutes` off this module is
// never evaluated; it only needs to typecheck and import.

import type { JSX, VNode } from "preact";
import {
  settings,
  defaultLocale,
  locales,
  t,
  withBase,
  stripBase,
  docsUrl,
  versionedDocsUrl,
  absoluteUrl,
  navHref,
  buildLocaleLinks,
  getNavSectionForSlug,
  getCategoryOrder,
  toRouteSlug,
  resolveNavSource,
  loadNavSourceDocs,
  buildNavTree,
  groupSatelliteNodes,
  collectAutoIndexNodes,
  findNode,
  firstRoutedHref,
  collectTags,
  stableDocs,
} from "./_context.js";
import type { CategoryMeta, DocNavNode } from "./_docs-helpers.js";

import { createComposeMetaTitle } from "../compose-meta-title/index.js";
import {
  generateCssCustomProperties,
  generateLightDarkCssProperties,
  type ColorScheme,
} from "../color-scheme-utils.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { createHeaderWithDefaults } from "../header-with-defaults/index.js";
import { createFooterWithDefaults } from "../footer-with-defaults/index.js";
import { createSidebarWithDefaults } from "../sidebar-with-defaults/index.js";
import { createSidebarPrepaint } from "../sidebar-prepaint/index.js";
import { createDocBodyEnd } from "../doc-body-end/index.js";
import { createDocPager } from "../doc-pager/index.js";
import { createDocPageShell } from "../doc-page-shell/index.js";
import { createDocContentHeader } from "../doc-content-header/index.js";
import { createDocMetainfoArea } from "../doc-metainfo-area/index.js";
import { createDocTagsArea } from "../doc-tags-area/index.js";
import { createDocHistoryArea } from "../doc-history-area/index.js";
import { createInlineVersionSwitcher } from "../inline-version-switcher/index.js";
import { createRenderDocPage } from "../doc-page-renderer/index.js";
import { createVersionsPageView } from "../versions-page/index.js";
import { createTagPages } from "../tag-pages/index.js";
import { createMdxComponents } from "../mdx-components/index.js";
import { createCategoryNavWrapper } from "../category-nav/index.js";
import { createCategoryTreeNavWrapper } from "../category-tree-nav/index.js";
import { createSiteTreeNavWrapper } from "../site-tree-nav/index.js";
import { getTocTitle } from "../toc/index.js";
import { SearchWidget } from "../search-widget/index.js";
import { buildGitHubRepoUrl, buildGitHubSourceUrl } from "../github-helpers/index.js";
import { toHistorySlug } from "../slug/index.js";
import {
  buildRootMenuItems as buildRootMenuItemsBase,
  buildLocaleLinksForNav as buildLocaleLinksForNavBase,
  remapVersionedHrefs,
  getThemeDefaultMode as getThemeDefaultModeBase,
} from "../nav-data-prep/index.js";
import { buildSidebarForSection } from "../sidebar-utils/index.js";

// ---------------------------------------------------------------------------
// Package-default host-only bindings (see module header).
// ---------------------------------------------------------------------------

/** Package-default color scheme — a neutral 16-step grey ramp. The project's
 *  real `colorSchemes` palette map is project DATA (not in `settings`), so it
 *  is not in the serializable virtual module; A2 re-homes it for the render
 *  proof. Semantic roles fall back to `SEMANTIC_DEFAULTS`. */
const GREY_RAMP: ColorScheme["palette"] = [
  "#000000", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080",
  "#999999", "#b3b3b3", "#cccccc", "#d9d9d9", "#e6e6e6", "#f2f2f2",
  "#ff5555", "#50fa7b", "#f1fa8c", "#8be9fd",
];
const DEFAULT_SCHEME: ColorScheme = {
  background: "#000000",
  foreground: "#ffffff",
  cursor: "#ffffff",
  selectionBg: "#444444",
  selectionFg: "#ffffff",
  palette: GREY_RAMP,
};

/** Empty doc-history manifest — the real `#doc-history-meta` virtual JSON is
 *  host-bound. With the flag off this is never read. */
const docHistoryMeta: Record<string, never> = {};

/** Empty sidebars config — sidebar sections fall back to the auto-generated
 *  tree. The project `sidebars` config is host-bound (A2). */
const sidebarsConfig: Record<string, never> = {};

/** Package no-op body-end islands. The host's `BodyEndIslands` wires project
 *  island bootstraps (client-router / design-token-panel) that cannot live in
 *  the package; the package default renders nothing. */
function BodyEndIslandsStub(_props: { basePath: string }): JSX.Element {
  return <></>;
}

/** Package no-op DocHistory island stub — renders an empty fragment (the
 *  `DocHistoryComponent` contract requires a VNode, not null). */
function DocHistoryStub(_props: { slug: string; locale?: string; basePath?: string }): VNode {
  return (<></>) as VNode;
}

/** SearchWidget adapter: the package `SearchWidget` requires a `base` prop, but
 *  the `HeaderWithDefaults` dep signature omits it (the host stub injects it).
 *  Inject the base-prefixed search index root here. */
function SearchWidgetBound(props: {
  placeholderText: string;
  shortcutHint: string;
  resultCountTemplate: string;
  searchLabel: string;
  searchUnavailableText: string;
  loadingIndexText: string;
  noResultsText: string;
}): JSX.Element {
  return SearchWidget({ ...props, base: withBase("/") });
}

// ---------------------------------------------------------------------------
// composeMetaTitle + Head.
// ---------------------------------------------------------------------------

export const composeMetaTitle = createComposeMetaTitle(settings.siteName);

export const HeadWithDefaults = createHeadWithDefaults({
  settings,
  composeMetaTitle,
  withBase,
  absoluteUrl,
  generateCssCustomProperties: () => generateCssCustomProperties(DEFAULT_SCHEME),
  generateLightDarkCssProperties: () =>
    generateLightDarkCssProperties(DEFAULT_SCHEME, DEFAULT_SCHEME),
});

// ---------------------------------------------------------------------------
// nav data-prep (bound to settings via _context helpers).
// ---------------------------------------------------------------------------

function buildRootMenuItems(lang: string, currentVersion: string | undefined) {
  return buildRootMenuItemsBase(
    lang,
    currentVersion,
    settings.headerNav,
    (key, l) => t(key, l),
    (path, l, v) => navHref(path, l, v),
  );
}

function buildLocaleLinksForNav(currentPath: string, lang: string, localeCount: number) {
  return buildLocaleLinksForNavBase(currentPath, lang, localeCount, (path, l) =>
    buildLocaleLinks(path, l),
  );
}

function buildSidebarNodes(
  lang: string,
  navSection: string | undefined,
  currentVersion: string | undefined,
  emptyWhenUnsectioned = true,
) {
  if (navSection === undefined && emptyWhenUnsectioned) return [];
  const { navDocs, categoryMeta } = loadNavSourceDocs(lang, currentVersion);
  const explicitPrefixes = getCategoryOrder().filter((cm) => cm !== "!");
  const rawNodes = buildSidebarForSection(
    navDocs,
    lang,
    navSection,
    categoryMeta as unknown as Map<string, CategoryMeta>,
    sidebarsConfig,
    (d, l, meta) =>
      buildNavTree(
        d as never[],
        l,
        meta as Map<string, CategoryMeta> | undefined,
        (slug, loc) => docsUrl(slug, loc),
      ) as never[],
    explicitPrefixes,
  );
  return currentVersion
    ? remapVersionedHrefs(rawNodes, currentVersion, lang, (slug, v, l) =>
        versionedDocsUrl(slug, v, l),
      )
    : rawNodes;
}

function getThemeDefaultMode() {
  return getThemeDefaultModeBase(settings.colorMode);
}

// ---------------------------------------------------------------------------
// Header / Footer / Sidebar.
// ---------------------------------------------------------------------------

export const HeaderWithDefaults = createHeaderWithDefaults({
  settings,
  defaultLocale,
  locales,
  t,
  withBase,
  stripBase,
  docsUrl,
  navHref,
  versionedDocsUrl,
  buildLocaleLinksForNav,
  buildRootMenuItems,
  buildSidebarNodes,
  getThemeDefaultMode,
  buildGitHubRepoUrl: () => buildGitHubRepoUrl(settings.githubUrl),
  SearchWidget: SearchWidgetBound,
});

export const FooterWithDefaults = createFooterWithDefaults({
  settings,
  defaultLocale,
  tagVocabulary: [],
  isExternal: (href: string) => /^https?:\/\//.test(href),
  resolveHref: (href: string) => (/^https?:\/\//.test(href) ? href : withBase(href)),
  withBase,
  // The footer taglist is host-bound (project tag aggregation); package default
  // renders no tag columns.
  loadTagsForLocale: () => [],
});

export const SidebarWithDefaults = createSidebarWithDefaults({
  defaultLocale,
  localeCount: locales.length,
  buildRootMenuItems,
  buildLocaleLinksForNav,
  buildSidebarNodes,
  getThemeDefaultMode,
  t,
});

const SidebarPrepaint = createSidebarPrepaint({ sidebarToggle: settings.sidebarToggle });
const DocBodyEnd = createDocBodyEnd({ settings, BodyEndIslands: BodyEndIslandsStub });
const DocPager = createDocPager({ t });

// ---------------------------------------------------------------------------
// Doc content header / metainfo / tags / history.
// ---------------------------------------------------------------------------

const DocMetainfoArea = createDocMetainfoArea({
  settings,
  defaultLocale,
  docHistoryMeta,
  t,
  toHistorySlug,
});

const DocTagsArea = createDocTagsArea({
  settings,
  defaultLocale,
  tagVocabularyEntries: [],
  tagHref: (tag: string, locale: string) => {
    const encoded = encodeURIComponent(tag);
    return withBase(
      locale === defaultLocale
        ? `/docs/tags/${encoded}`
        : `/${locale}/docs/tags/${encoded}`,
    );
  },
  t,
});

const DocContentHeader = createDocContentHeader({
  t,
  buildFrontmatterPreviewEntries: () => [],
  frontmatterRenderers: {},
  DocMetainfoArea,
  DocTagsArea,
});

const DocHistoryArea = createDocHistoryArea({
  settings,
  defaultLocale,
  docHistoryMeta,
  t,
  toHistorySlug,
  buildGitHubSourceUrl: (contentDir: string, entryId: string) =>
    buildGitHubSourceUrl(settings.githubUrl, contentDir, entryId),
  DocHistory: DocHistoryStub,
});

const buildInlineVersionSwitcher = createInlineVersionSwitcher({
  settings,
  defaultLocale,
  t,
  docsUrl,
  versionedDocsUrl,
  withBase,
});

// ---------------------------------------------------------------------------
// MDX components (locale-bound nav wrappers + package defaults).
// ---------------------------------------------------------------------------

const CategoryNavWrapper = createCategoryNavWrapper({
  defaultLocale,
  resolveNavSource: resolveNavSource as never,
  buildNavTree: ((docs: unknown[], locale: string, categoryMeta: Map<string, unknown>) =>
    buildNavTree(
      docs as never[],
      locale,
      categoryMeta as Map<string, CategoryMeta>,
      (slug, loc) => docsUrl(slug, loc),
    )) as never,
  findNode: findNode as never,
  firstRoutedHref: firstRoutedHref as never,
});

const CategoryTreeNavWrapper = createCategoryTreeNavWrapper({
  defaultLocale,
  resolveNavSource: resolveNavSource as never,
  buildNavTree: ((docs: unknown[], locale: string, categoryMeta: Map<string, unknown>) =>
    buildNavTree(
      docs as never[],
      locale,
      categoryMeta as Map<string, CategoryMeta>,
      (slug, loc) => docsUrl(slug, loc),
    )) as never,
  groupSatelliteNodes: groupSatelliteNodes as never,
  findNode: findNode as never,
});

const SiteTreeNavWrapper = createSiteTreeNavWrapper({
  defaultLocale,
  resolveNavSource: resolveNavSource as never,
  buildNavTree: ((docs: unknown[], locale: string, categoryMeta: Map<string, unknown>) =>
    buildNavTree(
      docs as never[],
      locale,
      categoryMeta as Map<string, CategoryMeta>,
      (slug, loc) => docsUrl(slug, loc),
    )) as never,
  groupSatelliteNodes: groupSatelliteNodes as never,
  getCategoryOrder,
});

export function createMdxComponentsBound(lang: string = defaultLocale) {
  return createMdxComponents({
    settings,
    locale: lang,
    navData: {
      CategoryNav: CategoryNavWrapper as never,
      CategoryTreeNav: CategoryTreeNavWrapper as never,
      SiteTreeNav: SiteTreeNavWrapper as never,
    },
    // PresetGenerator and other showcase-only slots resolve to a package stub
    // (render nothing) — they are project-bound and not in the package.
    extras: {
      PresetGenerator: (_props: unknown) => null,
    },
  });
}

// ---------------------------------------------------------------------------
// DocPageShell + renderDocPage.
// ---------------------------------------------------------------------------

const DocPageShell = createDocPageShell({
  settings,
  composeMetaTitle,
  getTocTitle,
  HeadWithDefaults,
  SidebarWithDefaults,
  HeaderWithDefaults,
  FooterWithDefaults,
  SidebarPrepaint,
  DocBodyEnd,
  DocPager,
});

export const renderDocPage = createRenderDocPage({
  docsUrl,
  versionedDocsUrl,
  absoluteUrl,
  getNavSectionForSlug,
  toRouteSlug,
  createMdxComponents: createMdxComponentsBound,
  t,
  buildInlineVersionSwitcher,
  DocPageShell,
  DocContentHeader,
  DocMetainfoArea,
  DocHistoryArea,
});

// ---------------------------------------------------------------------------
// VersionsPageView + TagPages.
// ---------------------------------------------------------------------------

export const VersionsPageView = createVersionsPageView({
  settings,
  defaultLocale,
  t,
  withBase,
  composeMetaTitle,
  components: {
    HeadWithDefaults,
    HeaderWithDefaults,
    FooterWithDefaults,
    BodyEndIslands: BodyEndIslandsStub,
  },
});

const tagPages = createTagPages({
  settings,
  defaultLocale,
  t,
  withBase,
  docsUrl,
  composeMetaTitle,
  collectTags: collectTags as never,
  stableDocs: stableDocs as never,
  isDefaultLocaleOnlyPath: undefined,
  components: {
    HeadWithDefaults,
    HeaderWithDefaults,
    FooterWithDefaults,
    BodyEndIslands: BodyEndIslandsStub,
    DocHistoryArea: DocHistoryArea as never,
  },
});

export const { collectTagMapForLocale, TagDetailPageView, TagsIndexPageView } = tagPages;

// Re-export the locale-aware site-tree wrapper for the index entrypoints.
export { SiteTreeNavWrapper, BodyEndIslandsStub };

// Bring the doc-route-entries builder + types into the chrome surface so the
// doc entrypoints import a single module.
export {
  buildDocRouteEntries,
} from "./_context.js";
export type { DocNavNode };
