// Boundary types for the v2 `<Header />` shell.
//
// The host project (`src/config/settings-types.ts`) owns the canonical
// shapes for these structures. We copy them here so v2 has its own
// self-contained type surface — consumers import `HeaderNavItem` /
// `HeaderRightItem` from `@takazudo/zudo-doc/header` and don't reach
// into the host's `@/config` alias.
//
// Structural-only: the v2 copies are intentionally simple and broad. If
// the host extends a field (e.g. adds a new `HeaderRightTriggerName`),
// downstream consumers may continue to use the v2 types until the v2
// package itself widens them. Changes here are v2 breaking changes.

/**
 * Locale code as seen by the header. Widened from the host's literal
 * union (`"en" | "ja" | …`) to plain `string` at the v2 boundary so the
 * package can render for any project's locale set without a generic
 * parameter (super-epic #1724, sub-issue #1729).
 */
export type Locale = string;

export interface HeaderNavChildItem {
  label: string;
  labelKey?: string;
  path: string;
  categoryMatch?: string;
}

export interface HeaderNavItem extends HeaderNavChildItem {
  children?: HeaderNavChildItem[];
}

export type HeaderRightComponentName =
  | "theme-toggle"
  | "language-switcher"
  | "version-switcher"
  | "github-link"
  | "search";

export type HeaderRightTriggerName = "design-token-panel" | "ai-chat";

export interface HeaderRightComponentItem {
  type: "component";
  component: HeaderRightComponentName;
}

export interface HeaderRightTriggerItem {
  type: "trigger";
  trigger: HeaderRightTriggerName;
}

export interface HeaderRightLinkItem {
  type: "link";
  href: string;
  label?: string;
  ariaLabel?: string;
  icon?: "github";
}

export interface HeaderRightHtmlItem {
  type: "html";
  html: string;
}

export type HeaderRightItem =
  | HeaderRightComponentItem
  | HeaderRightTriggerItem
  | HeaderRightLinkItem
  | HeaderRightHtmlItem;
