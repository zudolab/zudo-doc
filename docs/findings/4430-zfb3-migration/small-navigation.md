# Port the small navigation islands: desktop sidebar/TOC toggles, MobileToc, the Sidebar shell and ClientRouterBootstrap

Owner: [#4443](https://github.com/zudolab/zudo-doc/issues/4443). Status: **pending port**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This inventory is a review checklist, not authority to edit files outside the issue Files section. Historical v2 constructs remain listed after mechanical prep so the final mapping is auditable.

## Round-2 locked spec (3.1.0)

Decision [#4480](https://github.com/zudolab/zudo-doc/issues/4480), based on [#4479 packed evidence](../../../_temp-resource/4430-zfb3-migration/spike/round2-3.1.0.md). Planned contract only; implementation and browser evidence remain pending. This overrides the named round-1 deviations.

Void use of #4442 as an unconditional remount controller. Keep ClientRouterBootstrap and `@takazudo/zfb-runtime/client-router`; its eager singleton installs the simplified round-2 incoming-document/host-policy adapter. Storage/prepaint/activation, removal of inner-button persist, ordinary helper modules and empty Sidebar behavior remain required because #3363/#3384 are not fixed. Tests distinguish native preservation of a root retained by an ancestor from fresh mount of a replaced root; no new SDK persist prop or reset of unchanged state.

## Files and symbols

| File | Symbol | v2 construct → required v3 review | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx` | `SIDEBAR_STORAGE_KEY` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx` | `readState` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx` | `setDataAttribute` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx` | `DesktopSidebarToggle` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx` | `TOC_STORAGE_KEY` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx` | `readTocState` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx` | `setTocDataAttribute` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx` | `DesktopTocToggle` | useState → signal; useEffect → activation/effect; useRef → Ref; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar/sidebar.tsx` | `SidebarProps` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/sidebar/sidebar.tsx` | `Sidebar` | Preact child types → Child/Description; Island → strict props + v3 identity | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc/mobile-toc.tsx` | `MobileTocProps` | useState → signal; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `packages/zudo-doc/src/toc/mobile-toc.tsx` | `MobileToc` | useState → signal; memo/callback → computed/closure; event/callback → native listener or stable component prop; className → intrinsic class; preserve custom props except locked exceptions; Preact child types → Child/Description; Island → strict props + v3 identity; map → static intrinsic rows or keyed For as needed | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |
| `src/components/client-router-bootstrap.tsx` | `ClientRouterBootstrap` | useEffect → activation/effect | pending; R-JSX/R-SCOPE/R-PROPS or W-TOKENS/W-CATALOG as applicable; owner supplies exact anchor/test |

## Raw HTML sites to review

| File and baseline line | Payload/context review | Trust, parser context, cleanup and test |
| --- | --- | --- |
| `src/components/client-router-bootstrap.tsx:39` | `// closer to Astro's <script type="module"> emission timing. The first` | pending per-site review; R-RAW; identify producer/trust and disposal |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx` | `ease-in-out` | Keep utility; #4439 supplies explicit token | pending owner/existing #4435 proof |
| `packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx` | `ease-in-out` | Keep utility; #4439 supplies explicit token | pending owner/existing #4435 proof |

## Tests and completion evidence

Existing candidate test files (ownership exceptions in the issue still apply):

- `packages/zudo-doc/src/desktop-sidebar-toggle-island/__tests__/desktop-sidebar-toggle-ssg.test.tsx` — pending port/run result.
- `packages/zudo-doc/src/desktop-toc-toggle-island/__tests__/desktop-toc-toggle-ssg.test.tsx` — pending port/run result.

Run the exact source-resolution and port-check commands from the conventions with this topic’s paths. Record command, result, version and remaining diagnostics. Required behavioral coverage: initial SSR, active updates, cleanup/disposal, relevant navigation and parser/prop failures. CSS changes require computed-style evidence from the verification owner; a green build is insufficient.

| Completion field | Owner must fill |
| --- | --- |
| Port-check / unit evidence | pending |
| RawHtml review verdict per site | pending (or verified none) |
| Deliberate DOM/class/behavior differences and cause | pending (or verified none) |
| Upstream issue/shim and removal version | pending (or verified none) |
| Browser/visual cases handed to #4468/#4475 | pending |
| Final commit / reviewer / date | pending |
