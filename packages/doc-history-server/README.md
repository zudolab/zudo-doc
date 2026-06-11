# @takazudo/zudo-doc-history-server

Standalone package for extracting and serving git history of documentation files. Has two modes: an HTTP server for local development and a CLI generator for CI builds.

The history extraction logic was extracted from the Astro build pipeline so that expensive `git log --follow` calls do not block the main build, enabling a parallel CI strategy.

## Modes

### Server mode (local development)

Runs an HTTP server that serves history on demand. Used by `pnpm dev` at the repository root, which starts both Astro and this server concurrently via `run-p`.

```bash
pnpm dev -- \
  --content-dir src/content/docs \
  --locale ja:src/content/docs-ja \
  --port 4322
```

| Flag               | Required | Default       | Description                                   |
| ------------------ | -------- | ------------- | --------------------------------------------- |
| `--content-dir`    | Yes      | —             | Primary content directory to scan             |
| `--locale <k>:<d>` | No       | —             | Extra locale directory (repeatable)           |
| `--port`           | No       | `4322`        | HTTP port                                     |
| `--host`           | No       | `127.0.0.1`   | Network interface to bind (see note below)    |
| `--max-entries`    | No       | `50`          | Max commits to include per file               |

> **Security note — `--host`:** The server exposes full git revision history including file content at every commit. It binds to `127.0.0.1` (loopback only) by default so it is not reachable from the LAN. The zfb dev plugin proxies `/doc-history/*` requests server-side, so both `pnpm dev` and `pnpm dev:network` work without LAN exposure. Pass `--host 0.0.0.0` only when you have a specific reason to accept remote connections.

#### Endpoints

- `GET /doc-history/{slug}.json` — Full history for a document
- `GET /doc-history/{locale}/{slug}.json` — History for a localized document
- `GET /health` — Health check

The file index is refreshed every 10 seconds so newly added or renamed files are picked up without restarting the server. All responses include CORS headers.

### CLI mode (CI builds)

Generates static `{slug}.json` files into an output directory. Used by the `build-history` CI job, which runs in parallel with the `build-site` Astro build.

```bash
pnpm generate -- \
  --content-dir src/content/docs \
  --locale ja:src/content/docs-ja \
  --out-dir dist/doc-history
```

| Flag               | Required | Default | Description                               |
| ------------------ | -------- | ------- | ----------------------------------------- |
| `--content-dir`    | Yes      | —       | Primary content directory to scan         |
| `--locale <k>:<d>` | No       | —       | Extra locale directory (repeatable)       |
| `--out-dir`        | Yes      | —       | Output directory for the generated JSONs  |
| `--max-entries`    | No       | `50`    | Max commits to include per file           |

## zfb integration

In dev mode, the zfb integration at `packages/zudo-doc/src/integrations/doc-history/` proxies `/doc-history/*` requests to this server. In build mode, the integration falls back to inline generation unless `SKIP_DOC_HISTORY=1` is set — which is the case in the CI `build-site` job so that the zfb build completes fast while the CLI `build-history` job generates the JSONs in parallel.

## Build

```bash
pnpm build
```

Uses `tsup` to emit ESM output + DTS into `dist/`.

## Design notes

- **Async git** — all git calls use `execFile` / `spawn` (non-blocking). The CLI batch generator wraps each file in a semaphore-bounded Promise, so the async variant genuinely parallelizes across files (#1986). The server also uses the same async path so the event loop is never blocked.
- **Repo-relative paths** — responses use relative file paths to avoid leaking absolute server paths.
- **`--follow` for renames** — file history is tracked across renames with multiple fallback strategies.
- **pnpm --filter CWD** — when run via `pnpm --filter`, the CWD is this package dir. pnpm sets `INIT_CWD` to the repo root, so pass repo-root-relative content paths (e.g. `src/content/docs`) without any `../../` prefix.
