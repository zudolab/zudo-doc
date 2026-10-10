# Port the Toc island and useActiveHeading to zudo-react

Owner: [#4444](https://github.com/zudolab/zudo-doc/issues/4444). Status: **implemented; focused source-resolution checks pass**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Baseline: zudo-doc 5.28.2 at `337b9f110`, zfb 2.22.1. Target: zfb 3.1.0. This topic changed only its assigned TOC files and this evidence file.

## Construct matrix

| File / v2 construct | v3 form | Status, spec and evidence |
| --- | --- | --- |
| `toc.tsx` — `useMemo` around heading-depth filtering | Plain setup-time `.filter()` over immutable island props | Complete. Island setup runs once; only depths 2–4 remain. zudo-react contract §2.1 and the locked convention that immutable prop effects use plain setup values. Covered by `toc-ssg.test.tsx`. |
| `toc.tsx` — component return typed as Preact `VNode`/v3 `Description` | `Child` return type | Complete. The conditional child expression can be a boolean, so the component contract is `Child`, not `Description`. zudo-react contract §2.1. Owned-file port check is clean. |
| `use-active-heading.ts` — `useState` active id | Writable `signal<string | null>` | Complete. Signal starts `null`, matching static SSR; computed link state updates after activation. zudo-react contract §2.1. Covered by SSR/hydration and scroll-spy tests. |
| `use-active-heading.ts` — `useRef` heading ids, element map and suppression state | Immutable slug list plus activation-local DOM map and suppression closure | Complete. `document.getElementById` runs only inside `scope.onActivate`; no browser reads occur during SSR or setup. zudo-react contract §2.1. Covered by restored-position and cleanup tests. |
| `use-active-heading.ts` — `useEffect` listener installation and initial `update()` | One synchronous `scope.onActivate` callback that measures the live document, then installs `scroll`, `resize` and `scrollend` listeners | Complete. The callback returns cleanup that removes all listeners. Browser position is reconciled after hydration, preserving current hash/restored-scroll behavior after the browser applies that position while the server and initial client tree remain identical; no location read is added. zudo-react contract §2.1. Covered by `use-active-heading.test.ts`. |
| `use-active-heading.ts` — debounce, smooth-scroll fallback and click suppression timers | Timers created and owned inside the same activation callback; all handles cleared on scroll end or cleanup | Complete. Retains the 200 ms scroll debounce, 1.5 s no-`scrollend` fallback and 2 s click safety timeout. zudo-react contract §2.1 (activation cleanup). Covered by debounce, click, `scrollend`, no-`scrollend` fallback, and disposal cases in `use-active-heading.test.ts`. |
| `toc.tsx` — per-link active-state snapshot | Per-item `computed` values for active state, `class`, and `aria-current` | Complete. Computed signals are passed to attributes; no `.value` snapshot is emitted into JSX. zudo-react contract §2.1. Covered by active/inactive class and current-link assertions in `use-active-heading.test.ts`. |
| `toc.tsx` — `onClick` and `className` | Native `on:click` listener and HTML `class` | Complete. Link hrefs and immediate click activation remain intact. zudo-react contract §2.2. Covered by click and scroll suppression/reconciliation cases. |
| `getActiveHeadingId` — pure scroll-position selection algorithm | Kept as a pure function | Complete; threshold, midline, missing-element and predecessor behavior are unchanged. Covered by the existing 8 unit cases in `use-active-heading.test.ts`. |
| `cx.test.ts` and `toc-title.test.ts` — pure helpers | Remain framework-independent unit tests | Complete; no Preact runtime or renderer dependency to replace. Both run in the package source-resolution lane. |

## Raw HTML review

There are no `rawHtml` sites in the owned implementation or tests, and this port adds none. The retained `SmartBreak` child is built from escaped text values and `<wbr>` JSX nodes; its helper has no `rawHtml` use. No trust or parser-context exception is needed.

## DOM, class and behavior differences

- No DOM, visible class, or scroll-spy behavior difference was introduced by this topic. SSR still emits no active link; activation measures the browser's current position; clicks activate immediately and defer scroll-driven reconciliation until `scrollend` or the existing fallback.
- The inherited `h-[calc(100vh_-_3.5rem)]` class is preserved from #4435. Its underscore encodes spaces required by zudo-wind's calc grammar (W12); it represents the same `calc(100vh - 3.5rem)` value. This topic did not change that class.
- Exact-markup assertions were not loosened or changed to conceal a port difference.

## Tests and completion evidence

Owned tests: `cx.test.ts`, `toc-ssg.test.tsx`, `toc-title.test.ts`, and `use-active-heading.test.ts`. SSG uses the zudo-react server renderer. Scroll-spy coverage exercises initial SSR, activation-time current-position reconciliation, reactive classes/ARIA, 200 ms scroll and resize debounce, immediate link activation, `scrollend` reconciliation, and disposal of pending work.

Commands from the worktree root:

```sh
node scripts/zfb3-port-check.mjs packages/zudo-doc/src/toc/toc.tsx packages/zudo-doc/src/toc/use-active-heading.ts packages/zudo-doc/src/toc/__tests__/cx.test.ts packages/zudo-doc/src/toc/__tests__/toc-ssg.test.tsx packages/zudo-doc/src/toc/__tests__/toc-title.test.ts packages/zudo-doc/src/toc/__tests__/use-active-heading.test.ts
ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/toc/__tests__/cx.test.ts packages/zudo-doc/src/toc/__tests__/toc-ssg.test.tsx packages/zudo-doc/src/toc/__tests__/toc-title.test.ts packages/zudo-doc/src/toc/__tests__/use-active-heading.test.ts
```

Results on 2026-10-02, zfb 3.1.0: port check **0 owned diagnostics**; it separately reported 634 unrelated migration-window diagnostics. Source-resolution tests: **4 files, 33 tests passed**. Package artifacts were not rebuilt: this branch is in the documented red window before #4467, and the source-resolution harness is the prescribed verification lane; no package export-map or generated asset changed.

No upstream issue or workaround/shim was needed. Browser scroll, anchor navigation, smooth-scroll and Safari fallback checks remain for the #4468/#4475 browser parity owners; this leaf used the DOM test harness only.

## Final review

- Self-review: foreground complete; findings applied.
- Final commit: recorded in the topic completion report.
- Reviewer/date: topic owner self-review, 2026-10-02.
