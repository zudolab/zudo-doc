"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/sidebar.astro.
//
// The original Astro template was almost entirely data assembly —
// build root-menu items from `settings.headerNav`, load the locale's
// docs collection, build the nav tree for the active section, optionally
// remap hrefs for versioned routes, and finally render the project's
// `<SidebarTree client:load .../>` Preact island.
//
// All of that data-prep depends on host-only helpers (`@/config/i18n`,
// `@/utils/sidebar`, `@/utils/locale-docs`, `@/utils/base`,
// `@/config/settings`) that v2 must not import. This shell therefore
// keeps the data-prep on the host side and only provides:
//
//   - typed props that match the SidebarTree island's prop shape, so
//     the host's prep code can be typed against v2's interface;
//   - a `treeComponent` prop the host supplies (their existing Preact
//     island) — the shell instantiates it with the typed props and
//     forwards everything;
//   - a `children` fallback for callers that want to render the tree
//     themselves (useful for tests, fixtures, and downstream projects
//     that swap the tree out wholesale).
//
// Wave 13 ("smoke-toc duplicate-nav regression follow-on", zudolab/zudo-doc#1355):
// before this refactor, this module exported a `Sidebar` wrapper that
// itself called `Island({when:"load", children:<SidebarInner/>})` and
// returned the wrapped div. The zfb island scanner picked the exported
// `Sidebar` (the wrapper) as the bundle's hydration target, so on the
// client `mountIslands` ran `hydrate(<Sidebar/>, dataIslandDiv)` where
// the rendered vnode itself emitted *another* `<div data-zfb-island=
// "Sidebar"><SidebarInner/></div>` inside the existing one. Unlike the
// `Toc` / `MobileToc` case (where the inner re-rendered identical
// content alongside the SSR'd content, producing a visible duplicate),
// the duplicate here was silent: the host passes `treeComponent` (a
// Preact component function) as a prop, and `island.ts`'s
// `captureSerializableProps` does `JSON.stringify` on the props bag,
// which silently drops function values. At hydrate time the
// deserialized props had no `treeComponent`, `SidebarInner` returned
// `null`, and the appended wrapper-div was empty. Net result: an extra
// dead-mount data-zfb-island Sidebar div alongside the SSR'd tree, with
// no observable content — but a wasted hydration slot, and the actual
// user-facing event-handler / state work was being done entirely by
// the host's `SidebarTree` island registration.
//
// Fix: same shape as Toc / MobileToc — drop the `Island`-wrapping
// outer, export the bare component (was `SidebarInner`) as `Sidebar`,
// pin `displayName` explicitly. The `<Island when="load">` wrapper is
// applied at the call site (`<DocLayoutWithDefaults>`).

import type { ComponentChildren, FunctionComponent, VNode } from "preact";

import type { SidebarTreeIslandProps } from "./types";

export interface SidebarProps extends SidebarTreeIslandProps {
  /**
   * The host's SidebarTree component. When present, the shell renders
   * `<TreeComponent {...islandProps} />` with the typed props below.
   * Mutually exclusive with `children`: prefer this form so v2 owns the
   * prop forwarding contract.
   */
  treeComponent?: FunctionComponent<SidebarTreeIslandProps>;
  /**
   * Pre-rendered tree content — falls back to this when
   * `treeComponent` is omitted. Useful for tests and for layouts that
   * compose the tree separately (e.g. inside an Astro `.astro` wrapper
   * that needs `client:load` on the actual island element).
   */
  children?: ComponentChildren;
}

/**
 * Sidebar shell — typed wrapper around the SidebarTree island.
 *
 * Two usage shapes (matching the breadcrumb shell's pattern):
 *
 *   1. Pass `treeComponent` plus the data props (`nodes`,
 *      `rootMenuItems`, `localeLinks`, …). The shell forwards them all
 *      to the supplied component.
 *
 *   2. Pass `children` (e.g. a pre-instantiated `<SidebarTree
 *      client:load … />` from an Astro wrapper). The shell renders
 *      them as-is — the typed island props are then unused but kept on
 *      the type signature so call-sites stay self-documenting.
 *
 * **The caller is responsible for wrapping this in `<Island when="load">`**
 * so the SSG output emits the `data-zfb-island="Sidebar"` hydration
 * marker around the rendered tree. `<DocLayoutWithDefaults>` does this
 * for you; consumers who render `<Sidebar>` outside the default layout
 * (e.g. via the `sidebarOverride` prop or in a custom layout) must
 * apply the wrapper themselves — otherwise no hydration marker is
 * emitted, and the runtime walks past the SSR'd tree without claiming
 * it as an island. Either way the actual user-facing interactivity
 * comes from the `treeComponent`'s own island registration; the
 * `<Island>` wrapper here exists so the shell can host data-only
 * variants in the future without losing the marker contract.
 */
export function Sidebar(props: SidebarProps): VNode | null {
  const {
    treeComponent: TreeComponent,
    children,
    nodes,
    currentSlug,
    rootMenuItems,
    backToMenuLabel,
    localeLinks,
    themeDefaultMode,
  } = props;

  if (TreeComponent) {
    return (
      <TreeComponent
        nodes={nodes}
        currentSlug={currentSlug}
        rootMenuItems={rootMenuItems}
        backToMenuLabel={backToMenuLabel}
        localeLinks={localeLinks}
        themeDefaultMode={themeDefaultMode}
      />
    );
  }

  if (children !== undefined && children !== null) {
    return <>{children}</>;
  }

  return null;
}
// Pin the marker name to "Sidebar" regardless of how Preact's compat
// layer or esbuild minification renames the function. Island's SSR
// pass reads `displayName ?? name` to derive the marker string;
// pinning both means the SSG marker stays `data-zfb-island="Sidebar"`
// independent of the bundle's symbol-renaming.
Sidebar.displayName = "Sidebar";
