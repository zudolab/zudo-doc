"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

/**
 * Design-token panel (zdtp) WIRING MECHANISM + PACKAGE-DEFAULT ISLAND (#2658,
 * epic Minimal Scaffold #2651).
 *
 * `bootstrapDesignTokenPanel` is a callable that configures zdtp's panel and
 * wires its lifecycle hooks to zfb's navigation events via
 * `setLifecycleAdapter()`. It receives a mode-scoped PanelConfig builder —
 * either a project override or the package default from
 * `@takazudo/zudo-doc/design-token-panel-config`.
 *
 * The current call shape is a mode-scoped builder. It rebuilds the panel per
 * light/dark mode on every `color-scheme-changed` toggle:
 *
 *   import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
 *   import { buildDesignTokenPanelConfig } from "@/config/design-token-panel-config";
 *   bootstrapDesignTokenPanel(buildDesignTokenPanelConfig);
 *
 * `DesignTokenPanelBootstrap` (below) is the PACKAGE-OWNED island component
 * that wires the mode-scoped builder for package-owned routes with no host
 * config file — the #2658 "Approach (a)" package default. It resolves its
 * builder from the `virtual:zudo-doc-design-token-panel-config` virtual
 * module the routes plugin registers (`../plugins/routes.ts`): absent a host
 * `designTokenPanelConfigModule` override, that resolves to
 * `@takazudo/zudo-doc/design-token-panel-config`'s `buildDesignTokenPanelConfig`.
 * `packages/zudo-doc/src/chrome/derive.tsx` statically imports it so zfb's
 * island scanner walks route → chrome → derive → here (mirrors the DocHistory
 * #2480 static-import contract). A host that ejects entirely can call
 * `bootstrapDesignTokenPanel` with its own builder, but current package-owned
 * routes use this component directly.
 *
 * KNOWN COUPLING: `DesignTokenPanelBootstrap`'s top-level import of
 * `virtual:zudo-doc-design-token-panel-config` requires the routes plugin
 * (`settings.packageOwnedRoutes`, default `true`) to be active in the
 * consuming project, since that plugin is what registers the virtual module.
 * A project that explicitly sets `packageOwnedRoutes: false` AND wants to
 * reuse the bare `bootstrapDesignTokenPanel` export for its own component is
 * unaffected — that import graph never reaches `DesignTokenPanelBootstrap` —
 * but a `packageOwnedRoutes: false` project must not import the package island
 * component itself.
 *
 * Package-first wiring landed in S9a zudolab/zudo-doc#2333; mode-scoped rebuild
 * wiring was added in zudolab/zudo-doc#2610 and the package-default island in
 * #2658.
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
// Theme-pack layer (ADR docs/adr/theme-packs.md Decision 4, #2822): the active
// pack scopes zdtp's storage prefix, and the engine's `theme-pack-changed`
// event triggers a destroy → clear → reconfigure cycle parallel to the
// existing `color-scheme-changed` one. Plain browser-only helpers — importing
// them does not widen the island graph (no "use client" in that module).
import {
  DEFAULT_THEME_PACK_SLUG,
  THEME_PACK_CHANGED_EVENT,
  readThemePackFromDom,
} from "./theme-pack-switcher/theme-pack-sync.js";
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
 * A per-mode PanelConfig factory. The package default and host overrides use
 * this same shape so panel defaults follow the live light/dark mode.
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

/**
 * Whether the given instance's panel is currently open, per its public
 * open-state mirror key. Guarded: with browser storage disabled,
 * `localStorage.getItem` throws — an unguarded read inside the rebuild timers
 * would abort the whole destroy/reconfigure cycle and leave the panel bound
 * to a stale mode/pack (the theme-pack engine treats storage as best-effort
 * and still commits + dispatches). Treat unreadable state as "closed".
 */
function readOpenState(instancePrefix: string): boolean {
  try {
    return localStorage.getItem(openStateKey(instancePrefix)) === "1";
  } catch {
    return false;
  }
}

/** Read the active mode from `<html data-theme>`, defaulting to `light`. */
function readMode(): ColorSchemeMode {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/**
 * Theme-pack storage-prefix rule (ADR theme-packs.md Decision 4), enforced
 * CENTRALLY here — never per-builder, so host builders supplied via
 * `designTokenPanelConfigModule` cannot cross-contaminate namespaces even if
 * unaware of packs:
 *
 * - active pack `default` → the builder's `storagePrefix` stays BYTE-UNCHANGED
 *   (the existing-user carry-over guarantee: `zudo-doc-tweak` keys keep
 *   working on the stock look).
 * - any other pack → `${storagePrefix}--<slug>` (double hyphen avoids
 *   colliding with zdtp's own `-open`/version suffixes). zdtp derives every
 *   key — including the `${prefix}-open` open-state mirror — from the prefix,
 *   so tweaks saved under pack A are invisible under pack B and restored
 *   verbatim on switch-back.
 *
 * The `PanelConfigBuilder` signature stays `(mode) => PanelConfig` — this is a
 * post-process of the RETURNED config, not a builder-contract change.
 */
export function withPackScopedStoragePrefix(
  config: PanelConfig,
  activePack: string,
): PanelConfig {
  if (activePack === DEFAULT_THEME_PACK_SLUG) return config;
  return { ...config, storagePrefix: `${config.storagePrefix}--${activePack}` };
}

/**
 * Every CSS custom-property name the given PanelConfig declares as an
 * override target: the `cssVar` of every tab/tier item, PLUS the color tabs'
 * `colorExtras.baseRoles` values — zdtp's apply pipeline writes those
 * base-role variables (background/foreground/cursor/selection) inline too,
 * and they are not represented by any `TierItem.cssVar` (review finding).
 */
function collectDeclaredTokenNames(config: PanelConfig): string[] {
  const names: string[] = [];
  for (const tab of config.tabs ?? []) {
    for (const tier of tab.tiers ?? []) {
      for (const item of tier.items ?? []) {
        names.push(item.cssVar);
      }
    }
    const baseRoles = tab.colorExtras?.baseRoles;
    if (baseRoles) {
      for (const cssVar of Object.values(baseRoles)) {
        if (typeof cssVar === "string" && cssVar.length > 0) {
          names.push(cssVar);
        }
      }
    }
  }
  return names;
}

/**
 * Remove the OUTGOING panel instance's applied token overrides (theme-pack
 * switch step 4, ADR Decision 4). zdtp's own clear+reseed runs only on
 * `color-scheme-changed` (it does not know the theme-pack event) and
 * `destroy()` only deregisters, so without this the old pack's tweaks would
 * keep repainting the new pack.
 *
 * Removal is CONFIG-DRIVEN: exactly the names declared by the outgoing
 * PanelConfig ({@link collectDeclaredTokenNames}) — NEVER a blanket `--zd-*`
 * sweep (`style.colorScheme` is mode-toggle-owned and `--zd-sidebar-w`
 * belongs to the sidebar-resize island). When the config routes writes
 * through an `applySink`, the clear goes through the SAME sink
 * (`sink.clear(names)`, errors non-fatal per zdtp's own contract) — the
 * overrides live in the sink's target, not on the document root. Upstream
 * check (2026-07, zdtp 0.4.9): the package exposes no sanctioned
 * `clearApplied()`-style API on `PanelInstanceHandle` (only
 * instanceId/open/close/toggle/destroy), so this config-driven path is the
 * current mechanism; prefer a zdtp API if one lands
 * (Takazudo/zudo-design-token-panel).
 */
function clearAppliedTokenOverrides(config: PanelConfig): void {
  const names = collectDeclaredTokenNames(config);
  if (config.applySink) {
    try {
      config.applySink.clear(names);
    } catch (err) {
      console.warn(
        "[zudo-doc] applySink.clear threw during theme-pack switch; outgoing overrides may linger.",
        err,
      );
    }
    return;
  }
  const style = document.documentElement.style;
  for (const name of names) {
    style.removeProperty(name);
  }
}

/**
 * Bootstrap zdtp for a project. Configures the panel, drains any pre-hydration
 * click queue, and wires the zdtp lifecycle adapter to zfb's navigation events
 * so persisted token overrides re-apply on every soft navigation.
 *
 * Wires a `color-scheme-changed` listener that rebuilds the panel per
 * light/dark mode (see the toggle sequence below), and a parallel
 * `theme-pack-changed` listener that rebuilds it per theme pack with a
 * pack-scoped storage prefix (ADR theme-packs.md Decision 4, #2822).
 *
 * @param buildConfig - The project's `(mode) => PanelConfig` builder for
 *   mode-scoped rebuilds.
 */
export function bootstrapDesignTokenPanel(
  buildConfig: PanelConfigBuilder,
): void {
  // SSR guard: zfb evaluates the client-island bundle during SSR, where
  // `window`/`document` are absent. `readMode()` (and configurePanel's mount)
  // touch `document`; unguarded top-level access disables the renderer
  // (empty-page cache), so the whole browser-only body is gated here.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Every configurePanel call goes through the pack-prefix post-process
  // (withPackScopedStoragePrefix) so the namespacing rule is enforced
  // centrally, and the CURRENT config is tracked so the theme-pack switch
  // sequence can clear exactly the outgoing instance's token names.
  let currentConfig: PanelConfig = withPackScopedStoragePrefix(
    buildConfig(readMode()),
    readThemePackFromDom(),
  );
  let handle: PanelInstanceHandle = configurePanel(currentConfig);

  // Register the color-scheme-changed listener BEFORE draining the click queue
  // (a queued click can mount the panel first and flip listener order).
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
      const wasOpen = readOpenState(handle.instanceId);
      // MACROTASK (setTimeout 0), NOT a microtask: zdtp flushes its own
      // mount-time `color-scheme-changed` handler (clear applied vars +
      // reseed) on microtasks/rAF, so a macrotask guarantees that settled
      // before we destroy + reconfigure with the new mode's defaults.
      handle.destroy();
      // The pack prefix follows the LIVE pack so a mode toggle on a
      // non-default pack keeps reading/writing that pack's namespace.
      currentConfig = withPackScopedStoragePrefix(
        buildConfig(mode),
        readThemePackFromDom(),
      );
      handle = configurePanel(currentConfig);
      // configurePanel with a structurally-different config after destroy is
      // the ONLY sanctioned swap (a same-prefix reconfigure otherwise throws).
      if (wasOpen) showDesignTokenPanel();
    }, 0);
  });

  // theme-pack-changed listener — PARALLEL to the color-scheme one, same
  // coalescing macrotask shape (ADR theme-packs.md Decision 4 switch
  // sequence). The engine dispatches the event only AFTER its commit
  // (attribute + links + persistence), so every read below sees post-switch
  // state.
  let pendingPack: string = readThemePackFromDom();
  let packTimer: ReturnType<typeof setTimeout> | null = null;

  window.addEventListener(THEME_PACK_CHANGED_EVENT, () => {
    pendingPack = readThemePackFromDom();
    if (packTimer !== null) return;
    packTimer = setTimeout(() => {
      packTimer = null;
      const pack = pendingPack;
      // 1. Read the open state from the CURRENT (outgoing) instance's
      //    `${prefix}-open` key BEFORE destroy (guarded — storage may be
      //    disabled while the engine still commits pack switches).
      const wasOpen = readOpenState(handle.instanceId);
      const outgoingConfig = currentConfig;
      // 2. Destroy the outgoing instance (deregisters only — it does NOT
      //    clear applied inline vars, hence step 3).
      handle.destroy();
      // 3. Clear the OUTGOING instance's applied inline token overrides —
      //    config-driven removeProperty, never a blanket sweep.
      clearAppliedTokenOverrides(outgoingConfig);
      // 4. Reconfigure with the NEW pack's scoped prefix; zdtp's
      //    persisted-override reapply then seeds from that namespace,
      //    restoring the pack's saved tweaks.
      currentConfig = withPackScopedStoragePrefix(buildConfig(readMode()), pack);
      handle = configurePanel(currentConfig);
      // 5. Restore visibility.
      if (wasOpen) showDesignTokenPanel();
    }, 0);
  });

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
