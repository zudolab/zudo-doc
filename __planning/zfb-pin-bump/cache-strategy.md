# Cache Strategy Decision — embed-v8 first-build cost

**Epic:** zfb-pin-bump-embed-v8 (#1407)
**Wave:** W1C
**Date:** 2026-05-04

---

## 1. ZFB_PINNED_SHA occurrence count

Manager pre-counted 15; actual count is **16** across the 3 workflow files.

| File | Count | Lines |
|---|---|---|
| `.github/workflows/main-deploy.yml` | 5 | 77 (env decl), 93 (`ref:`), 101 (`key:`), 147 (`git -C checkout`), 213 (`git -C checkout`) |
| `.github/workflows/preview-deploy.yml` | 4 | 55 (env decl), 71 (`ref:`), 79 (`key:`), 126 (`git -C checkout`) |
| `.github/workflows/pr-checks.yml` | 7 | 60 (env decl), 97 (`ref:`), 105 (`key:`), 156 (`git -C checkout`), 215 (`git -C checkout`), 296 (`git -C checkout`), 353 (`git -C checkout`) |
| **Total** | **16** | |

The off-by-one vs. manager's pre-count of 15: `pr-checks.yml` has 7 occurrences (4 `git -C checkout` lines across `typecheck`, `build-site`, `build-history`, and `e2e` jobs), not 6. All references follow the same pattern: one `env:` declaration per file, one `ref:` in the `build-zfb` checkout step, one `key:` in the `Swatinem/rust-cache` step, and one `git -C ../zfb checkout "$ZFB_PINNED_SHA"` per install-bearing job.

---

## 2. Upstream health.yml cache config vs. ours

**Upstream (`$HOME/repos/myoss/zfb/.github/workflows/health.yml`):**

```yaml
- uses: Swatinem/rust-cache@v2
  with:
    prefix-key: "v1-zfb"
```

No `shared-key` or `cache-directories` overrides. The `prefix-key: "v1-zfb"` comment in upstream explains the intent: _"Prefix so future workspace-member additions don't share a stale cache."_ The upstream also explicitly notes in an inline comment that the `timeout-minutes: 45` budget accounts for V8 first compile costing 15-30 min.

**Ours (all 3 workflow files, `build-zfb` job):**

```yaml
- uses: Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4 # v2.9.1
  with:
    workspaces: zfb-src
    key: zfb-${{ env.ZFB_PINNED_SHA }}
```

We pin the action to a commit hash (good for supply-chain safety). We set `workspaces: zfb-src` (because we check out zfb into `zfb-src/`, not the repo root). We use `key: zfb-${{ env.ZFB_PINNED_SHA }}` as an extra suffix on top of Swatinem's auto-generated key.

**Differences:**

- Upstream uses `prefix-key: "v1-zfb"` for cache namespace isolation; we use `key:` (Swatinem's `key` is an _additional_ suffix appended to the auto-generated key — not a replacement for `prefix-key`).
- Upstream has no `workspaces` override (builds in repo root); we need `workspaces: zfb-src` because our checkout path is non-standard.
- Neither upstream nor ours sets `cache-directories` explicitly — both rely on Swatinem's defaults (`~/.cargo/registry`, `~/.cargo/git`, `target/`).

---

## 3. Decision: (A) No change

**Rationale:** Our current `Swatinem/rust-cache@v2.9.1` config with `workspaces: zfb-src` and `key: zfb-${{ env.ZFB_PINNED_SHA }}` is already well-suited for the embed-v8 pin bump. The SHA-keyed cache suffix (`key: zfb-${{ env.ZFB_PINNED_SHA }}`) is actually _stricter_ than upstream's `prefix-key: "v1-zfb"` approach: when the SHA changes (the whole point of W3), Swatinem will automatically produce a cache miss on all three workflows, pay the 15-30 min first-build cost exactly once per SHA, and then cache the full deno_core / V8 compiled artifacts on subsequent runs. Adding a `prefix-key` bump (option B) would be redundant — the SHA suffix already provides per-pin cache isolation, so there is no stale `target/` risk. Adding explicit `cache-directories` (option C) is equally unnecessary because Swatinem's defaults already cover `~/.cargo/registry`, `~/.cargo/git`, and `target/`; deno_core and V8 build products land in `target/` under the workspace root, which Swatinem discovers automatically via the `workspaces: zfb-src` setting. The only actionable note for W3: the `timeout-minutes: 20` cap on all three `build-zfb` jobs may be tight for the first cold build post-SHA-bump given the ADR-007 estimate of 15-30 min. W3 should consider raising it to 45 min (matching upstream's budget) for the first post-embed-v8 run, then reverting or keeping it at 45 to stay conservative.

---

## 4. Diff hunks for W3

Decision is **(A) No change** to cache config. No workflow YAML edits are required.

**Optional (non-blocking) recommendation for W3:** raise `timeout-minutes` on `build-zfb` jobs from 20 to 45 to guard against the cold-compile window. This is not a cache-strategy change and is left to W3's discretion.

If W3 wants to apply the timeout guard:

```diff
--- a/.github/workflows/main-deploy.yml
+++ b/.github/workflows/main-deploy.yml
@@ -84,7 +84,7 @@ jobs:
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
@@ -88,6 +88,6 @@ jobs:
   build-zfb:
     name: Build zfb Binary
     runs-on: ubuntu-latest
-    timeout-minutes: 20
+    timeout-minutes: 45
```
