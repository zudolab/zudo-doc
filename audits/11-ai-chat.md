# S11 AI Chat Audit

**Sub-issue:** #1371 (epic #1360)
**Build command:** `pnpm build` (zfb build) from worktree root
**Base value:** `/pj/zudo-doc/` (from `settings.base`)
**Build result:** 217 pages built, exit 0
**Conclusion:** **PASS** — trigger button present in dist, `ai-chat-modal` island wired correctly, API route registered as SSR (`prerender = false`), base-path threading is correct. `packages/ai-chat-worker/` has been consolidated into `pages/api/ai-chat.tsx` (deleted as a standalone package). JA locale parity for the two ai-assistant doc pages is **missing** (no JA source files).

---

## Verification Matrix

| Feature | Status | Severity | Root cause class | Evidence | Suggested next step |
|---|---|---|---|---|---|
| `aiAssistant: true` gates trigger | PASS | — | — | `filterHeaderRightItems` in `src/utils/header-right-items.ts` returns the `ai-chat` trigger item only when `Boolean(settings.aiAssistant)` is true (line 17). `settings.aiAssistant` is `true` (settings.ts line 86). | No action needed |
| Trigger button present in `<header>` | PASS | — | — | `dist/index.html`: `id="ai-chat-trigger" type="button" aria-label="Open AI assistant" onclick="window.dispatchEvent(new CustomEvent('toggle-ai-chat'))"` found in header markup. Also verified in `dist/docs/getting-started/index.html`. | No action needed |
| `ai-chat-modal` island wired | PASS | — | — | `dist/index.html`: `<div data-zfb-island-skip-ssr="AiChatModal" data-when="load"><p class="sr-only">Ask a question about the documentation.</p></div>`. Island marker present; SSR fallback `<p class="sr-only">` rendered; `<h2 class="sr-only">AI Assistant</h2>` present above island (parity guard). | No action needed |
| `pages/api/ai-chat.tsx` route (SSR) | PASS | — | — | `export const prerender = false` in file (line 31). `ai_chat_exports` registered in `dist/_zfb_inner.mjs` with all handler logic intact. `_worker.js` comment explicitly names `/api/ai-chat` as a dynamic (non-prerendered) route. CORS, rate-limiting, audit-logging, and prompt-injection guard all present. | No action needed |
| `packages/ai-chat-worker/` (standalone CF Worker) | N/A — consolidated | info | — | `packages/ai-chat-worker/` **no longer exists** as a standalone package. File header of `pages/api/ai-chat.tsx` (lines 6-12) documents the consolidation: `src/pages/api/ai-chat.ts` (Astro, deleted) and `packages/ai-chat-worker/` (deleted) have been merged verbatim into the zfb SSR route, preserving all worker-side protections. CLAUDE.md still mentions the package in its directory tree (stale). `wrangler.toml` contains the required CF bindings (`ANTHROPIC_API_KEY` secret, `DOCS_SITE_URL` var, `RATE_LIMIT` KV namespace). | Update CLAUDE.md directory tree to remove `ai-chat-worker/` entry (cosmetic; no functional impact). |
| **Base-path threading into modal API URL** | **PASS** | — | — | **Critical check.** `ai-chat-modal.tsx` line 85-86: `const base = basePath.replace(/\/+$/, ""); const res = await fetch(\`${base}/api/ai-chat\`, ...)`. The `basePath` prop is injected at page render time: all page templates pass `basePath={settings.base ?? "/"}` (e.g. `pages/docs/[...slug].tsx` line 245, `pages/index.tsx` line 74). Confirmed in `dist/_zfb_inner.mjs`: `u3(BodyEndIslands, { basePath: settings.base ?? "/" })` → `u3(AiChatModal, { basePath })`. With `settings.base = "/pj/zudo-doc/"`, the fetch URL becomes `https://host/pj/zudo-doc/api/ai-chat` — **base-prefixed, not a bare `/api/ai-chat`**. | No action needed |
| Modal hydration (island runtime) | PARTIAL — static only | — | — | Island marker `data-zfb-island-skip-ssr="AiChatModal" data-when="load"` confirms the island is registered for `load`-time hydration. Interactive hydration (dialog open, fetch round-trip) cannot be verified by static analysis; deferred to browser-level E2E. Soft dependency on S1 (islands.js loading) already noted in issue. | Verify interactively once E2E re-enabled post-migration window |
| Conversation round-trip (worker response) | DEFERRED | — | — | Cannot exercise the Anthropic API call without runtime + valid `ANTHROPIC_API_KEY` secret. Worker logic is structurally correct (rate-limit → inject guard → Claude API fetch → `{ response }` JSON). | E2E smoke test with mocked worker per issue spec |
| **JA locale parity — ai-assistant guide** | FAIL | low | zudo-doc-side | `src/content/docs-ja/guides/ai-assistant.mdx` does not exist. `dist/ja/docs/guides/ai-assistant/index.html` builds (EN fallback with "このページはまだ翻訳されていません" banner) but content is raw-text fallback (`<pre data-zfb-content-fallback>`). | Create `src/content/docs-ja/guides/ai-assistant.mdx` (Japanese prose, identical code blocks). |
| **JA locale parity — ai-assistant-api reference** | FAIL | low | zudo-doc-side | `src/content/docs-ja/reference/ai-assistant-api.mdx` does not exist. `dist/ja/docs/reference/ai-assistant-api/index.html` builds with EN fallback. | Create `src/content/docs-ja/reference/ai-assistant-api.mdx` (Japanese prose, identical code blocks). |

---

## Base-Path Threading — Detailed Trace

```
settings.base = "/pj/zudo-doc/"          (src/config/settings.ts:40)
   ↓ passed as
<BodyEndIslands basePath={settings.base ?? "/"} />   (pages/docs/[...slug].tsx:245)
   ↓ forwarded as
<AiChatModal basePath={basePath} />                  (_body-end-islands.tsx:105)
   ↓ used in
const base = basePath.replace(/\/+$/, "");           (ai-chat-modal.tsx:85)
fetch(`${base}/api/ai-chat`, ...)                    (ai-chat-modal.tsx:86)
   → POST https://host/pj/zudo-doc/api/ai-chat       ✓ base-prefixed
```

---

## Follow-up Issues Filed

| Issue | Signature |
|---|---|
| (none filed — only finding is missing JA translations; cosmetic CLAUDE.md stale entry. Neither warrants a blocking follow-up issue per the one-per-signature rule.) | — |

> **Note on CLAUDE.md stale entry:** `packages/ai-chat-worker/` is listed in the directory tree but the package was deleted and consolidated into `pages/api/ai-chat.tsx`. This is a documentation-only discrepancy and does not affect functionality.
