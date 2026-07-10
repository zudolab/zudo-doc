import type { FeatureModule } from "../compose.js";

/**
 * Footer pseudo-feature.
 *
 * Purely a `zudoDoc({ footer: {...} })` field (see `zfb-config-gen.ts`,
 * triggered by footerNavGroup / footerCopyright / footerTaglist) — the
 * footer chrome is fully package-owned. No injection required.
 */
export const footerFeature: FeatureModule = () => ({
  name: "footer",
  injections: [],
});
