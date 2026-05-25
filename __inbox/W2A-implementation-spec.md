**MANAGER ACTION REQUIRED:** A new sub-issue (Wave 2.5) is required before W3A can proceed. See "New sub-issues required before W3" section at the bottom.

---

# W2A — Implementation Spec for W3A and W3B (Manager-Confirm Gate)

**Date:** 2026-05-05
**Branch:** zfb-pin-bump-migration-fixes/w2a-confirm-gate
**Prepared by:** W2A child agent (claude-sonnet-4-6)

---

## Verified-Current-HEAD SHA

Re-fetched upstream HEAD on 2026-05-05 via:

```
git -C $HOME/repos/myoss/zfb fetch origin
git -C $HOME/repos/myoss/zfb log origin/main --oneline -1
```

Result: `f68a9ba Merge pull request #200 from Takazudo/base/migration-fixes`

Full SHA: `f68a9ba8b1d8ab8b24442969ce9b1192167e3d4c`

**HEAD has NOT moved.** Still f68a9ba. This is a clean fast-forward from bdbfbfb (bdbfbfb80d57f86de2485100af380b4b8c82c8f7). No new commits since W1A planning. All W1A verdicts apply without revision.

---

## Manager Re-Execution Notes

### W1A Findings

**Axis 4 (embedded-binaries / CI workflow) — REPRODUCED and refined.**

Re-read `crates/zfb/build.rs` at f68a9ba. Confirmed:

- `download_esbuild()` fetches esbuild 0.25.12 from `registry.npmjs.org` into `crates/zfb/binaries/esbuild/esbuild`. Idempotent via SHA-256 check (`binary_already_correct`). Skip if `ZFB_ESBUILD_BIN` is set.
- `download_tailwindcss()` fetches tailwindcss 4.2.0 from `https://github.com/tailwindlabs/tailwindcss/releases/download/v4.2.0/...` into `crates/zfb/binaries/tailwindcss-v4`. Skip if `ZFB_TAILWIND_BIN` is set.
- `embed_runtime()` (commit 16770a8) copies `packages/zfb/src/` and `packages/zfb-runtime/src/` into `$OUT_DIR/vendor/@takazudo/` at compile time. No new artifact requirement.
- `scripts/fetch-tailwind.mjs` is explicitly marked "SUPERSEDED" in its file header: "crates/zfb/build.rs is now the authoritative download path." The CI `node scripts/fetch-tailwind.mjs` step after cargo build is redundant (but harmless due to idempotency).

Re-read CI workflows. Current `build-zfb` job in both `pr-checks.yml` (line 60: `ZFB_PINNED_SHA: bdbfbfb80d57f86de2485100af380b4b8c82c8f7`) and `main-deploy.yml` (line 77: same):

- Rust cache scope: `workspaces: zfb-src` — covers `zfb-src/target/` but NOT `zfb-src/crates/zfb/binaries/`. On a cache HIT, binaries are absent and cargo build re-downloads them from network.
- `node scripts/fetch-tailwind.mjs` step: runs after cargo build, hits idempotency guard (tailwind binary already present from build.rs), does nothing.

**CONFIRMED VERDICT: workflow-change-required-spec-here.** See "New sub-issues required before W3" section. Raised as MANAGER ACTION REQUIRED.

**Axis 5 (public-asset copy) — REPRODUCED and confirmed KEEP for plugin.**

W1B category 1 re-verified by reading `main-deploy.yml` lines 279–288. The deploy step is `cp -r dist/. deploy/pj/zudo-doc/`. The upstream native `copy_public_dir` places files at `dist/pj/zudo-doc/img/logo.svg`, which after the deploy step lands at `deploy/pj/zudo-doc/pj/zudo-doc/img/logo.svg` — double-prefixed. The `plugins/copy-public-plugin.mjs` places files at `dist/img/logo.svg`, which lands at `deploy/pj/zudo-doc/img/logo.svg` — correct. CI gate at `main-deploy.yml:335-337` asserts HTTP 200 for `$DEPLOY_URL/img/logo.svg`.

**Empirical build (W1A 219-page finding) — REPRODUCED.**

Ran `SKIP_DOC_HISTORY=1 pnpm build` in worktrees/w2a-confirm-gate. Result: 219 pages built in 6.99s (timing varies; page count matches). No errors.

### W1B Findings

**Category 3 (admonition blank-line KEEP) — REPRODUCED and confirmed FAIL.**

Empirical re-test: reverted a single live `:::note` block (the first one in `src/content/docs/components/admonitions.mdx`) from blank-line shape to no-blank-line shape. Ran build. Inspected `dist/docs/components/admonitions/index.html`:

- `data-admonition="note"` hits: 1 (was 2 with blank-line shape) — the no-blank-line :::note failed to parse.
- Raw `:::note` in HTML: still present (leaked as plain text).

**KEEP verdict confirmed.** The parser at f68a9ba still requires blank-line shape. Local edit reverted before this commit.

**Category 1 (copy-public-plugin KEEP) — REPRODUCED.** See Axis 5 above.

**Category 2 (--color-*: initial KEEP) — Confirmed correct.** The reset at `src/styles/global.css:83` is project policy (tight-token rule), not a mechanical workaround. The upstream fix (9e37551) removes the leak cause, but the reset is retained by design. Comment text in `global.css` lines 51-82 and `src/CLAUDE.md:99` is stale and must be updated in W3B.

**Categories 4 and 5 (stale comments) — Confirmed locations match.** Verified line numbers align with current file state.

**No W1A or W1B finding needed correction.** All verdicts reproduced exactly.

---

## W3A Spec — Atomic Pin Bump (4 File Edits)

W3A is a single atomic commit that bumps the zfb pin from `bdbfbfb80d57f86de2485100af380b4b8c82c8f7` to `f68a9ba8b1d8ab8b24442969ce9b1192167e3d4c` (abbreviated: `bdbfbfb` → `f68a9ba`).

**Note:** W3A MUST NOT proceed until the Wave 2.5 CI workflow sub-issue is resolved. The embedded-binaries CI workflow change is a prerequisite — without it, the build-zfb job will make unnecessary network calls on cache hits. The manager decides whether to insert Wave 2.5 before W3A or to merge the CI workflow change directly into W3A.

### Sources (verified by `rg -n bdbfbfb` in worktree)

```
zfb.config.ts:3     commit: bdbfbfb (Takazudo/zudo-front-builder main, ...)
zfb.config.ts:205   - Takazudo/zudo-front-builder bdbfbfb (fix(embedded-v8): ...)
zfb.config.ts:223              bdbfbfb adds node:async_hooks stub ...
zfb.config.ts:369   // (legacy Astro-era pipeline). The current zfb pin (`bdbfbfb`, post-#170
```

And in CI workflows:

```
.github/workflows/pr-checks.yml:60    ZFB_PINNED_SHA: bdbfbfb80d57f86de2485100af380b4b8c82c8f7
.github/workflows/main-deploy.yml:77  ZFB_PINNED_SHA: bdbfbfb80d57f86de2485100af380b4b8c82c8f7
```

### Edit 1: `.github/workflows/pr-checks.yml` line 60

```
# OLD:
ZFB_PINNED_SHA: bdbfbfb80d57f86de2485100af380b4b8c82c8f7

# NEW:
ZFB_PINNED_SHA: f68a9ba8b1d8ab8b24442969ce9b1192167e3d4c
```

### Edit 2: `.github/workflows/main-deploy.yml` line 77

```
# OLD:
ZFB_PINNED_SHA: bdbfbfb80d57f86de2485100af380b4b8c82c8f7

# NEW:
ZFB_PINNED_SHA: f68a9ba8b1d8ab8b24442969ce9b1192167e3d4c
```

### Edit 3: `zfb.config.ts` — Pin comment block (lines 1–224)

Three occurrences of `bdbfbfb` in the header comment block:

1. Line 3: `commit: bdbfbfb` → `commit: f68a9ba`
2. Line 205: `Takazudo/zudo-front-builder bdbfbfb (fix(embedded-v8): add ...` → `Takazudo/zudo-front-builder bdbfbfb (fix(embedded-v8): add ...` (this line documents the prior bdbfbfb commit that was the hotfix — keep as historical context, do NOT rewrite this line; it describes what bdbfbfb was)
3. Line 223: `bdbfbfb adds node:async_hooks stub` → same (historical context, keep)

CORRECTION: Lines 205 and 223 are historical narrative about what bdbfbfb contained — they should be retained as-is to document the commit history. Only line 3 (the canonical pin declaration) and line 369 need updating.

Line 3: `commit: bdbfbfb` → `commit: f68a9ba`

The block starting at line 3 also needs to append the new range of included fixes from f68a9ba. The canonical pattern in the existing header is: list each PR in `- Takazudo/zudo-front-builder#N (description)` format. After the existing entries, append the f68a9ba batch under a new `pinned by:` sentence continuation.

Suggested append after line 223:

```
 *              → bumped by epic zudolab/zudo-doc#1431 sub-issue #1434 (W2A
 *                manager-confirm gate: pin f68a9ba picks up migration-fixes
 *                PR #200 — walk-order fix #187, admonitions title_from_label
 *                #188 partial, copy-public-dir native, GFM table emission,
 *                CSS split-import fix #159, embedded binaries d6a1c46, runtime
 *                embed 16770a8)
```

### Edit 4: `zfb.config.ts` line 369

```
# OLD:
// (legacy Astro-era pipeline). The current zfb pin (`bdbfbfb`, post-#170

# NEW:
// (legacy Astro-era pipeline). The current zfb pin (`f68a9ba`, post-#200
```

---

## W3B Spec — Stale-Comment Cleanup

W3B removes or corrects all stale workaround/todo comments whose upstream condition is now met. W3B does NOT revert the 6 admonition-reformatted files (W1B category 3: parser still requires blank-line shape, KEEP).

W3B is safe to proceed independently of Wave 2.5 (it only touches comments).

### W3B-1: `zfb.config.ts` line 503 — copy-public-plugin comment

**Current (line 503):**

```
// Workaround for upstream zfb gap (zudolab/zudo-doc#1394; upstream issue: https://github.com/Takazudo/zudo-front-builder/issues/158) — zfb build does not copy publicDir to outDir; remove once upstream ships and pin is bumped.
```

**Action:** Replace with a comment that accurately explains:

- Upstream #192 (a6abbc3) HAS shipped in f68a9ba — native copy_public_dir is now active.
- The host plugin is KEPT due to deploy-pipeline base-wrap semantics: native copy places files under `dist/pj/zudo-doc/` (base-prefixed) but the deploy step `cp -r dist/. deploy/pj/zudo-doc/` would then produce `deploy/pj/zudo-doc/pj/zudo-doc/` (double-prefixed).
- Reference: W1B category 1 analysis; CI smoke gate at `main-deploy.yml:335-337`.

**Suggested replacement:**

```
// Upstream zfb #192 (a6abbc3, f68a9ba) ships native copy_public_dir — but its output goes
// to dist/<base-segment>/ (e.g. dist/pj/zudo-doc/img/logo.svg). The deploy pipeline then
// does `cp -r dist/. deploy/pj/zudo-doc/`, producing a double-prefix
// (deploy/pj/zudo-doc/pj/zudo-doc/img/logo.svg). The host plugin copies flat to dist/
// (no base prefix), which the deploy step correctly relocates to deploy/pj/zudo-doc/.
// Keep the host plugin until the deploy pipeline is reshaped to serve dist/ directly.
// CI gate: main-deploy.yml:335-337 asserts HTTP 200 for $DEPLOY_URL/img/logo.svg.
```

**File/line:** `zfb.config.ts` lines 503 (single-line comment immediately above the copy-public-plugin entry)

### W3B-2: `zfb.config.ts` lines 512–539 — "Open upstream gaps" comment block (#187/#188)

**Current (lines 512–539):** A multi-line comment block titled "Open upstream gaps blocking style/feature parity (zudolab/zudo-doc#1417 W3C)" describing gaps #187 and #188 as still open.

**Action:** Remove the entire block. Both gaps are resolved at f68a9ba:

- #187 (walk-order divergence): fixed by 635a8e3 (sort_by_file_name + HeadingLinksPlugin::reset).
- #188 (syntect theme hardcoded): fixed by 339e30f (code_highlight field in ZfbConfig).

**Replacement:** Single tombstone line (optional but recommended for traceability):

```
// Upstream gaps #187 (walk-order) and #188 (syntect theme) resolved in f68a9ba (635a8e3, 339e30f).
```

**File/line range:** `zfb.config.ts` lines 512–539

### W3B-3: `zfb.config.ts` lines 363–414 — zfb#185 block

**Action:** Targeted edits within the comment block:

a) Line 369: `bdbfbfb` → `f68a9ba` (also updated in W3A Edit 4 above — coordinate to avoid double-edit)

b) Lines 390–401 (ResolveLinksPlugin reachability claim): Update. Upstream a22eb71 wired `ResolveLinksPlugin` via `resolveMarkdownLinks` config field. The comment "not reachable through ZfbConfig" is now stale. Revise to: "ResolveLinksPlugin is now wired via a22eb71 (resolveMarkdownLinks config field). Host-side adoption is deferred — current corpus uses stripMdExt:true alone and all corpus links resolve correctly."

c) Lines 402–409 (blank-line parser requirement): Update. Commit c644eb7 added a build-time diagnostic for the no-blank-line form but did NOT relax the parser. Revise to note: "Parser still requires blank-line shape (empirically confirmed at f68a9ba). c644eb7 adds a build-time diagnostic. The 6 corpus files reformatted by W3B retain blank-line shape permanently."

d) Line 414: Remove or update the "does not block on zfb#185" sentence. zfb#185 is partially resolved (Gap 1 closed by a22eb71; Gap 2 diagnostic added by c644eb7 but parser unchanged). Update to: "zfb#185 is partially resolved at f68a9ba: Gap 1 (ResolveLinksPlugin config exposure) closed by a22eb71; Gap 2 (blank-line parser requirement) has a diagnostic added by c644eb7 but is not relaxed."

**File/line range:** `zfb.config.ts` lines 363–414

### W3B-4: `src/styles/global.css` lines 51–82 — Default-theme reset comment

**Current:** Comment titled "Default-theme reset (zfb upstream blind spot workaround)" describes the leak mechanism and ends with: "Once upstream lands the split-import recognition and the pin is bumped, this reset becomes a no-op; remove at that time."

**Action:** Rewrite the comment header and body:

- Change title from "zfb upstream blind spot workaround" to "Project tight-token color reset"
- Remove the leak-mechanism description (lines 55–66: the `crates/zfb-css/src/engine.rs:234` reference and the "full default Tailwind theme leaks" language). The upstream fix (9e37551) eliminated the leak; the description is no longer accurate.
- Drop the "becomes a no-op; remove at that time" sentence (lines 79–81). The reset is KEPT as a project color rule, not a workaround.
- Retain the substance: this reset enforces the tight-token policy ("NEVER use Tailwind default colors"). Document that while the upstream fix (zfb#159, 9e37551) eliminated the leak cause, the reset is retained by project design rule.
- Keep the `--spacing` note (not reset because spacing calc failure was observed in Wave 4 Sub-7).

**Suggested replacement for the comment header (lines 51–82):**

```
  /* ========================================
   * Project tight-token color reset
   *
   * Wipes all Tailwind default color tokens (`--color-*`) so only
   * project-defined palette and semantic tokens remain. This enforces the
   * tight-token policy: "NEVER use Tailwind default colors" (per Color Rules
   * in src/CLAUDE.md). Project color tokens (defined below) are added back
   * after this reset.
   *
   * The upstream split-import fix (zfb#159 / 9e37551, shipped in f68a9ba)
   * eliminated the original leak cause (zfb no longer prepends the full
   * @import "tailwindcss" bundle). The reset is retained as an explicit
   * design guardrail — it prevents accidental default palette bleed from any
   * future upstream change and keeps the project's color surface intentional.
   *
   * NOT reset: `--spacing` (the base spacing scale, default 0.25rem).
   * Tailwind spacing utilities compute as calc(var(--spacing) * N); wiping
   * `--spacing` collapses them to zero (observed in Wave 4 Sub-7 #1403).
   * ======================================== */
```

**File/line range:** `src/styles/global.css` lines 51–82

### W3B-5: `src/CLAUDE.md` line 99 — Stale "remove when upstream fix lands" instruction

**Current (line 99):**

```
- `@theme` has `--color-*: initial; --spacing: initial;` at the top — workaround for a zfb upstream bug (Takazudo/zudo-front-builder#159) that injects the full default Tailwind theme. Remove when upstream fix lands and pin is bumped (Sub-5).
```

**Action:** Rewrite to reflect that the fix has landed and the reset is kept by policy:

**Suggested replacement:**

```
- `@theme` has `--color-*: initial;` at the top — project tight-token guardrail: wipes all Tailwind default color tokens so only project-defined tokens are available. The upstream split-import fix (zfb#159 / 9e37551) shipped in f68a9ba and eliminated the original leak cause; the reset is retained as an explicit design rule per the "NEVER use Tailwind default colors" policy. Do NOT remove.
```

Note: `--spacing: initial;` is NOT actually present in `global.css` at line 83 — only `--color-*: initial;` is there. The src/CLAUDE.md line 99 incorrectly says both. Verify before editing: the `--spacing` reset appears elsewhere in the CLAUDE.md description but is not at line 83 of global.css. Correct the claim if inaccurate.

**File/line:** `src/CLAUDE.md` line 99

### W3B-6: `src/content/docs/claude-md/src.mdx` — Content mirror

W1B category 5c identified a content mirror at `src/content/docs/claude-md/src.mdx` line 109. However, `rg` found no stale "Remove when upstream fix lands" or "Sub-5" text in any `.mdx` file in this worktree. The file may not exist on this branch or the line may differ.

**Action for W3B implementer:** Check `src/content/docs/claude-md/src.mdx` if it exists. If line 109 contains "Remove when upstream fix lands and pin is bumped (Sub-5)", apply the same update as W3B-5. If the file does not exist or the line differs, skip. Do the same for `src/content/docs-ja/claude-md/src.mdx` (Japanese mirror).

---

## Pre-Implementation Guards

Before W3A:

1. Upstream HEAD must be f68a9ba8b1d8ab8b24442969ce9b1192167e3d4c. Re-verify with `git -C $HOME/repos/myoss/zfb log origin/main --oneline -1`.
2. Wave 2.5 CI workflow sub-issue must be resolved or the manager must explicitly decide to proceed without it (accepting network calls on cache hits).
3. Local build in the W3A worktree must produce 219 pages with no errors (`SKIP_DOC_HISTORY=1 pnpm build`).

Before W3B:

1. W3B can proceed in parallel with or before W3A (no dependency).
2. After W3B edits, run `pnpm check` to confirm TypeScript still passes.
3. Run `SKIP_DOC_HISTORY=1 pnpm build` to confirm no build regressions.
4. Do NOT revert any of the 6 admonition-reformatted files. They are correct at blank-line shape.

---

## New Sub-Issues Required Before W3

**MANAGER ACTION REQUIRED — Decision needed before W3A proceeds.**

### Proposed Sub-Issue: Wave 2.5 — CI workflow update for embedded-binaries (build.rs)

**Proposed title:** `feat(ci): update build-zfb job for build.rs embedded-binary download (Wave 2.5)`

**Proposed description:**

After the pin bump to f68a9ba, `cargo build -p zfb --release` in the build-zfb job will invoke `crates/zfb/build.rs`, which downloads esbuild 0.25.12 from `registry.npmjs.org` and tailwindcss 4.2.0 from GitHub releases into `crates/zfb/binaries/`. Both downloads are idempotent (SHA-256 verified) and skip if the binary is already present. However:

1. The Swatinem/rust-cache workspaces path currently covers `zfb-src/target/` but NOT `zfb-src/crates/zfb/binaries/`. On a warm runner (cache HIT on the Rust compilation), the binaries directory is absent and cargo build re-downloads both binaries from network. This adds latency and creates unnecessary network dependencies on each CI run.
2. The `node scripts/fetch-tailwind.mjs` step that follows `cargo build` is now redundant (the file header in fetch-tailwind.mjs explicitly says "SUPERSEDED: crates/zfb/build.rs is now the authoritative download path"). It hits the idempotency guard and does nothing. It should be removed or documented as a no-op safety step.

**Required changes in both `pr-checks.yml` and `main-deploy.yml` (build-zfb job):**

Option A (preferred): Add an explicit `actions/cache` step to save/restore `zfb-src/crates/zfb/binaries/` keyed on `ZFB_PINNED_SHA + platform`. This ensures binaries survive cache hits without network access.

Option B: Set `ZFB_ESBUILD_BIN` before `cargo build` to point to a pre-downloaded esbuild binary (e.g., from the pnpm store after `pnpm install` runs, or from a separate `actions/cache` keyed on the esbuild version). Note: `pnpm install` does not run in the build-zfb job. Similarly set `ZFB_TAILWIND_BIN` to skip the tailwindcss download. This requires pre-fetching or caching each binary separately.

Option C: Accept the network calls and remove only the redundant `node scripts/fetch-tailwind.mjs` step. Network calls in build.rs are expected on cold runners; the idempotency guard makes warm-runner re-downloads fast (but still wasteful).

**The manager must choose an option and assign this sub-issue before W3A is committed to the branch.**

**Dependencies:** Must merge before (or be batched with) W3A.

---

## Files Changed in W3A (Summary)

| File | Change |
|------|--------|
| `.github/workflows/pr-checks.yml` | ZFB_PINNED_SHA: bdbfbfb... → f68a9ba... |
| `.github/workflows/main-deploy.yml` | ZFB_PINNED_SHA: bdbfbfb... → f68a9ba... |
| `zfb.config.ts` | Pin comment: bdbfbfb → f68a9ba at lines 3 and 369; append new pinned-by sentence |

## Files Changed in W3B (Summary)

| File | Change |
|------|--------|
| `zfb.config.ts` line 503 | Replace copy-public-plugin comment with deploy-semantics explanation |
| `zfb.config.ts` lines 512–539 | Remove "Open upstream gaps" block (#187/#188 resolved) |
| `zfb.config.ts` lines 363–414 | Update #185 block: Gap 1 resolved, Gap 2 diagnostic-only |
| `src/styles/global.css` lines 51–82 | Rewrite comment from "workaround" to "project tight-token rule" |
| `src/CLAUDE.md` line 99 | Rewrite stale "Remove when upstream fix lands" instruction |
| `src/content/docs/claude-md/src.mdx` | Check line 109 (may not exist on this branch); apply if present |
| `src/content/docs-ja/claude-md/src.mdx` | Japanese mirror of above; apply if present |

## Files NOT Changed (confirmed KEEP)

| File | Reason |
|------|--------|
| `src/content/docs/components/admonitions.mdx` | Blank-line shape required (W1B cat 3 FAIL) |
| `src/content/docs-ja/components/admonitions.mdx` | Same |
| `src/content/docs/components/image-enlarge.mdx` | Same |
| `src/content/docs-ja/components/image-enlarge.mdx` | Same |
| `src/content/docs/concepts/trailing-slash-policy.mdx` | Same |
| `src/content/docs-ja/concepts/trailing-slash-policy.mdx` | Same |
| `plugins/copy-public-plugin.mjs` | KEEP (deploy-pipeline base-wrap semantics mismatch) |
| `src/styles/global.css:83` (`--color-*: initial`) | KEEP as project policy (tight-token rule) |
