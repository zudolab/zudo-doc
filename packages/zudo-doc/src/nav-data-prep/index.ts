// nav-data-prep — parameterized nav data-prep pure functions (epic #2344, S5).
//
// The host's `pages/lib/_nav-data-prep.ts` previously read `settings.headerNav`,
// `settings.colorMode`, and called helpers from `@/utils/base`, `@/utils/sidebar`,
// `@/config/i18n`. This module receives those as arguments so the logic lives
// in the package while the host stub keeps the singleton imports.
//
// Pure functions — no node builtins, no `@/` host alias imports.

import type { LocaleLink } from "../url-helpers/index.js";

export type { LocaleLink };

/** Minimal nav node shape required by nav-data-prep functions. */
export interface NavDataPrepNode {
  slug: string;
  href?: string;
  label: string;
  children: NavDataPrepNode[];
}

/** Minimal headerNav item shape the nav-data-prep functions need. */
export interface NavDataPrepHeaderNavItem {
  label: string;
  labelKey?: string;
  path: string;
  /** Suppress the `/v/{version}` prefix on this item's href when `false`. Default `true`. */
  versioned?: boolean;
  children?: Array<{
    label: string;
    labelKey?: string;
    path: string;
    /** Suppress the `/v/{version}` prefix on this child's href when `false`. Default `true`. */
    versioned?: boolean;
  }>;
}

/** Color mode config shape (subset of settings.colorMode). */
export interface NavDataPrepColorMode {
  defaultMode?: string;
}

/** Root-menu item emitted by {@link buildRootMenuItems}. */
export interface RootMenuItem {
  label: string;
  href: string;
  children?: Array<{
    label: string;
    href: string;
  }>;
}

/**
 * Walk the nav tree and rewrite each node's `href` to its versioned form.
 *
 * `buildNavTree` always emits hrefs via `docsUrl()`; when the active route
 * lives under `/v/{version}/...` we need the same nodes pointing at the
 * versioned URL so internal nav clicks stay inside the version. Skips
 * nodes without an href (link-only or category placeholders).
 *
 * Parameterized version of `remapVersionedHrefs` from `_nav-data-prep.ts` —
 * receives `versionedDocsUrl` as an argument instead of importing from `@/utils/base`.
 *
 * Generic so callers can pass their concrete node type and get back the same
 * type without an unsafe cast.
 */
export function remapVersionedHrefs<T extends NavDataPrepNode>(
  nodes: T[],
  version: string,
  nodeLang: string,
  versionedDocsUrl: (slug: string, version: string, lang: string) => string,
): T[] {
  return nodes.map((node) => {
    const children =
      node.children.length > 0
        ? remapVersionedHrefs(node.children as T[], version, nodeLang, versionedDocsUrl)
        : node.children;

    if (!node.href || node.slug.startsWith("__link__")) {
      return children !== node.children ? { ...node, children } : node;
    }

    const newHref = versionedDocsUrl(node.slug, version, nodeLang);
    return { ...node, href: newHref, children };
  });
}

/**
 * Root-menu items derived from headerNav (mobile "back to menu" list).
 *
 * Parameterized version of `buildRootMenuItems` from `_nav-data-prep.ts` —
 * receives the headerNav, `t()`, and `navHref` as arguments instead of
 * importing from `@/config/settings`, `@/config/i18n`, `@/utils/base`.
 */
export function buildRootMenuItems(
  lang: string,
  currentVersion: string | undefined,
  headerNav: NavDataPrepHeaderNavItem[],
  t: (key: string, lang: string) => string,
  navHref: (
    path: string,
    lang: string | undefined,
    version: string | undefined,
    versioned?: boolean,
  ) => string,
): RootMenuItem[] {
  return headerNav.map((item) => ({
    label: item.labelKey
      ? t(item.labelKey, lang)
      : item.label,
    href: navHref(item.path, lang, currentVersion, item.versioned),
    children: item.children?.map((child) => ({
      label: child.labelKey
        ? t(child.labelKey, lang)
        : child.label,
      href: navHref(child.path, lang, currentVersion, child.versioned),
    })),
  }));
}

/**
 * Locale-switcher links for the mobile sidebar footer and language switcher.
 * Returns `undefined` when only one locale is configured (single-locale guard).
 *
 * Parameterized version of `buildLocaleLinksForNav` from `_nav-data-prep.ts`.
 */
export function buildLocaleLinksForNav(
  currentPath: string,
  lang: string,
  localeCount: number,
  buildLocaleLinks: (path: string, lang: string) => LocaleLink[],
): LocaleLink[] | undefined {
  return localeCount > 1 ? buildLocaleLinks(currentPath, lang) : undefined;
}

/**
 * Extract the configured default color mode from the colorMode setting.
 * Returns `undefined` when color mode is not configured (single-scheme projects).
 * Only the string values `"light"` and `"dark"` are returned — any other
 * `defaultMode` value is treated as absent.
 *
 * Parameterized version of `getThemeDefaultMode` from `_nav-data-prep.ts`.
 */
export function getThemeDefaultMode(
  colorMode: NavDataPrepColorMode | null | undefined | false,
): "light" | "dark" | undefined {
  if (!colorMode) return undefined;
  const mode = colorMode.defaultMode;
  return mode === "light" || mode === "dark" ? mode : undefined;
}
