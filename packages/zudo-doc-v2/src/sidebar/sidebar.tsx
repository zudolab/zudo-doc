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
// In Astro, the host invokes this through a small `.astro` wrapper that
// adds the `client:load` directive on the island. In zfb the wrapping
// is internal: this module wraps the inner shell in `<Island>` so SSG-
// rendered HTML emits a `data-zfb-island="Sidebar"` marker for the
// hydration runtime to pick up. Pages call `<Sidebar ... />` and get
// the marker for free.

import type { ComponentChildren, FunctionComponent, VNode } from "preact";
// `@takazudo/zfb` resolves at integration time via the consumer; the
// types come from the package shim at `../_zfb-shim.d.ts`.
import { Island } from "@takazudo/zfb";

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
 * Inner shell — same logic the original Astro `.astro` wrapper used.
 * Renamed so the outer `<Sidebar>` can wrap this in `<Island>` and
 * still produce a `data-zfb-island="Sidebar"` marker (Island reads the
 * child's `displayName ?? name` to derive the marker string).
 */
function SidebarInner(props: SidebarProps): VNode | null {
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
// layer munges the inner function name (some bundlers rename inner
// helpers). The hydration manifest looks the marker up by this string.
SidebarInner.displayName = "Sidebar";

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
 * Either way the outer `<Island>` emits the SSG marker; if both
 * `treeComponent` and `children` are omitted, the inner returns `null`
 * but the marker div still ships so the hydration runtime can pick the
 * island up after the host wires data prep at integration time.
 */
export function Sidebar(props: SidebarProps): VNode {
  // `Island(...)` is called directly (rather than via JSX) so we can
  // narrow its `unknown` return type at a single boundary — same shape
  // used in `theme/design-token-tweak-panel.tsx`.
  const rendered = Island({
    when: "load",
    children: <SidebarInner {...props} />,
  });
  return rendered as unknown as VNode;
}
