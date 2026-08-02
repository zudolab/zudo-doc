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

import type { ComponentChildren } from "preact";

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
  /**
   * Whether links built from this item's `path` carry the active `/v/{version}`
   * prefix. `false` targets a route that has no versioned counterpart, so its
   * href must stay unversioned even when rendered under an active version.
   * Default `true`.
   */
  versioned?: boolean;
}

export interface HeaderNavItem extends HeaderNavChildItem {
  children?: HeaderNavChildItem[];
}

export type HeaderRightBuiltinComponentName =
  | "theme-toggle"
  | "language-switcher"
  | "version-switcher"
  | "github-link"
  | "search";

/**
 * A serializable name resolved against the package built-ins plus the host's
 * `headerRightComponents` chrome-binding registry. The intersection preserves
 * built-in autocomplete while allowing project-owned names.
 */
export type HeaderRightComponentName =
  | HeaderRightBuiltinComponentName
  | (string & {});

export type HeaderRightTriggerName = "design-token-panel" | "ai-chat";

export interface HeaderRightComponentItem {
  type: "component";
  component: HeaderRightComponentName;
}

/**
 * Exact props passed to a host `headerRightComponents` renderer. They mirror
 * the existing header-right dispatch context; no callable enters the
 * serialized {@link HeaderRightComponentItem}.
 */
export interface HeaderRightComponentProps {
  /** The serialized item that selected this renderer. */
  item: HeaderRightComponentItem;
  /** Zero-based position in the rendered `headerRightItems` array. */
  index: number;
  lang: Locale | undefined;
  githubRepoUrl: string | null;
  githubLabel: string;
  themeToggle: ComponentChildren;
  languageSwitcher: ComponentChildren;
  versionSwitcher: ComponentChildren;
  search: ComponentChildren;
  colorModeEnabled: boolean;
  hasLocales: boolean;
}

/** A callable-only host registry keyed by serialized component name. */
export type HeaderRightComponentRegistry = Record<
  string,
  (props: HeaderRightComponentProps) => ComponentChildren
>;

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
