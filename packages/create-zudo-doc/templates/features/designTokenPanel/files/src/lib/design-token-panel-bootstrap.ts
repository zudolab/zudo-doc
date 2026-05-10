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
// CSS is pulled via `@import "@takazudo/zudo-design-token-panel/styles.css"` in
// src/styles/global.css so the panel chrome lands in the main page CSS bundle
// (not a deferred chunk). Vite library mode strips the source CSS import from
// the emitted JS, so the explicit CSS-side import is the required pull point.
import { designTokenPanelConfig } from "@/config/design-token-panel-config";

configurePanel(designTokenPanelConfig);

// Drain the pre-hydration click queue. If the user clicked the palette button
// before this module evaluated, a pre-hydration shim captured the event as a
// single boolean flag. Calling __zdtpReadyClicks() here removes the shim
// listener and re-dispatches once (at most) so the now-registered zdtp
// listener picks it up and mounts the panel.
if (typeof window !== "undefined") {
  (window as { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks?.();
}

// Idempotency guard: the two document.addEventListener calls below must be
// installed at most once per page lifecycle. Module caching usually guarantees
// this, but a future refactor could re-evaluate the module. The flag makes it
// provably one-shot.
// zfb fires "zfb:before-preparation" (before nav) and "zfb:after-swap" (after nav).
// Adjust these event names if your zfb version uses different names.
if (typeof document !== "undefined") {
  if (!(document as Document & { __zdtpAstroBridgeInstalled?: boolean }).__zdtpAstroBridgeInstalled) {
    (document as Document & { __zdtpAstroBridgeInstalled?: boolean }).__zdtpAstroBridgeInstalled = true;
    document.addEventListener("zfb:before-preparation", () => {
      document.dispatchEvent(new Event("astro:before-swap"));
    });
    document.addEventListener("zfb:after-swap", () => {
      document.dispatchEvent(new Event("astro:page-load"));
    });
  }
}
