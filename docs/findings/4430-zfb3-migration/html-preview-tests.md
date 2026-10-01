# Migrate the HtmlPreview unit tests (12 files) to the zudo-react harness

Owner: [#4454](https://github.com/zudolab/zudo-doc/issues/4454). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| Owner test/tool files listed below or in issue Files | test/harness contract | Replace Preact execution with owned SSR→hydrate/mount→flush | pending; R-HYDRATE |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/html-preview-wrapper/__tests__/build-srcdoc.test.ts` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/code-panel-resources.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/highlight-runtime.integration.test.ts` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/highlight-runtime.test.ts` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/highlighted-code-effect.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/highlighted-code.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-contract.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-wrapper-loading.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-wrapper-visible-gate.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/preview-auto-height-component.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/preview-auto-height.test.ts` — pending port/run result.
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/resolve-sandbox.test.ts` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |

## Remaining Preact runtime imports after #4437

The following files still import Preact runtime APIs for their assigned semantic port. The mechanical codemod removed Preact type imports and JSX pragmas.

- `packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-wrapper-visible-gate.test.tsx`
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/preview-auto-height-component.test.tsx`
- `packages/zudo-doc/src/html-preview-wrapper/__tests__/resolve-sandbox.test.ts`
