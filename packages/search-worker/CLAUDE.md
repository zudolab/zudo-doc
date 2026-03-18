# search-worker

Cloudflare Worker sub-package providing a server-side search API. Additional option for large doc bases — the primary search remains client-side MiniSearch (`src/components/search.astro`).

## Tech Stack

- **Cloudflare Workers** — runtime
- **Cloudflare KV** — rate limiting storage
- **MiniSearch** — full-text search (same engine as client-side)
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
├── rate-limit.ts   # Per-IP rate limiting via KV (60/min, 1000/day)
├── search.ts       # MiniSearch index loader + search logic
└── types.ts        # Env, request/response types
```

### Request Flow

1. CORS preflight → `cors.ts`
2. Method + path check → 405/404
3. Hash client IP (SHA-256 via Web Crypto)
4. JSON parse + query validation → 400 (query required, max 500 chars)
5. Rate limit check → 429 with `Retry-After`
6. Fetch `search-index.json` from docs site (cached with 5-minute TTL) → `search.ts`
7. MiniSearch search with prefix, fuzzy, and boost → results

### Key Design Decisions

- **Additive, not replacement** — client-side MiniSearch handles most users. Worker is for API consumers and huge doc bases
- **Index from deployed site** — fetches `${DOCS_SITE_URL}/search-index.json`, same data as client-side
- **5-minute cache TTL** — balances freshness with performance. Isolate recycle also clears cache
- **Same search config as client** — `prefix: true, fuzzy: 0.2, boost: { title: 3, description: 2 }`

## Configuration

- `DOCS_SITE_URL` — base URL of the deployed docs site (set in `wrangler.toml` `[vars]`)
- `RATE_LIMIT` — KV namespace for rate limiting (create via `wrangler kv namespace create`)
- `RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_PER_DAY` — configurable in `wrangler.toml`

## Conventions

- All responses include CORS headers (including error responses)
- Error responses use `{ error: string }` format
- Rate limit uses `cf-connecting-ip` for client IP
- Query length capped at 500 characters
- Default result limit: 20, max: 100
