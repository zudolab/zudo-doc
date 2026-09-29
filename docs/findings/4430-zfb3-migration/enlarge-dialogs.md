# Port the ImageEnlarge and MermaidEnlarge islands

Owner: [#4450](https://github.com/zudolab/zudo-doc/issues/4450). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/image-enlarge/index.tsx` | `ImageEnlarge` | useState → signal; useEffect → activation/effect; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/image-enlarge/index.tsx` | `ImageEnlargeSsrFallback` | useState → signal; useEffect → activation/effect; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `PlusIcon` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `MinusIcon` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `PanIcon` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `MermaidEnlarge` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `MermaidEnlargeSsrFallback` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx:308` | `dangerouslySetInnerHTML={{ __html: open.svgHtml }}` | pending per-site review; R-RAW; identify producer/trust and disposal |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned source set | No mapped gap in planning TSV | Confirm generated candidate or matching shipped authored selector; unknown ordinary class is not proof | pending scan confirmation |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/image-enlarge/__tests__/image-enlarge-ssg.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-button-injection.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-ssg.test.tsx` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
