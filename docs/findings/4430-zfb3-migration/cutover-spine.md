# Cutover spine A: bump the zfb family to the latest 3.x, flip the TypeScript JSX source, make preact zdtp-only, and stop emitting framework/tailwind

Owner: [#4436](https://github.com/zudolab/zudo-doc/issues/4436). Status: **implemented; integration and visual parity remain pending**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](round2-3.1.0.md). The cutover spine implements this pin/config contract; browser and style parity remain downstream. This overrides the named round-1 deviations.

Void the round-1 exact `3.0.0`/`^3.0.0` pin instructions. Pin `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` and `@takazudo/zfb-adapter-cloudflare` exactly to `3.1.0` wherever owned (root, package dev dependencies, scaffold and fixture pins); peer floors are `^3.1.0`. Registry freshness was rechecked on 2026-10-02; all four packages remain at `3.1.0`. Pin parity, scaffold freshness and the actual binary version are recorded below. Keep the owned JSX/config wind passthrough and zdtp-only Preact contract. No pnpm patch is selected. Cutover stays behind verified #4435 and this #4480 lock.

## Files and symbols

The still-pending `preset.ts` rows are source-port inventory for later owners; #4436 changes the preset result shape and emitted wind fragment only.

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `package.json` | engine dependencies | v2.22.1 family → exact zfb family 3.1.0 | implemented; `pnpm install --ignore-scripts`, pin parity and scaffold freshness pass; CLI reports zfb 3.1.0 |
| `packages/zudo-doc/package.json` | peers and devDependencies | v2.22.1 family / required Preact peer → 3.1.0 family / no package Preact peer | implemented; exact dev pins and `^3.1.0` floors pass pin parity; Preact stays a dev dependency for the transition tests |
| `packages/create-zudo-doc/src/scaffold.ts` | generated zfb family pins | v2.22.1 pins → exact 3.1.0 pins | implemented; lines 985–987 updated; pin parity and scaffold freshness pass |
| `packages/zudo-doc/src/__tests__/fixtures/target-manifest/package.json` | zfb family pins | conditional update if zfb is pinned | no zfb family pin exists in this fixture manifest; its zudo-doc pin remains unchanged |
| `tsconfig.json`, `tsconfig.pages.json`, `e2e/tsconfig*.json` | React compatibility paths | React/Preact path aliases → none | implemented; direct root/page aliases removed; e2e configs inherit the cleaned root config |
| `packages/zudo-doc/src/__tests__/fixtures/*/tsconfig.json` | JSX source and compatibility paths | Preact JSX / React aliases → zudo-react JSX / no aliases | implemented; route injection, i18n, date-only and target-manifest fixtures updated |
| `DEPENDENCIES.md` | Preact rationale | required zudo-doc peer → zdtp-only peer | implemented; row records the root Preact install for zdtp's opaque bundle |
| `packages/zudo-doc/src/config.ts` | `mergeDefaultTranslations` | existing settings helper | unchanged by #4436; no JSX or wind behavior changed |
| `packages/zudo-doc/src/config.ts` | `assertValidAssetViewerSettings` | existing validation helper | unchanged by #4436; no JSX or wind behavior changed |
| `packages/zudo-doc/src/config.ts` | `DEFAULT_SETTINGS` | settings defaults; wind is intentionally not a Settings field | unchanged; the new `wind` passthrough stays outside `DEFAULT_SETTINGS` |
| `packages/zudo-doc/src/config.ts` | `ZudoDocConfig.wind` | no wind passthrough → optional `WindConfig \| false` shell field | implemented; W27; JSDoc default coverage passes in `config-jsdoc.test.ts`; value stays outside `Settings` |
| `packages/zudo-doc/src/config.ts` | `zudoDoc` | framework/tailwind shell fields → omitted; wind defaults/user override → package preset plus optional top-level value | implemented; W27 and R-JSX; config tests cover absent, partial color override and `false`, asserting the full package fragment remains beside the user override for zfb's recursive merge; config loads in zfb 3.1.0; downstream JSX type errors remain expected |
| `packages/zudo-doc/src/preset.ts` | `PresetLocaleConfig` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetVersionConfig` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetClaudeResourcesConfig` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetCodexResourcesConfig` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetChangelogConfig` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetHeaderNavItem` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetSettings` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `DirectiveVocabulary` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetTranslations` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetTagVocabularyEntry` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `ZudoDocPresetArgs` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetCollection` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetPlugin` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetResolveMarkdownLinks` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetMarkdown` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `PresetCodeHighlight` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `ZudoDocPresetResult` | no package-owned wind preset → preset array containing the wind fragment | implemented; W27; typed as zfb config presets and asserted by `config.test.ts` |
| `packages/zudo-doc/src/preset.ts` | `zudoDocPreset` | framework/tailwind example → v3 shell; package wind defaults → `definePreset`-owned fragment | implemented; W27 and R-JSX; implementation lives in `src/wind/index.ts`; token/reset contents are intentionally deferred to #4439 |
| `packages/zudo-doc/src/preset.ts` | `buildCollections` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `buildResolveMarkdownLinks` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `buildMarkdownFeatures` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/preset.ts` | `buildPlugins` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/tsconfig.base.json` | `compilerOptions.jsxImportSource` | Preact JSX runtime → `@takazudo/zfb/zudo-react` | implemented; R-JSX; root, page, e2e-inherited and package fixture React compatibility paths are removed |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site changed or introduced by #4436 | Config and dependency changes only | verified none; no `rawHtml` payload or markup site is added |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| No CSS source changed by #4436 | Wind config is an empty placeholder until #4439 | no utility/token disposition claimed; #4439 owns tokens/reset and #4440 owns candidate coverage |

## Tests and completion evidence

The focused config coverage lives in `packages/zudo-doc/src/__tests__/config.test.ts`; field documentation is guarded by `config-jsdoc.test.ts`. This topic contains no island, route-rendering, or CSS behavior, so source-resolution ports and browser parity stay with their owning topics.

| Command | Result |
| --- | --- |
| `pnpm install --ignore-scripts` | PASS; 3.1.0 zfb family installed. pnpm warned that the history-server bins could not be linked because its `dist/` is absent under the intentional `--ignore-scripts` install. |
| `pnpm check:pin-parity` | PASS; root exact pins, package dev pins, `^3.1.0` peers, and scaffold family pins agree. |
| `node scripts/check-scaffold-pin-freshness.mjs` | PASS; published zfb family and peer floors are current at 3.1.0. |
| `pnpm exec zfb --version` | PASS; `zfb 3.1.0` (embedded esbuild 0.25.12). |
| `pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/__tests__/config.test.ts packages/zudo-doc/src/__tests__/config-jsdoc.test.ts` | PASS; 2 files, 58 tests. |
| `pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/__tests__/foundation-eval-graph.test.ts` | PASS; 1 file, 19 tests; the new `definePreset` runtime edge remains node-builtin-free. |
| `pnpm exec zfb check` | Config phase PASS; then exits 1 on expected transition errors in unported JSX/type sites (`src/components/preset-generator.tsx`, `src/config/frontmatter-preview-renderers.tsx`, and `pages/lib/_nav-source-cache.ts`). |
| `pnpm --filter @takazudo/zudo-doc exec tsup --silent` | Expected migration-window failure: zfb 3.1.0 rejects the old Tailwind `@import` in `src/compiled.entry.css` with ZW009; CSS cutover belongs to #4439/#4440. The command deleted tracked `dist/compiled.css`; it was restored from the worktree base and is unchanged. |

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | No island port in this topic; focused config/JSDoc tests pass as listed above. #4438 owns source-resolution/port-check tooling. |
| RawHtml review verdict per site | Verified none added or changed. |
| Deliberate DOM/class/behavior differences and cause | Config-only: framework/tailwind keys are removed per R-JSX; no DOM or CSS output is claimed. |
| Upstream issue/shim and removal version | No shim or pnpm patch selected; no upstream workaround introduced. |
| Browser/visual cases handed to #4468/#4475 | Effective CSS/reset/token parity remains with #4439/#4440/#4468/#4475; #4436 adds only the wind merge seam. |
| Final commit / reviewer / date | Local topic commit is included in the manager handoff; Codex foreground self-review complete, 2026-10-02. |
