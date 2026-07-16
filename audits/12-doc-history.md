# S12 — Doc History Audit

> Branch: `zfb-feature-audit/s12-doc-history`
> Date: 2026-05-04
> Issue: [#1372](https://github.com/zudolab/zudo-doc/issues/1372)

---

## Legend

- **PASS** — verified working
- **DEFER** — runtime verification deferred (port-binding constraint)
- **FAIL** — broken / missing

---

## Results

| # | Checkpoint | Status | Notes |
|---|---|---|---|
| 1 | `docHistory: true` wires the feature | PASS | Current chrome wiring derives `DocHistoryArea` from package settings and the required manifest `ext`. |
| 2 | Server mode — HTTP server logic exists | PASS (static) | `packages/doc-history-server/src/server.ts` implements a Node.js HTTP server on configurable port (default 4322). Routes: `GET /doc-history/{slug}.json`, `GET /health`, CORS preflight. File index refreshes every 10 s. Runtime port-binding verification deferred — manager dispatch with flock if needed. |
| 3 | Server mode — dev proxy exists | PASS (static) | `@takazudo/zudo-doc/plugins/doc-history` owns the zfb middleware and proxies the configured `/doc-history/` route to the standalone server. |
| 4 | CLI mode — `generate` command runs | PASS | `pnpm --filter @zudo-doc/doc-history-server generate -- --content-dir ../../src/content/docs --locale ja:../../src/content/docs-ja --out-dir /tmp/s12-cli-test2` exited 0. Processed 68 EN + 74 JA = 142 files; generated 142 JSON files in 19.2 s. Each JSON contains `slug`, `filePath`, `entries[]` with `hash`, `date`, `author`, `message`, `content`. |
| 5 | CLI path resolution note | INFO | When called via `pnpm --filter`, CWD is the package dir (`packages/doc-history-server/`). Content paths require `../../` prefix to resolve from repo root. This matches the CI `pr-checks.yml` invocation (`--content-dir ../../src/content/docs`). |
| 6 | `pnpm build` (no `SKIP_DOC_HISTORY`) — `dist/doc-history/` populated | PASS | Clean build produced 163 JSON files under `dist/doc-history/`. Build completed in 36.26 s, exit 0. |
| 7 | `SKIP_DOC_HISTORY=1 pnpm build` — `dist/doc-history/` absent | PASS | With a clean `dist/`, `SKIP_DOC_HISTORY=1 pnpm build` produced no `dist/doc-history/` directory. Build completed in 7.77 s (significantly faster — git log calls skipped). `.zfb/doc-history-meta.json` contains `{}` as required by the CI contract. |
| 8 | preBuild SKIP contract | PASS (static) | `packages/zudo-doc/src/plugins/internal/doc-history/pre-build.ts` writes an empty manifest when `SKIP_DOC_HISTORY=1`. |
| 9 | postBuild SKIP contract | PASS (static) | `packages/zudo-doc/src/plugins/internal/doc-history/index.ts` gives `SKIP_DOC_HISTORY=1` highest priority. |
| 10 | CI merge — `build-history` → deploy artifact | PASS (static) | `pr-checks.yml` `build-history` job: full clone (`fetch-depth: 0`), generates to `doc-history-out/`, saves as GitHub Actions cache. The preview/deploy job restores both `dist/` and `doc-history-out/` caches, then copies `doc-history-out/` into `deploy/pj/zudo-doc/doc-history/` in the "Prepare deploy directory" step. |
| 11 | Island UI — fetch path | PASS (static) | `src/components/doc-history.tsx`: `DocHistory` component (`"use client"`) constructs `fetchPath` as `${base}/doc-history/${locale}/${slug}.json` (or without locale for default). Opens a `<dialog>` panel with revision list + side-by-side diff viewer. Closes on Escape, `AFTER_NAVIGATE_EVENT`, and native dialog close. |
| 12 | Island UI — integration in page | PASS (static) | `@takazudo/zudo-doc/doc-history-area` reads current manifest metadata and renders the package-owned island through chrome. |
| 13 | Island hydration | DEFER | Runtime hydration and commit-list display require a browser. Deferred to manager headless-browser dispatch. |

---

## Summary

All statically verifiable checks pass. CLI mode (exit 0, 142 files), normal build (`dist/doc-history/` with 163 files), and SKIP build (no `dist/doc-history/`) all behave exactly as documented. The SKIP_DOC_HISTORY contract is honoured at both the preBuild and postBuild hooks. The CI merge pattern (separate `build-history` job, cache-merge at deploy time) is correctly wired. The only deferred items are runtime/browser-dependent: server port binding and island hydration.

---

## Follow-up Issues

None identified. No unrelated issues found during audit.

---

## Log

CLI generate log: `/tmp/s12-cli.log`
