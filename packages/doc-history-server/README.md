# @zudo-doc/doc-history-server

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

| Flag               | Required | Default | Description                                   |
| ------------------ | -------- | ------- | --------------------------------------------- |
| `--content-dir`    | Yes      | —       | Primary content directory to scan             |
| `--locale <k>:<d>` | No       | —       | Extra locale directory (repeatable)           |
| `--port`           | No       | `4322`  | HTTP port                                     |
| `--max-entries`    | No       | `50`    | Max commits to include per file               |

#### Endpoints

- `GET /doc-history/{slug}.json` — Full history for a document
- `GET /doc-history/{locale}/{slug}.json` — History for a localized document
- `GET /health` — Health check

The file index is refreshed every 10 seconds so newly added or renamed files are picked up without restarting the server. All responses include CORS headers for cross-origin dev access.

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

## Astro integration

In dev mode, the Astro integration at `src/integrations/doc-history.ts` proxies `/doc-history/*` requests to this server. In build mode, the integration falls back to inline generation unless `SKIP_DOC_HISTORY=1` is set — which is the case in the CI `build-site` job so that the Astro build completes fast while the CLI `build-history` job generates the JSONs in parallel.

## Build

```bash
pnpm build
```

Uses `tsup` to emit ESM output + DTS into `dist/`.

## Design notes

- **Synchronous git** — uses `execFileSync` for `git log` calls. The dev server is single-user and CI is inherently sequential, so async streaming is not needed.
- **Repo-relative paths** — responses use relative file paths to avoid leaking absolute server paths.
- **`--follow` for renames** — file history is tracked across renames with multiple fallback strategies.
- **pnpm --filter CWD** — when run via `pnpm --filter`, the CWD is this package dir, so content paths passed from CI need `../../` prefix for repo-relative resolution.
