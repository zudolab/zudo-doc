/**
 * Production bootstrap for @takazudo/zudo-design-token-panel (zdtp).
 *
 * Imported as a side-effect from the body-end islands helper when
 * settings.designTokenPanel (or the deprecated alias colorTweakPanel) is
 * truthy. The dynamic import is gated there so this module is only bundled
 * when the feature is enabled.
 *
 * Lifecycle bridge: zdtp hard-codes astro:before-swap / astro:page-load
 * event names (upstream issue Takazudo/zudo-design-token-panel#50). We
 * re-dispatch those Astro event names whenever the zfb equivalents fire so
 * zdtp's internal listeners receive the signal they expect. Replace this
 * bridge with setLifecycleAdapter() once upstream issue #50 ships.
 */

import { configurePanel } from "@takazudo/zudo-design-token-panel";
import "@takazudo/zudo-design-token-panel/styles";
import { designTokenPanelConfig } from "@/config/design-token-panel-config";

configurePanel(designTokenPanelConfig);

// Lifecycle bridge: re-dispatch Astro lifecycle event names for zdtp's
// internal listeners when zfb navigation events fire.
// zfb fires "zfb:before-preparation" (before nav) and "zfb:after-swap" (after nav).
// Adjust these event names if your zfb version uses different names.
if (typeof document !== "undefined") {
  document.addEventListener("zfb:before-preparation", () => {
    document.dispatchEvent(new Event("astro:before-swap"));
  });
  document.addEventListener("zfb:after-swap", () => {
    document.dispatchEvent(new Event("astro:page-load"));
  });
}
