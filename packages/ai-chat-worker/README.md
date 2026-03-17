# @zudo-doc/ai-chat-worker

Cloudflare Worker that serves as an AI chat API endpoint for zudo-doc. Uses Claude to answer questions about the documentation by fetching and caching `llms-full.txt` as context.

## Setup

1. Set the `DOCS_SITE_URL` variable in `wrangler.toml` to your deployed docs site URL
2. Create a KV namespace for rate limiting:

```bash
wrangler kv namespace create RATE_LIMIT
```

Update the `id` in `wrangler.toml` with the returned namespace ID.

3. Add your Anthropic API key as a secret:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

## Development

```bash
pnpm dev
```

Starts a local dev server (requires `ANTHROPIC_API_KEY` in a `.dev.vars` file).

## Deploy

```bash
pnpm deploy
```

## API

### POST /

Request body:

```json
{
  "message": "How do I add a new page?",
  "history": [
    { "role": "user", "content": "What is zudo-doc?" },
    { "role": "assistant", "content": "zudo-doc is a documentation framework..." }
  ]
}
```

Response:

```json
{
  "response": "To add a new page, create an MDX file in..."
}
```

Rate limited response (429):

```json
{
  "error": "Too many requests"
}
```

Includes `Retry-After` header with seconds until the limit resets.

## Security

The Worker includes prompt injection defenses:

- **Hardened system prompt** — XML-tagged context separation with explicit guardrails that instruct the model to stay on-topic and never reveal configuration
- **Input screening** — regex-based pre-filter in `src/input-screen.ts` that rejects messages matching common prompt injection patterns before they reach Claude

## Rate Limiting

Per-IP rate limiting via Cloudflare KV. Uses `cf-connecting-ip` header for client identification.

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_PER_MINUTE` | `10` | Max requests per IP per minute |
| `RATE_LIMIT_PER_DAY` | `100` | Max requests per IP per day |

Configure in `wrangler.toml` `[vars]` section. Invalid values fall back to the defaults.

The limiter is best-effort (KV is eventually consistent). On KV errors, requests are allowed through — chat availability takes priority over strict enforcement.
