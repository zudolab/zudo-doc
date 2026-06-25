/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// site-tree-nav — factory for the MDX <SiteTreeNav> wrapper component
// (epic #2344, S8).
//
// The host's `pages/lib/_site-tree-nav.tsx` previously imported host singletons
// (`@/utils/docs`, `@/config/i18n`, `@/utils/nav-scope`, and the host-bound
// `resolveNavSource`) directly. This factory receives those as injected
// dependencies so the logic lives in the package while the host stub keeps
// the singleton imports.
//
// Data-resolution steps performed before forwarding to the SiteTreeNav island:
//   1. Load the full docs collection for the active locale.
//   2. Build nav tree via buildNavTree().
//   3. Group satellite nodes via groupSatelliteNodes().
//   4. Wrap the interactive SiteTreeNav in Island({when:"idle"}) so the MDX
//      page gets the collapsible grid rendered at
//      /docs/components/site-tree-nav/ (refs #1453/#1442).
//
// All data access is synchronous (ADR-004 zfb content snapshot contract).
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.
//
// IMPORTANT: Island({when:"idle"}) is PRESERVED — not "load". The island
// must mount after the page is idle for performance (refs #1453).

import type { JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { SiteTreeNav } from "../site-tree-nav-island/index.js";
import type { SidebarNavNode } from "../sidebar/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal nav source needed by the site-tree-nav factory.
 * Typed `unknown[]` for navDocs so the factory does not import the host's
 * concrete entry type (the host casts when injecting).
 */
export interface SiteTreeNavSource {
  navDocs: unknown[];
  categoryMeta: Map<string, unknown>;
}

/** Props for the SiteTreeNavWrapper component. */
export interface SiteTreeNavWrapperProps {
  /**
   * Active locale. Injected via createMdxComponents() closure.
   * Defaults to defaultLocale when not provided.
   */
  lang?: string;
  /**
   * Optional aria-label for the wrapping <nav> element.
   * Forwarded to the v2 SiteTreeNavDemo component.
   */
  ariaLabel?: string;
}

/** Injected dependencies for {@link createSiteTreeNavWrapper}. */
export interface SiteTreeNavDeps {
  /** Default locale code (e.g. `"en"`). */
  defaultLocale: string;
  /**
   * Resolve the identity-stable nav source for an EN/locale context.
   * Host passes `resolveNavSource` from `pages/lib/_nav-source-docs.ts`.
   */
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => SiteTreeNavSource;
  /**
   * Build the nav tree for a locale.
   * Host passes `buildNavTree` from `@/utils/docs`.
   * Returns `SidebarNavNode[]` — the host's NavNode is structurally
   * compatible with SidebarNavNode (same fields including `position`).
   */
  buildNavTree: (
    docs: unknown[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => SidebarNavNode[];
  /**
   * Group satellite nodes under target category prefixes in the nav tree.
   * Host passes `groupSatelliteNodes` from `@/utils/docs`.
   */
  groupSatelliteNodes: (tree: SidebarNavNode[], prefixes: string[]) => SidebarNavNode[];
  /**
   * Collect all categoryMatch strings from headerNav in order.
   * Host passes `getCategoryOrder()` (already bound to settings.headerNav)
   * from `@/utils/nav-scope`.
   */
  getCategoryOrder: () => string[];
}

/**
 * Create the `SiteTreeNavWrapper` component bound to the host's nav source
 * and tree-building dependencies.
 *
 * Builds the full site nav tree and renders it via the interactive SiteTreeNav
 * island (wrapped in Island({when:"idle"})) — restoring byte-parity with the
 * Astro reference at /docs/components/site-tree-nav/ (refs #1453/#1442).
 *
 * The island renders the collapsible multi-column grid the reference shows.
 * SiteTreeNavDemo (static <details> list) is no longer used for MDX content.
 *
 * Returns null when the tree is empty after filtering.
 */
export function createSiteTreeNavWrapper(
  deps: SiteTreeNavDeps,
): (props: SiteTreeNavWrapperProps) => JSX.Element | null {
  const { defaultLocale, resolveNavSource, buildNavTree, groupSatelliteNodes, getCategoryOrder } = deps;

  function SiteTreeNavWrapper({
    lang = defaultLocale,
    ariaLabel,
  }: SiteTreeNavWrapperProps): JSX.Element | null {
    const locale = lang;

    // SiteTreeNav mirrors the route nav: applies the defaultLocaleOnly filter for
    // non-default locales (same options the sidebar/route enumeration use).
    const { navDocs, categoryMeta } = resolveNavSource(locale, undefined, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    const tree = buildNavTree(navDocs, locale, categoryMeta);
    const categoryOrder = getCategoryOrder();
    const groupedTree = groupSatelliteNodes(tree, categoryOrder);

    if (groupedTree.length === 0) return null;

    // IMPORTANT: Island({when:"idle"}) is preserved — not "load". This ensures
    // the SiteTreeNav mounts after the page is idle for performance (refs #1453).
    return Island({
      when: "idle",
      children: (
        <SiteTreeNav
          tree={groupedTree}
          categoryOrder={categoryOrder}
          categoryIgnore={["inbox", "develop"]}
          ariaLabel={ariaLabel}
        />
      ),
    }) as unknown as JSX.Element;
  }

  return SiteTreeNavWrapper;
}
