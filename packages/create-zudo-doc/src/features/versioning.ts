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
 * Known limitation (pre-existing, not introduced by the minimal-scaffold
 * cutover — inherited from the same injected-DYNAMIC-route dev-mode gap the
 * locked manifest's `pages/docs/[[...slug]].tsx` stub exists to fix for the
 * primary doc route, tracked as a #2667 follow-up): the versioned doc
 * routes may still 404 in `zfb dev` since versioning has no stub of its own
 * in the locked manifest. `zfb build` is unaffected.
 */
export const versioningFeature: FeatureModule = () => ({
  name: "versioning",
  injections: [],
});
