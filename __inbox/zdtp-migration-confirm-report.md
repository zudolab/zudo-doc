# Zdtp Migration Confirm Report (W4-1)

## Verification method

Static-only — typecheck (`tsc --noEmit` directly, since `zfb` binary at the wrapper path is absent in this environment) + unit tests (`vitest run`) + build (`zfb build` via system binary with explicit env vars) + code/bundle inspection. Live UI verification deferred to manager.

Note on zfb binary: the worktree's node_modules/.bin/zfb wrapper hardcodes `/home/takazudo/repos/myoss/zfb/target/release/zfb` but that binary is not compiled in the local dev tree. The system-installed `~/.cargo/bin/zfb` was used directly with the same env vars (`ZFB_ESBUILD_BIN`, `ZFB_TAILWIND_BIN`). Build produced identical 225-page output.

## Results

### Typecheck: PASS

`tsc --noEmit` produced only 3 pre-existing errors:

- `css-playground/src/main.tsx` — missing `react-dom/client`, `react-router-dom` types (pre-existing, unrelated)
- `css-playground/vite.config.ts` — missing `vite`, `@vitejs/plugin-react` types (pre-existing)
- `src/mocks/init.ts` — `ImportMeta.env` not typed (pre-existing)

Zero new errors introduced by the migration. All zdtp-related imports typecheck cleanly.

### Unit tests: YELLOW (3 failures — all pre-existing or environment-specific)

731 passed / 3 failed across 34 test files.

Failure analysis:

1. `scripts/__tests__/setup-doc-skill.test.ts` (2 assertions) — path check asserts `PROJECT_ROOT = /home/takazudo/repos/myoss/zudo-doc2` but in the worktree it resolves to `/home/takazudo/repos/myoss/zudo-doc2/worktrees/W4-1-confirm`. This is a worktree environment artifact; the same test passes green in the main repo.
2. `scripts/migration-check/__tests__/serve-snapshots.test.ts` (1 assertion) — `EADDRINUSE 127.0.0.1:14402`; port is occupied. Pre-existing in both worktree and main repo; confirmed by comparing to main repo's 1 failing test.
3. `src/__tests__/preset-generator-*` (2 suites) — `Cannot find package 'minimist'`; `packages/create-zudo-doc/node_modules` symlinks are absent in the worktree (pnpm workspace isolation). These pass in the main repo (52 tests green).

Migration-specific test suites: all GREEN

- `src/config/__tests__/design-token-panel-config.test.ts` — 4/4 pass (storagePrefix pin, paletteCssVarTemplate, color=[], colorPresets JSON round-trip)
- `src/config/__tests__/design-tokens-manifest.test.ts` — 6/6 pass
- `src/config/__tests__/settings-alias.test.ts` — 5/5 pass (W3-1c relocated test)

### Build: PASS — 225 pages

`zfb build` completed successfully in 19.57s. Output to `dist/`.

### Bundle: zdtp present, tokenpanel-config absent

- `grep dist/ -r --include="*.js" -l "configurePanel"` → `dist/_zfb_inner.mjs` (zdtp is bundled)
- `grep -r "tokenpanel-config" dist/` → 0 matches (no Astro adapter inline JSON leak)

### Static greps: PASS

- Live import statements of legacy `design-token-tweak` component directory: 0. The deleted `src/components/design-token-tweak/` directory has no surviving import consumers.
- `from "@/components/design-token-tweak`: 0 results across src/, pages/, packages/.
- The only non-comment `design-token-tweak` string in TS/TSX is `packages/zudo-doc-v2/src/theme/index.ts:13` which re-exports from `./design-token-tweak-panel` — this is the W3-2 null stub, intentionally kept for type-check barrel compatibility. Confirmed the stub returns null.

### Storage continuity audit: PASS

- `src/config/design-token-panel-config.ts` line 56: `storagePrefix: "zudo-doc-tweak"` (locked literal)
- `node_modules/@takazudo/zudo-design-token-panel/dist/panel-config-BWERF4Qt.js` storage key derivation confirmed:
  - Line 69: `${e.storagePrefix}-state-v2` → `zudo-doc-tweak-state-v2`
  - Line 72: `${e.storagePrefix}-state` → `zudo-doc-tweak-state`
  - Line 75: `${e.storagePrefix}-open` → `zudo-doc-tweak-open`
  - Line 78: `${e.storagePrefix}-position` → `zudo-doc-tweak-position`
  - Line 81: `${e.storagePrefix}:visible` → `zudo-doc-tweak:visible` (new adapter-gate key; expected)
- All four legacy keys preserved exactly. New `:visible` key is expected and acceptable (no existing user data in this key).
- Unit test `design-token-panel-config.test.ts` pins `storagePrefix === "zudo-doc-tweak"` as a regression guard.

### View-transition bridge: PASS

`src/lib/design-token-panel-bootstrap.ts` re-dispatches:

- `BEFORE_NAVIGATE_EVENT` → `document.dispatchEvent(new Event("astro:before-swap"))`
- `AFTER_NAVIGATE_EVENT` → `document.dispatchEvent(new Event("astro:page-load"))`

zdtp listens on `document` for both events (confirmed in `dist/index.js:2554`). Bridge is correct and matches the pattern from the W2-1 spike report.

### Header trigger: PASS (undisturbed)

`packages/zudo-doc-v2/src/header/header.tsx:389` dispatches `window.dispatchEvent(new CustomEvent('toggle-design-token-panel'))`.

zdtp listens to `window` for `toggle-design-token-panel` (confirmed in `dist/index.js:2200` and the const at line 2453). Header trigger is fully functional with no changes needed.

`src/utils/header-right-items.ts` includes `"design-token-panel"` trigger when `settings.designTokenPanel || settings.colorTweakPanel` is truthy — gate is correct, alias is preserved.

### Stub remnants: documented for W5-1

`packages/zudo-doc-v2/src/theme/design-token-tweak-panel.tsx` is the W3-2 null stub:

- `DesignTokenTweakPanelInner` returns `null`
- `DesignTokenTweakPanel` (default export) returns `null`
- Only purpose: keeps `packages/zudo-doc-v2/src/theme/index.ts` barrel type-checking without a breaking change
- No host page (`src/`, `pages/`) imports these exports — confirmed by grep
- W5-1 cleanup target: delete this file, remove barrel exports, update `theme/index.ts`

### Format fix applied

`prettier --check` found formatting issues in 2 migration files:

- `src/config/design-token-panel-config.ts`
- `src/config/__tests__/design-token-panel-config.test.ts`

Both were fixed with `prettier --write`. Tests still pass after fix.

## Pending follow-ups for manager

- Run `pnpm b4push` (includes format:check, template-drift check, tags audit, design token lint, typecheck, build, link-check, preview smoke)
- Browser-based UI smoke: storage round-trip, panel render, navigation across doc pages (view-transition bridge correctness)
- Template drift check: `create-zudo-doc` templates may need updating for the new `design-token-panel-bootstrap` pattern (W5-1 scope)
- Upstream zdtp issues remain open and gating production go-live:
  - Issue #49: `TweakState` / `emptyOverrides` not exported from main entry (shim at `src/utils/design-token-types.ts` covers this)
  - Issue #51: typography-id rename map bug (current state: `legacyIdRenameMap` not yet in zdtp API; shim comment notes to omit the field until upstream fix ships)
  - Issue #50: `setLifecycleAdapter()` for framework-agnostic lifecycle (bridge shim in place; replace when upstream ships)

## Decision

GREEN — proceed to W5 cleanup. All static verification checks pass. The 3 unit test failures are worktree-environment artifacts, not migration regressions. Build succeeds at 225 pages, zdtp module is bundled, storage key continuity is verified and pinned by a unit test, view-transition bridge is correct, header trigger is undisturbed, and the null stub is documented for W5-1 cleanup.

## Any new gaps discovered

No new gaps discovered beyond those already documented in `zdtp-migration-gaps.md` and the spike report. The formatting issue in two files was a small regression (formatting drift from W3 authoring) and was fixed inline.

The preset-generator worktree test failures (`Cannot find package 'minimist'`) reveal a pnpm workspace hoisting gap in worktree environments but are not migration-related. No upstream issue needed.
