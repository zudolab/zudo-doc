// E5 framework primitives — i18n + version chrome.
//
// This subpath publishes the layout-level locale and version switchers.
// Both are pure presentational components: the host project pre-builds
// the data they need (locale links, version URLs, availability sets,
// label strings) so v2 stays free of any settings/i18n/utils coupling.
//
// Usage from the host project:
//
//   import {
//     LanguageSwitcher,
//     VersionSwitcher,
//     VERSION_SWITCHER_INIT_SCRIPT,
//   } from "@takazudo/zudo-doc/i18n-version";
//
// Mount the version-switcher init script once per page (e.g. in the
// layout's body-end scripts slot) — it idempotently re-binds after
// View Transitions navigation.

export { LanguageSwitcher } from "./language-switcher.js";
export type { LanguageSwitcherProps } from "./language-switcher.js";

export {
  VersionSwitcher,
  VERSION_SWITCHER_INIT_SCRIPT,
  VERSION_SWITCHER_VISIBILITY_STYLE,
} from "./version-switcher.js";
export type { VersionSwitcherProps } from "./version-switcher.js";

export { VersionBanner } from "./version-banner.js";
export type { VersionBannerProps, VersionBannerLabels } from "./version-banner.js";

export type {
  LocaleLink,
  VersionEntry,
  VersionSwitcherLabels,
} from "./types.js";
