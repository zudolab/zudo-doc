// Shared types for the language- and version-switcher v2 ports.
//
// These are presentational primitives: every value the components need to
// render comes in via props. The package never reaches into the host
// project's settings/i18n/utils — keeping v2 fully decoupled from the
// legacy Astro src/ tree.

/**
 * Single link in the language-switcher's ordered list.
 *
 * Mirrors the shape of `LocaleLink` from src/types/locale.ts so existing
 * call-sites can pass their already-built links straight through.
 */
export interface LocaleLink {
  /** BCP-47 code, e.g. "en", "ja". Rendered as the anchor's `lang` attribute. */
  code: string;
  /** Display label (typically the uppercased code). */
  label: string;
  /** Pre-resolved href for the locale (already prefixed with the configured base). */
  href: string;
  /** True for the currently-active locale — rendered as plain text, not a link. */
  active: boolean;
}

/**
 * Single entry in the version-switcher's drop-down list.
 *
 * Slug is the URL-segment identifier; label is the user-visible string
 * (e.g. "v2.0", "1.x").
 */
export interface VersionEntry {
  slug: string;
  label: string;
}

/**
 * UI strings the version-switcher renders. Kept as a labels bag rather
 * than wired to a host-side i18n module so the v2 package stays
 * locale-system agnostic.
 */
export interface VersionSwitcherLabels {
  /** Label for the "latest" entry, e.g. "Latest" / "最新". */
  latest: string;
  /** Trigger-button prefix, e.g. "Version" / "バージョン". */
  switcher: string;
  /** `title` attribute for unavailable items, e.g. "Not available". */
  unavailable: string;
  /** Footer link label, e.g. "All versions". */
  allVersions: string;
}
