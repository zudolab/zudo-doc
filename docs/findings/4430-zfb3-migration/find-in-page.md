# Port FindInPageInit and FindBar (Tauri)

Owner: [#4449](https://github.com/zudolab/zudo-doc/issues/4449). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/find-in-page/find-bar.tsx` | `toMatchInfo` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/find-in-page/find-bar.tsx` | `FindBar` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/find-in-page/find-in-page.ts` | `FindResult` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/find-in-page/find-in-page.ts` | `FindInPage` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/find-in-page/find-in-page.ts` | `createFindInPage` | className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/find-in-page/index.tsx` | `FindInPageInit` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| No direct site in initial source scan | Check imported helpers and newly introduced rawHtml | pending confirmation; add each new site explicitly |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/find-in-page/find-bar.tsx` | `shadow-md` | #4435 measured inert on v2; delete only with zero computed change evidence | pending owner/existing #4435 proof |

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

## Remaining Preact runtime imports after #4437

The following files still import Preact runtime APIs for their assigned semantic port. The mechanical codemod removed Preact type imports and JSX pragmas.

- `packages/zudo-doc/src/find-in-page/find-bar.tsx`
- `packages/zudo-doc/src/find-in-page/index.tsx`
