import type { FeatureModule } from "../compose.js";

/**
 * Image-enlarge feature.
 *
 * W7A (#1736): post-cutover, the image-enlarge island is mounted by the
 * pages/lib body-end wrapper (always present; runtime-gated via the
 * always-loaded stub-or-real ImageEnlarge component). Image-enlarge CSS
 * lives unconditionally in `templates/base/src/styles/global.css` — the
 * selectors only activate when the runtime mounts the .zd-enlarge-btn.
 */
export const imageEnlargeFeature: FeatureModule = () => ({
  name: "imageEnlarge",
  injections: [],
});
