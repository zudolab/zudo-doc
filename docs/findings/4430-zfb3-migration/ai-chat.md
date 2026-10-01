# Port the AiChatModal island (and add the missing IME guard)

Owner: [#4451](https://github.com/zudolab/zudo-doc/issues/4451). Status: **ported; focused checks complete**. [Index and column meanings](README.md). [Binding decisions](../../../_temp-resource/4430-zfb3-migration/conventions.md).

Target: zfb 3.1.0 under the #4434/#4480 lock. The issue's locked spec is recorded in [issue-locks.md](issue-locks.md).

## Files and symbols

| File | Symbol / v2 construct | v3 form and result | Spec / evidence |
| --- | --- | --- | --- |
| `packages/zudo-doc/src/ai-chat-modal/index.tsx` | `AiChatModal`: `useState`, `useRef`, `useEffect`, `useCallback`, `useModalDialog` | Component setup creates writable signals, `Ref` objects, ordinary closures and a scope-owned `modalDialog`. Focus and scroll work use `scope.effect`; the window toggle listener is installed and removed by `scope.onActivate`. Requests receive an abortable signal and check request identity plus scope/request abort state after each await. Closing or before-navigation resets state, aborts work and removes its scope-abort listener. | Runtime/lifecycle; modal helper API; [SSR and interaction tests](../../../packages/zudo-doc/src/ai-chat-modal/__tests__/ai-chat-modal-interaction.test.tsx) |
| `packages/zudo-doc/src/ai-chat-modal/index.tsx` | Message list: `.map` with positional keys; `ChatMessageRow` wrapped in `memo` | Immutable `AiChatMessage[]` replacements are rendered with `<For>` keyed by a per-message numeric id. The row is a plain component. Local ids are stripped when building API history, preserving the `{role, content}` payload shape. | Show/For; props and identity; two-reply test retains the first row node |
| `packages/zudo-doc/src/ai-chat-modal/index.tsx` | Empty/loading/error conditionals; scalar form `value` and native `on:change` | `<Show>` owns empty, loading and error branches. Busy/disabled attributes are computed. The text input uses writable `modelValue`; composition state and native Enter guards block submits during IME confirmation. Listener handlers accept `Event` and narrow the keyboard event locally. | Show/For; Events and forms; send/loading/error/IME tests |
| `packages/zudo-doc/src/ai-chat-modal/index.tsx` | `ChatMessageRow` | User content remains a `SmartBreak` child. Assistant content remains renderer output on an ordinary `div` via exclusive `rawHtml`; the renderer is unchanged and audited below. | R-JSX; R-RAW; assistant raw HTML test |
| `packages/zudo-doc/src/render-markdown/index.ts` | `renderMarkdown` | Source was reviewed and left unchanged: it escapes input first, creates only its own small markup set, rewrites only validated `http:`/`https:` links, and re-escapes the URL before emitting an attribute. | R-RAW; hostile markup, rejected protocol, and safe-link test through the assistant bubble |
| `packages/zudo-doc/src/ai-chat-modal/__tests__/ai-chat-modal-ssg.test.tsx` | Preact SSR and `displayName` marker assertion | Uses the zudo-react `renderSsr` harness and asserts the entry's function name. | SSR test below |
| `packages/zudo-doc/src/ai-chat-modal/__tests__/ai-chat-modal-interaction.test.tsx` | No v2 construct | New source-resolution harness tests for send/loading, server error, two replies and keyed retention, composition/default-prevented guards, navigation-time stale response rejection, request abort on disposal, and toggle-listener cleanup. | R-SCOPE; R-RAW; Events and forms |

## Raw HTML sites

| File and site | Parent and payload producer | Trust, parser context, hydration and cleanup review |
| --- | --- | --- |
| `packages/zudo-doc/src/ai-chat-modal/index.tsx` — assistant bubble `div.ai-chat-md` | Ordinary HTML `div` inside a keyed message row; payload is `renderMarkdown(msg.content)` from `packages/zudo-doc/src/render-markdown/index.ts`. | `renderMarkdown` escapes authored/API text before adding generated `p`, `strong`, `em`, code, list, heading, and link tags. Link URLs must parse and use `http:` or `https:`, then are encoded and escaped. No HTML from the response is trusted directly; the renderer is safe by construction, not a general sanitizer. `rawHtml` is exclusive with children and the parent is parser-safe. The renderer cannot introduce script/style closers, nested islands, or reserved `zr:1:` comments. SSR starts with no messages; each immutable response creates a keyed row with the same trusted renderer output on hydration. Clearing/closing removes the row scope; the opaque payload contains no separately owned bindings. Test confirms `<img onerror>` is text, `javascript:` is not an anchor, and a safe link receives `rel="noopener noreferrer"`. zudo-react may add its own raw-region marker comments around the live region; these are runtime markers, not payload bytes. |

## Utility/token and authored rewrite rows

| File | Disposition | Status and evidence |
| --- | --- | --- |
| `packages/zudo-doc/src/ai-chat-modal/index.tsx` | No utility token or CSS class was renamed. All 75 unique zfb utility candidates across the modal were explained against `packageWindConfig` from package source; all resolved under zfb 3.1.0. The `ai-chat-md` ordinary class has authored selectors in `features.css` and is listed by the package authored-class registry. `chat-user-*` / `chat-assistant-*` colors continue to use the existing theme roles. | Confirmed; isolated `zfb wind explain` source-config probe: 75/75 resolved. No CSS changes. |

## Tests and completion evidence

| Check | Result |
| --- | --- |
| `node scripts/zfb3-port-check.mjs packages/zudo-doc/src/ai-chat-modal/index.tsx packages/zudo-doc/src/ai-chat-modal/__tests__/ai-chat-modal-ssg.test.tsx packages/zudo-doc/src/ai-chat-modal/__tests__/ai-chat-modal-interaction.test.tsx packages/zudo-doc/src/render-markdown/index.ts` | Passed: **0 owned diagnostics**; 165 unrelated diagnostics are reported by the migration-window checker. |
| `ZFB3_SOURCE_RESOLVE=1 pnpm exec vitest run --config packages/zudo-doc/vitest.config.ts packages/zudo-doc/src/ai-chat-modal/__tests__/ai-chat-modal-ssg.test.tsx packages/zudo-doc/src/ai-chat-modal/__tests__/ai-chat-modal-interaction.test.tsx` | Passed: 2 files, 7 tests, Vitest 4.1.0. Source-resolution mode used; no stale package `dist/`. |
| `git diff --check` | Passed. |

## Deliberate differences

- **Intentional fix — #4451:** Enter no longer sends while the keyboard event or tracked input is composing. This prevents Japanese IME confirmation from submitting a message. The Enter and send-button handlers also leave a `defaultPrevented` event untouched.
- The input now follows the locked text-control `modelValue` contract, updating the writable signal as input changes. This keeps the send button's disabled state current while typing.
- Message rows use stable ids for keyed retention; the id is private UI identity and is omitted from request history.
- No authored visible markup or class string was changed. zudo-react's rawHtml region marker comments are engine-generated and covered in the raw HTML review above.

## Upstream issues, visual handoff and remaining work

- No new upstream issue or compatibility shim was needed. The port uses `modalDialog` from #4441 and the `SmartBreak` primitive owned by #4457; neither shared file was edited here.
- CSS was unchanged. Browser/visual parity for the open dialog, focus, responsive sizes, light/dark, and repeated SPA navigation remains with #4468/#4475; this leaf topic did not run a browser suite.
- No full build, e2e, or b4push was run, per the issue lock.

## Final record

| Field | Result |
| --- | --- |
| Final commit | local topic commit; full SHA in owner handoff |
| Foreground self-review | complete; see `/tmp/zudo-doc-4430-review-logs/4451.md` |
| Date | 2026-10-02 |
