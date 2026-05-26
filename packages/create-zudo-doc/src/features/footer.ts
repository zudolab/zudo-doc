import type { FeatureModule } from "../compose.js";

/**
 * Footer pseudo-feature.
 *
 * W7A (#1736): post-cutover, `pages/lib/_footer-with-defaults.tsx` mounts
 * the footer unconditionally — no doc-layout injection is required.
 */
export const footerFeature: FeatureModule = () => ({
  name: "footer",
  injections: [],
});
