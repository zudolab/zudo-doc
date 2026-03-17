# ai-chat-worker

Standalone Cloudflare Worker sub-package for the AI chat API. Independent of the Astro docs site.

## Tech Stack

- **Cloudflare Workers** — runtime
- **Cloudflare KV** — rate limiting storage
- **Anthropic Messages API** — Claude Haiku via raw `fetch` (no SDK)
- **TypeScript** — strict mode, `@cloudflare/workers-types`

## Commands

- `pnpm dev` — local dev server (requires `.dev.vars` with `ANTHROPIC_API_KEY`)
- `pnpm run deploy` — deploy to Cloudflare Workers via Wrangler
- `pnpm typecheck` — TypeScript type checking

## Architecture

```
src/
├── index.ts          # Worker entry — routing, validation, CORS
├── audit-log.ts      # Audit logging + IP hashing via Web Crypto
├── claude.ts         # Claude API call + docs context fetching/caching
├── cors.ts           # CORS headers (exposes Retry-After)
├── rate-limit.ts     # Per-IP rate limiting via KV
└── types.ts          # Env, request/response, Claude API types
```

### Request Flow

1. CORS preflight → `cors.ts`
2. Method + path check → 405/404
3. Hash client IP (SHA-256 via Web Crypto) → `audit-log.ts`
4. JSON parse + message validation → 400 (audit logged as `invalid_input`)
5. Rate limit check (after validation, so bad requests don't consume quota) → 429 (audit logged as `rate_limit`)
6. Fetch `llms-full.txt` from docs site (cached in-memory, best-effort) → `claude.ts`
7. Call Claude API with docs context as system prompt → response (audit logged)

### Key Design Decisions

- **No SDK** — raw `fetch` to Anthropic API keeps bundle small for Workers
- **Fail-open rate limiting** — KV errors allow requests through (chat availability > strict enforcement)
- **Best-effort caching** — module-level cache for `llms-full.txt` is ephemeral (Workers isolates are recycled)
- **Rate limit after validation** — invalid requests don't consume the caller's quota
- **Fire-and-forget audit logging** — every interaction logged to KV (`audit:` prefix) with 7-day TTL; IPs stored as SHA-256 hashes for privacy

## Configuration

See `README.md` for full setup instructions (vars, secrets, KV namespace).

## Conventions

- All responses include CORS headers (including error responses)
- Error responses use `{ error: string }` format
- Rate limit uses `cf-connecting-ip` for client IP
- History capped at 50 messages to limit API cost
- KV keys use bucket pattern: `rate:min:{ip}:{bucket}` / `rate:day:{ip}:{bucket}` with TTL = 2x window
- Audit log keys: `audit:{date}:{timestamp-ms}:{random}` with 7-day TTL
