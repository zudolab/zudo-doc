/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// chrome/derive — internal shared derivations from the unified ChromeContext
// (epic Collapse Wiring Shells #2420, FACTORIES #2424).
//
// The 16 public factories now take the unified `ChromeContext` and derive their
// old narrow "deps" bag from it internally (breaking signature change — sole
// consumer). The genuinely MULTI-factory pieces of that derivation live here so
// Head / Header / Sidebar / doc-composition / page-views and `createChrome`
// share ONE implementation instead of copy-pasting it (no drift).
//
// Each host-bound value reads `ctx.hostBindings` with the SAME package-default
// stub the pre-collapse `routes/_chrome.tsx` hard-coded, so the injected
// (no-hostBindings) package path stays BYTE-IDENTICAL, while a host that threads
// its real bindings through the ChromeContext gets its real values back. The MDX
// nav wrappers prefer `ctx.components` (their allowlist) so a host can supply its
// exact wrapper functions — guaranteeing the host MDX render is byte-identical —
// and fall back to rebuilding them from the context for the injected path.
//
// This module is NOT in the preset eval graph (preset.ts never imports it), so
// its host/runtime dependency graph never touches the node-free config surface.

import type { JSX, VNode, ComponentChildren } from "preact";
import type { ChromeContext, FactoryComponent } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import type { CategoryMeta } from "../routes/_docs-helpers.js";

import { createComposeMetaTitle } from "../compose-meta-title/index.js";
import {
  generateCssCustomProperties,
  generateLightDarkCssProperties,
  SEMANTIC_RAMP_DEFAULTS,
  type ColorScheme,
  type Ramps,
} from "../color-scheme-utils.js";
import { createBodyEndIslands } from "../doc-body-end-islands/index.js";
import { createDesignTokenPanelIsland } from "../doc-body-end-islands/design-token-panel-island.js";
// Island-scanner contract (load-bearing, #2658 gate-2 fix from the Wave-5
// confirm #2659): the PACKAGE-DEFAULT DesignTokenPanelBootstrap island is the
// DEFAULT for the `hostBindings.DesignTokenPanelBootstrap` slot, so ANY
// `createChrome` consumer — the injected `routes/_chrome.tsx` path AND the
// locked-manifest self-contained doc stub (#2653), which calls
// `createChrome(routeCtx)` with NO hostBindings — gets the settings-gated
// panel island without threading it explicitly. The import MUST stay static
// (route → chrome → derive → bootstrap is the scanner-reachability chain; a
// dynamic/type-only import silently kills island registration — #2480 lesson).
//
// COUPLING NOTE: this module (and therefore `@takazudo/zudo-doc/chrome`) now
// transitively imports `virtual:zudo-doc-design-token-panel-config`, which
// only the routes plugin registers (`settings.packageOwnedRoutes`, default
// on). A `packageOwnedRoutes: false` host that bundles chrome must register
// that virtual module (or alias it to
// `@takazudo/zudo-doc/design-token-panel-config`) itself — see the KNOWN
// COUPLING note in `../design-token-panel-bootstrap.tsx`. The package's own
// vitest config aliases it for fast tests (vitest.config.ts).
//
// This same static import also makes `@takazudo/zdtp` an unconditional
// build-time dependency of every `createChrome` consumer — accepted,
// permanent contract per #2668; see the "@takazudo/zdtp dep implication"
// note in docs/adr/route-injection-seam.md.
import { DesignTokenPanelBootstrap } from "../design-token-panel-bootstrap.js";
// Island-scanner contract (#2821, ADR theme-packs.md Decision 7): the
// theme-pack switcher flyout island is injected into the body-end islands the
// same way as DesignTokenPanelBootstrap above, so ANY `createChrome` consumer
// gets the settings-gated mount. The import MUST stay static (route → chrome
// → derive → component is the scanner-reachability chain; a dynamic or
// type-only import silently kills island registration — the #2480 lesson).
import { ThemePackSwitcher, type ThemePackSwitcherProps } from "../theme-pack-switcher/index.js";
import { createThemePackSwitcherIsland } from "../doc-body-end-islands/theme-pack-switcher-island.js";
import { DEFAULT_THEME_PACK_SLUG } from "../theme-pack-switcher/theme-pack-sync.js";
import { SearchWidget } from "../search-widget/index.js";
import { createMdxComponents } from "../mdx-components/index.js";
import { createCategoryNavWrapper } from "../category-nav/index.js";
import { createCategoryTreeNavWrapper } from "../category-tree-nav/index.js";
import { createSiteTreeNavWrapper } from "../site-tree-nav/index.js";
import { Details } from "../details/index.js";
import {
  HtmlPreviewWrapper,
  type HtmlPreviewWrapperProps,
} from "../html-preview-wrapper/index.js";
import { createInlineVersionSwitcher } from "../inline-version-switcher/index.js";
import {
  buildRootMenuItems as buildRootMenuItemsBase,
  buildLocaleLinksForNav as buildLocaleLinksForNavBase,
  remapVersionedHrefs,
  getThemeDefaultMode as getThemeDefaultModeBase,
} from "../nav-data-prep/index.js";
import { buildSidebarForSection } from "../sidebar-utils/index.js";

// ---------------------------------------------------------------------------
// Package-default host-only bindings (the stub defaults — moved verbatim from
// the pre-collapse `routes/_chrome.tsx`).
// ---------------------------------------------------------------------------

/** Package-default ramps — a neutral warm-grey fallback used when the project's
 *  real `colorSchemes` payload is `null` or a key is missing. The state ramp
 *  keeps real hues so danger/success/etc. read correctly even on the fallback.
 *
 *  NOTE: placeholder authored during the engine rewrite (#2585); the real
 *  Default Dark ramp values land in #2586 (DEFAULT_SCHEME + host wrappers). */
const GREY_RAMPS: Ramps = {
  base: [
    "oklch(0.965 0.000 0)",
    "oklch(0.705 0.000 0)",
    "oklch(0.480 0.000 0)",
    "oklch(0.300 0.000 0)",
    "oklch(0.185 0.000 0)",
  ],
  accent: [
    "oklch(0.755 0.000 0)",
    "oklch(0.700 0.000 0)",
    "oklch(0.470 0.000 0)",
  ],
  state: {
    danger: "oklch(0.640 0.170 25)",
    success: "oklch(0.680 0.145 145)",
    warning: "oklch(0.760 0.135 82)",
    info: "oklch(0.680 0.130 245)",
  },
};

/** Package-default color scheme used when `colorSchemes` is `null` or a key is
 *  missing. Exported so `createChrome` keeps the identical fallback. Base roles
 *  follow the epic's Default Dark defaults on the minimized 5-base ramp
 *  (bg={base:4}, fg={base:0}, selBg={base:2}, selFg={base:0}); semantics use
 *  `SEMANTIC_RAMP_DEFAULTS`. */
export const DEFAULT_SCHEME: ColorScheme = {
  ramps: GREY_RAMPS,
  map: {
    bg: { base: 4 },
    fg: { base: 0 },
    selectionBg: { base: 2 },
    selectionFg: { base: 0 },
    semantic: { ...SEMANTIC_RAMP_DEFAULTS },
    syntax: {},
  },
};

/** Package no-op DocHistory island stub — renders an empty fragment (the
 *  `DocHistoryComponent` contract requires a VNode, not null). */
function DocHistoryStub(_props: { slug: string; locale?: string; basePath?: string }): VNode {
  return (<></>) as VNode;
}

/** Island MDX binding (package default) — an SSR pass-through that renders its
 *  children, deliberately NOT the real `@takazudo/zfb` <Island> (see the long
 *  note in the original `routes/_chrome.tsx`). `when` is ignored at SSR time. */
function IslandPassthrough(props: {
  when?: "load" | "idle" | "visible" | "media";
  children?: ComponentChildren;
}): ComponentChildren {
  return props.children ?? null;
}

// ---------------------------------------------------------------------------
// composeMetaTitle
// ---------------------------------------------------------------------------

/** Derive the meta-title composer from the context's site name. */
export function deriveComposeMetaTitle(ctx: ChromeContext): (title: string) => string {
  return createComposeMetaTitle(ctx.settings.siteName);
}

// ---------------------------------------------------------------------------
// Color-scheme CSS generators (Head)
// ---------------------------------------------------------------------------

function resolveHostScheme(ctx: ChromeContext, key: string): ColorScheme {
  // No colorSchemes payload at all → legitimately use the neutral default
  // (injected package path with no host schemes wired). Silent by design.
  if (!ctx.colorSchemes) return DEFAULT_SCHEME;
  const scheme = ctx.colorSchemes[key];
  if (!scheme) {
    // A scheme WAS wired but the requested key is missing — almost always a
    // typo in `colorScheme` / `colorMode.lightScheme` / `darkScheme`. Silently
    // falling back to the neutral grey scheme hides the misconfiguration, so
    // warn loudly (non-fatal) naming the missing key and the available ones.
    console.warn(
      `[zudo-doc] color scheme "${key}" not found in the configured ` +
        `colorSchemes — falling back to the neutral default scheme. ` +
        `Available schemes: ${Object.keys(ctx.colorSchemes).join(", ") || "(none)"}`,
    );
    return DEFAULT_SCHEME;
  }
  return scheme;
}

/** Derive the single-scheme / light-dark CSS-property generators bound to the
 *  context's `colorSchemes` payload (with the neutral grey-ramp fallback). */
export function deriveColorSchemeGenerators(ctx: ChromeContext): {
  generateCssCustomProperties: () => string;
  generateLightDarkCssProperties: () => string;
} {
  return {
    // Called only in single-scheme mode (colorMode false).
    generateCssCustomProperties: () =>
      generateCssCustomProperties(resolveHostScheme(ctx, ctx.settings.colorScheme)),
    // Called only in light/dark mode (colorMode truthy).
    generateLightDarkCssProperties: () => {
      const cm = ctx.settings.colorMode;
      if (cm) {
        return generateLightDarkCssProperties(
          resolveHostScheme(ctx, cm.lightScheme),
          resolveHostScheme(ctx, cm.darkScheme),
        );
      }
      return generateLightDarkCssProperties(DEFAULT_SCHEME, DEFAULT_SCHEME);
    },
  };
}

// ---------------------------------------------------------------------------
// nav data-prep (Header + Sidebar)
// ---------------------------------------------------------------------------

/** Derive the four nav data-prep builders (root menu items, locale-switcher
 *  links, sidebar nodes, theme default mode) bound to the context. The sidebar
 *  builder reads `ctx.hostBindings.sidebarsConfig` (default `{}`). */
export function deriveNavDataPrep(ctx: ChromeContext) {
  function buildRootMenuItems(lang: string, currentVersion: string | undefined) {
    return buildRootMenuItemsBase(
      lang,
      currentVersion,
      ctx.settings.headerNav,
      (key, l) => ctx.t(key, l),
      (path, l, v, versioned) => ctx.navHref(path, l, v, versioned),
    );
  }

  function buildLocaleLinksForNav(currentPath: string, lang: string, localeCount: number) {
    return buildLocaleLinksForNavBase(currentPath, lang, localeCount, (path, l) =>
      ctx.buildLocaleLinks(path, l),
    );
  }

  const sidebarsConfig = ctx.hostBindings.sidebarsConfig ?? {};

  function buildSidebarNodes(
    lang: string,
    navSection: string | undefined,
    currentVersion: string | undefined,
    emptyWhenUnsectioned = true,
  ) {
    if (navSection === undefined && emptyWhenUnsectioned) return [];
    const { navDocs, categoryMeta } = ctx.loadNavSourceDocs(lang, currentVersion);
    const explicitPrefixes = ctx.getCategoryOrder().filter((cm) => cm !== "!");
    const rawNodes = buildSidebarForSection(
      navDocs,
      lang,
      navSection,
      categoryMeta as unknown as Map<string, CategoryMeta>,
      sidebarsConfig as never,
      (d, l, meta) =>
        ctx.buildNavTree(
          d as never[],
          l,
          meta as Map<string, CategoryMeta> | undefined,
          (slug, loc) => ctx.docsUrl(slug, loc),
        ) as never[],
      explicitPrefixes,
    );
    return currentVersion
      ? remapVersionedHrefs(rawNodes, currentVersion, lang, (slug, v, l) =>
          ctx.versionedDocsUrl(slug, v, l),
        )
      : rawNodes;
  }

  function getThemeDefaultMode() {
    return getThemeDefaultModeBase(ctx.settings.colorMode);
  }

  return { buildRootMenuItems, buildLocaleLinksForNav, buildSidebarNodes, getThemeDefaultMode };
}

// ---------------------------------------------------------------------------
// SearchWidget slot (Header)
// ---------------------------------------------------------------------------

/** Derive the header SearchWidget: `ctx.hostBindings.SearchWidget` when the host
 *  supplies one, else the package `SearchWidget` bound to the site base. */
export function deriveSearchWidgetSlot(ctx: ChromeContext) {
  function SearchWidgetBound(props: {
    placeholderText: string;
    shortcutHint: string;
    resultCountTemplate: string;
    searchLabel: string;
    searchUnavailableText: string;
    loadingIndexText: string;
    noResultsText: string;
  }): JSX.Element {
    return SearchWidget({ ...props, base: ctx.withBase("/") });
  }
  return (ctx.hostBindings.SearchWidget ?? SearchWidgetBound) as typeof SearchWidgetBound;
}

// ---------------------------------------------------------------------------
// BodyEndIslands (DocBodyEnd + page views)
// ---------------------------------------------------------------------------

/**
 * Derive the SSR props of the theme-pack switcher flyout island from the
 * context's resolved registry (ADR theme-packs.md Decision 7 "Switcher data
 * flow"): the lightweight serializable `{ active, order, base }` projection.
 * `themePackRegistry: null` (registry not threaded) → `null`, which renders
 * the whole feature inert — the same accepted coupling class as
 * `colorSchemes` for a `packageOwnedRoutes: false` host.
 */
function deriveThemePackSwitcherProps(ctx: ChromeContext): ThemePackSwitcherProps | null {
  // `== null` on purpose: a pre-#2819 host-built payload (or a minimal test
  // context) may omit the field entirely — treat `undefined` like `null`.
  const registry = ctx.themePackRegistry;
  if (registry == null) return null;
  return {
    active: ctx.settings.themePack ?? DEFAULT_THEME_PACK_SLUG,
    order: registry.map((entry) => ({
      slug: entry.slug,
      name: entry.meta.name,
      mode: entry.meta.mode,
      description: entry.meta.description,
    })),
    // Base prefix WITH trailing slash — the head-with-defaults themePackBase
    // convention; the dialog (#2825) concatenates "theme-packs/index.json".
    base: ctx.withBase("/"),
  };
}

/**
 * Derive the body-end islands. The package owns the settings-gated
 * DesignTokenPanelBootstrap + ThemePackSwitcher mounts even when a host
 * supplies a BodyEndIslands override; the override is composed with those
 * package islands rather than replacing them. Without an override,
 * `createBodyEndIslands` already contains the same package islands, so the
 * two paths are deliberately exclusive.
 *
 * The components default to the statically imported package islands
 * (#2658 gate-2 fix; #2821), preserving route → chrome → derive → component
 * scanner reachability for bare `createChrome(routeCtx)` callers. A host may
 * still replace the DTP component through
 * `hostBindings.DesignTokenPanelBootstrap`, but the package remains the sole
 * owner of the mounts and settings gates.
 */
export function deriveBodyEndIslands(ctx: ChromeContext) {
  const designTokenPanelDeps = {
    DesignTokenPanelBootstrap:
      ctx.hostBindings.DesignTokenPanelBootstrap ??
      (DesignTokenPanelBootstrap as unknown as FactoryComponent),
  };
  const themePackSwitcherDeps = {
    themePackSwitcherProps: deriveThemePackSwitcherProps(ctx),
    ThemePackSwitcher: ThemePackSwitcher as unknown as FactoryComponent,
  };
  const HostBodyEndIslands = ctx.hostBindings.BodyEndIslands;

  if (!HostBodyEndIslands) {
    return createBodyEndIslands({
      settings: ctx.settings,
      ...designTokenPanelDeps,
      ...themePackSwitcherDeps,
    });
  }

  const DesignTokenPanelIsland = createDesignTokenPanelIsland({
    designTokenPanel: ctx.settings.designTokenPanel,
    ...designTokenPanelDeps,
  });
  const ThemePackSwitcherIsland = createThemePackSwitcherIsland({
    themePackSwitcher: ctx.settings.themePackSwitcher === true,
    ...themePackSwitcherDeps,
  });
  type BodyEndIslandsProps = { basePath: string; aiChatBodyLabel?: string };
  const HostBodyEnd = HostBodyEndIslands as unknown as (
    props: BodyEndIslandsProps,
  ) => JSX.Element;

  function BodyEndIslands(props: BodyEndIslandsProps): JSX.Element {
    return (
      <>
        <HostBodyEnd {...props} />
        <DesignTokenPanelIsland />
        <ThemePackSwitcherIsland />
      </>
    );
  }

  return BodyEndIslands as ReturnType<typeof createBodyEndIslands>;
}

// ---------------------------------------------------------------------------
// DocHistory island slot (DocHistoryArea)
// ---------------------------------------------------------------------------

/** Derive the DocHistory island: `ctx.hostBindings.DocHistory` when supplied,
 *  else the package no-op stub. */
export function deriveDocHistorySlot(ctx: ChromeContext) {
  return (ctx.hostBindings.DocHistory ?? DocHistoryStub) as typeof DocHistoryStub;
}

// ---------------------------------------------------------------------------
// inline version switcher (renderDocPage)
// ---------------------------------------------------------------------------

/** Derive the inline version-switcher builder bound to the context. */
export function deriveInlineVersionSwitcher(ctx: ChromeContext) {
  return createInlineVersionSwitcher({
    settings: ctx.settings,
    defaultLocale: ctx.defaultLocale,
    t: ctx.t,
    docsUrl: ctx.docsUrl,
    versionedDocsUrl: ctx.versionedDocsUrl,
    withBase: ctx.withBase,
  });
}

// ---------------------------------------------------------------------------
// MDX components factory (renderDocPage) + SiteTreeNavWrapper (createChrome)
// ---------------------------------------------------------------------------

/**
 * Derive the locale-aware `createMdxComponents` factory plus the
 * `SiteTreeNavWrapper` (also exposed by `createChrome`). The nav wrappers
 * (CategoryNav / CategoryTreeNav / SiteTreeNav) PREFER `ctx.components` — their
 * documented allowlist — so a host can pass its exact wrapper functions and the
 * MDX render stays byte-identical; they fall back to rebuilding from the context
 * for the injected package path. The content overrides (Details / HtmlPreview /
 * Island / PresetGenerator + any host extras) come from `ctx.hostBindings.mdxExtras`
 * merged over the package defaults.
 */
export function deriveMdxComponents(ctx: ChromeContext) {
  const CategoryNavWrapper =
    ctx.components.CategoryNav ??
    (createCategoryNavWrapper({
      defaultLocale: ctx.defaultLocale,
      resolveNavSource: ctx.resolveNavSource as never,
      buildNavTree: ((docs: unknown[], locale: string, categoryMeta: Map<string, unknown>) =>
        ctx.buildNavTree(
          docs as never[],
          locale,
          categoryMeta as Map<string, CategoryMeta>,
          (slug, loc) => ctx.docsUrl(slug, loc),
        )) as never,
      findNode: ctx.findNode as never,
      firstRoutedHref: ctx.firstRoutedHref as never,
    }) as unknown as FactoryComponent);

  const CategoryTreeNavWrapper =
    ctx.components.CategoryTreeNav ??
    (createCategoryTreeNavWrapper({
      defaultLocale: ctx.defaultLocale,
      resolveNavSource: ctx.resolveNavSource as never,
      buildNavTree: ((docs: unknown[], locale: string, categoryMeta: Map<string, unknown>) =>
        ctx.buildNavTree(
          docs as never[],
          locale,
          categoryMeta as Map<string, CategoryMeta>,
          (slug, loc) => ctx.docsUrl(slug, loc),
        )) as never,
      groupSatelliteNodes: ctx.groupSatelliteNodes as never,
      findNode: ctx.findNode as never,
    }) as unknown as FactoryComponent);

  const SiteTreeNavWrapper =
    ctx.components.SiteTreeNav ??
    (createSiteTreeNavWrapper({
      defaultLocale: ctx.defaultLocale,
      resolveNavSource: ctx.resolveNavSource as never,
      buildNavTree: ((docs: unknown[], locale: string, categoryMeta: Map<string, unknown>) =>
        ctx.buildNavTree(
          docs as never[],
          locale,
          categoryMeta as Map<string, CategoryMeta>,
          (slug, loc) => ctx.docsUrl(slug, loc),
        )) as never,
      groupSatelliteNodes: ctx.groupSatelliteNodes as never,
      getCategoryOrder: ctx.getCategoryOrder,
    }) as unknown as FactoryComponent);

  /** HtmlPreview MDX binding (package default) — `settings.htmlPreview` is a
   *  serializable setting in the route-context payload. */
  function HtmlPreviewBound(props: HtmlPreviewWrapperProps): JSX.Element {
    return HtmlPreviewWrapper({
      globalConfig: ctx.settings.htmlPreview ?? null,
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
  const mdxExtras = { ...mdxExtrasDefault, ...(ctx.hostBindings.mdxExtras ?? {}) };

  function createMdxComponentsBound(lang: string = ctx.defaultLocale) {
    return createMdxComponents({
      settings: ctx.settings,
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

  return { createMdxComponentsBound, SiteTreeNavWrapper };
}

// Re-export Settings for type-narrowing call sites that import from here.
export type { Settings };
