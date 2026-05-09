/**
 * SPIKE SHIM — W2-1 zdtp migration spike.
 *
 * Mounts the new @takazudo/zudo-design-token-panel (zdtp) alongside the legacy
 * panel, gated on ?dtp=v2 URL query. This file is the bootstrap for W3-1a
 * and will be deleted once W3-1a ships the production bootstrap.
 *
 * Lifecycle bridge: zdtp hard-codes astro:before-swap / astro:page-load
 * event names (upstream issue #50). As a spike workaround, we re-dispatch
 * those Astro events whenever the zfb equivalents fire, so zdtp's internal
 * listeners get the signal they expect. W3-1a will replace this with the
 * setLifecycleAdapter() API once upstream issue #50 is resolved.
 *
 * Known limitations (RED items from W1-1 gap doc):
 *   - TweakState / emptyOverrides not exported from main entry (#49) — not
 *     needed by this file; affects design-token-serde.ts in W3-1a.
 *   - Typography-id rename map bug (#51) — zdtp will silently corrupt
 *     persisted font overrides until upstream fix ships.
 *   - Lifecycle bridge below is a SHIM, not the production approach.
 */

import { configurePanel } from "@takazudo/zudo-design-token-panel";
import "@takazudo/zudo-design-token-panel/styles";
import { designTokenPanelConfig } from "@/config/design-token-panel-config";
import {
  BEFORE_NAVIGATE_EVENT,
  AFTER_NAVIGATE_EVENT,
} from "@zudo-doc/zudo-doc-v2/transitions";

// Configure the zdtp panel with the zudo-doc PanelConfig assembled in W1-3.
configurePanel(designTokenPanelConfig);

// Bridge zfb → astro events so zdtp's hard-coded astro:before-swap /
// astro:page-load listeners (upstream issue #50) receive the signal
// when zfb's view-transition lifecycle fires.
// W3-1a replaces this with setLifecycleAdapter() once issue #50 ships.
document.addEventListener(BEFORE_NAVIGATE_EVENT, () => {
  document.dispatchEvent(new Event("astro:before-swap"));
});
document.addEventListener(AFTER_NAVIGATE_EVENT, () => {
  document.dispatchEvent(new Event("astro:page-load"));
});
