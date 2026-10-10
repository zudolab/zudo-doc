# Port FindInPageInit and FindBar (Tauri)

Owner: [#4449](https://github.com/zudolab/zudo-doc/issues/4449). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/find-in-page/find-bar.tsx` | `toMatchInfo` | Retained as a pure helper that maps empty results to `null`; called from the search effect and navigation handlers | verified; R-SCOPE; covered by `find-in-page-interaction.test.tsx` |
| `packages/zudo-doc/src/find-in-page/find-bar.tsx` | `FindBar` | `query` and `matchInfo` use writable signals; `modelValue={query}` listens to native input for live search; a scope effect handles search/reset; `Ref<HTMLInputElement>` owns focus; computed `Show` tracks visibility; native key/click events use local Event narrowing | verified; R-FORMS/R-SCOPE/R-REGIONS; live typing before blur/change, composition, next, Escape guards, close and result cleanup pass in `find-in-page-interaction.test.tsx` |
| `packages/zudo-doc/src/find-in-page/find-in-page.ts` | `FindResult` | Retained as the utility's plain result interface; no component prop or JSX dialect | verified; R-API; consumed by `FindBar` tests |
| `packages/zudo-doc/src/find-in-page/find-in-page.ts` | `FindInPage` | Retained as the framework-free DOM utility interface; no component prop or JSX dialect | verified; R-API/R-LIFETIME; `stop()` behavior covered through close, navigation and disposal |
| `packages/zudo-doc/src/find-in-page/find-in-page.ts` | `createFindInPage` | Retained as plain DOM logic; creates/removes `<mark>` nodes and uses DOM `className`, not JSX `className`; no framework lifecycle is acquired | verified; R-LIFETIME; integration tests assert matches, active ordinal and mark cleanup |
| `packages/zudo-doc/src/find-in-page/index.tsx` | `FindInPageInit` | `isTauri` and `visible` use signals; synchronous `onActivate` checks the Tauri global and owns shortcut/navigation listeners; cleanup removes both listeners; computed `Show` gates the Tauri child; `Event` handlers narrow locally; the island marker name remains pinned | verified; R-SCOPE/R-REGIONS/R-LIFETIME; SSR/hydration, open/close, navigation reset and listener removal pass in `find-in-page-interaction.test.tsx` |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in the three owned source files | `FindInPage` uses DOM text nodes and generated `<mark>` elements; the port adds no `rawHtml` and no imported HTML-producing helper | verified by source review; no payload trust or parser-context surface exists; test exercises generated mark creation/removal |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/find-in-page/find-bar.tsx` | `shadow-md` | Already removed in #4435 CSS preparation; its measured v2 compiled CSS had no matching selector, so it emitted no declaration. The owned port makes no CSS/class change. | verified from the #4435 evidence in `css-prep.md`; browser computed-style parity remains with #4468/#4475 |

## Tests and completion evidence

`packages/zudo-doc/src/find-in-page/__tests__/find-in-page-interaction.test.tsx` exercises the hydrated island: inert behavior outside Tauri, open via Ctrl+F, live input search before blur/change, composition input, next, Escape composition/default-prevented guards, Escape and button close, zfb navigation reset, match cleanup, and removal of the two document listeners on disposal.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Evidence |
| --- | --- |
| Port-check / unit evidence | zfb 3.1.0; `node scripts/zfb3-port-check.mjs packages/zudo-doc/src/find-in-page/index.tsx packages/zudo-doc/src/find-in-page/find-bar.tsx packages/zudo-doc/src/find-in-page/find-in-page.ts packages/zudo-doc/src/find-in-page/__tests__/find-in-page-interaction.test.tsx` → 0 owned / 502 unrelated diagnostics, exit 0; `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/find-in-page/__tests__/find-in-page-interaction.test.tsx` → 2 passed. |
| RawHtml review verdict per site | No `rawHtml` sites in owned source; utility writes text content into generated marks. The test harness hydrates trusted output from the owned zudo-react server renderer in its disposable host. |
| Deliberate DOM/class/behavior differences and cause | Behavior: native Preact `onChange` (change, generally after blur/commit) is replaced by locked `modelValue`/native `input`, so find-as-you-type updates before blur/change; required by #4480's #4449 lock and verified in the interaction test. Escape/Enter shortcuts also honor composing and `defaultPrevented` events per the lock. No markup/class changes. |
| Upstream issue/shim and removal version | No new upstream issue or shim. The port uses zfb 3.1.0's published model and lifecycle APIs. |
| Browser/visual cases handed to #4468/#4475 | Tauri shortcut visibility, focus/selection, find bar positioning, and actual browser IME composition remain visual/browser parity cases for #4468/#4475; this topic ran only the happy-dom harness. |
| Final commit / reviewer / date | Source/test commit `af21642de0cdcc579ec84f75c99659edc48057d4`; this matrix evidence is finalized in the following topic commit. Foreground self-review by owning agent, 2026-10-02. |

## Preact runtime import census after #4449

No owned file imports Preact runtime APIs after this port. The ordinary FindBar module uses zudo-react signals, regions and native events; FindInPageInit remains the single client island entry.
