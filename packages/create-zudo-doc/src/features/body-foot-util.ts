import type { FeatureModule } from "../compose.js";

/**
 * body-foot-util feature.
 *
 * W7A (#1736): post-cutover, the body-foot-util area is hosted by
 * `pages/lib/_doc-history-area.tsx` which wraps `BodyFootUtilArea`
 * unconditionally. The component itself runtime-gates on
 * `settings.bodyFootUtilArea`, so there is nothing to inject.
 */
export const bodyFootUtilFeature: FeatureModule = () => ({
  name: "bodyFootUtil",
  injections: [],
});
