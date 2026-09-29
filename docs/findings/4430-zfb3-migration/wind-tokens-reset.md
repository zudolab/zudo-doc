# CSS cutover A: package-owned wind tokens, owned-v1 reset with an authored preflight patch, and theme.css without @theme

Owner: [#4439](https://github.com/zudolab/zudo-doc/issues/4439). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `parseArgs` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `validateTiers` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `skipTrivia` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `skipQuoted` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `skipTemplate` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `scanTierObjects` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `lastKeySite` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `readQuotedValue` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `assertSupportedPurposeGrammar` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `unreadableFieldError` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `parseTiers` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `shellQuote` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `buildRerunCommand` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `buildBlock` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `fenceIndentColumns` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `scanMarkerLines` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `replaceBlock` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `collapseWhitespace` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `escapeTableCell` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `escapeMdxText` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `buildMdTable` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `readNamedFile` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `main` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/bin/gen-z-index.mjs` | `isDirectInvocation` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/check-theme-css.mjs` | `module / template` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/copy-theme-css.mjs` | `module / template` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/theme-css-variants.mjs` | `activeResetLines` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/theme-css-variants.mjs` | `deriveNoResetCss` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/scripts/theme-css-variants.mjs` | `assertNoResetVariant` | Retain pure logic/markup; audit reachable dialect and API | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/theme.css` | `module / template` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/z-index-defaults/index.ts` | `defaultZIndexTiers` | Tailwind directives → authored properties/wind manifest | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/wind/index.ts` (new) | `package wind defaults` | new named var-backed token config, reset and breakpoints | pending; pinned contract and locked spec |
| `scripts/zfb3-parity/explain-candidates.mjs` (new) | `candidate classifier` | new pinned-spec explain gate | pending; pinned contract and locked spec |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| `packages/zudo-doc/src/theme.css:349` | `/* Version-switcher responsive visibility (was an inline <style> child of` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/theme.css:351` | `* <style>-inside-<div> HTML5 content-model violation flagged by` | pending per-site review; R-RAW; identify producer/trust and disposal |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/theme.css` | Authored cascade / reset / custom properties | W-CASCADE and locked reset; every utility overlap gets winner-before/after evidence | pending computed-style proof |

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
