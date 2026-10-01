# SidebarTree v3 port

Owner: [#4447](https://github.com/zudolab/zudo-doc/issues/4447). Status: **ported and source checked**. Binding rules: [conventions](../../../_temp-resource/4430-zfb3-migration/conventions.md), especially runtime/lifecycle, keyed structure, raw HTML, and persisted chrome. The implementation is in `packages/zudo-doc/src/sidebar-tree-island/`.

## Construct and symbol gap table

| v2 symbols / construct | v3 form and decision | Evidence |
| --- | --- | --- |
| `SidebarTree`, `useActiveSlug`: `useState`, `useEffect`, setup-time path read | Signals seed from the SSR `currentSlug`; `readCurrentPath` resolves explicit path, dataset, then location only in `onActivate` and after navigation. The live navigation listener is scope-owned. | `sidebar-tree-active-path.test.tsx`; `sidebar-tree-interaction.test.tsx`; R-SCOPE, #4447 locked spec |
| `SidebarTree`: `useMemo` filter/footer and three early root returns | Writable `query` text model; computed filtered nodes and tray root; `Show` chain owns root menu, top page and tree branches. Footer retains ThemeToggle's exact four prop names and values. | `sidebar-tree-ssg.test.tsx`; `sidebar-tree-interaction.test.tsx`; R-JSX/R-SCOPE, #4447 |
| `NodeList`, `CategoryNode`, `LeafNode`: memo, mapped keyed JSX, effect and callback closures | Removed three memo wrappers. Slug-keyed `For` retains row scopes across filtering; computed row labels/classes/current marker read live item and active signals. Open state reads sessionStorage on activation, follows new active paths, and persists user toggles. | `sidebar-tree-interaction.test.tsx`; `sidebar-tree-active-path.test.tsx`; R-SCOPE/R-JSX, #4447 |
| `TrayList`, `TrayGroupNode`, `TrayItem`, group storage key | Keyed `For` by slug/group key, computed rank/date labels and active state, `Show` for group lifetime. Existing `notes#year` / `notes#year-month` persistence keys are unchanged. | `sidebar-tree-note-tray-ssg.test.tsx`; `sidebar-tree-date-formats.test.tsx`; `sidebar-tree-interaction.test.tsx`; R-JSX/R-SCOPE |
| `RootMenuItemEntry`, `SidebarFooter`, `ToggleChevron` | Keyed root entries and children; `Show` for expansion and locale active link; reactive chevron class through a single keyed icon description. ThemeToggle remains a bare child. | `sidebar-tree-interaction.test.tsx`; `sidebar-tree-note-tray-ssg.test.tsx`; R-JSX/R-PROPS |
| `padLeft`, `subtreeContainsSlug`, `getOpenSet`, `saveOpenSet` | Pure or scoped helpers retain their existing calculations and fail-closed storage handling. No callable helper is exported from the client entry. | Source check; interaction/storage tests; #3384 |
| `sidebar-scroll-preserve.ts`: document singleton and before/after listeners | Retained the document-lifetime controller across an island remount. One animation frame restores nonzero scroll only on the same persisted aside; replacement aside starts fresh. | `sidebar-scroll-preserve.test.ts`; persisted chrome convention, #4442 |

## Raw HTML review

Every payload below is `smartBreakToHtml(label)`. Its producer escapes author-controlled text and inserts only `<wbr>` opportunities. Each target is an ordinary HTML `span` with no children; none can contain a nested island wrapper, reserved protocol marker, script/style closing tag, or resource requiring disposal. The payload is deterministic from SSR props and recomputes from the retained item signal after filter updates. See R-RAW.

| Site / parent context | Label source and test |
| --- | --- |
| `RootMenuItemEntry` root link span inside `a` | `item.label`; root menu hydration/expansion interaction test |
| `RootMenuItemEntry` child link span inside `a` | `child.label`; root menu expansion interaction test |
| `TrayItem` row label span inside `a` | `item.label`; note tray SSG and filtered tray tests |
| `CategoryNode` linked category span inside `a` | `node.label`; active-path and hydration tests |
| `CategoryNode` button category span inside `button` | `node.label`; category open/collapse and filter tests |
| `LeafNode` link span inside `a` | `node.label`; SSG link and hydration filter tests |

No additional raw HTML site was introduced.

## DOM, utility, and behavior differences

- `aria-current="false"` is emitted for inactive links because zudo-react's live string binding cannot accept an undefined signal. It has the same ARIA meaning as an absent current marker; active links still use `page`. No class or layout change is intended.
- zudo-react region comments and keyed list markers are engine protocol output. The `data-zfb-island="SidebarTree"` marker remains unchanged.
- The existing `py-[calc(var(--spacing-vsp-xs)_+_0.15rem)]` spelling is the #4435 zudo-wind normalization. Its computed value is unchanged.
- The filter remains live on input; `modelValue` now handles native composition. Persisted category and group state, rank padding, date roles, footer locale links, and root navigation are preserved.

## Verification and remaining integration checks

- `node scripts/zfb3-port-check.mjs` with every owned source and test file: **0 owned diagnostics** (823 unrelated migration-window diagnostics).
- `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/sidebar-tree-island/__tests__`: **6 files, 38 tests passed**. This includes SSR, hydration diagnostics, filter input, active path updates, storage restore/collapse, note tray group collapse, root menu, and scroll controller behavior.
- `node scripts/check-client-export-names.mjs`: no #4447 diagnostic; other unported client entries still produce errors.
- The footer prop test mocks ThemeToggle only to check the SidebarTree seam while #4446 owns the child port. Integrated SSR/hydration of the real ThemeToggle remains for #4446/#4468.
- No direct browser or visual check in this worktree. #4468/#4475 should check nonzero desktop sidebar scroll through same-section and cross-section SPA navigation, active-path updates after navigation, keyed row focus during filtering, note tray open state, root menu, mobile footer ThemeToggle, and computed spacing in light/dark themes.
- Guarded package build emitted the owned JS artifact through tsup, then stopped at the unrelated `compiled.entry.css` ZW009 `@import` migration blocker owned by #4440; declarations were not emitted. The build removed tracked `dist/compiled.css` as a side effect, and that file was restored immediately. Full package rebuild remains for #4467 after CSS migration.
- No new upstream issue or shim. Relevant existing upstream issue: [#3362](https://github.com/Takazudo/zudo-front-builder/issues/3362) for persisted nested island lifecycle; 3.1.0 native path is used.
