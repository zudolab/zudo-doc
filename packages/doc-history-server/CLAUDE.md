# doc-history-server

Standalone package for document git history with dual modes: REST API server for local dev, CLI batch generator for CI builds. Extracted from `src/utils/doc-history.ts` to decouple expensive git operations from the documentation build pipeline.

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
- Used by CI `build-history` job (parallel with the main site build)

### zfb Integration

In dev mode, the zfb integration at `packages/zudo-doc/src/integrations/doc-history/` proxies `/doc-history/*` requests to this server. In build mode, that integration falls back to inline generation when `SKIP_DOC_HISTORY` is not set.

Root `pnpm dev` runs both the zfb dev server and this server via `run-p`.

## Key Design Decisions

- **Synchronous git** — `execFileSync` is acceptable for dev server (same as original integration). CI uses the CLI which is inherently sequential
- **Repo-relative paths** — API responses use relative file paths to avoid leaking absolute server paths
- **`--follow` for renames** — tracks file history across renames with multiple fallback strategies
- **pnpm --filter paths** — when run via `pnpm --filter`, `process.cwd()` is the package dir, but pnpm sets `INIT_CWD` to where pnpm was invoked (the repo root). `resolveContentPath` resolves relative `--content-dir` / `--locale` paths against `INIT_CWD`, so pass the clean repo-root-relative form (`src/content/docs`, `ja:src/content/docs-ja`) with NO `../../` prefix — the same form `dev:history` and CI's `build-history` use. A path that resolves to a non-existent directory is a hard error (exit 1), not a silent zero-entry run (#1907 / #1913). `--out-dir` is the exception: it is stored verbatim (not resolved via `INIT_CWD`), so CI keeps `../../doc-history-out` to write the artifact at the repo root.

## CLI Arguments

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--content-dir` | Yes | — | Content directory to scan |
| `--locale <key>:<dir>` | No | — | Additional locale (repeatable) |
| `--out-dir` | CLI only | — | Output directory for JSONs |
| `--port` | Server only | 4322 | Server port |
| `--max-entries` | No | 50 | Max commits per file |
