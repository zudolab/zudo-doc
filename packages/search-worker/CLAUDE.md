# search-worker

Cloudflare Worker sub-package providing a server-side search API. Additional option for large doc bases — the primary search is the in-browser widget `pages/lib/_search-widget.tsx`, which loads the same `search-index.json` emitted by the `@takazudo/zudo-doc/plugins/search-index` zfb plugin.

**The host does NOT use MiniSearch.** `_search-widget.tsx` runs its own word-match scoring loop; `minisearch` is a dependency of *this package only* and is not imported anywhere under `src/` or `pages/`. What the two share is the index, not the engine.

## Tech Stack

- **Cloudflare Workers** — runtime
- **Cloudflare KV** — rate limiting storage
- **MiniSearch** — full-text search (this package's own dep; the host does not use it)
- **TypeScript** — strict mode, `@cloudflare/workers-types`

## Commands

- `pnpm dev` — local dev server (requires `wrangler.toml` with correct `DOCS_SITE_URL`)
- `pnpm run deploy` — deploy to Cloudflare Workers via Wrangler
- `pnpm typecheck` — TypeScript type checking

## Architecture

```
src/
├── index.ts        # Worker entry — routing, validation, CORS
├── cors.ts         # CORS headers (exposes Retry-After)
├── hash-ip.ts      # Rate-limit key derivation: HMAC-SHA-256 when the optional
│                   # IP_HASH_SECRET is set, unsalted SHA-256 otherwise (#2038)
├── rate-limit.ts   # Per-IP rate limiting via KV (60/min, 1000/day)
├── search.ts       # MiniSearch index loader + search logic
└── types.ts        # Env, request/response types
```

### Request Flow

1. CORS preflight → `cors.ts`
2. Method + path check → 405/404
3. Hash client IP (`hash-ip.ts` — HMAC-SHA-256 with `IP_HASH_SECRET`, else SHA-256)
4. JSON parse + query validation → 400 (query required, max 500 chars)
5. Rate limit check → 429 with `Retry-After`
6. Fetch `search-index.json` from docs site (cached with 5-minute TTL) → `search.ts`
7. MiniSearch search with prefix, fuzzy, and boost → results

### Key Design Decisions

- **Additive, not replacement** — the client-side widget handles most users. Worker is for API consumers and huge doc bases
- **Index from deployed site** — fetches `${DOCS_SITE_URL}/search-index.json`, same data as the client-side widget
- **5-minute cache TTL** — balances freshness with performance. Isolate recycle also clears cache
- **MiniSearch config** — `prefix: true, fuzzy: 0.2, boost: { title: 3, description: 2 }`. This is NOT the client's config: the client scores with its own word-match loop, so results can differ between the two paths by design

## Configuration

- `DOCS_SITE_URL` — base URL of the deployed docs site (set in this package's own `wrangler.toml` `[vars]`, separate from the main worker's). A Cloudflare **dashboard** environment-variable override **shadows** the file value and persists across deploys — if one was ever set, clear or replace it when redeploying
- `RATE_LIMIT` — KV namespace for rate limiting, **separate from the main worker's**. `wrangler.toml` ships a placeholder id; see `README.md` for the creation runbook (deploying without replacing it gives error code 10042)
- `RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_PER_DAY` — configurable in `wrangler.toml`
- `IP_HASH_SECRET` — optional Workers secret; see `hash-ip.ts` above

## Conventions

- All responses include CORS headers (including error responses)
- Error responses use `{ error: string }` format
- Rate limit uses `cf-connecting-ip` for client IP
- Query length capped at 500 characters
- Default result limit: 20, max: 100
