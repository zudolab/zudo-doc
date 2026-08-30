import type { FeatureModule } from "../compose.js";

/**
 * Versioning feature.
 *
 * Purely a `zudoDoc({ versions: [] })` field (see `zfb-config-gen.ts`) — the
 * versioned doc routes (`/docs/versions`, `/v/[version]/docs/[[...slug]]`,
 * and their i18n counterparts) are PACKAGE-INJECTED
 * (`settings.packageOwnedRoutes`, default on) and render through the shared
 * `renderDocPage` chrome. `templates/features/versioning/files/` has been
 * empty since #2390 — there is no host stub left to copy or postProcess.
 *
 * zfb 2.13.1 renders these injected version routes in both dev and build, so
 * versioning needs no version-specific host stub. The primary and locale doc
 * stubs remain explicit host-owned seams.
 */
export const versioningFeature: FeatureModule = () => ({
  name: "versioning",
  injections: [],
});
