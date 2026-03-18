# doc-history-server

Standalone package for document git history with dual modes: REST API server for local dev, CLI batch generator for CI builds. Extracted from `src/utils/doc-history.ts` to decouple expensive git operations from the Astro build pipeline.

## Tech Stack

- **Node.js** — HTTP server + CLI (no framework dependency)
- **Git** — `execFileSync` calls for log, show, follow
- **TypeScript** — strict mode, ESM

## Commands

- `pnpm dev -- --port 4322 --content-dir <path> --locale <key>:<dir>` — start REST API server
- `pnpm generate -- --content-dir <path> --locale <key>:<dir> --out-dir <path>` — batch generate JSONs
- `pnpm typecheck` — TypeScript type checking
- `pnpm build` — build via tsup (ESM + DTS)

## Architecture

```
src/
├── index.ts        # Server entry — parses args, starts HTTP server
├── cli.ts          # CLI entry — parses args, batch generates JSONs
├── args.ts         # Shared argument parsing with bounds checking
├── server.ts       # HTTP server (GET /doc-history/{slug}.json, /health)
├── git-history.ts  # Core git logic (log, show, follow, rename tracking)
├── shared.ts       # Shared helpers (getContentDirEntries)
└── types.ts        # DocHistoryEntry, DocHistoryData types
```

### Server Mode (Local Dev)

- Runs on configurable port (default 4322)
- `GET /doc-history/{slug}.json` — returns full history for a document
- `GET /doc-history/{locale}/{slug}.json` — locale-prefixed history
- `GET /health` — health check
- File index refreshes every 10 seconds (picks up new/renamed files)
- CORS headers for cross-origin dev access

### CLI Mode (CI Build)

- Generates `{slug}.json` files in the output directory
- Reports progress and timing
- Used by CI `build-history` job (parallel with Astro build)

### Astro Integration

In dev mode, `src/integrations/doc-history.ts` proxies `/doc-history/*` requests to this server. In build mode, the Astro integration falls back to inline generation when `SKIP_DOC_HISTORY` is not set.

Root `pnpm dev` runs both Astro and this server via `run-p`.

## Key Design Decisions

- **Synchronous git** — `execFileSync` is acceptable for dev server (same as original integration). CI uses the CLI which is inherently sequential
- **Repo-relative paths** — API responses use relative file paths to avoid leaking absolute server paths
- **`--follow` for renames** — tracks file history across renames with multiple fallback strategies
- **pnpm --filter paths** — when run via `pnpm --filter`, CWD is the package dir, so content paths need `../../` prefix for repo-relative resolution in CI

## CLI Arguments

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--content-dir` | Yes | — | Content directory to scan |
| `--locale <key>:<dir>` | No | — | Additional locale (repeatable) |
| `--out-dir` | CLI only | — | Output directory for JSONs |
| `--port` | Server only | 4322 | Server port |
| `--max-entries` | No | 50 | Max commits per file |
