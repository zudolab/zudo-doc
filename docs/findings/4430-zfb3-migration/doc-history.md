# DocHistory and DocHistoryArea migration (#4452)

Status: ported against zfb 3.1.0. Binding rules: [conventions](../../../_temp-resource/4430-zfb3-migration/conventions.md); spec anchors are indexed in the [matrix README](README.md).

| Owned symbol/site | v2 construct → v3 form | Status and evidence |
| --- | --- | --- |
| `DocHistory` view, data, loading, error, selection | `useState` → five setup `signal`s; `useCallback` → closure; derived flags → `computed` | Done; R-SCOPE. Interaction test covers open, pending, error, retry, data and selection. |
| `DocHistory` body overflow | `useEffect([view])` → `scope.effect` with previous value cleanup | Done; R-SCOPE. Disposed with the island. Browser check: scroll lock and restoration after close/navigation. |
| `DocHistory` dialog | `useModalDialog` → `modalDialog(scope, { isOpen, manageFocus, returnFocusRef })`; `useRef` → `Ref` | Done; R-SCOPE. Helper test covers focus/native close; manager browser check needed for real dialog focus after SPA navigation. |
| `DocHistory` fetch | unguarded `fetch`/JSON → per-run `AbortController`, root abort and run guards after both awaits | Done; R-SCOPE. Interaction test covers pending, close, retry and disposal. |
| `DiffViewer` lazy diff | `useEffect`, `useMemo` → activation task, cancellation guard after dynamic `import('diff')`, signal changes/error and computed rows | Done; R-SCOPE. Dynamic import remains lazy and optional peer behavior is preserved. |
| `DiffViewer` table | JSX key on child and dynamic rows directly under tbody → keyed `For` outside complete table; one factory owns static intrinsic table/tbody/tr/td hierarchy; data revision updates snapshot key | Done; R-JSX/R-SCOPE, upstream [#3377](https://github.com/Takazudo/zudo-front-builder/issues/3377). Interaction test checks parsed tbody rows and replacement across comparisons. |
| `RevisionList` badges and compare | `useState` and JSX map → signals, keyed `For`, computed class/disabled bindings; native `on:click` | Done; R-SCOPE/R-JSX. Two consecutive selection changes covered. |
| `Spinner` | unsupported `animate-spin` → authored `page-loading-spin` via `page-loading-spinner`; explicit 48px dimensions and 5px border | Done; W-CATALOG. Interaction test checks pending spinner; browser check for reduced motion and dimensions. |
| `DocHistoryArea` island props | optional `locale={undefined}` → conditional spread omitting the key before child description; no post-serialization cleanup | Done; R-PROPS, upstream [#3376](https://github.com/Takazudo/zudo-front-builder/issues/3376). Area tests assert default and fallback locale transport. |
| Owned SSR/hydration tests | Preact renderer/act → zudo-react `renderToString` and `renderIsland` source-resolution harness with explicit build/scanner identity | Done; R-JSX/R-PROPS. Five focused test files, including new interaction coverage. |

## Raw HTML review

No `rawHtml` site exists in the owned sources or was introduced. Revision content is rendered as text in table cells; no HTML injection is needed.

## DOM, class and behavior differences

- `doc-history-trigger` and `doc-history-panel` were marker-only class tokens with no authored rule or wind candidate. They are now `data-doc-history-trigger` and `data-doc-history-panel`; tests and selectors use the data attributes. This is a wind candidate coverage fix, with no intended visual difference. Existing utility classes remain.
- `diff-line-num` and `diff-line-content` remain classes because they have substantive authored rules in `packages/zudo-doc/src/features.css` (line number typography/border and diff content typography/wrapping). The related `diff-row`, added, removed and empty classes also have authored rules. No no-op CSS was added.
- The table is replaced when the revision pair or completed async diff snapshot changes, as required by v3's table parser-context and keyed-region contract. Focus/selection inside the table may reset. No other deliberate behavior difference.

## Verification and handoff

- `node scripts/zfb3-port-check.mjs` on both source files and all five owned tests: **0 owned diagnostics**; unrelated migration-window diagnostics are expected until #4467.
- `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/doc-history/__tests__ packages/zudo-doc/src/doc-history-area/__tests__`: **31 passing**, including a hydration smoke test.
- No complete package/site build or browser run in this leaf topic. #4468/#4475 should check dialog focus and scroll restoration, spinner motion/size, comparison layout at mobile/desktop widths, and hydration after navigation against v2.
- Upstream issues used: [#3377](https://github.com/Takazudo/zudo-front-builder/issues/3377), [#3376](https://github.com/Takazudo/zudo-front-builder/issues/3376). No new shim or upstream issue was required.
