# zudo-doc-online-worker

Private workspace package (epic zudolab/zudo-doc#3361): a Cloudflare Worker
(Hono + D1) that becomes the future remote backend for
`packages/zudo-doc-online/`. Not published to npm.

## Role

The local API server in `packages/zudo-doc-online/` (port 4324) stays
auth-free — local authoring is unaffected by anything in this package. This
worker exists only toward the eventual remote path: authenticated multi-user
access to a zudo-doc-online project store, fronted by Better Auth
(email/password + bearer tokens, landing in later sub-issues of the epic).

## Commands

- `pnpm --filter zudo-doc-online-worker dev` — `wrangler dev`, default port
  8787
- `pnpm --filter zudo-doc-online-worker deploy` — `wrangler deploy`
- `pnpm --filter zudo-doc-online-worker typecheck` — `tsc --noEmit`
- `pnpm --filter zudo-doc-online-worker test` — `vitest run` under
  `@cloudflare/vitest-pool-workers` (frozen test-harness choice — do not
  substitute miniflare directly). Runs standalone and as part of the root
  `pnpm test`'s `test:packages` step.

## Architecture

```
src/
├── index.ts        # Hono app — CORS, GET /api/health, error mapping
├── cors.ts          # CORS allowlist constant for the SPA's dev origin (4323)
└── __tests__/       # vitest-pool-workers suites
```

- `wrangler.toml` — `nodejs_compat` compatibility flag (required once Better
  Auth is wired in, since it imports `node:crypto`), and a `[[d1_databases]]`
  binding `DB` against `zudo-doc-online-db` with a placeholder `database_id`
  (same placeholder convention as `packages/search-worker`'s KV id — replace
  it after `wrangler d1 create` when actually deploying).
- Response format: `{ error: { code, message } }` for routes this worker owns
  directly (e.g. `/api/health`). Future `/api/auth/*` routes mounted from
  Better Auth keep Better Auth's own response format — they are NOT forced
  through this mapping.
- CORS: origins `http://localhost:4323` / `http://127.0.0.1:4323` (the SPA's
  Vite dev origin), `credentials: false`, and `exposeHeaders:
  ["set-auth-token"]` so browser JS can read the future bearer-session
  response header.
