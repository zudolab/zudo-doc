# Port the SidebarTree island completely (core, note tray, root menu, footer) and its tests

Owner: [#4447](https://github.com/zudolab/zudo-doc/issues/4447). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `ToggleChevron` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `padLeft` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `getOpenSet` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `saveOpenSet` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `deriveActiveSlug` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `useActiveSlug` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `RootMenuItemEntry` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `SidebarTreeProps` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `SidebarFooter` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `SidebarTree` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `TrayList` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `TrayItem` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `noteTrayGroupStorageKey` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `TrayGroupNode` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `subtreeContainsSlug` | useState → signal; useEffect → activation/effect; useRef → Ref; memo/callback → computed/closure; raw injection → reviewed rawHtml; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; style → CSS spelling/explicit units; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/sidebar-scroll-preserve.ts` | `installSidebarScrollPreserve` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/sidebar-scroll-preserve.ts` | `ensureSidebarScrollPreserve` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/sidebar-scroll-preserve.ts` | `resolveBrowserOptions` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar-tree-island/sidebar-scroll-preserve.ts` | `disposeSidebarScrollPreserve` | event/callback → native listener or stable component prop | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx:140` | `<span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(item.label) }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx:162` | `<span dangerouslySetInnerHTML={{ __html: smartBreakToHtml(child.label) }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx:456` | `<span className="min-w-0 flex-1" dangerouslySetInnerHTML={{ __html: labelHtml }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx:727` | `<span dangerouslySetInnerHTML={{ __html: labelHtml }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx:751` | `<span dangerouslySetInnerHTML={{ __html: labelHtml }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx:823` | `<span dangerouslySetInnerHTML={{ __html: labelHtml }} />` | pending per-site review; R-RAW; identify producer/trust and disposal |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/sidebar-tree-island/index.tsx` | `py-[calc(var(--spacing-vsp-xs)+0.15rem)]` | #4435 canonical underscore-space operators; preserve mathematical value | pending owner/existing #4435 proof |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/sidebar-tree-island/__tests__/sidebar-scroll-preserve.test.ts` — pending port/run result.
- `packages/zudo-doc/src/sidebar-tree-island/__tests__/sidebar-tree-active-path.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/sidebar-tree-island/__tests__/sidebar-tree-date-formats.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/sidebar-tree-island/__tests__/sidebar-tree-note-tray-ssg.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/sidebar-tree-island/__tests__/sidebar-tree-ssg.test.tsx` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
