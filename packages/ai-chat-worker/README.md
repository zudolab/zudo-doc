# @zudo-doc/ai-chat-worker

Cloudflare Worker that serves as an AI chat API endpoint for zudo-doc. Uses Claude to answer questions about the documentation by fetching and caching `llms-full.txt` as context.

## Setup

1. Set the `DOCS_SITE_URL` variable in `wrangler.toml` to your deployed docs site URL
2. Add your Anthropic API key as a secret:

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
