# S10 — Search Verification

> Branch: `zfb-feature-audit/s10-search`
> Date: 2026-05-04
> Auditor: subagent (sonnet)

---

## Summary

All four main areas (build-time index, search-worker package, dialog island, data-base threading) are wired correctly and functional. One documentation discrepancy noted (client-side script does not use MiniSearch). Interactive dialog hydration verification deferred to manager browser dispatch.

---

## Checklist

| # | Area | Status | Notes |
|---|------|--------|-------|
| 1 | **Build-time index present** | PASS | `dist/search-index.json` emitted at root of `outDir` after `pnpm build` |
| 2 | **Index JSON schema** | PASS | Valid flat JSON array of 163 entries; all entries have required fields `id`, `title`, `body`, `url`, `description` |
| 3 | **Per-locale entries** | PASS | 89 EN entries (plain slugs), 74 JA entries (prefixed `ja/<slug>`); both locales present in single merged file |
| 4 | **Base in URLs** | PASS | All 163 URLs start with `/pj/zudo-doc/`; `base` is threaded from `settings.base` through `zfb.config.ts` → plugin → `emitSearchIndex` → `slugToUrl` |
| 5 | **Body length cap** | PASS | Max body length = 300 chars; no entries exceed `MAX_BODY_LENGTH = 300` constant |
| 6 | **Dev middleware** | PASS | `createSearchIndexDevMiddleware` registered at base-prefixed path `/pj/zudo-doc/search-index.json` via `devMiddleware` hook in `plugins/search-index-plugin.mjs` |
| 7 | **search-worker entry point** | PASS | `packages/search-worker/src/index.ts`; exports `fetch` handler as `ExportedHandler<Env>` |
| 8 | **Worker API contract** | PASS | `POST /` only; JSON body `{ query: string, limit?: number }`; response `{ results, query, total }` with `SearchResult[]` (`id`, `title`, `url`, `description`, `score`); error shape `{ error: string }` |
| 9 | **Worker rate limiting** | PASS | Per-IP SHA-256 hash; KV-backed 60/min + 1000/day; fail-open on KV unavailability; 429 with `Retry-After` |
| 10 | **Worker CORS** | PASS | All responses include CORS headers; preflight returns 204; `Retry-After` exposed via `Access-Control-Expose-Headers` |
| 11 | **Worker index fetch** | PASS | Fetches `${DOCS_SITE_URL}/search-index.json`; 5-minute TTL cache; resets on failure |
| 12 | **Worker search config** | PASS | MiniSearch with `prefix: true, fuzzy: 0.2, boost: { title: 3, description: 2 }` — matches client-side scoring intent |
| 13 | **`<site-search>` custom element emitted** | PASS | `<site-search data-base="/pj/zudo-doc/" data-result-count-template="...">` confirmed in built HTML (`dist/docs/tags/index.html` and others) |
| 14 | **data-base threading** | PASS | `_search-widget.tsx` calls `withBase("/")` which resolves to `settings.base` value; passed as `data-base` prop on `<site-search>`; client script reads `this.dataset.base` for `fetch(base + "search-index.json")` |
| 15 | **Dialog SSR markup** | PASS | Full `<dialog data-search-dialog>` markup emitted in SSR; `[data-search-input]`, `[data-search-results]`, `[data-search-count]`, `[data-search-count-narrow]`, `[data-kbd-shortcut]`, `[data-search-placeholder]` all present |
| 16 | **Kbd shortcut label** | PASS | `[data-kbd-shortcut]` empty in SSR (platform detection deferred to client); `connectedCallback` injects `⌘K` on Mac / `Ctrl+K` elsewhere |
| 17 | **Dialog open triggers** | PASS | `[data-open-search]` button click + `metaKey/ctrlKey + k` global keydown listener both call `openDialog()` |
| 18 | **Dialog close triggers** | PASS | `[data-close-search]` button, backdrop click (click on `<dialog>` element itself), and `Escape` key (native `<dialog>` behavior) |
| 19 | **Result count templating** | PASS | `data-result-count-template` attribute read in `connectedCallback`; `updateCount()` replaces `{count}` token; `[data-search-count]` (wide) and `[data-search-count-narrow]` (mobile) toggled with CSS `hidden` class |
| 20 | **Infinite-scroll pagination** | PASS | `IntersectionObserver` sentinel appended after first `PAGE_SIZE=10` results; `loadMore()` fires when sentinel enters viewport; sentinel removed when all results shown |
| 21 | **Result navigation** | PASS | Each result rendered as `<article><a href="{entry.url}">` where `url` comes directly from the index; clicking navigates to that URL |
| 22 | **View-Transitions compat** | PASS | After-navigate event bound to `AFTER_NAVIGATE_EVENT = "DOMContentLoaded"` (from `@zudo-doc/zudo-doc-v2/transitions`); re-injects `[data-kbd-shortcut]` text on each navigation |
| 23 | **Locale-aware dialog strings** | PASS | `placeholderText`, `shortcutHint`, `resultCountTemplate`, `searchLabel` passed as SSR props from `t()` helper per locale; both EN and JA strings rendered in static HTML without JS |
| 24 | **search_exclude frontmatter** | PASS | `isExcluded()` in `collect.ts` skips entries with `search_exclude: true`, `draft: true`, or `unlisted: true` |
| 25 | **Interactive dialog hydration** | DEFERRED | Browser dispatch required; not run per spec constraints |

---

## Findings

### PASS — Everything wired correctly

All structural checks pass. The build emits a single merged `search-index.json` (EN + JA entries) at the `outDir` root (not under the base subpath), which matches the worker's fetch target `${DOCS_SITE_URL}/search-index.json`. The `data-base` attribute in built HTML is `/pj/zudo-doc/` (matching `settings.base`), and the client script constructs the index URL as `base + "search-index.json"` — i.e. `/pj/zudo-doc/search-index.json`.

### NOTE — Client-side search does not use MiniSearch

The search guide (`guides/search.mdx`) states "zudo-doc uses MiniSearch for full-text site search." However, `_search-widget-script.ts` documents explicitly: "MiniSearch is NOT imported; a lightweight built-in search (fetch index + simple word-match scoring) is used instead. … Full MiniSearch integration can be added in a follow-up topic once the bundle pipeline is in place." The script implements its own word-frequency scorer and highlight logic. The worker (`packages/search-worker/`) does use MiniSearch. The search results and ranking behavior are therefore different between the dialog (word-match) and the optional CF Worker (MiniSearch with fuzzy/prefix/boost). This is a documentation accuracy gap and a known deferral, not a regression.

---

## Follow-up Issues

One documentation gap identified:

- **Doc accuracy: guides/search.mdx claims MiniSearch powers the dialog, but the client script uses a custom word-match scorer.** The guide should clarify that MiniSearch is used by the optional Search Worker only; the built-in dialog uses a lightweight custom scorer pending full MiniSearch bundle pipeline. Recommend filing one issue against this if desired by the manager.

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Index files present in `dist/` and well-formed | PASS |
| search-worker accepts queries and returns results | PASS (static analysis) |
| Search dialog hydrates and integrates with worker | DEFERRED (interactive) |
| `data-base` propagates correctly | PASS |
| Failed rows linked | N/A — no failures |
