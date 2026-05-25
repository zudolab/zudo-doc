# S14 — Build & Quality Pipelines Verification

**Branch:** `zfb-feature-audit/s14-pipelines`
**Date:** 2026-05-04
**Issue:** [#1374](https://github.com/zudolab/zudo-doc/issues/1374)

---

## Summary Table

| Step | Command | Exit Code | Pass/Fail |
|------|---------|-----------|-----------|
| Type check | `pnpm check` | 1 | FAIL |
| Build | `pnpm build` | 0 | PASS |
| Format check | `pnpm format:check` | 0 | PASS |
| Tags audit | `pnpm tags:audit --ci` | 0 | PASS (warn only) |
| Template drift | `pnpm check:template-drift` | 0 | PASS |
| Design token lint | `pnpm lint:tokens` | 0 | PASS |
| Link checker | `pnpm check:links` | 0 | PASS (non-strict; issues present) |
| Preview smoke | `pnpm preview` + curl | 0 | PASS |
| b4push | `pnpm b4push` (smokes skipped) | 1 | FAIL (type check) |
| Generator CLI | Code-trace only | — | DEFERRED |
| Deployment workflow | YAML read + review | — | PASS |

---

## Per-Step Detail

### 1. pnpm check (Type Checking)

| Field | Value |
|---|---|
| Feature | Type checking via `zfb check` → `tsc --noEmit` |
| Status | FAIL |
| Severity | High — blocks CI `typecheck` job and `b4push` |
| Root cause | `zfb-shim.d.ts` declares `module "zfb/config"` with a local `ZfbConfig` interface that is missing the `base?: string` field. Because `zfb/config` is a virtual module (no file in `node_modules` — resolved at zfb tool parse time), TypeScript uses the shim declaration instead of the real package type. The `base` field was added to the real `@takazudo/zfb` `src/config.ts` (line 130) in the `feat/asset-base-path` merge (PR #154, zfb commit `19b2bd5`, referenced in the `zfb.config.ts` pin comment) but `zfb-shim.d.ts` was not updated. The error is: `zfb.config.ts(401,3): error TS2353: Object literal may only specify known properties, and 'base' does not exist in type 'ZfbConfig'.` |
| Evidence | `/tmp/s14-check.log` |
| Next step | Add `base?: string` to the `ZfbConfig` interface in `zfb-shim.d.ts` (after `stripMdExt?: boolean`). See the real type at `node_modules/.pnpm/@takazudo+zfb@file+..+zfb+packages+zfb/node_modules/@takazudo/zfb/src/config.ts:130`. |

### 2. pnpm build

| Field | Value |
|---|---|
| Feature | Static export (`zfb build`) → `dist/` |
| Status | PASS |
| Severity | — |
| Root cause | — |
| Evidence | `/tmp/s14-build.log` — `✓ 217 pages built in 48.59s`; adapter output `dist/_worker.js` + `dist/_zfb_inner.mjs` confirmed |
| Next step | — |

### 3. pnpm format:check

| Field | Value |
|---|---|
| Feature | `@takazudo/mdx-formatter --check` over `src/content/**/*.{md,mdx}` |
| Status | PASS |
| Severity | — |
| Root cause | — |
| Evidence | `/tmp/s14-format.log` — `✓ All files are formatted correctly` |
| Next step | — |

### 4. pnpm tags:audit --ci

| Field | Value |
|---|---|
| Feature | Tag vocabulary audit in CI warn-mode |
| Status | PASS (exit 0; 4 orphan vocab entries logged as warnings) |
| Severity | Low — `governance: warn` means orphan entries do not fail CI |
| Root cause | 4 unused vocabulary tags: `type:reference`, `type:tutorial`, `level:beginner`, `level:advanced` — no pages use them. Pre-existing; governance is set to `warn`. |
| Evidence | `/tmp/s14-tags.log` |
| Next step | Consider pruning unused vocab entries from tag vocabulary or promoting `governance: error` if stricter enforcement is desired. Not blocking. |

### 5. pnpm check:template-drift

| Field | Value |
|---|---|
| Feature | `scripts/check-template-drift.sh` — compares `packages/create-zudo-doc/templates/` against live files |
| Status | PASS |
| Severity | — |
| Root cause | — |
| Evidence | `/tmp/s14-template-drift.log` — `✅ No template drift detected.` |
| Next step | — |

### 6. pnpm lint:tokens (design-token-lint)

| Field | Value |
|---|---|
| Feature | `design-token-lint` using `vendor/design-token-lint/` + `.design-token-lint.json` |
| Status | PASS |
| Severity | — |
| Root cause | — |
| Evidence | `/tmp/s14-design-token.log` — `No design token violations found.` (96 files scanned) |
| Next step | — |

### 7. pnpm check:links

| Field | Value |
|---|---|
| Feature | `scripts/check-links.js` — post-build HTML + MDX source link audit |
| Status | PASS (exit 0; non-strict mode) |
| Severity | Medium — non-strict exit means CI (which runs without `--strict`) does not fail, but issues are present |
| Root cause | 4 broken links in built HTML (3 genuine broken pages: `ja/docs/getting-started/writing-docs → ../guides/frontmatter.mdx` resolves to a missing page; `ja/docs/guides/header-navigation → ./header-right-items.mdx`; 2 links to `/pj/zudo-doc/docs/claude-commands/` which is a generated page that may be excluded). 51 absolute path warnings (MDX source using `/docs/...` bypassing base path). 13 trailing-slash warnings. The checker is invoked without `--strict` in `run-b4push.sh` and in the CI `build-site` job — so these do not cause a build failure today. |
| Evidence | `/tmp/s14-links.log` |
| Next step | Broken links warrant a separate follow-up. See **Follow-up Issues** below. |

### 8. pnpm preview (smoke)

| Field | Value |
|---|---|
| Feature | `zfb preview` → wrangler pages dev on port 4321; curl smoke |
| Status | PASS |
| Severity | — |
| Root cause | Note: `GET /pj/zudo-doc/` returns 404 during local preview — wrangler's dev mode serves `dist/` flat (no base prefix rewrite). The root `/` returns 200 and `/docs/getting-started/` returns 200. `smoke-preview.mjs` correctly probes paths without the base prefix (`/`, `/docs/getting-started/`, `/sitemap.xml`, `/search-index.json`, `/llms.txt`), so the script passes. This is expected behaviour. |
| Evidence | `/tmp/s14-preview.log`, `/tmp/s14-preview-curl.log` |
| Next step | — |

### 9. pnpm b4push

| Field | Value |
|---|---|
| Feature | Full pre-push gate: format → template-drift → tags → design-token → typecheck → build → link-check → preview-smoke → manual |
| Status | FAIL (exit 1) |
| Severity | High — same root cause as step 1 |
| Root cause | `Type checking` step fails due to missing `base` in `zfb-shim.d.ts` (same as step 1). All other steps pass. Preview smoke + manual smoke were skipped via env vars (`B4PUSH_SKIP_PREVIEW_SMOKE=1`, `B4PUSH_SKIP_MANUAL_SMOKE=1`). |
| Evidence | `/tmp/s14-b4push.log` — `❌ 1 check(s) failed: - Type checking` |
| Next step | Fix `zfb-shim.d.ts` (step 1 above). |

### 10. Generator CLI Testing (/l-run-generator-cli-whole-test)

| Field | Value |
|---|---|
| Feature | `create-zudo-doc` generator CLI multi-pattern test (9 patterns) |
| Status | DEFERRED — code-trace only per audit instructions |
| Severity | — |
| Root cause | Code-trace: `packages/create-zudo-doc/src/scaffold.ts` produces `package.json`; `src/features/*.ts` inject per-feature config; `src/zfb-config-gen.ts` builds `zfb.config.ts` from templates; `packages/create-zudo-doc/templates/` holds base + feature file overlays. The `check-template-drift.sh` script confirms no live drift from base templates (step 5 above). Full execution requires `/l-run-generator-cli-whole-test` in a separate session. |
| Evidence | Code-read: `packages/create-zudo-doc/src/scaffold.ts`, `src/zfb-config-gen.ts`, `scripts/check-template-drift.sh` |
| Next step | Run `/l-run-generator-cli-whole-test` in a dedicated session as documented in `develop/generator-cli-testing.mdx`. |

---

## Deployment Workflow Review

### main-deploy.yml

Structure verified against `guides/deployment.mdx` documentation:

| Job | Clone depth | Key env | Depends on | Confirmed |
|---|---|---|---|---|
| `build-zfb` | 1 | — | — | Builds Rust binary + fetches Tailwind CLI; uploads as 1-day artifacts |
| `build-site` | 1 (shallow) | `SKIP_DOC_HISTORY=1` | `build-zfb` | PASS — runs `pnpm build` with SKIP_DOC_HISTORY, saves `dist/` to cache |
| `build-history` | 0 (full) | — | none (parallel) | PASS — runs `@zudo-doc/doc-history-server generate`, saves `doc-history-out/` to cache |
| `deploy` | — | — | `build-site` + `build-history` | Merges both caches into `deploy/pj/zudo-doc/`, writes `_redirects`, runs `wrangler pages deploy` |
| `notify` | — | — | all | IFTTT notification with per-job status |

**Matches doc:** Yes. `build-site` uses `SKIP_DOC_HISTORY=1` shallow clone; `build-history` uses full clone; deploy merges both. The `dist/client/` branch in the prepare step is documented as a legacy Astro fallback that never runs under zfb.

**Known limitation:** Documented in the workflow YAML header — `_worker.js` lands at `deploy/pj/zudo-doc/_worker.js` (nested under base path), not at the root `deploy/_worker.js`. Cloudflare Pages advanced mode requires it at the deploy root. SSR routes (`/api/ai-chat`) are expected to 404 in prod until this layout is fixed. Tracked separately.

### pr-checks.yml

| Job | Clone depth | Key env | Confirmed |
|---|---|---|---|
| `check-template-drift` | default | — | Pure shell, no install, runs first |
| `build-zfb` | 1 | — | Parallel with drift check; produces binary artifacts |
| `typecheck` | 1 | — | Depends on `build-zfb`; runs `pnpm check` |
| `build-site` | 1 (shallow) | `SKIP_DOC_HISTORY=1` | Depends on `build-zfb`; runs `pnpm build` + `check:links` |
| `build-history` | 0 (full) | — | Independent — does NOT depend on `build-zfb` (standalone package) |
| `e2e` | 0 (full) | — | Depends on `build-zfb`; uses Playwright container |
| `preview` | — | — | Depends on `build-site` + `build-history`; deploys CF Pages preview + comments URL |

**Matches doc:** Yes. `build-site` and `build-history` are parallel. `build-history` is intentionally independent of `build-zfb` (documented in YAML inline comment). E2E uses full clone (inline doc history, no `SKIP_DOC_HISTORY`). PR preview URL is posted as a PR comment via `actions/github-script`.

---

## Follow-up Issues

### FU-1: `zfb-shim.d.ts` missing `base` field — typecheck blocked

**Signature:** `TS2353 — 'base' does not exist in type 'ZfbConfig'` in `zfb-shim.d.ts`

**Impact:** `pnpm check` exit 1; `pnpm b4push` exit 1; CI `typecheck` job will fail.

**Fix:** Add `base?: string` to the `ZfbConfig` interface in `zfb-shim.d.ts` after `stripMdExt?: boolean`. The real type in `node_modules/@takazudo/zfb/src/config.ts` already has this field with full JSDoc.

### FU-2: Link checker runs in non-strict mode — 4 broken HTML links + 51 absolute path warnings not blocking

**Signature:** `check-links.js` exits 0 even when issues are found (non-strict mode)

**Impact:** Broken internal links are not caught by CI. Currently 4 broken HTML links including `ja/docs/getting-started/writing-docs → ../guides/frontmatter.mdx` (missing page) and `ja/docs/guides/header-navigation → ./header-right-items.mdx` (missing page).

**Recommendation:** Consider enabling `--strict` mode in `run-b4push.sh` and the CI `build-site` job once the existing broken links are fixed, to prevent regressions.

---

## Logs

| Step | Log file |
|---|---|
| pnpm check | `/tmp/s14-check.log` |
| pnpm build | `/tmp/s14-build.log` |
| pnpm format:check | `/tmp/s14-format.log` |
| pnpm tags:audit --ci | `/tmp/s14-tags.log` |
| pnpm check:template-drift | `/tmp/s14-template-drift.log` |
| pnpm lint:tokens | `/tmp/s14-design-token.log` |
| pnpm check:links | `/tmp/s14-links.log` |
| pnpm preview | `/tmp/s14-preview.log` |
| pnpm b4push | `/tmp/s14-b4push.log` |
