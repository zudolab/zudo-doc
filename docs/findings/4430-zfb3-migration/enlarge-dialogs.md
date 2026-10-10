# Port the ImageEnlarge and MermaidEnlarge islands

Owner: [#4450](https://github.com/zudolab/zudo-doc/issues/4450). Status: **verified source port; browser parity pending #4468/#4475**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Seed evidence: exploration maps `server-jsx.md`, `islands-nav.md`, `islands-content.md`, `css-wind.md`, `pkg-build.md`, `tests-ci.md`, `deps-docs.md` at the migration planning baseline; file/symbol inventory refreshed from prerequisite base `4026c213`. This topic changes only its two islands, their three owned tests, and this matrix.

## Files and symbols

| File | Symbol | v2 construct → v3 form | Status / spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/image-enlarge/index.tsx` | `ImageEnlarge` | `useState(imgData)` → writable `signal`; both mount-only `useEffect`s → `scope.onActivate` for ResizeObserver, MutationObserver, window resize, document click and AFTER_NAVIGATE; cleanup disconnects/aborts/removes synchronously. `useModalDialog` → `modalDialog(scope, { isOpen: computedSignal, … })`. Conditional image/close-button subtree → `Show`; retained image fields use computed attributes. `srcSet` → native `srcset`. | **verified**; #4450 locked spec, R-JSX/R-SCOPE. `image-enlarge-ssg.test.tsx`: SSR/fallback equality, open/close, responsive and absent `srcset`, navigation rescan and disposal cleanup. Port check: 0 owned diagnostics. |
| `packages/zudo-doc/src/image-enlarge/index.tsx` | `ImageEnlargeSsrFallback` | Static fallback remains a closed intrinsic `<dialog>` using shared `class` and CSS-string `style`; no activation work or browser reads. | **verified**; R-JSX/R-SCOPE. Same SSR test compares fallback bytes to the closed island shell. |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `PlusIcon` | Static SVG description remains intrinsic SVG with its existing path data and CSS-spelled attributes. | **verified**; R-JSX. Rendered in the open interaction case; no path or class change. |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `MinusIcon` | Static SVG description remains intrinsic SVG with its existing line geometry and CSS-spelled attributes. | **verified**; R-JSX. Rendered in the open interaction case; no path or class change. |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `PanIcon` | Static SVG description remains intrinsic SVG with its existing path geometry and CSS-spelled attributes. | **verified**; R-JSX. Rendered in the open interaction case; no path or class change. |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `MermaidEnlarge` | Four `useState`s → writable `open`, `scale`, `translate`, `panActive` signals; derived state → `computed`. `useRef` → a `Ref<HTMLDivElement>` plus a setup-local drag record. All nine `useCallback`s → ordinary setup closures that read current signals. Button injection, document click, and route events → `scope.onActivate` with cleanup; the open-SVG MutationObserver → a rerunning `scope.effect` with disconnect cleanup. `useModalDialog` → `modalDialog(scope, …)`. Open subtree → `Show`; SVG clone → computed `rawHtml` on an ordinary div; transform → computed CSS string; pointer and keyboard handlers → `on:*` listeners taking `Event` and narrowing locally. | **verified**; #4450 locked spec, R-JSX/R-SCOPE/R-RAW. `mermaid-enlarge-button-injection.test.tsx`: inject/reinject, open, live SVG replacement, zoom, pointer and keyboard pan, zoom reset, close, navigation, observer/listener disposal. Source-resolution harness diagnostics: none. |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx` | `MermaidEnlargeSsrFallback` | Static fallback remains the closed intrinsic `<dialog>` with shared `class` and CSS-string `style`; no browser reads. | **verified**; R-JSX/R-SCOPE. `mermaid-enlarge-ssg.test.tsx` compares fallback with the closed island and hydrates the same shell without diagnostics. |

## Raw HTML review

| File / symbol / parent | Payload producer and trust | Parser, hydration, cleanup and test |
| --- | --- | --- |
| `packages/zudo-doc/src/mermaid-enlarge/index.tsx`, `MermaidEnlarge`, `div.zd-mermaid-transform` inside the dialog viewport | `svg.outerHTML` from Mermaid 11.15.0's rendered `.mermaid` container, cloned while opening and refreshed after child-list changes to the source SVG subtree. The producer is `packages/zudo-doc/src/code-syntax/mermaid-init-script.ts`; it calls `mermaid.initialize` with theme settings and does not loosen `securityLevel`. Mermaid documents `strict` as the default and protects it in its secure configuration ([Mermaid securityLevel](https://mermaid.js.org/config/schema-docs/config.html#securitylevel)). Raw HTML itself does not sanitize. | Allowed opaque SVG subtree in an ordinary HTML `div`; never assigned to an SVG element and has no JSX children. The renderer output contains no nested island or reserved `zr:1:` markers. The initial shell is closed and equals the fallback; the opaque subtree is created only on open and replaced when the cloned SVG changes. The per-open MutationObserver disconnects on replacement, close, and scope disposal. The same harness test checks the cloned SVG and a live subtree update. Real browser SVG rendering, zoom, focus and theme parity is handed to #4468/#4475. |

The Mermaid injector also assigns a static literal SVG icon to the generated button's `innerHTML`; it contains only fixed `<svg>/<polygon>` markup and no diagram or author payload. The diagram SVG is handled only by the reviewed `rawHtml` site above.

## Utility/token and authored CSS review

No utility or stylesheet was changed. The planning inventory (temporary `_temp-resource/4430-zfb3-migration/explore/artifacts/css-wind/explain.tsv`, raw dump not preserved) (explicitly measured against zfb 3.0.0 in `explore/css-wind.md`) records these source candidates in this topic and its shared dialog class constants as **resolved utility** at planning time: `relative`, `block`, `max-h-[85vh]`, `max-w-[85vw]`, `object-contain`, `mx-auto`, `max-h-[90vh]`, `max-w-[90vw]`, `overflow-hidden`, `border`, `border-muted`, `bg-surface`, `p-0`, `backdrop:z-modal-backdrop`, `z-modal`, `h-[90vh]`, and `w-[90vw]`. The `zd-*` names are component selectors in `packages/zudo-doc/src/features.css` (image enlarge around lines 669–779; Mermaid enlarge around 805–933), not assumed utilities. This worktree cannot rerun the host `zfb wind explain` against the locked zfb 3.1.0 config: loading `zfb.config.ts` fails because its package import resolves the intentionally absent `dist/config.js`, while the package-root explain invocation has no host token configuration. #4467/#4440 own the integration config and manifest recheck. Browser computed-style parity is deferred to #4468/#4475.

## Tests and completion evidence

Owned tests:

- `packages/zudo-doc/src/image-enlarge/__tests__/image-enlarge-ssg.test.tsx` — harness SSR/fallback equality and hydration-safe shell; eligible-image open, native close, srcset/sizes presence or omission, route rescan and observer/listener cleanup.
- `packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-button-injection.test.tsx` — rendered-before/after activation, duplicate guard, theme re-render reinjection, repeated re-renders, live raw-SVG update, zoom, bounded pointer drag, arrow-key pan, reset, close, AFTER_NAVIGATE close/rescan, and disposal cleanup.
- `packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-ssg.test.tsx` — fallback/closed SSR equality and harness hydration without diagnostics.

Source-resolution Vitest command from the repository root:

```sh
ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/image-enlarge/__tests__/image-enlarge-ssg.test.tsx packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-button-injection.test.tsx packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-ssg.test.tsx
```

Result: **3 files passed, 15 tests passed** (Vitest 4.1.0). Owned source/test port check:

```sh
node scripts/zfb3-port-check.mjs packages/zudo-doc/src/image-enlarge/index.tsx packages/zudo-doc/src/image-enlarge/__tests__/image-enlarge-ssg.test.tsx packages/zudo-doc/src/mermaid-enlarge/index.tsx packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-button-injection.test.tsx packages/zudo-doc/src/mermaid-enlarge/__tests__/mermaid-enlarge-ssg.test.tsx
```

Result: **0 owned TypeScript diagnostics**; unrelated migration-window diagnostics are reported separately by the helper. No full package/site build, browser suite, e2e, or b4push was run in this leaf topic.

## Differences, upstreams and remaining checks

| Completion field | Verdict |
| --- | --- |
| Deliberate DOM/class/behavior differences | No wrapper or class changes. Intrinsic `srcSet` is spelled `srcset` as locked for zfb; the conditional source branch preserves omission of `srcset` and `sizes` when the image has no responsive source. Open-state transform style is a reactive CSS string as required by #4450. SSR closed shell matches the fallback. |
| Upstream issue/shim and removal gate | No new upstream issue or shim. The consumed `ENLARGE_DIALOG_STYLE` is the shared #4441 CSS-string fallback for upstream #3375; the Mermaid transform also retains the locked CSS-string form with an issue reference. #4467/#4475 must recheck published #3375 evidence before release; the public string contract remains locked. Existing #3132 reinjection behavior is retained and covered. |
| Browser/visual cases handed to #4468/#4475 | Pending guarded real-browser evidence for image/diagram dialogs at mobile and desktop sizes; image eligibility across resize and SPA swaps; Mermaid SVG aspect fit, repeated zoom and pointer/keyboard pan; modal focus/backdrop/native close and navigation; theme/pack changes, hover/focus, repeated navigation, nonzero scroll, and no-console-error hydration. |
| Upstream issue filed / used | No issue filed by this topic. Preserves zudo-doc #3132's button reinjection regression fix. No out-of-scope source changes. |
| Remaining Preact runtime imports after #4437 | **None** in either owned island or the three owned tests; the tests now use the #4438 zudo-react SSR/hydration/mount harness. |
| Final commit / reviewer / date | The final topic commit is reported in the worker completion report; foreground self-review by the implementation owner; 2026-10-02. |
