import type { FeatureModule } from "../compose.js";

/**
 * Versioning feature.
 *
 * W7A (#1736): post-cutover, the pages/lib wrappers gate `VersionSwitcher`
 * and `VersionBanner` on `settings.versions`. Doc-layout flow is handled by
 * route enumerators + `_inline-version-switcher.tsx`. Conditional page files
 * (version routes) are handled by #1738 (W7C).
 */
export const versioningFeature: FeatureModule = () => ({
  name: "versioning",
  injections: [],
});
