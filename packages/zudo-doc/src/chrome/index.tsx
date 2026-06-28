/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// chrome — public `createChrome(context, hostBindings)` builder (epic Collapse
// Wiring Shells #2420, CTX #2423; promoted from `routes/_chrome.tsx`).
//
// Wires the package page-chrome factories (head / header / footer / sidebar,
// doc-page renderer, versions + tag page views, MDX components) from a
// reconstructed `RouteContext` (see `createRouteContext`) plus the genuinely
// host-bound slots (`ChromeHostBindings`).
//
// The ~10 host-bound slots are PARAMETERS whose DEFAULTS EQUAL TODAY'S STUBS:
// when `createChrome(context)` is called with no `hostBindings` (the injected
// package-routes path, via the `routes/_chrome.tsx` shim), every slot resolves
// to the exact package default the old `_chrome.tsx` hard-coded — so rendered
// output is byte-identical. The host (HOSTCOLLAPSE wave) passes real bindings.
//
// This builder is NOT in the preset eval graph (preset.ts does not import it),
// so its host/runtime dependencies never touch the node-free config surface.

import type { JSX, VNode, ComponentChildren } from "preact";
import type {
  RouteContext,
  ChromeHostBindings,
} from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import type { CategoryMeta } from "../routes/_docs-helpers.js";

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
import { createBodyEndIslands } from "../doc-body-end-islands/index.js";
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
import { Details } from "../details/index.js";
import {
  HtmlPreviewWrapper,
  type HtmlPreviewWrapperProps,
} from "../html-preview-wrapper/index.js";

// ---------------------------------------------------------------------------
// Package-default host-only bindings (the stub defaults — see module header).
// ---------------------------------------------------------------------------

/** Package-default color scheme — a neutral 16-step grey ramp. The project's
 *  real `colorSchemes` palette map rides in the serializable payload; this is
 *  the fallback when a key is missing or `colorSchemes` is `null`. */
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

/** Package no-op DocHistory island stub — renders an empty fragment (the
 *  `DocHistoryComponent` contract requires a VNode, not null). */
function DocHistoryStub(_props: { slug: string; locale?: string; basePath?: string }): VNode {
  return (<></>) as VNode;
}

/** Island MDX binding (package default) — an SSR pass-through that renders its
 *  children, deliberately NOT the real `@takazudo/zfb` <Island> (see the long
 *  note in the original `routes/_chrome.tsx`: the corpus never uses `<Island>`
 *  as a real render tag, and the islands scanner can't register a package
 *  node_modules import anyway). `when` is ignored at SSR time. */
function IslandPassthrough(props: {
  when?: "load" | "idle" | "visible" | "media";
  children?: ComponentChildren;
}): ComponentChildren {
  return props.children ?? null;
}

/**
 * Build the wired page-chrome factories from a reconstructed route context plus
 * the host-bound slots. Every omitted `hostBindings` slot falls back to the
 * package stub default, reproducing the injected package-routes path
 * byte-for-byte.
 */
export function createChrome<S extends Settings = Settings>(
  context: RouteContext<S>,
  hostBindings: ChromeHostBindings = {},
) {
  const {
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
    colorSchemes,
  } = context;

  // ── Host-bound slots → stub defaults (byte-identical when omitted) ────────

  /** Empty doc-history manifest by default — the real `#doc-history-meta`
   *  virtual JSON is host-bound. */
  const docHistoryMeta = hostBindings.docHistoryMeta ?? {};

  /** Empty sidebars config by default — sidebar sections fall back to the
   *  auto-generated tree. The project `sidebars` config is host-bound. */
  const sidebarsConfig = hostBindings.sidebarsConfig ?? {};

  /** Package-default body-end islands — the package-island subset of the
   *  host's `BodyEndIslands` (AiChatModal / ImageEnlarge / MermaidEnlarge),
   *  reconstructed from the serializable `settings` flags. The host-owned
   *  bootstraps (client-router / design-token-panel) are NOT included here. */
  const BodyEndIslands = (hostBindings.BodyEndIslands ??
    createBodyEndIslands({ settings })) as ReturnType<typeof createBodyEndIslands>;

  /** SearchWidget adapter: the package `SearchWidget` requires a `base` prop,
   *  but the `HeaderWithDefaults` dep signature omits it. Inject the
   *  base-prefixed search index root. */
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
  const SearchWidgetSlot = (hostBindings.SearchWidget ?? SearchWidgetBound) as typeof SearchWidgetBound;

  const DocHistorySlot = (hostBindings.DocHistory ?? DocHistoryStub) as typeof DocHistoryStub;

  const frontmatterRenderers = hostBindings.frontmatterRenderers ?? {};
  const buildFrontmatterPreviewEntries =
    hostBindings.buildFrontmatterPreviewEntries ?? (() => []);
  const loadTagsForLocale = hostBindings.loadTagsForLocale ?? (() => []);
  const footerTagVocabulary = hostBindings.tagVocabulary ?? [];

  // ── composeMetaTitle + Head ───────────────────────────────────────────────

  const composeMetaTitle = createComposeMetaTitle(settings.siteName);

  // Scheme-selection: resolve the active color scheme(s) from the host
  // `colorSchemes` map (in the payload). Falls back to `DEFAULT_SCHEME`.
  function resolveHostScheme(key: string): ColorScheme {
    if (!colorSchemes) return DEFAULT_SCHEME;
    return colorSchemes[key] ?? DEFAULT_SCHEME;
  }

  const HeadWithDefaults = createHeadWithDefaults({
    settings,
    composeMetaTitle,
    withBase,
    absoluteUrl,
    // Called only in single-scheme mode (colorMode false).
    generateCssCustomProperties: () =>
      generateCssCustomProperties(resolveHostScheme(settings.colorScheme)),
    // Called only in light/dark mode (colorMode truthy).
    generateLightDarkCssProperties: () => {
      const cm = settings.colorMode;
      if (cm) {
        return generateLightDarkCssProperties(
          resolveHostScheme(cm.lightScheme),
          resolveHostScheme(cm.darkScheme),
        );
      }
      return generateLightDarkCssProperties(DEFAULT_SCHEME, DEFAULT_SCHEME);
    },
  });

  // ── nav data-prep (bound to settings via the route context) ──────────────

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
      sidebarsConfig as never,
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

  // ── Header / Footer / Sidebar ─────────────────────────────────────────────

  const HeaderWithDefaults = createHeaderWithDefaults({
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
    SearchWidget: SearchWidgetSlot,
  });

  const FooterWithDefaults = createFooterWithDefaults({
    settings,
    defaultLocale,
    tagVocabulary: footerTagVocabulary as never[],
    isExternal: (href: string) => /^https?:\/\//.test(href),
    resolveHref: (href: string) => (/^https?:\/\//.test(href) ? href : withBase(href)),
    withBase,
    // The footer taglist is host-bound; package default renders no tag columns.
    loadTagsForLocale: loadTagsForLocale as never,
  });

  const SidebarWithDefaults = createSidebarWithDefaults({
    defaultLocale,
    localeCount: locales.length,
    buildRootMenuItems,
    buildLocaleLinksForNav,
    buildSidebarNodes,
    getThemeDefaultMode,
    t,
  });

  const SidebarPrepaint = createSidebarPrepaint({ sidebarToggle: settings.sidebarToggle });
  const DocBodyEnd = createDocBodyEnd({ settings, BodyEndIslands });
  const DocPager = createDocPager({ t });

  // ── Doc content header / metainfo / tags / history ───────────────────────

  const DocMetainfoArea = createDocMetainfoArea({
    settings,
    defaultLocale,
    docHistoryMeta: docHistoryMeta as never,
    t,
    toHistorySlug,
  });

  const DocTagsArea = createDocTagsArea({
    settings,
    defaultLocale,
    tagVocabularyEntries: footerTagVocabulary as never[],
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
    buildFrontmatterPreviewEntries: buildFrontmatterPreviewEntries as never,
    frontmatterRenderers: frontmatterRenderers as never,
    DocMetainfoArea,
    DocTagsArea,
  });

  const DocHistoryArea = createDocHistoryArea({
    settings,
    defaultLocale,
    docHistoryMeta: docHistoryMeta as never,
    t,
    toHistorySlug,
    buildGitHubSourceUrl: (contentDir: string, entryId: string) =>
      buildGitHubSourceUrl(settings.githubUrl, contentDir, entryId),
    DocHistory: DocHistorySlot,
  });

  const buildInlineVersionSwitcher = createInlineVersionSwitcher({
    settings,
    defaultLocale,
    t,
    docsUrl,
    versionedDocsUrl,
    withBase,
  });

  // ── MDX components (locale-bound nav wrappers + package defaults) ─────────

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

  /** HtmlPreview MDX binding (package default) — `settings.htmlPreview` is a
   *  serializable setting in the route-context payload, so the package reads it
   *  directly. `HtmlPreviewWrapper` SSR-renders the preview tree. */
  function HtmlPreviewBound(props: HtmlPreviewWrapperProps): JSX.Element {
    return HtmlPreviewWrapper({
      globalConfig: settings.htmlPreview ?? null,
      ...props,
    }) as JSX.Element;
  }

  // Package-default MDX extras; host-supplied `mdxExtras` override per-key.
  const mdxExtrasDefault: Record<string, unknown> = {
    Details: Details as never,
    HtmlPreview: HtmlPreviewBound as never,
    Island: IslandPassthrough as never,
    // PresetGenerator stays a package stub (render nothing): it is the
    // showcase's project-bound interactive island; downstream projects stub it.
    PresetGenerator: (_props: unknown) => null,
  };
  const mdxExtras = { ...mdxExtrasDefault, ...(hostBindings.mdxExtras ?? {}) };

  function createMdxComponentsBound(lang: string = defaultLocale) {
    return createMdxComponents({
      settings,
      locale: lang,
      navData: {
        CategoryNav: CategoryNavWrapper as never,
        CategoryTreeNav: CategoryTreeNavWrapper as never,
        SiteTreeNav: SiteTreeNavWrapper as never,
      },
      // Package-owned content components wired here so an INJECTED docs route
      // renders MDX using these tags without the "MDX requires '<X>' to be
      // passed via the 'components' prop" error.
      extras: mdxExtras as never,
    });
  }

  // ── DocPageShell + renderDocPage ──────────────────────────────────────────

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

  const renderDocPage = createRenderDocPage({
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

  // ── VersionsPageView + TagPages ───────────────────────────────────────────

  const VersionsPageView = createVersionsPageView({
    settings,
    defaultLocale,
    t,
    withBase,
    composeMetaTitle,
    components: {
      HeadWithDefaults,
      HeaderWithDefaults,
      FooterWithDefaults,
      BodyEndIslands,
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
      BodyEndIslands,
      DocHistoryArea: DocHistoryArea as never,
    },
  });

  const { collectTagMapForLocale, TagDetailPageView, TagsIndexPageView } = tagPages;

  return {
    composeMetaTitle,
    HeadWithDefaults,
    HeaderWithDefaults,
    FooterWithDefaults,
    SidebarWithDefaults,
    renderDocPage,
    VersionsPageView,
    collectTagMapForLocale,
    TagDetailPageView,
    TagsIndexPageView,
    SiteTreeNavWrapper,
    BodyEndIslands,
  };
}

/** The wired page-chrome surface returned by {@link createChrome}. */
export type Chrome = ReturnType<typeof createChrome>;
