/**
 * Public types for the framework-agnostic sidebar shell.
 *
 * The original Astro `sidebar.astro` mixed three concerns:
 *   1. Building `rootMenuItems` from `settings.headerNav` (with i18n
 *      label resolution and version-aware hrefs).
 *   2. Building the doc tree via `loadLocaleDocs` +
 *      `buildSidebarForSection`, then optionally remapping hrefs to
 *      versioned paths.
 *   3. Rendering a `<SidebarTree client:load .../>` Preact island.
 *
 * Concerns (1) and (2) depend on host-only helpers that v2 must not
 * reach into. The v2 shell exists to:
 *   - publish the prop shape so the host's data prep code can be
 *     typed against a v2-owned interface, and
 *   - render whatever the host hands in (typically the project's
 *     `<SidebarTree client:load .../>` island) inside a typed wrapper.
 *
 * The structural types here mirror `src/utils/docs.ts` (`NavNode`) and
 * `src/types/locale.ts` (`LocaleLink`) so the host can keep using its
 * existing data-prep pipeline without re-mapping fields.
 */

/**
 * One node in the navigation tree the SidebarTree island renders.
 * Matches `NavNode` in the host project's `src/utils/docs.ts`.
 */
export interface SidebarNavNode {
  slug: string;
  label: string;
  description?: string;
  position: number;
  href?: string;
  hasPage: boolean;
  children: SidebarNavNode[];
  sortOrder?: "asc" | "desc";
  collapsed?: boolean;
}

/**
 * Item in the root-level "Docusaurus-style" menu shown above the
 * doc tree on mobile / inside the back-to-menu view.
 */
export interface SidebarRootMenuItem {
  label: string;
  href: string;
  children?: SidebarRootMenuItem[];
}

/**
 * Locale switcher link rendered inside the mobile sidebar footer.
 * Matches `LocaleLink` in the host project's `src/types/locale.ts`.
 */
export interface SidebarLocaleLink {
  code: string;
  label: string;
  href: string;
  active: boolean;
}

/**
 * Props the SidebarTree island consumes. The shell forwards these
 * to whichever component the host plugs in via {@link SidebarProps.treeComponent}
 * (or to nothing, when the host renders its own tree as `children`).
 */
export interface SidebarTreeIslandProps {
  nodes: SidebarNavNode[];
  currentSlug?: string;
  rootMenuItems?: SidebarRootMenuItem[];
  backToMenuLabel?: string;
  localeLinks?: SidebarLocaleLink[];
  themeDefaultMode?: "light" | "dark";
}
