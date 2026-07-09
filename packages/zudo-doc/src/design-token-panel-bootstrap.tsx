"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

/**
 * Design-token panel (zdtp) WIRING MECHANISM + PACKAGE-DEFAULT ISLAND (#2658,
 * epic Minimal Scaffold #2651).
 *
 * `bootstrapDesignTokenPanel` is a callable that configures zdtp's panel and
 * wires its lifecycle hooks to zfb's navigation events via
 * `setLifecycleAdapter()`. Projects import it with their own PanelConfig
 * DATA — which stays project-side (or, since #2658, the PACKAGE-DEFAULT data
 * from `@takazudo/zudo-doc/design-token-panel-config`).
 *
 * Two calling shapes (both supported):
 *
 *   // Mode-scoped builder — rebuilds the panel per light/dark mode on every
 *   // `color-scheme-changed` toggle:
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
 * `DesignTokenPanelBootstrap` (below) is the PACKAGE-OWNED island component
 * that wires the mode-scoped builder for package-owned routes with no host
 * config file — the #2658 "Approach (a)" package default. It resolves its
 * builder from the `virtual:zudo-doc-design-token-panel-config` virtual
 * module the routes plugin registers (`../plugins/routes.ts`): absent a host
 * `designTokenPanelConfigModule` override, that resolves to
 * `@takazudo/zudo-doc/design-token-panel-config`'s `buildDesignTokenPanelConfig`.
 * `packages/zudo-doc/src/routes/_chrome.tsx` statically imports it so zfb's
 * island scanner walks route → `_chrome` → here (mirrors the DocHistory
 * #2480 static-import chain). A host that ejects entirely (its own
 * `src/lib/*` + `src/components/*`, like the pre-#2658 showcase) never
 * reaches this component — it only calls `bootstrapDesignTokenPanel` itself,
 * same as always.
 *
 * KNOWN COUPLING: `DesignTokenPanelBootstrap`'s top-level import of
 * `virtual:zudo-doc-design-token-panel-config` requires the routes plugin
 * (`settings.packageOwnedRoutes`, default `true`) to be active in the
 * consuming project, since that plugin is what registers the virtual module.
 * A project that explicitly sets `packageOwnedRoutes: false` AND wants to
 * reuse the bare `bootstrapDesignTokenPanel` export for its own hand-wired
 * component (as every current consumer's `src/lib/design-token-panel-bootstrap.ts`
 * does) is unaffected — that import graph never reaches `DesignTokenPanelBootstrap`
 * — but a `packageOwnedRoutes: false` project must not import
 * `DesignTokenPanelBootstrap` itself.
 *
 * Moved from the host's `src/lib/design-token-panel-bootstrap.ts` as part of
 * the package-first migration (S9a zudolab/zudo-doc#2333); mode-scoped rebuild
 * wiring added in zudolab/zudo-doc#2610; package-default island added in #2658.
 *
 * CSS is pulled via `@import "@takazudo/zdtp/styles.css"` in the project's
 * `src/styles/global.css` so the panel chrome lands in the main page CSS
 * bundle (not a deferred chunk). Vite library mode strips the source CSS
 * import from the emitted JS, so the explicit CSS-side import is the
 * required pull point. See @takazudo/zdtp PORTABLE-CONTRACT.md §7.
 */

import type { JSX } from "preact";
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
// Host-callables channel, third virtual module (#2658, mirrors #2501's
// chromeBindingsModule): absent `settings.designTokenPanelConfigModule` →
// re-exports the package default (`@takazudo/zudo-doc/design-token-panel-config`);
// present → re-exports the host's module. Registered unconditionally by the
// routes plugin (`../plugins/routes.ts`) whenever `packageOwnedRoutes` is on.
// Not present on disk; the package ships ambient typings for it
// (`routes/_virtual.d.ts`).
import { buildDesignTokenPanelConfig } from "virtual:zudo-doc-design-token-panel-config";

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
 * The panel's own open-state key for a given instance (`${storagePrefix}-open`,
 * value `"1"` when open). This is the PUBLIC open-state mirror, not a private
 * zdtp storage key — we read it (never write it) to decide whether to re-mount
 * after a reconfigure. Derived from the active instance's prefix
 * (`handle.instanceId`, which equals its `storagePrefix`) so ANY host prefix
 * works, not just the showcase's `zudo-doc-tweak`.
 */
function openStateKey(instancePrefix: string): string {
  return `${instancePrefix}-open`;
}

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
        // Read the open state BEFORE destroy (destroy keeps localStorage),
        // keyed off the CURRENT instance's prefix so a non-showcase host prefix
        // still round-trips correctly.
        const wasOpen = localStorage.getItem(openStateKey(handle.instanceId)) === "1";
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

// ---------------------------------------------------------------------------
// DesignTokenPanelBootstrap — package-default island component (#2658).
// ---------------------------------------------------------------------------

/**
 * Guards the bootstrap call to run at most once per module instance — the
 * component itself may run during SSR (harmless no-op: `bootstrapDesignTokenPanel`
 * bails out on its own `typeof window === "undefined"` guard) as well as on
 * client hydration, and re-running `configurePanel` on every render would
 * re-mount the panel each time. Module-scoped rather than `useRef`/`useEffect`
 * so the guard is cheap and framework-lifecycle-independent (this component
 * has no children to schedule effects around).
 */
let bootstrapped = false;

/**
 * The package-default `<DesignTokenPanelBootstrap/>` island: mounted (via
 * `Island({ when: "load" })`, no `ssrFallback` — it renders nothing on either
 * side) by `../doc-body-end-islands/index.tsx` when `settings.designTokenPanel`
 * is on, gated the same way `AiChatModal`/`ImageEnlarge`/`MermaidEnlarge` are.
 * On first render, calls `bootstrapDesignTokenPanel` with the mode-scoped
 * `buildDesignTokenPanelConfig` builder resolved from
 * `virtual:zudo-doc-design-token-panel-config` (package default, or the
 * host's `designTokenPanelConfigModule` override).
 *
 * `displayName` pinned explicitly (belt-and-braces, matching
 * `AiChatModal`/`ImageEnlarge`/`MermaidEnlarge`/`DocHistory`) so zfb's
 * `captureComponentName` emits a stable `data-zfb-island="DesignTokenPanelBootstrap"`
 * marker independent of minification.
 */
export function DesignTokenPanelBootstrap(): JSX.Element | null {
  if (!bootstrapped) {
    bootstrapped = true;
    bootstrapDesignTokenPanel(buildDesignTokenPanelConfig);
  }
  return null;
}
DesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";
