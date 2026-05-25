# @zudo-doc/search-worker

Cloudflare Worker that provides a server-side search API for zudo-doc. Fetches and caches `search-index.json` from the docs site and uses MiniSearch for full-text search.

## Setup

### 1. Set `DOCS_SITE_URL`

Set the `DOCS_SITE_URL` variable in `wrangler.toml` to your deployed docs site URL.

### 2. Create the RATE_LIMIT KV namespace

Run from `packages/search-worker/` with Wrangler authenticated:

```sh
wrangler kv namespace create RATE_LIMIT
```

Copy the returned `id` value and paste it into `wrangler.toml` under `[[kv_namespaces]]`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<paste-id-here>"
```

The `wrangler.toml` currently contains a placeholder that must be replaced before `wrangler deploy` will succeed (deploying with the placeholder produces error code 10042).

### 3. Deploy

```sh
pnpm deploy
```

## Development

```bash
pnpm dev
```

Starts a local dev server.

## API

### POST /

Request body:

```json
{
  "query": "how to add a page",
  "limit": 10
}
```

- `query` (required): Search query string (max 500 characters)
- `limit` (optional): Maximum results to return (default: 20, max: 100)

Success response (200):

```json
{
  "results": [
    {
      "id": "guides/adding-pages",
      "title": "Adding Pages",
      "url": "/docs/guides/adding-pages",
      "description": "Learn how to add new documentation pages",
      "score": 12.5
    }
  ],
  "query": "how to add a page",
  "total": 3
}
```

Error response (400):

```json
{
  "error": "query is required"
}
```

Rate limited response (429):

```json
{
  "error": "Too many requests"
}
```

Includes `Retry-After` header with seconds until the limit resets.

## Rate Limiting

Per-IP rate limiting via Cloudflare KV. Uses `cf-connecting-ip` header for client identification.

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_PER_MINUTE` | `60` | Max requests per IP per minute |
| `RATE_LIMIT_PER_DAY` | `1000` | Max requests per IP per day |

Configure in `wrangler.toml` `[vars]` section. The limiter is best-effort (KV is eventually consistent). On KV errors, requests are allowed through.
