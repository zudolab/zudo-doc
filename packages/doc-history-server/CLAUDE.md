# doc-history-server

Standalone package for document git history with dual modes: REST API server for local dev, CLI batch generator for CI builds. Extracted from `src/utils/doc-history.ts` to decouple expensive git operations from the documentation build pipeline.

## Tech Stack

- **Node.js** — HTTP server + CLI (no framework dependency)
- **Git** — `execFile` / `spawn` (async) for log, show, follow; `execFileSync` only for the one-time `rev-parse --show-toplevel` repo-root probe
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

- Binds to `127.0.0.1` by default (loopback only); pass `--host 0.0.0.0` to accept LAN connections
- Runs on configurable port (default 4322)
- `GET /doc-history/{slug}.json` — returns full history for a document
- `GET /doc-history/{locale}/{slug}.json` — locale-prefixed history
- `GET /health` — health check
- File index refreshes every 10 seconds (picks up new/renamed files)
- CORS headers on all responses

### CLI Mode (CI Build)

- Generates `{slug}.json` files in the output directory
- Reports progress and timing
- Used by CI `build-history` job (parallel with the main site build)

### zfb Integration

In dev mode, the zfb plugin at `packages/zudo-doc/src/plugins/doc-history.ts` proxies `/doc-history/*` requests to this server. In build mode, that plugin falls back to inline generation when `SKIP_DOC_HISTORY` is not set.

Root `pnpm dev` runs both the zfb dev server and this server via `run-p`.

## Key Design Decisions

- **Async git everywhere** — both the server and CLI use `getDocHistoryAsync` (#1986). The CLI wraps every file in a semaphore-bounded Promise; async git calls (`execFile` / `spawn`) mean the concurrency cap actually parallelizes work. The server also awaits the same function, keeping the event loop unblocked. The pure parsers (`parseCommitLog`, `parseHashToPathMap`, `parseBatchContents`) are shared between the content-fetch and the rename-fallback paths.
- **Localhost-only bind** — the server binds to `127.0.0.1` by default to avoid exposing full git history (including unpublished content) on the LAN. The zfb dev plugin proxies server-side, so LAN exposure is not needed. Pass `--host 0.0.0.0` to opt in.
- **Repo-relative paths** — API responses use relative file paths to avoid leaking absolute server paths
- **`--follow` for renames** — tracks file history across renames with multiple fallback strategies
- **pnpm --filter paths** — when run via `pnpm --filter`, `process.cwd()` is the package dir, but pnpm sets `INIT_CWD` to where pnpm was invoked (the repo root). `resolveContentPath` resolves relative `--content-dir` / `--locale` paths against `INIT_CWD`, so pass the clean repo-root-relative form (`src/content/docs`, `ja:src/content/docs-ja`) with NO `../../` prefix — the same form `dev:history` and CI's `build-history` use. A path that resolves to a non-existent directory is a hard error (exit 1), not a silent zero-entry run (#1907 / #1913). `--out-dir` is the exception: it is stored verbatim (not resolved via `INIT_CWD`), so CI keeps `../../doc-history-out` to write the artifact at the repo root.

## CLI Arguments

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--content-dir` | Yes | — | Content directory to scan |
| `--locale <key>:<dir>` | No | — | Additional locale (repeatable) |
| `--out-dir` | CLI only | — | Output directory for JSONs |
| `--port` | Server only | `4322` | Server port |
| `--host` | Server only | `127.0.0.1` | Network interface to bind |
| `--max-entries` | No | `50` | Max commits per file |
