# W2 Spec: zfb Pin Bump — embed-v8 + cold-start-rebuild

**Date:** 2026-05-04
**Wave:** W2 — Manager-confirm gate + implementation spec
**Branch:** `zfb-pin-bump-embed-v8/w2-spec`
**Depends on:** W1A (#1408), W1B (#1409), W1C (#1410)

---

## 1. Hard Gate — W1B Status

**CLEAR. Proceed.**

W1B found two bugs in `e550167` (cold-start rebuild + PageCache disk fallback) and autonomously merged PR #170 to upstream. The new upstream HEAD is `0549132`. W1B reported all three smokes PASS at `0549132`. No HOLD is warranted.

---

## 2. Final New SHA

```
0549132255827d1581c3933f7a422b0a577025ce
```

Short form: `0549132`

Re-fetched from upstream on 2026-05-04:

```bash
cd $HOME/repos/myoss/zfb
git fetch origin
git rev-parse origin/main
# → 0549132255827d1581c3933f7a422b0a577025ce
```

**Note:** W1A and W1B initially targeted `e550167` (merge of PR #168). W1B exercised upstream fix authority and merged PR #170 (`fix/dev-cold-start-rebuild`) on top. The new pin is `0549132` — the merge commit of PR #170, **not** `e550167`. The issue brief has been updated accordingly.

---

## 3. Linear-Ancestry Confirmation

```bash
cd $HOME/repos/myoss/zfb
git merge-base --is-ancestor 88cec07 origin/main && echo "linear-ancestry-confirmed"
# → linear-ancestry-confirmed

git log 88cec07..origin/main --oneline | wc -l
# → 35
```

**Result:** `88cec07` IS a linear ancestor of `0549132`. 35 commits in range. Ancestry confirmed.

Merged PRs in range (chronological order):
- PR #157 — `fix/basic-blog-end-to-end` (1 commit: `26f5141`)
- PR #168 — `base/embed-v8` (sub-161 through sub-167, 33 commits including post-merge fixups)
- PR #170 — `fix/dev-cold-start-rebuild` (2 commits: `11d6d64` + merge `0549132`)

---

## 4. Consumer-Side Audit

**Re-grep result (2026-05-04):**

```
src/content/docs-ja/concepts/routing-conventions.mdx:17: miniflare (prose)
src/content/docs-ja/concepts/routing-conventions.mdx:193: miniflare (prose)
src/content/docs/concepts/routing-conventions.mdx:17: miniflare (prose)
src/content/docs/concepts/routing-conventions.mdx:201: miniflare (prose)
```

**Assessment:** Only doc content prose. No `SpawnMiniflare`, `Backend::`, or `workerd` references in build/runtime code. No code changes required for the pin bump.

**Post-merge follow-up (W4):** Update EN+JA routing-conventions.mdx to say "embedded V8 / deno_core" instead of "miniflare." See section 9b below.

---

## 5. ZFB_PINNED_SHA Occurrence Count: 16

W1C confirmed 16 occurrences (not 15 as originally estimated by manager). The extra occurrence is in `pr-checks.yml`'s `e2e` job.

| File | Count | Occurrence types |
|------|-------|-----------------|
| `.github/workflows/main-deploy.yml` | 5 | env decl (L77), `ref:` (L93), `key:` (L101), `git -C checkout` build-site (L147), `git -C checkout` build-history (L213) |
| `.github/workflows/preview-deploy.yml` | 4 | env decl (L55), `ref:` (L71), `key:` (L79), `git -C checkout` build-and-deploy (L126) |
| `.github/workflows/pr-checks.yml` | 7 | env decl (L60), `ref:` (L97), `key:` (L105), `git -C checkout` typecheck (L156), `git -C checkout` build-site (L215), `git -C checkout` build-history (L296), `git -C checkout` e2e (L353) |
| **Total** | **16** | |

---

## 6. Per-File Diff Hunks

**Old SHA:** `88cec078b568596b57b5ba041adc2849d28fa737`
**New SHA:** `0549132255827d1581c3933f7a422b0a577025ce`

### 6a. `.github/workflows/main-deploy.yml`

**Occurrence 1 — L77: env declaration**
```diff
@@ -74,7 +74,7 @@ env:
   # Pinned zfb commit — keep in sync with the zfb pin comment at the
   # top of zfb.config.ts and the same env in pr-checks.yml.
-  ZFB_PINNED_SHA: 88cec078b568596b57b5ba041adc2849d28fa737
+  ZFB_PINNED_SHA: 0549132255827d1581c3933f7a422b0a577025ce
```

**Occurrence 2 — L93: `ref:` in build-zfb checkout step**
```diff
@@ -90,7 +90,7 @@ jobs:
       - name: Checkout pinned zfb
         uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
         with:
           repository: Takazudo/zudo-front-builder
-          ref: ${{ env.ZFB_PINNED_SHA }}
+          ref: ${{ env.ZFB_PINNED_SHA }}
```
*(This occurrence uses the env var `${{ env.ZFB_PINNED_SHA }}` — it does NOT hardcode the SHA. No change required here; it auto-picks up the new env value. The count still includes it because it IS a reference to ZFB_PINNED_SHA.)*

**Occurrence 3 — L101: `key:` in Swatinem/rust-cache step**
```diff
@@ -99,7 +99,7 @@ jobs:
       - name: Cache cargo build
         uses: Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4 # v2.9.1
         with:
           workspaces: zfb-src
-          key: zfb-${{ env.ZFB_PINNED_SHA }}
+          key: zfb-${{ env.ZFB_PINNED_SHA }}
```
*(Same pattern — uses env var, auto-picks up new value.)*

**Occurrence 4 — L147: `git -C ../zfb checkout` in build-site job**
```diff
@@ -144,7 +144,7 @@ jobs:
       - name: Clone zfb sibling repo
         run: |
           git clone https://github.com/Takazudo/zudo-front-builder.git ../zfb
-          git -C ../zfb checkout "$ZFB_PINNED_SHA"
+          git -C ../zfb checkout "$ZFB_PINNED_SHA"
```
*(Uses env var — auto-picks up new value.)*

**Occurrence 5 — L213: `git -C ../zfb checkout` in build-history job**
```diff
@@ -210,7 +210,7 @@ jobs:
       - name: Clone zfb sibling repo
         run: |
           git clone https://github.com/Takazudo/zudo-front-builder.git ../zfb
-          git -C ../zfb checkout "$ZFB_PINNED_SHA"
+          git -C ../zfb checkout "$ZFB_PINNED_SHA"
```
*(Uses env var — auto-picks up new value.)*

**Summary for main-deploy.yml:** Only ONE actual text change — the `env:` declaration at L77. All other occurrences use `${{ env.ZFB_PINNED_SHA }}` or `"$ZFB_PINNED_SHA"` and auto-propagate.

**Effective diff for main-deploy.yml:**
```diff
--- a/.github/workflows/main-deploy.yml
+++ b/.github/workflows/main-deploy.yml
@@ -74,7 +74,7 @@ env:
   # Pinned zfb commit — keep in sync with the zfb pin comment at the
   # top of zfb.config.ts and the same env in pr-checks.yml.
-  ZFB_PINNED_SHA: 88cec078b568596b57b5ba041adc2849d28fa737
+  ZFB_PINNED_SHA: 0549132255827d1581c3933f7a422b0a577025ce
```

### 6b. `.github/workflows/preview-deploy.yml`

**Occurrence 1 — L55: env declaration**

**Effective diff for preview-deploy.yml:**
```diff
--- a/.github/workflows/preview-deploy.yml
+++ b/.github/workflows/preview-deploy.yml
@@ -52,7 +52,7 @@ env:
   # Pinned zfb commit — keep in sync with the zfb pin comment at the
   # top of zfb.config.ts and the same env in pr-checks.yml.
-  ZFB_PINNED_SHA: 88cec078b568596b57b5ba041adc2849d28fa737
+  ZFB_PINNED_SHA: 0549132255827d1581c3933f7a422b0a577025ce
```

*(Occurrences 2–4 at L71 `ref:`, L79 `key:`, L126 `git -C checkout` all use the env var and auto-propagate.)*

### 6c. `.github/workflows/pr-checks.yml`

**Occurrence 1 — L60: env declaration**

**Effective diff for pr-checks.yml:**
```diff
--- a/.github/workflows/pr-checks.yml
+++ b/.github/workflows/pr-checks.yml
@@ -57,7 +57,7 @@ env:
   # Pinned zfb commit — keep in sync with the zfb pin comment at the
   # top of zfb.config.ts. Updating the pin here without updating that
   # comment (or vice versa) will silently desync local dev from CI.
-  ZFB_PINNED_SHA: 88cec078b568596b57b5ba041adc2849d28fa737
+  ZFB_PINNED_SHA: 0549132255827d1581c3933f7a422b0a577025ce
```

*(Occurrences 2–7 at L97 `ref:`, L105 `key:`, L156/L215/L296/L353 `git -C checkout` all use the env var and auto-propagate.)*

---

## 7. `zfb.config.ts` Comment Block Update

The existing pin comment block occupies lines 1–180 of `zfb.config.ts`. W3 must replace lines 3–6 (the `commit:` line and its continuation) and append new `includes fixes:` entries, and update the `pinned by:` chain at lines 172–179.

**Effective diff for zfb.config.ts:**
```diff
--- a/zfb.config.ts
+++ b/zfb.config.ts
@@ -1,8 +1,12 @@
 /**
  * zfb pin (canonical, shared with E2/E4):
- *   commit: 88cec07 (Takazudo/zudo-front-builder main, post-merge of PR #156
- *           — wave13 rebase: data-props SSR + Tailwind src/styles/global.css
- *           input-CSS path probe — on top of PR #155 renderer-emission test
- *           and PR #154 feat/asset-base-path; 2026-05-04)
+ *   commit: 0549132 (Takazudo/zudo-front-builder main, post-merge of PR #170
+ *           — fix/dev-cold-start-rebuild: cold-start rebuild empty dirty set +
+ *           PageCache disk fallback; on top of PR #168 embed-v8 (replace
+ *           miniflare subprocess with embedded deno_core via deno_core crate)
+ *           and PR #157 basic-blog end-to-end fix; 2026-05-04)
  *   includes fixes:
```

And after the existing last `includes fixes:` bullet (currently the `#156` wave13 rebase entry at ~L171), append:

```
 *     - Takazudo/zudo-front-builder PR #157 (fix examples/basic-blog build
 *                               end-to-end — 6 bugs fixed; no consumer API
 *                               change)
 *     - Takazudo/zudo-front-builder PR #168 / sub-161 (ADR-007: author
 *                               embedded deno_core ADR, superseding ADR-005
 *                               miniflare subprocess)
 *     - Takazudo/zudo-front-builder PR #168 / sub-162 (implement
 *                               EmbeddedV8RenderHost: deno_core + node:*
 *                               runtime stubs + deno_fetch/web/url/console
 *                               Web API extensions)
 *     - Takazudo/zudo-front-builder PR #168 / sub-163 (CI: wire
 *                               Swatinem/rust-cache@v2; document 15-30 min
 *                               V8 first-build cost in CONTRIBUTING.md)
 *     - Takazudo/zudo-front-builder PR #168 / sub-164 (renderer: add
 *                               Backend::EmbeddedV8 + Backend::Stub,
 *                               WorkerDispatch enum; swap dispatch path)
 *     - Takazudo/zudo-front-builder PR #168 / sub-165 (test: ContentSnapshot
 *                               e2e verification tests)
 *     - Takazudo/zudo-front-builder PR #168 / sub-166 (cli: flip default
 *                               Backend from SpawnMiniflare → EmbeddedV8
 *                               in build/dev pipelines)
 *     - Takazudo/zudo-front-builder PR #168 / sub-167 (cleanup: delete
 *                               miniflare-bootstrap.mjs, strip
 *                               SpawnMiniflare backend, scrub all miniflare
 *                               references from code/docs/config)
 *     - Takazudo/zudo-front-builder PR #170 (fix(dev): cold-start rebuild
 *                               empty dirty set (DependencyGraph seeded with
 *                               all page IDs on startup; empty dirty escalates
 *                               to PageSelection::All) + PageCache disk
 *                               fallback (serve_page() reads from dist/ on
 *                               cache miss instead of returning 500))
```

And update the `pinned by:` chain (currently lines 172–179) to append:

```diff
-  *   pinned by: epic zudolab/zudo-doc#1353 (super-epic #1333) → bumped by epic
-  *              zudolab/zudo-doc#1355 (Sig F finalisation + post-#131 hash-mismatch follow-up
-  *              + Sig G island-resolver/esbuild parity + shared-bundle hydration glue
-  *              + manifest-key alignment + wave 12 hydration prop serialisation
-  *              + wave 13 Tailwind input-CSS path-probe gap) → bumped by epic
-  *              zudolab/zudo-doc#1360 sub-issue #1361 (S1 BLOCKER: HTML asset URLs respect
-  *              site `base`) → bumped by epic zudolab/zudo-doc#1386 sub-issue #1388
-  *              (atomic three-point pin bump + e2e fixture roll-forward; closes #1384)
+  *   pinned by: epic zudolab/zudo-doc#1353 (super-epic #1333) → bumped by epic
+  *              zudolab/zudo-doc#1355 (Sig F finalisation + post-#131 hash-mismatch follow-up
+  *              + Sig G island-resolver/esbuild parity + shared-bundle hydration glue
+  *              + manifest-key alignment + wave 12 hydration prop serialisation
+  *              + wave 13 Tailwind input-CSS path-probe gap) → bumped by epic
+  *              zudolab/zudo-doc#1360 sub-issue #1361 (S1 BLOCKER: HTML asset URLs respect
+  *              site `base`) → bumped by epic zudolab/zudo-doc#1386 sub-issue #1388
+  *              (atomic three-point pin bump + e2e fixture roll-forward; closes #1384)
+  *              → bumped by epic zudolab/zudo-doc#1407 (zfb-pin-bump-embed-v8: pick up
+  *              PR #168 embedded deno_core + PR #170 cold-start-rebuild fix)
```

---

## 8. `publicDir` Workaround Status

**zfb#158: OPEN** (confirmed 2026-05-04 via `gh issue view 158 --json state`).

`plugins/copy-public-plugin.mjs` and its `zfb.config.ts` entry at L406 area must be **retained** in this pin bump. No change required for this item.

---

## 9. Atomic Commit Message for W3

```
chore(zfb): bump pin 88cec07 → 0549132 (embed-v8 + cold-start fix)

Brings in upstream PR #168 (replaces miniflare subprocess with embedded
deno_core via deno_core crate) and PR #170 (cold-start dev rebuild +
PageCache disk fallback fix). Also includes PR #157 (basic-blog 6-bug fix).

Linear ancestry confirmed: 88cec07 IS an ancestor of 0549132.
Consumer-side audit: no Backend::SpawnMiniflare or workerd references in
zudo-doc build/runtime code (4 miniflare mentions in routing-conventions.mdx
are doc prose only — scheduled for W4 prose update).
Upstream PR #168 smokes verified by W1B. PR #170 merged upstream by W1B.

Workarounds retained: publicDir copy-public-plugin (zfb#158 OPEN),
--color-*:initial CSS reset (zfb#159 OPEN).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 10. Pre-Flight Checks for W3

Run all of these before committing the pin bump:

```bash
# 1. Confirm the new SHA is fetched locally in the zfb clone
cd $HOME/repos/myoss/zfb
git fetch origin
git log 0549132 -1 --oneline
# → should print: 0549132 Merge pull request #170 from Takazudo/fix/dev-cold-start-rebuild

# 2. Belt-and-braces ancestry check
git merge-base --is-ancestor 88cec07 0549132 && echo "ancestry-ok"
# → ancestry-ok

# 3. Confirm issue states before bumping
gh issue view 158 --json state   # → {"state":"OPEN"}
gh issue view 159 --json state   # → {"state":"OPEN"}

# 4. Confirm occurrence count in workflows (should be 16)
grep -rn 'ZFB_PINNED_SHA' \
  .github/workflows/main-deploy.yml \
  .github/workflows/preview-deploy.yml \
  .github/workflows/pr-checks.yml | wc -l
# → 16

# 5. Dry-run: confirm all 3 env: declaration lines contain the OLD sha
grep -n '88cec07' \
  .github/workflows/main-deploy.yml \
  .github/workflows/preview-deploy.yml \
  .github/workflows/pr-checks.yml
# → 3 hits (one per file, the env: declaration)

# 6. Consumer re-audit (should only show doc prose)
grep -rn 'SpawnMiniflare\|miniflare\|workerd\|Backend::' \
  zfb.config.ts plugins/ packages/ pages/ src/ 2>/dev/null
# → only routing-conventions.mdx hits (4 lines of doc prose)
```

---

## 11. W4 Follow-Ups

### 11a. Post-merge prose update — routing-conventions.mdx (EN + JA)

**Files:**
- `src/content/docs/concepts/routing-conventions.mdx` — L17 and L201
- `src/content/docs-ja/concepts/routing-conventions.mdx` — L17 and L193

**What to change:** Replace "miniflare" (runtime engine reference) with "embedded V8 (deno_core)" or equivalent accurate description, since the build-time engine is now the embedded V8 isolate, not miniflare. This is a prose-only doc update, not a code change.

**EN prose (L17 current):**
> zfb's `paths()` runs inside **miniflare** at build time and is **synchronous** by contract.

**Suggested replacement:**
> zfb's `paths()` runs inside an **embedded V8 isolate (deno_core)** at build time and is **synchronous** by contract.

### 11b. smoke-search flake retry fallback

W1B committed `ae653b4` (change `waitUntil: "load"` → `waitUntil: "domcontentloaded"` in `e2e/smoke-search.spec.ts`). This was already committed to the base by W1B. If flakiness persists post-merge, consider adding `test.describe.configure({ retries: 1 })` at the top of `e2e/smoke-search.spec.ts` as an additional guard.

---

## 12. Optional — `timeout-minutes` Bump (W1C Recommendation)

W1C recommends (non-blocking) bumping `build-zfb` `timeout-minutes` from 20 to 45 to guard against cold V8 compile cost (ADR-007 estimates 15-30 min). W3 may apply this at its discretion.

**Diff hunks if W3 applies the timeout guard:**

```diff
--- a/.github/workflows/main-deploy.yml
+++ b/.github/workflows/main-deploy.yml
@@ -83,7 +83,7 @@ jobs:
   build-zfb:
     name: Build zfb Binary
     runs-on: ubuntu-latest
-    timeout-minutes: 20
+    timeout-minutes: 45
```

```diff
--- a/.github/workflows/preview-deploy.yml
+++ b/.github/workflows/preview-deploy.yml
@@ -61,7 +61,7 @@ jobs:
   build-zfb:
     name: Build zfb Binary
     runs-on: ubuntu-latest
-    timeout-minutes: 20
+    timeout-minutes: 45
```

```diff
--- a/.github/workflows/pr-checks.yml
+++ b/.github/workflows/pr-checks.yml
@@ -87,7 +87,7 @@ jobs:
   build-zfb:
     name: Build zfb Binary
     runs-on: ubuntu-latest
-    timeout-minutes: 20
+    timeout-minutes: 45
```

**Recommendation:** Apply. The 20 min cap was set before the embed-v8 epic landed deno_core. Cold V8 compile on a fresh GitHub Actions runner will likely hit 15-30 min. The Rust cache (`Swatinem/rust-cache` with `key: zfb-${{ env.ZFB_PINNED_SHA }}`) guarantees a cache miss on first run at the new SHA, so W3's first CI run post-bump will pay the full cost. Setting timeout to 45 matches upstream `health.yml` convention and eliminates the risk of a false-failure timeout on the initial cold build.

---

## 13. Manager-Confirm Decision Record

| Item | W1 Finding | W2 Re-verify | Decision |
|------|-----------|-------------|---------|
| Upstream HEAD SHA | W1B: `0549132` (after merging PR #170) | Re-fetched: `0549132` confirmed | Pin to `0549132` |
| zfb#158 (publicDir copy) | W1A: OPEN | Re-checked: OPEN | Retain workaround |
| zfb#159 (default-theme leak) | W1A: OPEN | Re-checked: OPEN | Retain workaround |
| Consumer code changes | W1A: None required | Re-grep: confirmed none | No consumer changes |
| ZFB_PINNED_SHA count | W1C: 16 (not 15) | Verified: 16 across 3 files | All 16 covered in spec |
| Cache config change | W1C: Decision A (no change) | Accepted | No cache config changes |
| `timeout-minutes` bump | W1C: Optional 20→45 | Included as optional diff | W3 decides |
| Linear ancestry | W1 (implied) | Confirmed: `88cec07` IS ancestor of `0549132` | Proceed |
| Miniflare doc prose | W1A: Deferred post-W2 | Confirmed: 4 doc lines only | W4 follow-up |
| smoke-search flake | W1B: Fixed with domcontentloaded | Commit `ae653b4` in base | If persists: retries: 1 |
