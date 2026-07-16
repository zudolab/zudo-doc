/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// chrome — public `createChrome(context, hostBindings)` builder (epic Collapse
// Wiring Shells #2420, CTX #2423; FACTORIES #2424 collapsed the per-factory
// wiring INTO the factories).
//
// Each public page-chrome factory now takes the unified `ChromeContext` and
// derives its own bag internally (breaking signature change — sole consumer).
// This builder therefore became thin: it assembles a `ChromeContext` from the
// reconstructed `RouteContext` (see `createRouteContext`) plus the genuinely
// host-bound slots (`ChromeHostBindings`), then calls each TOP-LEVEL factory
// with that context and returns the wired surface.
//
// The host-bound slots are PARAMETERS whose DEFAULTS EQUAL TODAY'S STUBS: when
// `createChrome(context)` is called with no `hostBindings` (the injected
// package-routes path, via the `routes/_chrome.tsx` shim), every slot resolves
// to the exact package default the factories' shared `chrome/derive` helpers
// hard-code — so rendered output is byte-identical. The host (HOSTCOLLAPSE wave)
// builds a `ChromeContext` carrying its real bindings and calls the factories
// with it directly; this builder stays the injected-path convenience.
//
// This builder is NOT in the preset eval graph (preset.ts does not import it),
// so its host/runtime dependencies never touch the node-free config surface.

import type {
  RouteContext,
  ChromeContext,
  ChromeHostBindings,
  FactoryComponents,
} from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import type { JSX, VNode } from "preact";
import type { HeaderWithDefaultsProps } from "../header-with-defaults/index.js";
import type { SidebarWithDefaultsProps } from "../sidebar-with-defaults/index.js";

import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { createRenderDocPage } from "../doc-page-renderer/index.js";
import { createVersionsPageView } from "../versions-page/index.js";
import { createTagPages } from "../tag-pages/index.js";
import { createHomePageView } from "../home-page/index.js";
import {
  deriveComposeMetaTitle,
  deriveBodyEndIslands,
  deriveMdxComponents,
} from "./derive.js";
import { derivePrimaryChromeSlots } from "./primary-slots.js";

/**
 * Build the wired page-chrome factories from a reconstructed route context plus
 * the host-bound slots. Assembles a {@link ChromeContext} (route context +
 * empty `components` allowlist + the passed `hostBindings`) and threads it
 * through each top-level factory; every omitted `hostBindings` slot falls back
 * to the package stub default inside the factories, reproducing the injected
 * package-routes path byte-for-byte.
 */
export function createChrome<S extends Settings = Settings>(
  context: RouteContext<S>,
  hostBindings: ChromeHostBindings = {},
) {
  const components: FactoryComponents = {};
  const ctx: ChromeContext<S> = { ...context, components, hostBindings };

  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx);
  const primary = derivePrimaryChromeSlots(ctx);
  // Preserve createChrome's established public wrapper declarations even when
  // a strict host replacement is installed. The wrappers normalize the old
  // optional props to the exact replacement call contracts and always return
  // a VNode, while internal package call sites keep the stricter slot types.
  const HeaderWithDefaults = (props: HeaderWithDefaultsProps): JSX.Element => (
    <>{primary.Header({ ...props, lang: props.lang ?? context.defaultLocale })}</>
  );
  const FooterWithDefaults = (props: { lang?: string }): VNode => (
    <>{primary.Footer({ lang: props.lang ?? context.defaultLocale })}</>
  );
  const SidebarWithDefaults = (props: SidebarWithDefaultsProps): JSX.Element => (
    <>
      {primary.Sidebar({
        currentSlug: props.currentSlug ?? "",
        lang: props.lang ?? context.defaultLocale,
        navSection: props.navSection,
        currentVersion: props.currentVersion,
        currentPath: props.currentPath ?? "",
      })}
    </>
  );
  const renderDocPage = createRenderDocPage(ctx);
  const VersionsPageView = createVersionsPageView(ctx);
  const { collectTagMapForLocale, TagDetailPageView, TagsIndexPageView } =
    createTagPages(ctx);
  const { SiteTreeNavWrapper } = deriveMdxComponents(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx);
  const HomePageView = createHomePageView(ctx);

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
    HomePageView,
  };
}

/** The wired page-chrome surface returned by {@link createChrome}. */
export type Chrome = ReturnType<typeof createChrome>;
