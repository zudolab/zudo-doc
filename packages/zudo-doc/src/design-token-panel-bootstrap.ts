/**
 * Design-token panel (zdtp) WIRING MECHANISM.
 *
 * A side-effect module that calls `configurePanel(panelConfig)` and wires
 * zdtp's lifecycle hooks to zfb's navigation events via
 * `setLifecycleAdapter()`. Projects import this with their own
 * `designTokenPanelConfig` object — the DATA stays project-side.
 *
 * Usage (project-side `src/lib/design-token-panel-bootstrap.ts`):
 *
 *   import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
 *   import { designTokenPanelConfig } from "@/config/design-token-panel-config";
 *   bootstrapDesignTokenPanel(designTokenPanelConfig);
 *
 * Moved from the host's `src/lib/design-token-panel-bootstrap.ts` as part of
 * the package-first migration (S9a zudolab/zudo-doc#2333). The PanelConfig
 * DATA stays project-side.
 *
 * CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in the project's
 * `src/styles/global.css` so the panel chrome lands in the main page CSS
 * bundle (not a deferred chunk). Vite library mode strips the source CSS
 * import from the emitted JS, so the explicit CSS-side import is the
 * required pull point. See @takazudo/zdtp PORTABLE-CONTRACT.md §7.
 */

import { configurePanel, setLifecycleAdapter, type LifecycleAdapter, type PanelConfig } from "@takazudo/zdtp";
import {
  BEFORE_NAVIGATE_EVENT,
  AFTER_NAVIGATE_EVENT,
} from "./transitions/page-events.js";

/**
 * Bootstrap zdtp for a project. Calls `configurePanel(panelConfig)`,
 * drains any pre-hydration click queue, and wires the zdtp lifecycle
 * adapter to zfb's navigation events so persisted token overrides are
 * re-applied on every soft navigation.
 *
 * Call this once, as a side-effect import from the project's island
 * wrapper (`src/components/design-token-panel-bootstrap.tsx`).
 *
 * @param panelConfig - The project's `PanelConfig` object (data stays
 *   project-side in `src/config/design-token-panel-config.ts`).
 */
export function bootstrapDesignTokenPanel(panelConfig: PanelConfig): void {
  configurePanel(panelConfig);

  // Drain the pre-hydration click queue. If the user clicked the palette
  // button before this Island evaluated, the SSR shim in
  // _body-end-islands.tsx captured the event as a single boolean flag.
  // Calling __zdtpReadyClicks() here removes the shim listener and
  // re-dispatches once (at most) so the now-registered zdtp listener
  // picks it up and mounts the panel.
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
}
