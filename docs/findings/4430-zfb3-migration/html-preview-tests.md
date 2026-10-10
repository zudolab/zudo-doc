# Migrate the HtmlPreview unit tests to the zudo-react harness

Owner: [#4454](https://github.com/zudolab/zudo-doc/issues/4454). Status: **complete**. [Index and column meanings](README.md). [Binding decisions](conventions.md).

Base: #4453 at `e5c7f4b0b7fc9d5b9627c3a5408ae3762e533a30`; target zfb 3.1.0. This topic changes tests only; the implementation and existing `html-preview.md` source matrix remain owned by #4453.

## Files and symbols

| File | v2 test form → v3 form | Status / spec / evidence |
| --- | --- | --- |
| `build-srcdoc.test.ts` | Pure `buildSrcdoc` and string helper assertions; no Preact execution | Kept source-only; pass in the focused run. Injection order, title/lang escaping, reset and resource cases remain pinned. R-RAW. |
| `code-panel-resources.test.tsx` | `preact-render-to-string` → `renderSsr`; parse SSR output and assert the displayed HTML source text and resource order | Done. `showResources` inclusion/exclusion and source order pass. Parser reads text content, preserving the behavior assertion without coupling it to entity spelling. R-SSR, R-RAW. |
| `highlight-runtime.integration.test.ts` | Public highlight-subpath and result integration checks; no Preact execution | Kept source-only; pass. Continues to check semantic roles and escaped unknown-language fallback. R-RAW. |
| `highlight-runtime.test.ts` | Runtime/import/cancellation logic tests; no Preact execution | Kept source-only; pass. The deferred result after cleanup remains suppressed. R-SCOPE, R-RAW. |
| `highlighted-code-effect.test.tsx` | Mock Preact hooks and direct function calls → `renderIsland`, activation cleanup, `flushAll`, and a live `rawHtml` result update | Done. Tests SSR fallback, activated request props, semantic markup replacing the fallback, and a deferred public-module import resolving after disposal without settling the disposed component. R-SCOPE, R-RAW. |
| `highlighted-code.test.tsx` | `preact-render-to-string` → `renderSsr` | Done. Keeps an exact escaped-source assertion and absence of an active `<script>`. zudo-react 3.1.0's text serializer escapes `>` but leaves `"` literal in text; the exact expected bytes were updated to its engine-required output. R-RAW. |
| `html-preview-contract.test.tsx` | `preact-render-to-string` → `renderSsr`; iframe-only metadata assertions → `renderIsland` and DOM/source-document reads after activation | Done. Labels/control SSR, language/title fallback, wrapper prop forwarding, and iframe metadata pass. The SSR output now asserts the host instead of an iframe under #3361. Full-width style pins zudo-react's emitted CSS string (`width:100%`) and its parsed width. R-SSR, R-SCOPE, R-PROPS. |
| `html-preview-wrapper-loading.test.tsx` | `preact-render-to-string` and private `__zudoDocVisibleMount` assertions → identity-scoped zfb `Island` SSR plus public `data-when` / skip-SSR / `data-props` assertions | Done. Omitted/eager parity, full public props, inert height reservation/floor, and marker identity pass. Optional `height` is omitted from props instead of serialized as `undefined`, per R-PROPS. Native visible scheduling receives browser verification in #4468/#4475. |
| `html-preview-wrapper-visible-gate.test.tsx` | Direct Preact `IntersectionObserver` gate tests around private mount data | Deleted. #4453 removed the private `VISIBLE_MOUNT_PROP`/observer gate; native `Island({ when: "visible", ssrFallback })` now owns scheduling. Public marker/reservation SSR is covered by `html-preview-wrapper-loading.test.tsx`; browser scheduling is assigned to #4468/#4475. R-SCOPE. |
| `preview-auto-height-component.test.tsx` | Preact `render`/`act` and same-root prop rerender → `renderIsland`, load events, `flushAll`, and scope disposal | Done. Already-complete document, explicit height, full-height, measurement and observer cleanup pass. Since v3 props are immutable for a setup lifetime, the removed same-root prop-rerender case is represented by disposing a fixed-height island and mounting a new auto-height island. R-SCOPE, R-PROPS. |
| `preview-auto-height.test.ts` | Pure controller tests; no Preact execution | Kept source-only; pass. Timer/frame scheduling, stale generations, self-sizing protection and destroy cleanup remain pinned. R-SCOPE. |
| `resolve-sandbox.test.ts` | Pure sandbox policy plus Preact SSR attribute assertion → pure policy plus `renderIsland` assertion on the imperatively created iframe | Done. Empty sandbox remains present with zero tokens after activation. SSR iframe markup is intentionally absent under #3361. R-SCOPE. |

## Raw HTML and trusted payload review

| File and site | Payload/context, trust, update and cleanup | Test / browser handoff |
| --- | --- | --- |
| `src/html-preview-wrapper/highlighted-code.tsx`, `HighlightedCode` ordinary HTML `<div rawHtml={html}>` | The payload comes from `getUsableHighlightHtml` over the public `@takazudo/zfb-md-wasm/highlight` result. Non-null results without error diagnostics are accepted; the upstream highlighter produces semantic `pre.hi-root` markup and escaped unknown-language fallback. It is trusted generated markup, not sanitized by `rawHtml`. The div has no children and is a valid HTML parser parent. The highlighter produces no scripts, protocol comments or nested island wrappers. `Show` owns the branch; activation cleanup cancels a late result, including when the lazy module import resolves after disposal. | `highlighted-code.test.tsx`, `highlighted-code-effect.test.tsx`, `highlight-runtime.integration.test.ts`, and `highlight-runtime.test.ts`; #4468/#4475 verify real browser WASM loading, highlighted result DOM, close/reopen and disposal. |
| `PreviewBase` iframe `srcdoc` property | Not a zudo-react `rawHtml` site. The assigned document combines trusted author MDX/config HTML, head, CSS, JS and external URLs with package-generated preflight/title/language. It is intentionally not sanitized; the default script-capable same-origin sandbox requires trusted authors or an explicit stricter sandbox. Generated language/title values are escaped. `onActivate` owns the iframe, load listener, observer controller and teardown. | `build-srcdoc.test.ts`, `html-preview-contract.test.tsx`, `resolve-sandbox.test.ts`, and the #4453 smoke test; #4468/#4475 verify real iframe load, sandbox, measured height, navigation and disposal. |

## Utility/token and authored rewrite rows

| File | Original utility or CSS construct | Required disposition / review | Status and test |
| --- | --- | --- | --- |
| Owned HtmlPreview tests | No utility candidate, token, authored selector, or class assertion was added or removed. Existing class output from #4453 is unchanged. | Keep the #4453 authored `zd-preview-shadow` disposition; no additional CSS candidate mapping belongs to this test-only topic. | No class assertion was loosened; HTML Preview component/harness tests pass. |

## Deliberate differences

| Difference | Engine cause / disposition | Coverage |
| --- | --- | --- |
| Eager SSR emits the iframe host but no `<iframe>`; activation creates one and attaches `srcdoc`, sandbox and title. | Required by zfb 3.1.0 rejecting iframe elements inside islands; tracked upstream as [#3361](https://github.com/Takazudo/zudo-front-builder/issues/3361). Remove the imperative host only after published native iframe support and browser lifecycle proof. | `html-preview-contract.test.tsx`, `html-preview-wrapper-loading.test.tsx`, `resolve-sandbox.test.ts`, and #4453 smoke; browser evidence remains with #4468/#4475. |
| The private visible observer / `__zudoDocVisibleMount` state is absent. | Replaced by zfb's native visible skip-SSR scheduling under the locked #4453 decision. This is an engine-owned scheduling transition, not a product redesign. | SSR marker/props/reservation in `html-preview-wrapper-loading.test.tsx`; actual visibility scheduling remains a browser check. |
| Exact escaped source bytes differ from Preact's serializer. | zudo-react 3.1.0 escapes `>` in a text node and leaves `"` literal there. The expected source bytes were updated to the installed engine output; the assertion still rejects an active script and requires escaped source. | `highlighted-code.test.tsx`; exact output is recorded in this matrix and the commit message. |
| The full-width resize container emits `style="width:100%"`, where the v2 Preact object-style output had a trailing semicolon. | #4453's v3 `PreviewBase` uses a reactive CSS style string; zudo-react emits that value without adding punctuation. Parsed `style.width` remains `100%`, with no visual or behavior change. | `html-preview-contract.test.tsx` pins both the v3 attribute output and parsed width. |
| No other visual or behavior difference is asserted by #4454. | #4453's component matrix owns source-port differences. | Focused unit run below. |

## Tests and completion evidence

The visible-gate test is deliberately deleted with its private target. The remaining 11 owned test files were run through #4438 source resolution; **89 tests passed**. Node `v24.13.1`, pnpm `10.30.3`, Vitest `4.1.0`, zfb `3.1.0`.

```sh
ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/build-srcdoc.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/code-panel-resources.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlight-runtime.integration.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlight-runtime.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlighted-code-effect.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlighted-code.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-contract.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-wrapper-loading.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/preview-auto-height-component.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/preview-auto-height.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/resolve-sandbox.test.ts
# Test Files  11 passed (11); Tests  89 passed (89)
```

The owned-source port check reports zero owned diagnostics. Its unrelated migration-window diagnostics are expected until the remaining package ports land.

```sh
node scripts/zfb3-port-check.mjs \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/build-srcdoc.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/code-panel-resources.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlight-runtime.integration.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlight-runtime.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlighted-code-effect.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/highlighted-code.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-contract.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/html-preview-wrapper-loading.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/preview-auto-height-component.test.tsx \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/preview-auto-height.test.ts \
  packages/zudo-doc/src/html-preview-wrapper/__tests__/resolve-sandbox.test.ts
# Port check: 0 owned diagnostic(s); 713 unrelated diagnostic(s) from migration window.
```

No package artifact was rebuilt: this topic edits tests and the migration matrix only, and tests resolve package source through #4438. The wider package build remains in the documented red window until #4467; no stale v2 `dist/` was used.

### Browser verification handed to #4468/#4475

- Eager SSR/hydration and first iframe paint with the added host, then dispose/revisit.
- Native `when="visible"` scheduling: reservation remains until visible, then one iframe mounts.
- 320/768/full viewport selection and drag resizing; source close/open with actual lazy WASM highlighting.
- Iframe `load`, `ResizeObserver` height updates, fixed height, 200px floor, full-height behavior, opaque sandbox and disposal.

No browser/UI was run by this leaf topic. No new upstream issue was filed; iframe support remains blocked on existing #3361. The wrapper test identity is a local `__zfb` scanner/build fixture and restores prior global metadata synchronously around SSR.

| Completion field | Result |
| --- | --- |
| Port-check / unit evidence | 0 owned TypeScript diagnostics; 89/89 focused tests pass. |
| RawHtml review | `HighlightedCode` site reviewed above; test coverage names included. |
| Deliberate DOM/class/behavior differences | #3361 iframe host; native visibility scheduling; zudo-react escaped-text bytes; v3 CSS style string serialization. No class changes or computed-style change. |
| Upstream issue/shim and removal gate | Existing #3361 imperative iframe host; remove only after a published fix and real-browser lifecycle proof. No issue filed by this topic. |
| Browser/visual cases handed off | Eager/visible scheduling, iframe load/height, viewports, highlighting and disposal listed above. |
| Final commit / reviewer / date | Final topic commit is listed in the completion report; foreground reviewer: Codex; date: 2026-10-02. |
