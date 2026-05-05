# W1A — Upstream zfb Consumer-Impact Survey
## Range: bdbfbfb..f68a9ba (PR Takazudo/zudo-front-builder#200, base/migration-fixes)

**Date:** 2026-05-05
**Branch:** zfb-pin-bump-migration-fixes/w1a-survey
**Empirical build:** pnpm build run against worktrees/w1a-survey (zfb at f68a9ba via symlink) — 219 pages, no errors.

---

## Commit inventory

46 commits enumerated via `git -C $HOME/repos/myoss/zfb log --oneline bdbfbfb..f68a9ba`:

### Functional commits (consumer-impacting candidates)

| SHA | Message | Axis |
|-----|---------|------|
| 6a950e1 | fix(zfb-css): split-import detection | CSS split-import |
| 635a8e3 | fix(bundler): sort walk order + HeadingLinksPlugin reset | Plugin contract |
| 873bd9b | feat(mdx): emit MdastNode::Table | Table emission |
| c644eb7 | feat(admonitions): title_from_label default → true | Plugin contract |
| a6abbc3 | feat(build): copy public/ into out_dir | Public-asset copy |
| 339e30f | feat(syntect): expose code highlight theme via zfb.config.ts | Plugin contract |
| d6a1c46 | feat(build): add Cargo build.rs — download esbuild+tailwindcss | Embedded binaries |
| a22eb71 | feat(resolve-links): wire ResolveLinksPlugin via config | Plugin contract |
| 16770a8 | feat(zfb): embed @takazudo/zfb and zfb-runtime in binary | Embedded binaries |
| 4964cd0 | fix(content,build): wire GFM Table through mdast→hast detour | Table emission |

### Merge commits

cce2a8e, e6088ff, 756dfb6, 1e42ee5, 2097fd4, 5da0e10, 21d811e, 9e37551, ddd8eeb, f68a9ba, aaf711f — all merge/squash commits aggregating the above.

### Documentation-only commits (no consumer impact)

All commits under `base/zfb-docs-uplift` subtree: bec6346, 99bf2e6, 69e2265, f6159b7, c629a95, 58c1e2b, a3a0b6a, a43469e, a161efa, b8ccd4a, 2921009, 503d20b, 304c6e7, f1645f2, 5aa5264, 3db6d01, a22b2fc, 6bab78a, edb80e9, 37a50cd, 27a3ad5, b1ecdea — internal zfb docs only, no Rust or TypeScript changes.

8bb837e (test: integration-confirm wave 3 e2e) — test code only, no Rust runtime change.

2e4aa25 — "= start migration-fixes dev =" boundary marker.

9370c5a — `Merge pull request #182 from Takazudo/base/zfb-docs-uplift` — docs merge only.

---

## Axis-by-axis analysis

### Axis 1: Plugin contracts / pipeline shape

**Commits:** 635a8e3 (walk-order + HeadingLinksPlugin reset), c644eb7 (admonitions title_from_label), 339e30f (syntect theme config), a22eb71 (ResolveLinksPlugin via config)

**Verdict: safe**

- **635a8e3** — Walk-order sort and `Pipeline::reset_per_entry()` are purely internal. Consumer `zfb.config.ts` needs no changes. Effect: pages that previously rendered as `<pre data-zfb-content-fallback>` due to slug-counter mismatch (~68/104 EN pages, per gap note zfb#187) will now render correctly. This is a BUG FIX for zudo-doc — content will start appearing where it wasn't.
- **c644eb7** — `title_from_label` flipped to `true` for all six admonition types. zudo-doc corpus already uses `:::note[Custom Title]` syntax throughout (e.g. `src/content/docs/components/admonitions.mdx`). The `makeAdmonitionStub` in `pages/_mdx-components.ts` already handles `props.title` with a conditional render (`props.title ? ...`). **No config or component change needed.** Rendered output will now show titles where `:::note[Custom Title]` was authored.
- **339e30f** — Adds `codeHighlight?: { theme?: string }` to the Rust `Config` struct. Consumer-exposed as a new optional `ZfbConfig` field, but the TypeScript type in `packages/zfb/src/config.ts` was NOT updated (confirmed via `git diff bdbfbfb f68a9ba -- packages/zfb/src/config.ts` returns empty). Existing configs work as before — the field is absent and defaults to `base16-ocean.dark`. **No consumer change required** to maintain current behavior. Note: zudo-doc's `colorSchemes[*].shikiTheme` comment in `zfb.config.ts` (zfb#188) refers to this field being unwired; post-bump it can now be wired via a future `codeHighlight.theme` line in `defineConfig({...})` if desired.
- **a22eb71** — Adds `resolveMarkdownLinks?: { enabled, docsDir, onBrokenLinks }` to Rust Config. Same TS type gap as above. Consumer config works without any changes; the feature is disabled by default. **No consumer change required.**

---

### Axis 2: Page-handler call shape / route handler signatures

**Verdict: safe**

No commits in bdbfbfb..f68a9ba touch `pages/`, route handler factories, or the `{params, ...match.props}` dispatch shape. The comparable PR #157 pattern (route signature break) is absent from this range. All commits are internal to the Rust bundler, CSS engine, MDX pipeline, or binary bootstrap. The JS packages (`packages/zfb/`, `packages/zfb-runtime/`, `packages/zfb-adapter-cloudflare/`) had zero diff in this range (`git diff bdbfbfb f68a9ba -- packages/` returned empty). No consumer page module needs to change.

---

### Axis 3: Adapter API / build-pipeline lifecycle changes

**Verdict: safe**

- `plugins/connect-adapter.mjs` uses `devMiddleware` shape. No changes to the plugin host protocol (`crates/zfb/src/plugin_host.rs` diff is empty for this range).
- `@takazudo/zfb-adapter-cloudflare` had no commits in this range.
- `preBuild`, `postBuild`, `devMiddleware` hook contracts: unchanged.
- **a6abbc3** adds `copy_public_dir()` to `build.rs` Rust command — this is a build-step addition, not a plugin API change. It does not affect the `postBuild` hook shape.

---

### Axis 4: Embedded binaries architecture (CI / network access)

**Verdict: workflow-change-required-spec-here**

**Current workflow (at bdbfbfb):**

```
build-zfb job:
  1. cargo build -p zfb --release        # no build.rs; pure Rust compile
  2. node scripts/fetch-tailwind.mjs     # downloads tailwindcss binary
  3. Upload zfb-binary artifact
  4. Upload zfb-tailwind-binary artifact
```

**New behavior at f68a9ba:**

Commit `d6a1c46` adds `crates/zfb/build.rs` (Cargo build script). When `cargo build -p zfb --release` runs, this build script executes and:

1. Calls `download_esbuild()` — downloads esbuild v0.25.12 from npm registry (`registry.npmjs.org`) into `crates/zfb/binaries/esbuild/esbuild`. Idempotent: skips if binary already exists with correct SHA-256.
2. Calls `download_tailwindcss()` — downloads tailwindcss v4.2.0 from GitHub releases into `crates/zfb/binaries/tailwindcss-v4`. Idempotent: skips if binary already exists with correct SHA-256.

Escape hatches: `ZFB_ESBUILD_BIN` env var skips esbuild download; `ZFB_TAILWIND_BIN` skips tailwindcss download.

**Required workflow changes:**

1. **Swatinem/rust-cache must cover the binary slots** — The `workspaces: zfb-src` cache key already covers `target/` but NOT `crates/zfb/binaries/`. On a cache HIT at the same SHA, the downloaded binaries won't be present unless `binaries/` is included in the cache. Without this, every cargo build will re-download esbuild and tailwindcss even when the Rust compilation cache hits.

   Fix: extend the rust-cache configuration to also save/restore `zfb-src/crates/zfb/binaries/` as an additional path, OR set `ZFB_ESBUILD_BIN` and `ZFB_TAILWIND_BIN` to pre-fetch esbuild before cargo runs.
2. **Separate `node scripts/fetch-tailwind.mjs` step is now redundant** — `build.rs` downloads tailwindcss during cargo build. The post-cargo `node scripts/fetch-tailwind.mjs` step in the CI workflow will hit the idempotent check and do nothing (the file will already exist). The step can be retained for safety or removed; it does not cause harm. If removed, delete it from `build-zfb` in both `pr-checks.yml` and `main-deploy.yml` (lines ~119 and ~110 respectively).
3. **esbuild artifact upload** — The CI currently uploads only `zfb-binary` and `zfb-tailwind-binary`. Consumer jobs download these and stage them in `../zfb/target/release/` and `../zfb/crates/zfb/binaries/` respectively. The esbuild slot (`crates/zfb/binaries/esbuild/esbuild`) must also be available in consumer jobs. The existing consumer job flow resolves esbuild via `ZFB_ESBUILD_BIN` (set by `scripts/zfb-link.mjs` wrapper to the pnpm-store esbuild), NOT from the binary slot. Confirm the slot is only used when pnpm esbuild is absent. **No third artifact is needed if pnpm esbuild is discovered by `zfb-link.mjs`.**
4. **Commit 16770a8** (embed @takazudo/zfb and zfb-runtime in binary) adds `embed_runtime()` to `build.rs::main()`. This copies TypeScript source from `packages/zfb/` and `packages/zfb-runtime/` into `OUT_DIR/vendor/@takazudo/` at compile time. The CI workflow already checks out the full zfb source tree, so this step will work without additional changes.

**Concrete spec for workflow change:**

In `pr-checks.yml` and `main-deploy.yml`, in the `build-zfb` job, after `cargo build -p zfb --release`:

- Option A (preferred): Add `additional_cache_prefix` or an explicit path to rust-cache to include `zfb-src/crates/zfb/binaries/` so downloaded binaries survive cache hits without network access on subsequent runs.
- Option B: Set `ZFB_ESBUILD_BIN` before `cargo build` (pointing to a pre-downloaded esbuild binary), bypassing the build.rs download. The esbuild binary is already available in the pnpm store after `pnpm install` runs, but `pnpm install` doesn't run in the `build-zfb` job. Alternative: use a `actions/cache` step with `~/esbuild-binary` and a version key.

**Summary verdict:** The CI `build-zfb` job WILL make network calls to npm registry and GitHub releases during `cargo build` after the pin bump. On a cache MISS (new SHA or cold runner) this is acceptable behavior; on a cache HIT (same SHA, warm runner) the idempotency guard avoids re-download if the `binaries/` directory is cached. The workflow needs updating to either include `binaries/` in the cargo cache path or add pre-fetch steps for esbuild.

**Files to change:**

- `.github/workflows/pr-checks.yml` — `build-zfb` job: cache path + optional `fetch-tailwind.mjs` cleanup
- `.github/workflows/main-deploy.yml` — same `build-zfb` job

---

### Axis 5: Public-asset copy

**Commits:** a6abbc3 (copy public/ into out_dir), 21d811e (merge)

**Verdict: consumer-change-required**

**What changed:** `zfb build` now natively copies `<project_root>/<cfg.public_dir>` (default `public/`) into `<out_dir>/<base-segment>/` during the build step. This is exactly what `plugins/copy-public-plugin.mjs` does as a `postBuild` workaround.

**Current state in zudo-doc:** `plugins/copy-public-plugin.mjs` is still registered in `zfb.config.ts` (line ~505). After the pin bump, both the native copy AND the plugin copy run. This is idempotent (no data loss, files are overwritten with identical content), but the double-copy is wasteful.

**Important behavioral difference:** The native `copy_public_dir` places files under `<out_dir>/<base-segment>/` (e.g., `dist/pj/zudo-doc/favicon.svg` when `base="/pj/zudo-doc/"`). The plugin's `postBuild` copies flat to `ctx.outDir` (e.g., `dist/favicon.svg`) because it intentionally skips the base prefix (per the plugin's comment: "FLAT, matching zfb's own dist/ convention... The deployed URL prefix is applied uniformly by the deploy pipeline's prepare step"). Empirical build output confirmed `dist/favicon.svg` present (consistent with either path).

**Recommendation:** Remove the plugin registration AFTER verifying that native copy output matches the required deploy layout. Files required:

- `zfb.config.ts` — remove the `copy-public-plugin` entry from `integrationPlugins` (lines ~505-510)
- `plugins/copy-public-plugin.mjs` — can be deleted once confirmed redundant

**Risk note:** The native copy puts files under `dist/<base-segment>/` while the old plugin puts them at `dist/` root. If the deploy pipeline's `prepare` step assumes public files arrive at `dist/` root (and the deploy step adds the base prefix), keeping the plugin until that interaction is confirmed is safe. This behavioral difference should be verified before removing the plugin.

---

### Axis 6: Table emission

**Commits:** 873bd9b (emit MdastNode::Table), 5da0e10 (merge), 4964cd0 (wire through mdast→hast detour)

**Verdict: safe**

**What changed:** GFM pipe-table syntax (`| col | col |`) is now recognized and emitted as `<_components.table><_components.thead>...</_components.thead><_components.tbody>...</_components.tbody></_components.table>`. Per-column `style="text-align: ..."` is applied from the alignment hints.

**Sub-elements emitted:** `table`, `thead`, `tbody`, `tr`, `th`, `td` are all registered in `html_tags` inside the emitter. These get a default fallback of their native HTML tag string in the compiled `_components` map. Only `table` has a consumer override (`ContentTable` in `src/components/content/component-map.ts`). `thead`, `tbody`, `tr`, `th`, `td` fall back to native HTML string elements — correct behavior.

**No consumer change required.** The `ContentTable` wrapper provides the `overflow-x-auto` scroll container and `border-collapse` styling. Sub-element HTML fallbacks are native HTML and will inherit CSS from the table wrapper. If custom `thead`/`th` styling is desired later, those can be added to `htmlOverrides` in `src/components/content/component-map.ts`.

**Important note (4964cd0):** Tables work correctly in the bundler path ONLY because of the follow-up fix in 4964cd0 that wires the `Table` arm through the `mdast→hast` detour used when a Pipeline is active. Without 4964cd0, tables would silently vanish in the bundler. At f68a9ba (HEAD), both fixes are present and tables render correctly — confirmed by the empirical build.

---

### Axis 7: CSS split-import detection

**Commits:** 6a950e1 (fix user_has_import to match split-import patterns), 9e37551 (merge)

**Verdict: safe (bug fix)**

**What changed:** The `user_has_import` predicate in `build_synthesised_entry_css` now matches `@import "tailwindcss/preflight"` and `@import "tailwindcss/utilities"` in addition to `@import "tailwindcss"`. Previously, only the full-bundle import was matched. If neither matched, zfb prepended `@import "tailwindcss";` on top, causing the default Tailwind palette tokens to leak into `@theme` output.

**Impact on zudo-doc:** `src/styles/global.css` uses the split-import pattern exclusively (lines 1-2: `@import "tailwindcss/preflight"; @import "tailwindcss/utilities"`). **This was a live bug.** Before the fix, zfb was prepending `@import "tailwindcss";` onto the zudo-doc CSS, leaking all Tailwind v4 default palette tokens (`--color-*`, `--spacing`, etc.) into the compiled output. The fix stops this prepend correctly.

**No consumer change required.** The fix makes zfb behave correctly for the existing `global.css`.

---

## Empirical build test

**Method:** Ran `pnpm install && pnpm build` in `worktrees/w1a-survey/` with the zfb symlink pointing to the local zfb checkout at f68a9ba (the same SHA as the target pin).

**Result:** 219 pages built in 31.01s. No compile errors, no runtime errors, no missing exports.

**Observations:**

- `dist/favicon.svg` and `dist/img/` present — public dir copied (both native + plugin ran).
- Build succeeded despite the `copy-public-plugin.mjs` double-copy.
- Table rendering: GFM tables in content will now render as HTML tables rather than being dropped.
- Admonitions with `[Custom Title]` syntax will now show titles.

**Caveats:**

- The local binary at f68a9ba was pre-built with all necessary tooling present. The CI scenario with a fresh cargo build was NOT exercised (see Axis 4).
- The empirical build ran with `ZFB_ESBUILD_BIN` set by the postinstall wrapper to the pnpm store esbuild, bypassing the build.rs esbuild download. This means the esbuild download path was NOT tested empirically.

---

## Summary of consumer-change-required findings

| Finding | Files to change |
|---------|----------------|
| Public-asset copy redundant | `zfb.config.ts` (remove copy-public-plugin entry), optionally delete `plugins/copy-public-plugin.mjs` — AFTER verifying deploy layout |
| CI workflow for embedded binaries | `.github/workflows/pr-checks.yml`, `.github/workflows/main-deploy.yml` |

All other axes are safe — no changes to page modules, plugin contracts, or other consumer code.

---

## Self-skepticism note: failure modes this survey did NOT eliminate

1. **Base-prefix layout for public-asset copy not empirically confirmed.** The native `copy_public_dir` places files under `dist/<base-segment>/` (e.g., `dist/pj/zudo-doc/favicon.svg`). The plugin places them at `dist/` root. The deploy pipeline's `prepare` step behavior with this layout was not traced. If the prepare step expects files at `dist/` root and adds the prefix separately, the native copy produces doubled prefix. This requires inspection of the deploy step and comparison with actual CI deploy output.
2. **CI cache behavior for build.rs downloads not tested.** The survey analyzed the build.rs code and CI workflow configuration to conclude `workflow-change-required`, but did NOT run a CI build from a cold runner. The idempotency guard (`binary_already_correct`) was not exercised end-to-end in a real GitHub Actions environment.
3. **TypeScript type gaps for codeHighlight / resolveMarkdownLinks.** The Rust Config gained these fields but `packages/zfb/src/config.ts` was not updated. Consumer TypeScript (`zfb check`) will not catch invalid values in these fields. If the project tries to use `codeHighlight.theme` in `defineConfig`, TypeScript will error because the field is not in `ZfbConfig`. This is an upstream gap, not a consumer breakage, but it means post-bump features cannot be adopted from TypeScript without a TS type patch.
4. **Visual appearance of tables and admonition titles not verified.** The empirical build confirmed the build succeeded and page count matches. Whether the newly-rendered tables and admonition titles appear correctly styled was NOT verified (no browser/visual testing was run per task constraints). The CSS path for `ContentTable` wraps the outer `<table>` correctly, but `th`/`td` styling relies on native browser defaults or global CSS cascade.
5. **Admonitions blank-line diagnostic behavior.** Commit c644eb7 adds a parser-time diagnostic for :::name without a closing ::: — unclear whether existing content violates the blank-line requirement anywhere and would now produce warnings. The build succeeded (219 pages), suggesting no hard errors, but diagnostic warnings may appear in build output.
