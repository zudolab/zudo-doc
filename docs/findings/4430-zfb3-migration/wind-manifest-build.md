# CSS cutover B: wind candidate manifest, compiled.css pipeline, showcase global.css, and the lockstep safelist-gate rename

Owner: [#4440](https://github.com/zudolab/zudo-doc/issues/4440). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](../../../_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md). Planned contract only; implementation and browser evidence remain pending. This overrides the named round-1 deviations.

Void the round-1 physical CSS imports and #3364 workaround comments: use public `@takazudo/zudo-doc/<name>.css` exports and `@takazudo/zdtp/styles.css`; package-internal relative imports remain relative. #4479 Z06/D01 prove the public resolution from a packed consumer, including a sibling relative asset for the CSS producer. Cover public imports/relative assets in the integration packed build. Do not treat standalone `zfb css` companion-asset behavior as proven by `zfb build`.

Void the claim that audit cannot gate: use `pnpm exec zfb wind audit --project-root . --fail-on error`; error diagnostics and invalid config exit 1, clean config exits 0 (Z11). Keep emitted-rule/authored-class coverage and the manifest pipeline: #3371 conditional literals still vanish, #3367 source exclusions remain missing, and #3366 now diagnoses excluded `dist/**` rather than making it usable. Use the public wind manifest or sources outside outDir. Export removals/additions and the safelist-gate rename stay as locked; #4470 adds the audit required-check wiring.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/scripts/check-safelist.mjs` | `module / template` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-compiled-css.mjs` | `assertRule` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-compiled-css.mjs` | `assertCompiledCss` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-compiled-css.mjs` | `generateCompiledCss` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-safelist.mjs` | `findJsFiles` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-safelist.mjs` | `maskBrackets` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-safelist.mjs` | `isValidToken` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-safelist.mjs` | `collectTokens` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-safelist.mjs` | `extractTokens` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-safelist.mjs` | `emitSafelist` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-safelist.mjs` | `main` | event/callback → native listener or stable component prop; Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/compiled.entry.css` | `module / template` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/styles/global.css` | `module / template` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/gen-wind-manifest.mjs` (new) | `manifest generator` | gen-safelist renamed; strict valid-candidate JSON | pending; pinned contract and locked spec |
| `packages/zudo-doc/src/__tests__/authored-class-coverage.test.ts` (new) | `authored coverage` | new utility-or-shipped-selector proof | pending; pinned contract and locked spec |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/compiled.entry.css` | Authored cascade / reset / custom properties | W-CASCADE and locked reset; every utility overlap gets winner-before/after evidence | pending computed-style proof |
| `src/styles/global.css` | Authored cascade / reset / custom properties | W-CASCADE and locked reset; every utility overlap gets winner-before/after evidence | pending computed-style proof |

## Tests and completion evidence

No colocated test file in the initial selected-source inventory. Use the issue acceptance tests and add a focused test only for the relevant behavior.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
