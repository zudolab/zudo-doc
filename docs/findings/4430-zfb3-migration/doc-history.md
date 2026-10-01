# Port the DocHistory island completely (dialog, fetch, states, revision list, diff viewer), doc-history-area, and their tests

Owner: [#4452](https://github.com/zudolab/zudo-doc/issues/4452). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/doc-history-area/index.tsx` | `DocHistoryMetaEntry` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history-area/index.tsx` | `DocHistoryAreaSettings` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history-area/index.tsx` | `DocHistoryComponent` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history-area/index.tsx` | `DocHistoryAreaProps` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history-area/index.tsx` | `createDocHistoryArea` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history/index.tsx` | `Spinner` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history/index.tsx` | `buildSideBySideRows` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history/index.tsx` | `getCachedDiff` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history/index.tsx` | `DiffViewer` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history/index.tsx` | `RevisionList` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/doc-history/index.tsx` | `DocHistory` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/doc-history/index.tsx` | `animate-spin` | Classify against W-CATALOG/G/R and locked wind decisions; use token or zd- authored rule, preserve baseline computed winner | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/doc-history/index.tsx` | `h-[calc(100%-3rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/doc-history-area/__tests__/doc-history-area.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-history/__tests__/doc-history-date-formats.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-history/__tests__/doc-history-display-locale.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/doc-history/__tests__/doc-history-ssg.test.tsx` — pending port/run result.

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

- `packages/zudo-doc/src/doc-history/__tests__/doc-history-date-formats.test.tsx`
- `packages/zudo-doc/src/doc-history/__tests__/doc-history-display-locale.test.tsx`
- `packages/zudo-doc/src/doc-history/index.tsx`
