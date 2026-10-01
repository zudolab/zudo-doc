# Port the shared primitives first: useModalDialog, island-types, Icons, tree-nav-shared and hydration-pending

Owner: [#4441](https://github.com/zudolab/zudo-doc/issues/4441). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/hydration-pending.ts` | `useHydrationPending` | useState → signal; useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `IconProps` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `ChevronRight` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `ChevronLeft` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `Search` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `History` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `Close` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `ArrowLeft` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `GitHub` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `Folder` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FolderOpen` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FileGeneric` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FileCode` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FileText` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FileImage` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FileVideo` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FilePdf` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/icons/index.tsx` | `FileArchive` | className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/island-types/index.ts` | `ChatMessage` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/island-types/index.ts` | `DocHistoryEntry` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/island-types/index.ts` | `DocHistoryData` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/island-types/index.ts` | `ENLARGE_DIALOG_STYLE` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/island-types/index.ts` | `IMAGE_ENLARGE_DIALOG_CLASS` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/island-types/index.ts` | `MERMAID_ENLARGE_DIALOG_CLASS` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/island-types/index.ts` | `EnlargeDialogProps` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tree-nav-shared/index.tsx` | `INDENT` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tree-nav-shared/index.tsx` | `CONNECTOR_OFFSET` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tree-nav-shared/index.tsx` | `CONNECTOR_WIDTH` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tree-nav-shared/index.tsx` | `BASE_PAD` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tree-nav-shared/index.tsx` | `connectorLeft` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tree-nav-shared/index.tsx` | `CategoryLinkIcon` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/tree-nav-shared/index.tsx` | `ConnectorLines` | className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/use-modal-dialog/index.ts` | `useModalDialog` | useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

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

- `packages/zudo-doc/src/icons/__tests__/icons.test.tsx` — pending port/run result.

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

- `packages/zudo-doc/src/hydration-pending.ts`
- `packages/zudo-doc/src/use-modal-dialog/index.ts`
