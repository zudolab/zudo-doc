import type { FeatureModule } from "../compose.js";

/**
 * Search feature.
 *
 * W7A (#1736): post-cutover, `pages/lib/_header-with-defaults.tsx` includes
 * the search widget unconditionally — no header injection is required.
 * The search-index plugin is still wired by `zfb-config-gen.ts`.
 */
export const searchFeature: FeatureModule = () => ({
  name: "search",
  injections: [],
});
