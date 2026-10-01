# CSS cutover B: wind candidate manifest, compiled.css pipeline, showcase global.css, and the lockstep safelist-gate rename

Owner: [#4440](https://github.com/zudolab/zudo-doc/issues/4440). Status: **pipeline implemented; authored-class gate blocked by leaf-owned source classes**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

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

## #4440 implementation evidence (2026-10-02)

The package's dist-literal scanner now writes a strict `dist/wind.json` through zfb's own CSS compiler. A temporary project loads the package wind token config and a provisional manifest; `ZW001`–`ZW008` candidate diagnostics remove unsupported entries before a final successful read-back. The one-shot `pnpm --filter @takazudo/zudo-doc exec tsup --silent` build passed under the machine heavy guard (`verdict=PASS`): 482 valid candidates from 2,751 scanner tokens, and an 88,816-byte `dist/compiled.css`. The compiled CSS generator uses a temporary project config and the manifest, avoiding the excluded `dist/**` source path. Its tracked output passed byte-for-byte regeneration.

The public `wind.json` export replaces `safelist.css`; `theme-no-reset.css` is also removed from exports. The package preset declares the bare manifest specifier. The prepack presence/shape check, root package gate, b4push step, CI job and required-checks context were renamed together. `node scripts/check-b4push-ci-parity.mjs` and `node scripts/check-required-checks.mjs` passed. Focused package tests passed 72/72, root gate tests passed 15/15, and the manifest and compiled CSS gates passed. `pnpm exec zfb wind audit --project-root . --fail-on error` exited 0, while its report still lists two host `zd-preset-gen*` unrecognized classes and audit-info diagnostics; the red-window audit is not visual parity evidence.

A comment-stripped scan of 36 shipped and showcase source CSS files found zero uncommented Tailwind directives/functions from the #4440 acceptance list. The one test fixture under `packages/zudo-doc/src/__tests__` retains historical Tailwind input and is excluded from the shipped/showcase claim. There are no `rawHtml` sites in #4440 source changes and no deliberate DOM or behavior changes. The cascade and token choices follow the locked conventions, plus the [cascade layers](https://github.com/takazudo/zudo-css-wisdom/blob/main/src/content/docs/architecture/cascade-layers.mdx) and [theming recipes](https://github.com/takazudo/zudo-css-wisdom/blob/main/src/content/docs/custom-properties/theming-recipes.mdx) references.

### Authored-class coverage blocker

The new normal package test checks class expressions, conditional literals and markup against `wind.json`, then checks registered authored classes against actual shipped CSS selectors. Its selector registry check passes. Its exhaustive source check intentionally fails on these **18 complete class tokens**. None is in the manifest or a matching shipped selector. These source files are owned by later topics, so #4440 did not mutate them or add no-op rules:

| Owner | Source | Missing class / disposition |
| --- | --- | --- |
| #4443 | `desktop-toc-toggle-island/index.tsx:102`; `desktop-sidebar-toggle-island/index.tsx:97` | `rounded-l`, `rounded-r`: unsupported wind catalog values; migrate to supported classes or a non-utility-root authored class with a real radius rule. |
| #4452 | `doc-history/index.tsx:590,610` | `doc-history-trigger`, `doc-history-panel`: behavior/structure markers with no shipped selector; move to data attributes or give them real authored rules. |
| #4457 | `content-admonition/index.tsx:43`; `code-syntax/tabs.tsx:129,133,151`; `math-block/index.tsx:74,83` | `admonition`, `tabs-container`, `tabs-nav`, `tabs-content`, `math`, `math-display`, `math-inline`: markers with no shipped selector. Dynamic `admonition-<variant>` has authored variant rules, but the base `admonition` does not. |
| #4459 | `i18n-version/version-switcher.tsx:366` | `version-switcher`: data marker already exists; no shipped selector. |
| #4461 | `asset-page/components.tsx:104,195`; `home-page/index.tsx:315,332,350,360,398` | `zd-asset-pdf`, `rounded-l`, `zd-home-hero`, `zd-home-copy`, `zd-home-intro`, `zd-home-sitemap`, `zd-home-tags`: markers without shipped selectors and one unsupported radius utility. |

`rounded-l`/`rounded-r` cannot be registered as authored classes under ZW006's utility-root collision rule. The leaf owners or #4467 integration floor must clear this list and rerun `authored-class-coverage.test.ts`. Browser verification remains for #4468/#4475: check package and showcase import/cascade order, computed border radii on the three toggles, theme pack/token changes, content typography, responsive visibility, and packed-consumer public CSS imports with sibling relative assets. A standalone `zfb css` run does not prove the packed asset resolution case.
