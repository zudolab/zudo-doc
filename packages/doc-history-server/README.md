# @zudo-doc/doc-history-server

Standalone package for serving and generating doc history from git.

## Modes

### REST API Server (local dev)

```bash
pnpm dev -- --content-dir src/content/docs --locale ja:src/content/docs-ja --port 4322
```

Endpoints:

- `GET /doc-history/{slug}.json` — History for a doc
- `GET /doc-history/{locale}/{slug}.json` — History for a localized doc
- `GET /health` — Health check

### CLI Generator (CI builds)

```bash
pnpm generate -- --content-dir src/content/docs --locale ja:src/content/docs-ja --out-dir dist/doc-history
```

Options:

- `--content-dir <path>` — Content directory to scan (required)
- `--locale <key>:<dir>` — Additional locale directories (repeatable)
- `--out-dir <path>` — Output directory for JSON files (required)
- `--max-entries <n>` — Max commits per file (default 50)

## Build

```bash
pnpm build
```
