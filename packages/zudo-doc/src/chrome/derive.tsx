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
  type ColorScheme,
} from "../color-scheme-utils.js";
import { createBodyEndIslands } from "../doc-body-end-islands/index.js";
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

/** Package-default color scheme — a neutral 16-step grey ramp. The project's
 *  real `colorSchemes` palette map rides in the serializable payload; this is
 *  the fallback when a key is missing or `colorSchemes` is `null`. */
const GREY_RAMP: ColorScheme["palette"] = [
  "oklch(0.000 0.000 0.00)" /* #000000 */, "oklch(0.218 0.000 0.00)" /* #1a1a1a */, "oklch(0.321 0.000 0.00)" /* #333333 */, "oklch(0.420 0.000 0.00)" /* #4d4d4d */, "oklch(0.510 0.000 0.00)" /* #666666 */, "oklch(0.600 0.000 0.00)" /* #808080 */,
  "oklch(0.683 0.000 0.00)" /* #999999 */, "oklch(0.767 0.000 0.00)" /* #b3b3b3 */, "oklch(0.845 0.000 0.00)" /* #cccccc */, "oklch(0.885 0.000 0.00)" /* #d9d9d9 */, "oklch(0.925 0.000 0.00)" /* #e6e6e6 */, "oklch(0.961 0.000 0.00)" /* #f2f2f2 */,
  "oklch(0.682 0.206 24.43)" /* #ff5555 */, "oklch(0.871 0.2195 148.02)" /* #50fa7b */, "oklch(0.955 0.134 112.76)" /* #f1fa8c */, "oklch(0.883 0.0934 212.85)" /* #8be9fd */,
];

/** Package-default color scheme used when `colorSchemes` is `null` or a key is
 *  missing. Exported so `createChrome` keeps the identical fallback. */
export const DEFAULT_SCHEME: ColorScheme = {
  background: "oklch(0.000 0.000 0.00)" /* #000000 */,
  foreground: "oklch(1.000 0.000 0.00)" /* #ffffff */,
  cursor: "oklch(1.000 0.000 0.00)" /* #ffffff */,
  selectionBg: "oklch(0.387 0.000 0.00)" /* #444444 */,
  selectionFg: "oklch(1.000 0.000 0.00)" /* #ffffff */,
  palette: GREY_RAMP,
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
  if (!ctx.colorSchemes) return DEFAULT_SCHEME;
  return ctx.colorSchemes[key] ?? DEFAULT_SCHEME;
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
      (path, l, v) => ctx.navHref(path, l, v),
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

/** Derive the body-end islands: `ctx.hostBindings.BodyEndIslands` when supplied,
 *  else the package-island subset reconstructed from `settings`. */
export function deriveBodyEndIslands(ctx: ChromeContext) {
  return (ctx.hostBindings.BodyEndIslands ??
    createBodyEndIslands({ settings: ctx.settings })) as ReturnType<typeof createBodyEndIslands>;
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
