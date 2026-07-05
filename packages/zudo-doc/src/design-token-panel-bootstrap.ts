/**
 * Design-token panel (zdtp) WIRING MECHANISM.
 *
 * A side-effect module that configures zdtp's panel and wires its lifecycle
 * hooks to zfb's navigation events via `setLifecycleAdapter()`. Projects import
 * this with their own PanelConfig DATA — which stays project-side.
 *
 * Two calling shapes (both supported):
 *
 *   // Mode-scoped builder (showcase host) — rebuilds the panel per light/dark
 *   // mode on every `color-scheme-changed` toggle:
 *   import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
 *   import { buildDesignTokenPanelConfig } from "@/config/design-token-panel-config";
 *   bootstrapDesignTokenPanel(buildDesignTokenPanelConfig);
 *
 *   // Plain config (back-compat — generated projects on the old shape):
 *   import { designTokenPanelConfig } from "@/config/design-token-panel-config";
 *   bootstrapDesignTokenPanel(designTokenPanelConfig);
 *
 * A plain-config caller gets NO toggle listener (a static config has nothing to
 * rebuild), so existing generated projects keep working with zero changes.
 *
 * Moved from the host's `src/lib/design-token-panel-bootstrap.ts` as part of
 * the package-first migration (S9a zudolab/zudo-doc#2333); mode-scoped rebuild
 * wiring added in zudolab/zudo-doc#2610.
 *
 * CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in the project's
 * `src/styles/global.css` so the panel chrome lands in the main page CSS
 * bundle (not a deferred chunk). Vite library mode strips the source CSS
 * import from the emitted JS, so the explicit CSS-side import is the
 * required pull point. See @takazudo/zdtp PORTABLE-CONTRACT.md §7.
 */

import {
  configurePanel,
  setLifecycleAdapter,
  showDesignTokenPanel,
  type LifecycleAdapter,
  type PanelConfig,
  type PanelInstanceHandle,
} from "@takazudo/zdtp";
import {
  BEFORE_NAVIGATE_EVENT,
  AFTER_NAVIGATE_EVENT,
} from "./transitions/page-events.js";

/** Active color-scheme mode, read from `<html data-theme>`. */
type ColorSchemeMode = "light" | "dark";

/**
 * A per-mode PanelConfig factory. Supplied by hosts that want the panel's
 * defaults to follow the live light/dark mode (see `buildDesignTokenPanelConfig`
 * in the host's `design-token-panel-config.ts`).
 */
export type PanelConfigBuilder = (mode: ColorSchemeMode) => PanelConfig;

/**
 * The `color-scheme-changed` window event ThemeToggle dispatches after toggling
 * `<html data-theme>` (see `theme-toggle/color-scheme-sync.ts`). Cross-package
 * contract — do not rename.
 */
const COLOR_SCHEME_CHANGED_EVENT = "color-scheme-changed";

/**
 * The panel's own open-state key (`${storagePrefix}-open`, value `"1"` when
 * open). This is the PUBLIC open-state mirror, not a private zdtp storage key —
 * we read it (never write it) to decide whether to re-mount after a reconfigure.
 */
const OPEN_STATE_KEY = "zudo-doc-tweak-open";

/** Read the active mode from `<html data-theme>`, defaulting to `light`. */
function readMode(): ColorSchemeMode {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/**
 * Bootstrap zdtp for a project. Configures the panel, drains any pre-hydration
 * click queue, and wires the zdtp lifecycle adapter to zfb's navigation events
 * so persisted token overrides re-apply on every soft navigation.
 *
 * When passed a `PanelConfigBuilder`, also wires a `color-scheme-changed`
 * listener that rebuilds the panel per light/dark mode (see the toggle sequence
 * below). When passed a plain `PanelConfig`, no toggle listener is registered.
 *
 * Call this once, as a side-effect import from the project's island wrapper
 * (`src/components/design-token-panel-bootstrap.tsx`).
 *
 * @param configOrBuilder - The project's `PanelConfig`, or a `(mode) =>
 *   PanelConfig` builder for mode-scoped rebuilds. DATA stays project-side in
 *   `src/config/design-token-panel-config.ts`.
 */
export function bootstrapDesignTokenPanel(
  configOrBuilder: PanelConfig | PanelConfigBuilder,
): void {
  // SSR guard: zfb evaluates the client-island bundle during SSR, where
  // `window`/`document` are absent. `readMode()` (and configurePanel's mount)
  // touch `document`; unguarded top-level access disables the renderer
  // (empty-page cache), so the whole browser-only body is gated here.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const isBuilder = typeof configOrBuilder === "function";
  const builder: PanelConfigBuilder = isBuilder
    ? configOrBuilder
    : () => configOrBuilder;

  let handle: PanelInstanceHandle = configurePanel(builder(readMode()));

  // Register the color-scheme-changed listener BEFORE draining the click queue
  // (a queued click can mount the panel first and flip listener order). Only a
  // builder caller has anything to rebuild — a plain config is mode-agnostic.
  if (isBuilder) {
    let pendingMode: ColorSchemeMode = readMode();
    let timer: ReturnType<typeof setTimeout> | null = null;

    window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, () => {
      pendingMode = readMode();
      // Coalesce rapid toggles: a single macrotask reconfigures to the LATEST
      // mode. Without this, light→dark→light before the timer fires would run
      // three destroy/reconfigure cycles instead of one.
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        const mode = pendingMode;
        // Read the open state BEFORE destroy (destroy keeps localStorage).
        const wasOpen = localStorage.getItem(OPEN_STATE_KEY) === "1";
        // MACROTASK (setTimeout 0), NOT a microtask: zdtp flushes its own
        // mount-time `color-scheme-changed` handler (clear applied vars +
        // reseed) on microtasks/rAF, so a macrotask guarantees that settled
        // before we destroy + reconfigure with the new mode's defaults.
        handle.destroy();
        handle = configurePanel(builder(mode));
        // configurePanel with a structurally-different config after destroy is
        // the ONLY sanctioned swap (a same-prefix reconfigure otherwise throws).
        if (wasOpen) showDesignTokenPanel();
      }, 0);
    });
  }

  // Drain the pre-hydration click queue. If the user clicked the palette
  // button before this Island evaluated, the SSR shim in
  // _body-end-islands.tsx captured the event as a single boolean flag.
  // Calling __zdtpReadyClicks() here removes the shim listener and
  // re-dispatches once (at most) so the now-registered zdtp listener
  // picks it up and mounts the panel.
  (window as { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks?.();

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
