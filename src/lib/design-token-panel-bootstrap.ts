/**
 * Production bootstrap for @takazudo/zdtp (zdtp).
 *
 * Imported as a side-effect from _body-end-islands.tsx when
 * settings.designTokenPanel (or the deprecated alias colorTweakPanel) is
 * truthy. The dynamic import is gated there so this module is only bundled
 * when the feature is enabled.
 *
 * Lifecycle adapter: wires zdtp's navigation hooks to zfb's own navigation
 * events via setLifecycleAdapter(). onBeforeSwap maps to BEFORE_NAVIGATE_EVENT
 * and onPageLoad maps to AFTER_NAVIGATE_EVENT so zdtp re-applies persisted
 * token overrides on every soft navigation without depending on Astro events.
 */

import { configurePanel, setLifecycleAdapter, type LifecycleAdapter } from "@takazudo/zdtp";
// CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in
// src/styles/global.css so the panel chrome lands in the main page CSS bundle
// (not a deferred chunk). Vite library mode strips the source CSS import from
// the emitted JS, so the explicit CSS-side import is the required pull point.
import { designTokenPanelConfig } from "@/config/design-token-panel-config";
import {
  BEFORE_NAVIGATE_EVENT,
  AFTER_NAVIGATE_EVENT,
} from "@takazudo/zudo-doc/transitions";

configurePanel(designTokenPanelConfig);

// Drain the pre-hydration click queue. If the user clicked the palette button
// before this Island evaluated, the SSR shim in _body-end-islands.tsx captured
// the event as a single boolean flag. Calling __zdtpReadyClicks() here removes
// the shim listener and re-dispatches once (at most) so the now-registered zdtp
// listener picks it up and mounts the panel.
if (typeof window !== "undefined") {
  (window as { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks?.();
}

if (typeof document !== "undefined") {
  const adapter: LifecycleAdapter = {
    onBeforeSwap(cb) {
      const handler = () => cb();
      document.addEventListener(BEFORE_NAVIGATE_EVENT, handler);
      return () => document.removeEventListener(BEFORE_NAVIGATE_EVENT, handler);
    },
    onPageLoad(cb) {
      const handler = () => cb();
      document.addEventListener(AFTER_NAVIGATE_EVENT, handler);
      return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handler);
    },
  };
  setLifecycleAdapter(adapter);
}
