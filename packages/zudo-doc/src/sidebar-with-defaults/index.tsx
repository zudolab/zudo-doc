/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// sidebar-with-defaults — factory for the locale-/version-aware Sidebar
// wrapper (epic #2344, S5).
//
// The host's `pages/lib/_sidebar-with-defaults.tsx` previously imported
// host singletons (`@/config/i18n`, `@/utils/*`). This factory receives
// the nav data builders as injected functions so the logic lives in the
// package while the host stub keeps the singleton imports.

import type { JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { SidebarTree } from "../sidebar-tree-island/index.js";
import type { SidebarNavNode, SidebarRootMenuItem } from "../sidebar/types.js";
import type { LocaleLink } from "../url-helpers/index.js";

export type { SidebarNavNode, SidebarRootMenuItem };

export interface SidebarWithDefaultsProps {
  /** Slug of the active doc page, used to highlight the current entry. */
  currentSlug?: string;
  /** Active locale string, e.g. "en", "ja". */
  lang?: string;
  /** Header-nav category matcher used to scope the tree (e.g. "guides"). */
  navSection?: string;
  /** Active version slug, when rendering inside `/v/{version}/...`. */
  currentVersion?: string;
  /**
   * Current page URL path used to build the locale-switcher links shown in
   * the mobile sidebar footer.
   */
  currentPath?: string;
}

/** Dependencies injected by the host stub. */
export interface SidebarWithDefaultsDeps {
  defaultLocale: string;
  localeCount: number;
  buildRootMenuItems: (lang: string, currentVersion: string | undefined) => SidebarRootMenuItem[];
  buildLocaleLinksForNav: (currentPath: string, lang: string, localeCount: number) => LocaleLink[] | undefined;
  buildSidebarNodes: (
    lang: string,
    navSection: string | undefined,
    currentVersion: string | undefined,
    emptyWhenUnsectioned?: boolean,
  ) => SidebarNavNode[];
  getThemeDefaultMode: () => "light" | "dark" | undefined;
  t: (key: string, lang: string) => string;
}

/**
 * Create a `SidebarWithDefaults` component bound to the host's nav builders.
 *
 * The host stub calls this once with its concrete dependencies and re-exports
 * the result.
 */
export function createSidebarWithDefaults(
  deps: SidebarWithDefaultsDeps,
): (props: SidebarWithDefaultsProps) => JSX.Element {
  const {
    defaultLocale,
    localeCount,
    buildRootMenuItems,
    buildLocaleLinksForNav,
    buildSidebarNodes,
    getThemeDefaultMode,
    t,
  } = deps;

  /**
   * Default-bearing host wrapper that performs sidebar data prep, then wraps
   * the project's `<SidebarTree>` Preact island in `<Island when="load">`.
   *
   * The v2 `<Sidebar>` shell is intentionally NOT used as the hydration
   * target here. Its `treeComponent` prop is a function, and zfb's
   * `Island.captureSerializableProps` drops function values during
   * `JSON.stringify`, so a `<Sidebar treeComponent={SidebarTree} ...>`
   * island would hydrate with `treeComponent=undefined`. Wrapping
   * `<SidebarTree>` directly mirrors the mobile `<SidebarToggle>` shape
   * (zudolab/zudo-doc#1459).
   */
  function SidebarWithDefaults(
    props: SidebarWithDefaultsProps,
  ): JSX.Element {
    const {
      currentSlug,
      lang = defaultLocale,
      navSection,
      currentVersion,
      currentPath = "",
    } = props;

    const rootMenuItems = buildRootMenuItems(lang, currentVersion);

    const backToMenuLabel = navSection ? t("nav.backToMenu", lang) : undefined;

    // emptyWhenUnsectioned=false: the desktop sidebar falls back to the FULL
    // tree for pages whose slug matches no headerNav categoryMatch (legacy
    // behavior) — only the header's mobile drawer collapses to root menu.
    const nodes = buildSidebarNodes(lang, navSection, currentVersion, false);

    const localeLinks = buildLocaleLinksForNav(currentPath, lang, localeCount);

    return Island({
      when: "load",
      children: (
        <SidebarTree
          nodes={nodes}
          currentSlug={currentSlug}
          rootMenuItems={rootMenuItems}
          backToMenuLabel={backToMenuLabel}
          localeLinks={localeLinks}
          themeDefaultMode={getThemeDefaultMode()}
        />
      ),
    }) as unknown as JSX.Element;
  }

  return SidebarWithDefaults;
}
