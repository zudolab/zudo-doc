# Workers Cutover Runbook

One-time setup steps required before the first `wrangler deploy` succeeds for this project (epic zudolab/zudo-doc#1691). Run from the repo root with Wrangler authenticated.

This is completed operator setup — `wrangler.toml` already carries the real KV
id, the Durable Object binding, migration tag `v1-ai-chat-daily-spend-cap`, the
`custom_domain` route, and `DOCS_SITE_URL`, and documents the same steps in its
own inline comments. Kept here for a fresh Cloudflare account or a re-cutover.

## 1. Create the RATE_LIMIT KV namespace

```sh
wrangler kv namespace create RATE_LIMIT
```

Copy the returned `id` value and paste it into `wrangler.toml` under `[[kv_namespaces]]`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<paste-id-here>"
```

## 2. Add the Anthropic API key as a secret

```sh
wrangler secret put ANTHROPIC_API_KEY
```

Paste the key when prompted. The value is stored in Cloudflare's secret store and never appears in `wrangler.toml`.

### 2a. Keep the exact paid-call Durable Object migration

`wrangler.toml` binds `AI_CHAT_DAILY_SPEND_CAP` to the exported `AiChatDailySpendCap` class and
declares migration tag `v1-ai-chat-daily-spend-cap` with
`new_sqlite_classes = ["AiChatDailySpendCap"]`. Do not replace this with D1 migration commands.
The first production `wrangler deploy` applies the Worker migration. Build first: the custom
`worker-entry.ts` imports the generated `dist/_worker.js`, whose adapter graph retains
`dist/_zfb_inner.mjs`.

Preview workflows intentionally generate an adapter-only config for the separate preview service;
Cloudflare does not issue preview URLs for versions implementing Durable Objects. Preview smoke
therefore validates SSR/assets wiring, not the live exact-cap binding.

### 2b. (Optional) Add the IP-hash HMAC secret

```sh
wrangler secret put IP_HASH_SECRET
```

Optional and non-breaking. When set, the ai-chat per-IP rate limiter keys clients with **HMAC-SHA-256(ip)** instead of unsalted `SHA-256(ip)`, which defeats reversing stored rate-limit keys by enumerating the (small) IPv4 space (#2038). Audit values never contain an IP or IP hash. When the secret is absent the worker falls back to the original unsalted SHA-256 for rate-limit keys, so the step can be skipped.

> **Rotation caveat.** Setting or rotating `IP_HASH_SECRET` changes every derived rate-limit key. In-flight buckets reset (acceptable — 60s windows).

## 3. Verify DOCS_SITE_URL

`wrangler.toml` already sets `DOCS_SITE_URL = "https://zudo-doc.takazudomodular.com"`. For preview deploys, override per-deploy:

```sh
wrangler deploy --var DOCS_SITE_URL=<preview-url>
```

Or override via the Cloudflare dashboard per environment to avoid preview workers pointing at production docs.

> **Search worker (optional, opt-in deployment).** The showcase site does NOT deploy `packages/search-worker/` — on-site search is a custom-scorer widget (`pages/lib/_search-widget.tsx`) that fetches `search-index.json` from `dist/` and runs a built-in word-match scoring loop (MiniSearch is **not** imported by the host; the worker package has its own `minisearch` dep). The worker exists as a template/example for downstream users who want a server-side search API for huge doc bases or programmatic API consumers. If you choose to deploy it, two caveats apply:
>
> - `packages/search-worker/wrangler.toml` carries its **own** `DOCS_SITE_URL` (used for CORS/referrer). A Cloudflare **dashboard environment-variable override** on the search Worker **shadows** the file value and persists across deploys, so if you've ever set one, clear/replace it when redeploying.
> - The search worker also has its **own `RATE_LIMIT` KV namespace** (separate from the main worker's). `packages/search-worker/wrangler.toml` ships with a placeholder id — see `packages/search-worker/README.md` for the creation runbook (`wrangler kv namespace create RATE_LIMIT` run from that directory). Deploying without replacing the placeholder produces error code 10042.

## 4. Bind the custom domain

`wrangler.toml` already contains:

```toml
[[routes]]
pattern = "zudo-doc.takazudomodular.com"
custom_domain = true
```

The domain binding is activated on first `wrangler deploy`. Ensure the DNS record for `zudo-doc.takazudomodular.com` exists in the Cloudflare zone (CNAME or proxied A record pointing at the Worker). Cloudflare will issue a certificate automatically.
