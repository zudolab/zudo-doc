"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

/**
 * Design-token panel (zdtp) WIRING MECHANISM + PACKAGE-DEFAULT ISLAND (#2658,
 * epic Minimal Scaffold #2651). zdtp itself is LAZY-LOADED (#3282, epic
 * #3261): this module carries NO top-level value import of `@takazudo/zdtp` —
 * its side-effect-free `/constants` leaf is the only eager zdtp value import.
 * The root package is `import()`ed on the first dispatch on either resolved
 * toggle channel (the shared `toggle-design-token-panel`, or this instance's own —
 * see the public 0.5 {@link resolveToggleEventName}), or eagerly when the
 * persisted-state probe finds saved tweaks / a previously-open panel, so zdtp's bundle stays
 * out of the initial page load.
 *
 * `bootstrapDesignTokenPanel` is a callable that configures zdtp's panel and
 * wires its lifecycle hooks to zfb's navigation events via
 * `setLifecycleAdapter()`. It receives a mode-scoped PanelConfig builder —
 * either a project override or the package default from
 * `@takazudo/zudo-doc/design-token-panel-config`. The builder module is
 * zdtp-runtime-free (type-only zdtp imports), which is what lets it stay a
 * STATIC import here without defeating the lazy load — and lets the probe
 * compute the exact active storage prefix before zdtp exists.
 *
 * The current call shape is a mode-scoped builder. It rebuilds the panel per
 * light/dark mode on every `color-scheme-changed` toggle:
 *
 *   import { bootstrapDesignTokenPanel } from "@takazudo/zudo-doc/design-token-panel-bootstrap";
 *   import { buildDesignTokenPanelConfig } from "@/config/design-token-panel-config";
 *   bootstrapDesignTokenPanel(buildDesignTokenPanelConfig);
 *
 * `DesignTokenPanelBootstrap` (below) is the PACKAGE-OWNED island component
 * that wires the mode-scoped builder for every `createChrome` consumer with no
 * host config file — the #2658 "Approach (a)" package default. Since #3396 it
 * binds the package-default builder DIRECTLY
 * (`./design-token-panel-config/index.js`), not the routes plugin's
 * `virtual:zudo-doc-design-token-panel-config` module.
 * `packages/zudo-doc/src/chrome/derive.tsx` statically imports it so zfb's
 * island scanner walks route → chrome → derive → here (mirrors the DocHistory
 * #2480 static-import contract). A host that ejects entirely can call
 * `bootstrapDesignTokenPanel` with its own builder. Package-owned INJECTED
 * routes do not render this component — they render the configured wrapper
 * described below — but every other `createChrome` caller does.
 *
 * COUPLING REMOVED (#3396, epic #3394): this module no longer imports any
 * `virtual:` specifier, so `@takazudo/zudo-doc/chrome` (which reaches here via
 * `chrome/derive.tsx`) bundles OUTSIDE a zfb build with zero shims, and a
 * `packageOwnedRoutes: false` host needs no alias for the config specifier.
 *
 * WHERE THE HOST OVERRIDE ENTERS NOW: `settings.designTokenPanelConfigModule`
 * still travels through `virtual:zudo-doc-design-token-panel-config`, but the
 * ONLY module that imports that specifier is the routes-only wrapper
 * `routes/_design-token-panel-bootstrap.tsx`. It calls
 * {@link runDesignTokenPanelBootstrapOnce} with the resolved builder and is
 * threaded into `hostBindings.DesignTokenPanelBootstrap` by `routes/_chrome.tsx`,
 * so `deriveBodyEndIslands` renders it instead of the package default on
 * injected routes. The wrapper is a component-level seam INSIDE the client
 * island bundle — deliberately NOT a module-level setter: the route/SSR graph
 * and the hydrated island bundle are separate module graphs, so a setter called
 * during route evaluation would configure only the server instance while the
 * client re-evaluated this module and kept the default.
 *
 * SELF-CONTAINED `pages/` STUBS (was a KNOWN GAP in #3396; closed by #3414).
 * A host that renders docs through a self-contained `pages/` stub (the
 * locked-manifest shape, #2653 — it calls `createChrome` directly rather than
 * going through `routes/_chrome.tsx`) reaches the package default here, so
 * `designTokenPanelConfigModule` does not apply to those pages. Because
 * {@link runDesignTokenPanelBootstrapOnce}'s latch is per SESSION, not per
 * page, that used to make the whole SPA session's panel config depend on which
 * page was hard-loaded first (#3406). Two things now bound it:
 *
 * - `chrome/derive.tsx` SKIPS this package default as the slot default when
 *   `settings.designTokenPanelConfigModule` is set and the host supplied no
 *   explicit `chromeBindings.DesignTokenPanelBootstrap` (and
 *   `packageOwnedRoutes` is on). Stub-rendered pages then mount NO panel island
 *   at all, so they can no longer win the latch with the wrong builder — the
 *   configured island is the genuine first caller whatever the entry page. The
 *   absence on stub pages is deliberate; such a host threads its own builder
 *   via `chromeBindings.DesignTokenPanelBootstrap` to get a panel there too.
 * - Any residual default-then-configured race that skip does not close warns at
 *   runtime, naming both the setting and that workaround — see
 *   {@link runDesignTokenPanelBootstrapOnce}.
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
import type {
  LifecycleAdapter,
  PanelConfig,
  PanelInstanceHandle,
} from "@takazudo/zdtp";
import {
  DEFAULT_STORAGE_PREFIX,
  DEFAULT_TOGGLE_EVENT,
  EAGER_LOAD_GATE_KEY_SUFFIXES,
  EAGER_LOAD_GATE_STATE_FAMILY,
  resolveToggleEventName,
} from "@takazudo/zdtp/constants";
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
// PACKAGE-DEFAULT builder, imported as a plain on-disk module (#3396). This
// was `virtual:zudo-doc-design-token-panel-config` until #3396; that static
// import made every chrome consumer un-bundleable without the routes plugin
// registering the specifier. The host-override channel now enters through the
// routes-only wrapper (`routes/_design-token-panel-bootstrap.tsx`), so this
// module — and therefore `@takazudo/zudo-doc/chrome` — needs no alias or shim
// outside a zfb build. The builder module is zdtp-runtime-free (type-only zdtp
// imports), so importing it statically does not defeat the #3282 lazy load.
import { buildDesignTokenPanelConfig } from "./design-token-panel-config/index.js";

/** The zdtp module namespace, typed without importing any runtime code. */
type ZdtpModule = typeof import("@takazudo/zdtp");

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

/**
 * Is a persisted state-family envelope PROVABLY empty — i.e. does it carry
 * zero overrides for zdtp's `reapplyPersistedOverrides()` to apply?
 * Organizing principle (#3314, locked by #3313): **trigger unless provably
 * empty**, and provably empty is raw empty string plus `{}`, `[]`, and the
 * literal `null`. Everything else counts as content: a non-empty object or
 * array, any primitive (including `0` / `false` / `""`-as-JSON-string), and
 * anything that does not parse at all.
 *
 * Note the inversion in the `catch`: malformed JSON returns `false` (NOT
 * empty → the caller triggers the eager load), so zdtp gets the chance to
 * migrate or reject the value rather than this probe silently discarding a
 * returning user's overrides. This stays schema-agnostic per #3282 — it never
 * looks inside the envelope beyond "does it hold anything at all".
 */
function isEmptyEnvelope(raw: string | null): boolean {
  if (raw === null || raw === "") return true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (parsed === null) return true;
  if (Array.isArray(parsed)) return parsed.length === 0;
  if (typeof parsed === "object") return Object.keys(parsed).length === 0;
  return false;
}

/**
 * Read the public 0.5 constants gate metadata in the ACTIVE pack's namespace.
 * The only host-policy divergence is :autoload: explicit owner value "1"
 * activates, while auto-remembered "auto" stays lazy for casual visitors.
 * DOM Tweaker activates only when the active config supplies domTweaker.
 *
 * State keys match exactly one of the suffixes in zdtp's own
 * `READABLE_STATE_KEY_SUFFIXES` registry (via `EAGER_LOAD_GATE_STATE_FAMILY
 * .matchesKey`), with literal prefix matching — NOT any numeric `-state-vN`.
 * That registry is upstream-owned and, per its contract, only ever grows when
 * the loader gains the ability to read a new format version, so a suffix that
 * merely looks like a state key but isn't registered yet must not eagerly
 * load a panel that cannot actually parse it.
 * OR across every matching version: an empty newer envelope does not veto a
 * non-empty legacy one. The probe intentionally does not learn migration
 * precedence. Unavailable storage reads as no persisted state.
 */
function hasPersistedPanelState(config: PanelConfig): boolean {
  const instancePrefix = config.storagePrefix ?? DEFAULT_STORAGE_PREFIX;
  try {
    for (const [suffix, gate] of Object.entries(EAGER_LOAD_GATE_KEY_SUFFIXES)) {
      if (
        gate.requiredConfig !== null &&
        config[gate.requiredConfig] === undefined
      ) {
        continue;
      }
      const value = localStorage.getItem(`${instancePrefix}${suffix}`);
      if (suffix === ":autoload" && value !== "1") continue;
      if (gate.acceptedValues.some((accepted) => accepted === value)) return true;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key === null ||
        !EAGER_LOAD_GATE_STATE_FAMILY.matchesKey(instancePrefix, key)
      ) {
        continue;
      }
      if (!isEmptyEnvelope(localStorage.getItem(key))) return true;
    }
  } catch {
    // Storage unavailable → nothing persisted to restore → no eager load.
  }
  return false;
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
 * check (zdtp 0.5.0 public declarations and PORTABLE-CONTRACT.md §1):
 * the package still exposes no sanctioned
 * `clearApplied()`-style API — `PanelInstanceHandle` carries exactly
 * `instanceId`/`open`/`close`/`toggle`/`destroy` in both
 * `dist/config/panel-config.d.ts` and PORTABLE-CONTRACT.md §1, and
 * `dist/index.d.ts` exports no package-root equivalent. So this config-driven
 * path is the current mechanism; prefer a zdtp API if one lands
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
 * Bootstrap zdtp for a project — LAZILY (#3282). At mount this registers the
 * interim toggle listener on both resolved channels (#3315), drains the
 * pre-hydration click queue, and probes localStorage for persisted panel
 * state; the actual
 * `import("@takazudo/zdtp")` + configure happen on the first toggle (or
 * immediately on a probe hit). The configure body then wires everything the
 * pre-lazy version wired eagerly: `configurePanel` with the pack-scoped
 * mode-config, the `color-scheme-changed` / `theme-pack-changed` rebuild
 * listeners, `reapplyPersistedOverrides`, and the zfb lifecycle adapter via
 * `setLifecycleAdapter`.
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

  // Lazy-load state. RETRY SCOPE (deliberate, keep it asymmetric):
  // - IMPORT rejection resets the import memo — the next toggle retries the
  //   chunk load, because a failed network fetch is transient and browsers do
  //   not cache dynamic-import failures.
  // - CONFIGURE-phase failure is NOT auto-retried: it is a config/programming
  //   error, so retrying would loop the same throw. It surfaces loudly via
  //   console.error and parks the panel until the next full page load.
  let zdtpImport: Promise<ZdtpModule> | null = null;
  let activationInFlight = false;
  let configurePhase: "pending" | "configured" | "failed" = "pending";
  // Toggle dispatches received before configure completes. Coalesced into a
  // single NET intent applied once, after configure: odd → shown, even →
  // left as configure left it (hidden, unless zdtp's parked post-configure
  // hook restored a previously-open panel from `${prefix}-open`).
  let pendingToggles = 0;

  function loadZdtp(): Promise<ZdtpModule> {
    if (zdtpImport === null) {
      zdtpImport = import("@takazudo/zdtp").catch((err: unknown) => {
        // The memo resets ONLY here, on import rejection (see RETRY SCOPE).
        zdtpImport = null;
        throw err;
      });
    }
    return zdtpImport;
  }

  /**
   * The one-shot configure body — everything the pre-lazy bootstrap ran
   * eagerly at mount. Runs exactly once, right after the dynamic import
   * resolves. The mode/pack rebuild listeners are registered HERE, post-
   * import, rather than at bootstrap: both handlers read mode/pack live from
   * the DOM when they fire, so late registration loses nothing — events
   * before zdtp exists have no panel to rebuild.
   */
  function configureAndWire(zdtp: ZdtpModule): void {
    const {
      configurePanel,
      reapplyPersistedOverrides,
      setLifecycleAdapter,
      showDesignTokenPanel,
    } = zdtp;

    // Every configurePanel call goes through the pack-prefix post-process
    // (withPackScopedStoragePrefix) so the namespacing rule is enforced
    // centrally, and the CURRENT config is tracked so the theme-pack switch
    // sequence can clear exactly the outgoing instance's token names.
    let currentConfig: PanelConfig = withPackScopedStoragePrefix(
      buildConfig(readMode()),
      readThemePackFromDom(),
    );
    let handle: PanelInstanceHandle = configurePanel(currentConfig);

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
        // 2. Destroy the outgoing instance. Verified against zdtp 0.5.0: it
        //    deregisters, unmounts the Preact tree, removes the DOM root, and
        //    releases the instance's HOST-DOCUMENT mutations — the docked
        //    modes' `body { margin-right/bottom }` reflow and the
        //    `--zdtp-dock-inset-*` custom properties are restored to their
        //    pre-claim values, keyed on the OUTGOING `storagePrefix`, so a
        //    pack switch cannot strand reserved space. It still does NOT clear
        //    applied inline token vars, hence step 3.
        handle.destroy();
        // 3. Clear the OUTGOING instance's applied inline token overrides —
        //    config-driven removeProperty, never a blanket sweep.
        clearAppliedTokenOverrides(outgoingConfig);
        // 4. Reconfigure with the NEW pack's scoped prefix. This registers the
        //    new instance and makes it the active config, but does NOT itself
        //    push that namespace's persisted overrides onto :root — configurePanel
        //    only wires the panel UI. On the color-scheme path zdtp's OWN
        //    listener reapplies; on this theme-pack event zdtp is unaware
        //    (ADR Decision 4 step 4), so nothing would restore the live vars.
        currentConfig = withPackScopedStoragePrefix(buildConfig(readMode()), pack);
        handle = configurePanel(currentConfig);
        // 5. Push the now-active namespace's persisted overrides back onto :root.
        //    Without this the switch clears the outgoing pack's inline vars
        //    (step 3) but never re-applies the incoming pack's saved tweaks —
        //    switching A→B→A would leave A's overrides visible only inside the
        //    panel rows, not on the live document (regression caught by the
        //    #2826 zdtp-interplay e2e; ADR Decision 4 invariant (b)).
        reapplyPersistedOverrides();
        // 6. Restore visibility.
        if (wasOpen) showDesignTokenPanel();
      }, 0);
    });

    // Push the active namespace's persisted overrides onto :root now. zdtp's
    // parked post-configure hook re-applies (and re-mounts a previously-open
    // panel) on its own during configurePanel, but this direct call keeps the
    // contract explicit instead of leaning on a zdtp internal, and re-running
    // it is idempotent.
    reapplyPersistedOverrides();

    // BOTH hooks are supplied deliberately: zdtp keeps its own
    // `astro:before-swap` / `astro:page-load` document listeners bound (and
    // console.warns) for any channel an adapter omits. `onBeforeSwap` is also
    // what releases a docked panel's reserved host-document space across an
    // SPA navigation — zdtp's before-swap handler unmounts each mounted
    // instance, which restores the body margin and `--zdtp-dock-inset-*`
    // before the swap; the `onPageLoad` handler re-materialises and re-claims
    // it. Dropping either hook would leak that reserved space on soft nav
    // (verified against zdtp 0.5.0).
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

  async function activate(): Promise<void> {
    if (activationInFlight || configurePhase !== "pending") return;
    activationInFlight = true;
    let zdtp: ZdtpModule;
    try {
      zdtp = await loadZdtp();
    } catch (err) {
      activationInFlight = false;
      // Queued intent dies with the failed attempt: the toggle that retries
      // the import carries fresh intent of its own.
      pendingToggles = 0;
      console.error(
        "[zudo-doc] design-token-panel: loading @takazudo/zdtp failed; the next toggle retries.",
        err,
      );
      return;
    }
    try {
      configureAndWire(zdtp);
      configurePhase = "configured";
    } catch (err) {
      // NOT auto-retried — see RETRY SCOPE above.
      configurePhase = "failed";
      console.error(
        "[zudo-doc] design-token-panel: configure failed; the panel is disabled until the next full page load.",
        err,
      );
      return;
    } finally {
      activationInFlight = false;
    }
    // Apply the NET pre-configure toggle intent exactly once (odd → shown).
    // Multiple queued toggles never produce multiple show() calls.
    if (pendingToggles % 2 === 1) zdtp.showDesignTokenPanel();
    pendingToggles = 0;
  }

  /**
   * The pack-scoped PanelConfig for the LIVE mode + pack — byte-identical to
   * what the configure body builds, so the interim listener's channel and the
   * probe's namespace can never disagree with the eventual instance. Each call
   * invokes the host builder once; callers needing both the toggle channel and
   * the probe prefix share ONE call rather than building twice.
   */
  function readActiveConfig(): PanelConfig {
    return withPackScopedStoragePrefix(
      buildConfig(readMode()),
      readThemePackFromDom(),
    );
  }

  // Interim toggle handler, registered BEFORE the click-queue drain below so
  // the drain's synchronous re-dispatch of a queued pre-hydration click lands
  // here (counting as toggle intent and starting the lazy load). Once
  // configure completes, the listeners zdtp binds itself — when the dynamic
  // import evaluated, and again inside configurePanel — own every subsequent
  // dispatch on both channels; handling them here too would double-toggle each
  // click, so this handler becomes a permanent no-op the moment configurePhase
  // leaves "pending".
  const onInterimToggle = (): void => {
    if (configurePhase !== "pending") return;
    pendingToggles += 1;
    void activate();
  };

  // Channel names `onInterimToggle` is currently bound to (#3315) — the
  // double-registration guard. A host whose `toggleEvent` equals the shared
  // constant (or whose derived channel does) must bind ONE listener, not two,
  // or a single dispatch would count as two toggle intents and flip the net
  // odd/even result — configure would run, but the panel would never open.
  //
  // It does NOT collapse two dispatches of two DISTINCT events: those are
  // genuinely two intents. (A DOM `Event` carries exactly one `type`, so one
  // dispatch can never reach two channel names — binding the same name twice
  // is the only double-count path there is.)
  //
  // Belt-and-braces, deliberately: `addEventListener` already ignores a repeat
  // registration of an identical (type, callback, capture) triple, and every
  // call here shares the one `onInterimToggle` reference, so the DOM alone
  // would cover today's code. The Set states the invariant explicitly and
  // keeps it holding if a future edit ever wraps the handler per channel — at
  // which point the DOM's dedupe silently stops applying.
  const boundToggleChannels = new Set<string>();
  // The instance channel currently bound, so a refresh can REPLACE it.
  let instanceToggleChannel: string | null = null;

  function bindToggleChannel(name: string): void {
    if (boundToggleChannels.has(name)) return;
    boundToggleChannels.add(name);
    window.addEventListener(name, onInterimToggle);
  }

  /**
   * Re-resolve the per-instance channel and swap the binding — REPLACE, never
   * accumulate. The resolved name derives from `storagePrefix`, which changes
   * with the active theme pack (and, for a mode-dependent builder, with the
   * color scheme); merely adding the new name would leave a stale listener that
   * still starts an import for a pack the user has already left. The shared
   * constant is exempt from removal: it is bound unconditionally for the whole
   * pending phase, so a host whose resolved channel happens to equal it must
   * not have it unbound out from under the shared registration.
   */
  function refreshInstanceToggleChannel(config: PanelConfig): void {
    const resolved = resolveToggleEventName(config);
    if (resolved === instanceToggleChannel) return;
    if (
      instanceToggleChannel !== null &&
      instanceToggleChannel !== DEFAULT_TOGGLE_EVENT
    ) {
      window.removeEventListener(instanceToggleChannel, onInterimToggle);
      boundToggleChannels.delete(instanceToggleChannel);
    }
    instanceToggleChannel = resolved;
    bindToggleChannel(resolved);
  }

  const bootConfig = readActiveConfig();
  bindToggleChannel(DEFAULT_TOGGLE_EVENT);
  refreshInstanceToggleChannel(bootConfig);

  // Drain the pre-hydration click queue. If the user clicked the palette
  // button before this Island evaluated, the SSR shim (see
  // `doc-body-end-islands/design-token-panel-island.tsx`) captured the event
  // as a single boolean flag. Calling __zdtpReadyClicks() here removes the
  // shim listener and re-dispatches once (at most) so the interim handler
  // above picks it up.
  (window as { __zdtpReadyClicks?: () => void }).__zdtpReadyClicks?.();

  // Persisted-state PROBE (#3282): a returning user with saved tweaks or a
  // previously-open panel must not wait for a toggle — without this eager
  // load their overrides would silently revert until they opened the panel.
  // The probed prefix comes from the same `readActiveConfig()` result the
  // toggle channel resolved from, so it names EXACTLY the active namespace
  // (including the `<prefix>--<slug>` pack-scoped variant; package default
  // `zudo-doc-tweak`, host-overridable). On a hit, zdtp's parked post-configure
  // hook re-applies the overrides and re-opens a previously-open panel once
  // configure runs.
  if (hasPersistedPanelState(bootConfig)) void activate();

  // Pre-load pack-change handling, folded into ONE listener (review finding +
  // #3315): switching to a pack whose namespace holds persisted state must
  // trigger the same eager load — the post-import theme-pack-changed rebuild
  // listener does not exist yet, so without this the incoming pack's saved
  // overrides would sit unapplied until a toggle (parity with the eager era,
  // where the rebuild listener ran from boot) — AND the new pack's namespace
  // resolves a different instance toggle channel, which must replace the old
  // pack's. Permanently no-ops once configurePhase leaves "pending": from then
  // on the configure body's own listener owns the event, and configure itself
  // always reads the pack live, so an in-flight activation needs no help from
  // this handler either.
  window.addEventListener(THEME_PACK_CHANGED_EVENT, () => {
    if (configurePhase !== "pending") return;
    const activeConfig = readActiveConfig();
    refreshInstanceToggleChannel(activeConfig);
    if (hasPersistedPanelState(activeConfig)) void activate();
  });

  // The color-scheme twin of the refresh above (#3315). `buildConfig(mode)` may
  // make `storagePrefix` — and therefore the derived channel — mode-dependent,
  // so a light/dark toggle during the pending phase can retarget the instance
  // channel exactly like a pack switch does. It deliberately does NOT re-run
  // the persisted-state probe: which namespaces are worth an eager load is the
  // probe's own contract (#3313/#3314), and widening its trigger set is out of
  // scope here. Same permanent no-op after configure, for the same reason.
  window.addEventListener(COLOR_SCHEME_CHANGED_EVENT, () => {
    if (configurePhase !== "pending") return;
    refreshInstanceToggleChannel(readActiveConfig());
  });
}

// ---------------------------------------------------------------------------
// DesignTokenPanelBootstrap — package-default island component (#2658).
// ---------------------------------------------------------------------------

/**
 * Which island won the once-latch below (#3414).
 *
 * - `"default"` — the package-default {@link DesignTokenPanelBootstrap}, bound
 *   to the package-default builder.
 * - `"configured"` — the routes-only wrapper
 *   (`routes/_design-token-panel-bootstrap.tsx`), bound to whatever
 *   `virtual:zudo-doc-design-token-panel-config` resolved to (a host's
 *   `settings.designTokenPanelConfigModule` when set, the package default
 *   otherwise).
 */
export type DesignTokenPanelBootstrapOrigin = "default" | "configured";

/**
 * Guards the bootstrap call to run at most once per module instance, and
 * records WHICH island won (#3414) so a later loser can be diagnosed — the
 * component itself may run during SSR (harmless no-op:
 * `bootstrapDesignTokenPanel` bails out on its own
 * `typeof window === "undefined"` guard) as well as on client hydration, and
 * re-running `configurePanel` on every render would re-mount the panel each
 * time. Module-scoped rather than `useRef`/`useEffect` so the guard is cheap
 * and framework-lifecycle-independent (this component has no children to
 * schedule effects around).
 *
 * The winning BUILDER is kept alongside the origin because the two islands very
 * often carry the SAME builder: with no `designTokenPanelConfigModule` set, the
 * virtual module re-exports exactly the package default this module imports, so
 * a default-then-configured sequence is a no-op with nothing to warn about.
 * Comparing builder identity is what keeps the diagnostic off that (very
 * common) path.
 */
let bootstrapWinner: { origin: DesignTokenPanelBootstrapOrigin; build: PanelConfigBuilder } | null =
  null;

/** One diagnostic per session, not one per navigation: the losing island
 *  re-runs on every soft nav to a page that mounts it, and the same warning
 *  repeated is noise rather than information. */
let warnedLostRace = false;

/**
 * Warn when a bootstrap call carrying a DIFFERENT builder loses the once-latch
 * — the entry-page-dependent-config symptom of #3406. Browser-only: during SSG
 * every page render shares one module instance, so a build-time copy would fire
 * once per build with page-ordering wording that does not apply there.
 */
function warnLostBootstrapRace(
  winnerOrigin: DesignTokenPanelBootstrapOrigin,
  loserOrigin: DesignTokenPanelBootstrapOrigin,
): void {
  if (typeof window === "undefined" || warnedLostRace) return;
  warnedLostRace = true;
  const detail =
    loserOrigin === "configured" && winnerOrigin === "default"
      ? "The package-default island configured the panel earlier in this browser session, " +
        "so `designTokenPanelConfigModule` did not apply on this page. This happens when the " +
        "session first hard-loaded a page rendered by a self-contained `pages/` stub, which " +
        "reaches the package default instead of the package-injected route. " +
        "Thread your builder through `chromeBindings.DesignTokenPanelBootstrap` to make it " +
        "apply on every page regardless of entry point."
      : `The ${winnerOrigin} island configured the panel first; this ${loserOrigin} island's ` +
        "builder was ignored. zdtp is configured once per session — mount exactly one " +
        "design-token-panel bootstrap, e.g. via `chromeBindings.DesignTokenPanelBootstrap`.";
  console.warn(`[zudo-doc] design-token panel already configured. ${detail}`);
}

/**
 * Run {@link bootstrapDesignTokenPanel} at most once per module instance, with
 * whichever mode-scoped builder the caller supplies.
 *
 * Exists so the routes-only configured wrapper
 * (`routes/_design-token-panel-bootstrap.tsx`, #3396) gets the same one-shot
 * semantics as {@link DesignTokenPanelBootstrap} while supplying the
 * host-overridable builder from `virtual:zudo-doc-design-token-panel-config`.
 * The guard is deliberately shared across both callers: `deriveBodyEndIslands`
 * renders exactly ONE of them, and if a host ever mounted both, configuring the
 * panel twice would re-mount it rather than layer the two configs.
 *
 * `origin` tags WHICH island is calling (#3414). It is optional, defaulting to
 * `"default"`, because this function is reachable from the frozen
 * `./design-token-panel-bootstrap` subpath (API.md) — an added required
 * parameter would break an ejected host that calls it. Both in-package callers
 * pass it explicitly.
 *
 * This is a CALL, not a module-level setter — the builder is passed in at
 * render time inside whichever bundle the island actually hydrates in, so it
 * never has to cross the route-graph → island-bundle boundary.
 */
export function runDesignTokenPanelBootstrapOnce(
  build: PanelConfigBuilder,
  origin: DesignTokenPanelBootstrapOrigin = "default",
): void {
  if (bootstrapWinner) {
    if (bootstrapWinner.build !== build) warnLostBootstrapRace(bootstrapWinner.origin, origin);
    return;
  }
  bootstrapWinner = { origin, build };
  bootstrapDesignTokenPanel(build);
}

/**
 * The package-default `<DesignTokenPanelBootstrap/>` island: mounted (via
 * `Island({ when: "load" })`, no `ssrFallback` — it renders nothing on either
 * side) by `../doc-body-end-islands/index.tsx` when `settings.designTokenPanel`
 * is on, gated the same way `AiChatModal`/`ImageEnlarge`/`MermaidEnlarge` are.
 * On first render, calls `bootstrapDesignTokenPanel` with the PACKAGE-DEFAULT
 * mode-scoped `buildDesignTokenPanelConfig` builder. A host's
 * `designTokenPanelConfigModule` override does not reach this component — it
 * arrives through the routes-only wrapper described in the module docblock.
 *
 * `displayName` pinned explicitly (belt-and-braces, matching
 * `AiChatModal`/`ImageEnlarge`/`MermaidEnlarge`/`DocHistory`) so zfb's
 * `captureComponentName` emits a stable `data-zfb-island="DesignTokenPanelBootstrap"`
 * marker independent of minification. It MUST keep matching the exported
 * binding identifier — zfb's island scanner registers by the scanner-visible
 * export name and warns when a `displayName` diverges from it.
 */
export function DesignTokenPanelBootstrap(): JSX.Element | null {
  runDesignTokenPanelBootstrapOnce(buildDesignTokenPanelConfig, "default");
  return null;
}
DesignTokenPanelBootstrap.displayName = "DesignTokenPanelBootstrap";
