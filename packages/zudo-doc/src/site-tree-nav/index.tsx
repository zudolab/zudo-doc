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
import { remapVersionedHrefs } from "../nav-data-prep/index.js";

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
  /**
   * Active version slug for a `/v/{version}` route. Injected via
   * createMdxComponents() closure alongside `lang` (#3218). When set, the nav
   * source resolves the version's doc collection and emitted hrefs are
   * remapped to their versioned form; omitted (latest/unversioned pages)
   * leaves behavior unchanged.
   */
  currentVersion?: string;
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
  /**
   * Build a versioned docs URL: `versionedDocsUrl(slug, versionSlug, lang)`.
   * Host passes `ctx.versionedDocsUrl`. Used to remap the resolved tree's
   * hrefs into their versioned form when `currentVersion` is set (#3218) —
   * mirrors the sidebar's `buildSidebarNodes` two-step in `chrome/derive.tsx`.
   *
   * Optional — `./site-tree-nav` is a documented frozen-1.0 public subpath
   * (`packages/zudo-doc/CLAUDE.md`/`API.md`), so a pre-#3218 caller that
   * hand-constructs `SiteTreeNavDeps` without this field must keep compiling.
   * Omitting it while passing `currentVersion` leaves hrefs unversioned (a
   * loud dev warning is emitted) rather than throwing.
   */
  versionedDocsUrl?: (slug: string, versionSlug: string, lang: string) => string;
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
  const {
    defaultLocale,
    resolveNavSource,
    buildNavTree,
    groupSatelliteNodes,
    getCategoryOrder,
    versionedDocsUrl,
  } = deps;

  function SiteTreeNavWrapper({
    lang = defaultLocale,
    ariaLabel,
    currentVersion,
  }: SiteTreeNavWrapperProps): JSX.Element | null {
    const locale = lang;

    // SiteTreeNav mirrors the route nav: applies the defaultLocaleOnly filter for
    // non-default locales (same options the sidebar/route enumeration use).
    const { navDocs, categoryMeta } = resolveNavSource(locale, currentVersion, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    const rawTree = buildNavTree(navDocs, locale, categoryMeta);
    const categoryOrder = getCategoryOrder();
    const groupedTree = groupSatelliteNodes(rawTree, categoryOrder);
    // Two-step version threading mirroring buildSidebarNodes (chrome/derive.tsx):
    // version-scoped data source above, then remap the resolved hrefs into
    // their versioned form (#3218). Unversioned pages: tree === groupedTree.
    let tree = groupedTree;
    if (currentVersion) {
      if (versionedDocsUrl) {
        tree = remapVersionedHrefs(groupedTree, currentVersion, locale, versionedDocsUrl);
      } else {
        // versionedDocsUrl is optional (back-compat for pre-#3218
        // SiteTreeNavDeps callers, see the field's doc comment) — silently
        // leaving hrefs unversioned would hide the misconfiguration, so warn
        // loudly.
        console.warn(
          "[zudo-doc] SiteTreeNavWrapper: currentVersion is set but SiteTreeNavDeps.versionedDocsUrl " +
            "was not provided — nav card hrefs will NOT be remapped into the version.",
        );
      }
    }

    if (tree.length === 0) return null;

    // IMPORTANT: Island({when:"idle"}) is preserved — not "load". This ensures
    // the SiteTreeNav mounts after the page is idle for performance (refs #1453).
    return Island({
      when: "idle",
      children: (
        <SiteTreeNav
          tree={tree}
          categoryOrder={categoryOrder}
          categoryIgnore={["inbox", "develop"]}
          ariaLabel={ariaLabel}
        />
      ),
    }) as unknown as JSX.Element;
  }

  return SiteTreeNavWrapper;
}
