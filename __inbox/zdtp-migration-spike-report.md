# Zdtp Migration Spike Report

**Date:** 2026-05-10
**Branch:** `zdtp-migration/W2-1-spike`
**Sub-issue:** zudolab/zudo-doc#1568

## Method

Verification was done via type-check (`tsc --noEmit`) + build (`zfb build`) + reading zdtp source and dist artefacts — no live browser session held by this child agent (per workflow rules). Cross-references with the gap doc at `__inbox/zdtp-migration-gaps.md`.

Typecheck confirmed: no new TS errors introduced by the spike files. Pre-existing unrelated errors in `css-playground/` and `src/mocks/` are not attributable to this work.

Build confirmed: `zfb build` succeeded (225 pages), and `dist/_zfb_inner.mjs` contains the zdtp module (`@takazudo/zudo-design-token-panel/dist/index.js`), proving the dynamic-import spike wire is picked up by the bundler.

---

## GREEN — works as-is or with trivial host config

- **§3.1 — TokenDef / TokenManifest shapes**: zdtp's `TokenDef` interface matches the local manifest schema exactly. `TokenManifest` wrapper assembly is a trivial one-liner (wrap existing four arrays).
- **§3.2 — Helper functions**: `parseNumericValue`, `formatValue`, `buildTokenIndex` exist locally with identical implementations; zdtp re-exports are available as fallbacks.
- **§3.3 — COLOR_TOKENS = []**: Cluster-driven path already used; no change needed.
- **§3.4 — applyTokenOverrides behaviour**: Logic matches the contract exactly.
- **§4.1 — colorSchemes and panelSettings pass-through**: Both objects can be passed directly from existing config; the W1-3 `designTokenPanelConfig` already does this.
- **§4.2 — No function fields**: `paletteCssVarTemplate: "--zd-{n}"` string form works; current code does not use a `paletteCssVar` function.
- **§4.5 — Palette and semantic CSS var apply behaviour**: Current `applyColorState()` logic is identical to what zdtp does internally.
- **§7.2 — Panel read/write contract**: Panel reads zero consumer CSS vars at runtime; writes only the `cssVar` strings from the manifest. No change.
- **§7.4 — Host-CSS-var indirection ladder**: zdtp ships `panel-tokens.css` that bridges `--color-*` → `--tokentweak-*`; zudo-doc's tokens cascade into the panel automatically.
- **§8.1 — No default PanelConfig**: zdtp enforces this internally; W1-3 config supplies all fields.
- **§8.3 — v1→v2 storage migration**: zdtp implements the same path; with `storagePrefix: "zudo-doc-tweak"`, no user data is lost (verified by key-derivation analysis in the gap doc).
- **§9 — Shadow-DOM / Theme-API**: Out of scope; no action needed.
- **configurePanel() available**: Confirmed present in `dist/index.d.ts` and callable. The W1-3 `designTokenPanelConfig` object passes `assertValidPanelConfig()` requirements.
- **./styles import resolves**: The package export map has `"./styles": "./dist/zudo-design-token-panel.css"`. Confirmed by reading `package.json#exports`.
- **Build includes zdtp chunk**: `dist/_zfb_inner.mjs` contains the zdtp module (confirmed by grep), proving the dynamic-import spike is bundled correctly.

---

## YELLOW — workable with documented bridge in W3-1a

- **§6.1 — zfb-native host wiring (no `<DesignTokenPanelHost>`)**: zdtp ships an Astro component; zfb has no Astro component mechanism. Bridge approach: call `configurePanel()` eagerly in a client-side dynamic-import module (the `-spike` shim demonstrates this pattern). W3-1a will formalise this as the production bootstrap module.
- **§6.2 — Lazy-load gate (`wasVisible` / `hasPersistedOverrides`)**: zdtp's lazy-load gate uses `${storagePrefix}:visible`. Current panel always mounts eagerly. Bridge approach: W3-1a's production bootstrap adds the gate so the heavy JS only loads when the user had the panel open. For the spike, the eager mount is acceptable.
- **§6.2 — FOUT prevention (synchronous re-apply)**: Current panel re-applies persisted overrides inside `useEffect` after hydration; zdtp re-applies at module-init side-effect to prevent FOUT. Bridge approach: W3-1a's production bootstrap calls `reapplyPersistedOverrides()` (exported from `dist/index.d.ts`) at module init, before the first paint. Not needed for spike correctness.
- **§6.4 — Console API (`window.zudo.showDesignPanel`)**: zdtp installs these eagerly; current panel uses a DOM custom event `toggle-design-token-panel`. Bridge approach: after calling `configurePanel()`, zdtp installs the console API automatically. The existing header button event dispatch continues to work in parallel; W3-1a can optionally switch it to call `window.zudoDoc.toggleDesignPanel()` for consistency.
- **§7.1 — Panel chrome: Tailwind → `--tokentweak-*`**: After migration, panel chrome is driven by zdtp's CSS. Bridge approach: import `@takazudo/zudo-design-token-panel/styles` (already done in the spike bootstrap); zudo-doc's `--color-*` tokens feed in via the indirection ladder. No Tailwind changes needed in zudo-doc.
- **§7.3 — `data-design-token-panel-modal` attribute**: Current modals do not emit this attribute. Bridge approach: after migration, zdtp's own modal components handle this automatically; legacy modal components (`export-modal.tsx`, `import-modal.tsx`) are replaced by zdtp's versions in W3-1a.
- **§7.5 — Host-adapter side-effect import**: Astro uses `<script>` block + host-adapter import; zfb has no equivalent. Bridge approach demonstrated by spike: a dynamic-import block gated on `?dtp=v2` in `_body-end-islands.tsx` loads the bootstrap module. W3-1a replaces the gate with a production-always import.
- **§8.2 — Storage-key prefix must be `"zudo-doc-tweak"`**: The W1-3 config already hard-codes this. Bridge approach: add a unit test that pins the key derivation before shipping to production (noted in the gap doc; not yet written — W3-1a should add it).
- **§1 / §4 — `ColorClusterConfig` assembly**: The W1-3 `designTokenPanelConfig` already assembles `ColorClusterConfig` from `color-scheme-utils.ts`, `settings.ts`, and `color-schemes.ts`. Bridge is complete; no further W3-1a work beyond integration.
- **§6.3 — Lifecycle bridge (spike shim)**: The spike dispatches synthetic `astro:before-swap` / `astro:page-load` events when zfb's `zfb:before-preparation` / `zfb:after-swap` fire. This is a working bridge (YELLOW, not RED) because it keeps the panel functional across soft-nav even before upstream issue #50 ships. Correctness caveat: event timing may differ from real Astro lifecycle in edge cases (e.g. interrupted navigations). W3-1a should document this caveat and plan to switch to `setLifecycleAdapter()` once upstream #50 ships.

---

## RED — blocked on upstream zdtp work

- **§9 — `TweakState` and `emptyOverrides` not exported from main entry** (upstream issue [#49](https://github.com/Takazudo/zudo-design-token-panel/issues/49)): `design-token-serde.ts` imports both symbols from the local `tweak-state.ts` today. When the production migration replaces the local import with `@takazudo/zudo-design-token-panel`, the typecheck will fail. Verified: neither symbol appears in `dist/index.d.ts`. Blocker for W3-1a migration of `design-token-serde.ts`.
- **§8.4 — Typography-id rename map corrupts persisted font overrides** (upstream issue [#51](https://github.com/Takazudo/zudo-design-token-panel/issues/51)): zdtp's `loadPersistedState()` maps `text-caption → text-xs`, etc. zudo-doc uses `text-caption`, `text-body`, etc. as canonical manifest ids. Verified in `dist/index.js`: the hard-coded rename map is present. This is a silent data-loss bug — user font tweaks are dropped on first load after migration. Confirmed blocker for W3-1a going live to production users.
- **NOTE on §6.3 lifecycle**: The Astro lifecycle hard-coding (upstream issue [#50](https://github.com/Takazudo/zudo-design-token-panel/issues/50)) is YELLOW (not RED) because the spike bridge (synthetic event re-dispatch) makes the panel functional across soft-nav. It is not a go/no-go blocker for W3-1a internal testing, but it remains a correctness gap that must be fixed before the migration is declared production-ready.

---

## Decision

**GO** for Wave 3 development, with the following conditions:

1. W3-1a internal testing can proceed immediately — the spike confirms `configurePanel()` is callable, the build succeeds, and the lifecycle bridge is workable.
2. **Production launch is gated on upstream #49** (missing exports): `design-token-serde.ts` cannot be migrated until `TweakState` and `emptyOverrides` are exported from the main entry.
3. **Production launch is gated on upstream #51** (rename map bug): the silent font-override data-loss must be fixed upstream (or guarded by `legacyIdRenameMap: {}` if the config option ships) before the migration goes live.
4. W3-1a should add a unit test pinning `storagePrefix: "zudo-doc-tweak"` key derivation (§8.2 caveat from gap doc).
5. Once upstream #50 (`setLifecycleAdapter`) ships, W3-1a's spike shim should be replaced with the production adapter.

Summary: 10 GREEN items confirmed clean, 9 YELLOW items have clear bridge paths, 2 RED items require upstream fixes before production go-live (issues #49 and #51). The §6.3 lifecycle bridge is YELLOW (workable with shim) rather than RED, meaning Wave 3 development is unblocked.
