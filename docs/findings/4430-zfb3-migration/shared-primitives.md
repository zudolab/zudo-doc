# Shared primitives port (#4441)

Owner: [#4441](https://github.com/zudolab/zudo-doc/issues/4441). Target: zfb 3.1.0. Binding rules: [conventions](../../../_temp-resource/4430-zfb3-migration/conventions.md), especially Runtime, Props, and the locked modal API. Baseline: zudo-doc 5.28.2 at `337b9f110`.

## Symbol gap table

| Owned symbols | v2 construct → v3 form | Status and evidence |
| --- | --- | --- |
| `hydration-pending.ts`: `useHydrationPending` | Preact `useState`/`useEffect` hook → `hydrationPending(scope, enabled)` with a signal and `scope.onActivate` | Ported. Hydration test asserts SSR/activation agreement. Subsequent leaf ports change callers. [R-SCOPE](../../../_temp-resource/4430-zfb3-migration/v3-contract.md). |
| `use-modal-dialog/index.ts`: `useModalDialog` and option/result types | Preact hooks, React refs and mouse event → setup-only `modalDialog(scope, options)`, `Scope.effect`, activation listeners, `Ref`, `Listener<Event>`, `ReadonlySignal<boolean>` | Ported per [locked public API](../../../_temp-resource/4430-zfb3-migration/conventions.md#zudo-doc-600-public-api-change-list). Tests cover hydration, state synchronization, native close (Escape's browser action), backdrop, navigation, focus, and disposal. Leaf owners migrate all six callers. |
| `island-types/index.ts`: `ChatMessage`, `DocHistoryEntry`, `DocHistoryData` | Plain data interfaces → unchanged | Reviewed; no engine dependency or behavior change. |
| `island-types/index.ts`: `ENLARGE_DIALOG_STYLE`, `EnlargeDialogProps` | Object style with `inset`, `className` → CSS string, `class` | Ported. #3375 workaround; source comment marks release gate. String preserves fixed/inset/margin declaration values. Shared style test covers the literal. |
| `island-types/index.ts`: `IMAGE_ENLARGE_DIALOG_CLASS`, `MERMAID_ENLARGE_DIALOG_CLASS` | Existing class strings → unchanged | Reviewed; leaf CSS audit and computed-style parity are #4440/#4468. |
| `icons/index.tsx`: `IconProps`, `ChevronRight`, `ChevronLeft`, `Search`, `History`, `Close`, `ArrowLeft`, `GitHub`, `Folder`, `FolderOpen`, `FileGeneric`, `FileCode`, `FileText`, `FileImage`, `FileVideo`, `FilePdf`, `FileArchive` | `className` prop → `class` prop, aliases locally to a legal identifier; CSS-spelled SVG attributes retained; Preact return annotation → zudo-react `Child` | Ported per [R-JSX/R-PROPS](../../../_temp-resource/4430-zfb3-migration/v3-contract.md). Icon SSR tests cover all file/folder icons, decorative ARIA, class forwarding and omission. No redundant `xmlns`/`focusable` present. |
| `tree-nav-shared/index.tsx`: `INDENT`, `CONNECTOR_OFFSET`, `CONNECTOR_WIDTH`, `BASE_PAD`, `connectorLeft`, `CategoryLinkIcon`, `ConnectorLines` | Constants and calculation unchanged; icon `className` → `class`; JSX and CSS-spelled style attributes remain | Ported. SSR tests cover depth zero, connector clipping and icon markup. Existing class strings and layout calculations remain. |

## Raw HTML review

No owned source file calls `rawHtml` or injects HTML. SVG icons and tree connectors are intrinsic JSX. There are no script/style payloads, parser-context exclusions, or subtree cleanup obligations in this topic.

## Utility and behavior review

No utility class was changed or introduced. Existing `zd-enlarge-dialog`, `zd-mermaid-dialog`, `z-modal`, `backdrop:z-modal-backdrop`, `shrink-0`, and connector classes remain for #4440's manifest and #4468's computed-style parity. Deliberate DOM/class differences: none. The new modal helper keeps the prior dialog behavior but requires a dialog whose lifetime matches its owning scope. The CSS style string is equivalent to the former declarations. The public `class` and modal API changes are locked migration changes; leaf callers must switch together. The hydration helper returns a signal instead of a boolean hook snapshot.

## Verification and handoff

- `node scripts/zfb3-port-check.mjs` with all nine owned source and test paths: **0 owned diagnostics**, 878 unrelated migration-window diagnostics for #4467.
- Source-resolution Vitest: 4 files, 26 tests pass (modal, hydration, icons, tree, island types). Root client-export-name unit test: 8 pass. The standalone `node scripts/check-client-export-names.mjs` remains red on six unported entries owned by later topics; it reports no owned file.
- Visual checks for #4468/#4475: focus capture and restore in real browsers, backdrop vs child click, Escape close, navigation close, enlarge dialog centering and top-layer stacking, all icons and tree connectors at mobile/desktop widths. Happy DOM cannot establish computed style or native keyboard default behavior.
- Upstream issue used: [#3375](https://github.com/Takazudo/zudo-front-builder/issues/3375). Recheck and remove the marked style-string workaround after a published fix before release; explicit CSS units remain.
- Final commit and foreground self-review recorded in the topic report.
