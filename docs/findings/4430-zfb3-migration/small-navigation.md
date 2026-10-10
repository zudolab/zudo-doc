# Port the small navigation islands: desktop toggles, MobileToc, Sidebar and ClientRouterBootstrap

Owner: [#4443](https://github.com/zudolab/zudo-doc/issues/4443). Status: **implemented and source-verified**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Active target: zfb 3.1.0, locked by [#4480](https://github.com/zudolab/zudo-doc/issues/4480) from [#4479 packed evidence](round2-3.1.0.md). Read the round-two convention and the issue lock; they supersede named round-one behavior only.

## Files and symbol mapping

| File | Symbol | v2 construct → v3 form | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/storage.ts` | `SIDEBAR_STORAGE_KEY`, `readState`, `setDataAttribute`, `writeState` | Storage readers/writers and document helpers moved out of a client island module into ordinary storage module functions. | Implemented; R-SCOPE, R-API; helper behavior is exercised through activation and toggle coverage in `desktop-sidebar-toggle-ssg.test.tsx`. Public helpers remain available through the ordinary `index.ts` facade. |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/island.tsx` | `DesktopSidebarToggle` | `useState`/`useEffect`/`useRef` → `signal` and synchronous `scope.onActivate`; chevron branch → `Show`; `className` → `class`; persist write and document attribute update happen on activation/toggle. | Implemented; R-SCOPE/R-JSX/W-CATALOG; SSR, hydration, activation storage reconcile, toggles, after-swap reconcile and disposal covered in `desktop-sidebar-toggle-ssg.test.tsx`. |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/index.ts` | public facade | Preserve the public component and helper imports at the same package subpath while moving callable helpers out of the `"use client"` entry. | Implemented; R-API and #3384 lock; imports resolve through source mode and the client export scan reports no issue in this entry. |
| `packages/zudo-doc/src/desktop-toc-toggle-island/storage.ts` | `TOC_STORAGE_KEY`, `readTocState`, `setTocDataAttribute`, `writeTocState` | Storage readers/writers and document helpers moved out of a client island module into ordinary storage module functions. | Implemented; R-SCOPE, R-API; helper behavior is exercised through activation and toggle coverage in `desktop-toc-toggle-ssg.test.tsx`. Public helpers remain available through the ordinary `index.ts` facade. |
| `packages/zudo-doc/src/desktop-toc-toggle-island/island.tsx` | `DesktopTocToggle` | `useState`/`useEffect`/`useRef` → `signal` and synchronous `scope.onActivate`; chevron branch → `Show`; `className` → `class`; persist write and document attribute update happen on activation/toggle. | Implemented; R-SCOPE/R-JSX/W-CATALOG; SSR, hydration, activation storage reconcile, toggles, after-swap reconcile and disposal covered in `desktop-toc-toggle-ssg.test.tsx`. |
| `packages/zudo-doc/src/desktop-toc-toggle-island/index.ts` | public facade | Preserve the public component and helper imports at the same package subpath while moving callable helpers out of the `"use client"` entry. | Implemented; R-API and #3384 lock; imports resolve through source mode and the client export scan reports no issue in this entry. |
| `packages/zudo-doc/src/sidebar/sidebar.tsx` | `SidebarProps`, `Sidebar` | Preact child/component aliases → `Child` and `Component` from zudo-react; empty `nodes` returns `null`; the shell is server-rendered and does not establish an island boundary. | Implemented; R-JSX/R-PROPS; no Island wrapper is owned at this call site, so #4458 has the integration handoff to remove its obsolete wrapper around `<Sidebar nodes={[]}>`. |
| `packages/zudo-doc/src/toc/mobile-toc.tsx` | `MobileTocProps`, `MobileToc` | `useState` → `signal`; `useMemo` over immutable props → one setup-time filter; state-dependent class/ARIA bindings → `computed`; anchor rows remain a static intrinsic map; `className` → `class`. | Implemented; R-JSX/R-SCOPE/R-REGIONS; SSR, closed/open interaction, close-on-selection, depth filtering, stable mobile hook and absence of `xmlns` covered in `mobile-toc-ssg.test.tsx`. |
| `src/components/client-router-bootstrap.tsx` | default `ClientRouterBootstrap` component | Remove the obsolete Preact JSX return type; retain the eager static `@takazudo/zfb-runtime/client-router` side-effect import and null-rendering island. | Implemented; R-SCOPE and the #4443 lock; import remains static and the component renders no markup. |

## Raw HTML review

No owned file uses `rawHtml`, `innerHTML`, or another raw-markup insertion path. The desktop icons and MobileToc chevron are intrinsic SVG/HTML descriptions; ClientRouterBootstrap imports the router module and returns `null`. No HTML payload is injected, so no raw-HTML trust or parser exception applies (R-RAW).

## Utility and authored-style dispositions

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/desktop-sidebar-toggle-island/island.tsx` | `rounded-r` | Removed unsupported utility. Static inline `border-radius:0 var(--radius-DEFAULT) var(--radius-DEFAULT) 0` preserves zero left corners and 4px right corners from the 0.25rem token. | Implemented; SSR asserts the emitted token expression. #4468 owns browser computed-style parity. `ease-in-out` stays as configured by #4439. |
| `packages/zudo-doc/src/desktop-toc-toggle-island/island.tsx` | `rounded-l` | Removed unsupported utility. Static inline `border-radius:var(--radius-DEFAULT) 0 0 var(--radius-DEFAULT)` preserves 4px left corners and zero right corners from the 0.25rem token. | Implemented; SSR asserts the emitted token expression. #4468 owns browser computed-style parity. `ease-in-out` stays as configured by #4439. |

## Tests and completion evidence

- `packages/zudo-doc/src/desktop-sidebar-toggle-island/__tests__/desktop-sidebar-toggle-ssg.test.tsx` — source-resolution SSR, hydrate, storage reconcile, toggle persistence, after-swap reconcile and cleanup.
- `packages/zudo-doc/src/desktop-toc-toggle-island/__tests__/desktop-toc-toggle-ssg.test.tsx` — source-resolution SSR, hydrate, storage reconcile, toggle persistence, after-swap reconcile and cleanup.
- `packages/zudo-doc/src/toc/__tests__/mobile-toc-ssg.test.tsx` — source-resolution SSR, hydrate, list visibility, close-on-selection, heading filter and no-`xmlns` markup.

| Completion field | Result |
| --- | --- |
| Port-check / unit evidence | `node scripts/zfb3-port-check.mjs <12 owned source/test files>` → 0 owned diagnostics; 841 unrelated migration-window diagnostics. `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts` on the three listed tests → 3 files / 11 tests passed. `git diff --check` passed. |
| RawHtml review verdict | Verified none in owned files. |
| Deliberate DOM/class/behavior differences and cause | Removed the desktop toggles' inner-button `data-zfb-transition-persist` per the locked #3363 decision; activation restores visibility from storage and `Show` owns chevron branches. Replaced unsupported rounded utilities with equivalent physical-corner token styles per #4440 coverage. Sidebar empty-node output is null; its call-site Island removal is handed to #4458. |
| Upstream issue/shim and removal version | #3363 is handled by the locked storage/prepaint/activation arrangement; no root persist prop or source workaround was added. #3384 callable helper exports were moved to ordinary modules. |
| Browser/visual cases handed to #4468/#4475 | Verify visible/hidden desktop sidebar and TOC toggles at lg/xl breakpoints, 4px computed physical-corner parity, hover/focus, persisted state through SPA navigation, and responsive MobileToc open/close. |
| Client export-name scan | `node scripts/check-client-export-names.mjs` does not report an owned file; it exits 1 for callable exports in `design-token-panel-bootstrap`, `html-preview-wrapper`, `image-enlarge`, and `mermaid-enlarge`, owned by other migration topics. |
| Final commit / reviewer / date | Topic commit and foreground self-review will be recorded in the #4443 completion report; 2026-10-02. |

## Remaining Preact runtime imports after the port

None in the owned client island files. The desktop toggles, MobileToc and ClientRouterBootstrap use the zudo-react contract; storage helpers are in ordinary TypeScript modules.
