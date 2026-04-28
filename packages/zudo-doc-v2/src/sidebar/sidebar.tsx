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
// adds the `client:load` directive on the island. Everything else lives
// in v2.

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
 * Returns `null` when neither path produces content; matches the
 * implicit "render nothing" behaviour the Astro template would have if
 * the host passed an empty tree island.
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
