/**
 * Production bootstrap for @takazudo/zdtp (zdtp).
 *
 * Imported as a side-effect from the body-end islands helper when
 * settings.designTokenPanel is truthy. The dynamic import is gated there so
 * this module is only bundled
 * when the feature is enabled.
 *
 * Lifecycle adapter: wires zdtp's navigation hooks to zfb's own navigation
 * events via setLifecycleAdapter(). onBeforeSwap maps to zfb:before-preparation
 * and onPageLoad maps to zfb:after-swap so zdtp re-applies persisted token
 * overrides on every soft navigation without depending on Astro events.
 */

import { configurePanel, setLifecycleAdapter, type LifecycleAdapter } from "@takazudo/zdtp";
// CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in
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

// zfb fires "zfb:before-preparation" (before nav) and "zfb:after-swap" (after nav).
// Adjust these event names if your zfb version uses different names.
if (typeof document !== "undefined") {
  const adapter: LifecycleAdapter = {
    onBeforeSwap(cb) {
      const handler = () => cb();
      document.addEventListener("zfb:before-preparation", handler);
      return () => document.removeEventListener("zfb:before-preparation", handler);
    },
    onPageLoad(cb) {
      const handler = () => cb();
      document.addEventListener("zfb:after-swap", handler);
      return () => document.removeEventListener("zfb:after-swap", handler);
    },
  };
  setLifecycleAdapter(adapter);
}
