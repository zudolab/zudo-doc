#!/bin/bash
# Materialize and link E2E test fixtures (zfb topology).
#
# Each fixture has its own `src/config/settings.ts` and its own
# `src/content/`, but shares the rest of the project tree (pages,
# plugins, src/components, etc.) by copying first-party sources from the repo
# root. Only dependency-resolution directories stay symlinked.
#
# zfb's module-preprocessing graph canonicalizes first-party files and rejects
# symlinks whose targets escape the project root. Materializing pages/ and
# src/* therefore is part of the fixture contract, not just a portability
# choice. `packages/` and `node_modules/` remain links because they represent
# installed/workspace dependency resolution rather than fixture-owned source.
#
# Pre-zfb-cutover this script symlinked `src/{components,layouts,...}`,
# copied `astro.config.ts` + `src/content.config.ts`, and ran `astro build`.
# That topology is gone now — pages are file-routed under `pages/` and the
# engine config lives at the project root as `zfb.config.ts`.
#
# Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2661 / Wave 7
# #2663): the host dropped `zfb-shim.d.ts` (ambient `zfb/config` types now
# ship from `@takazudo/zudo-doc/zfb-config-shim.d.ts`, pulled in transitively
# via `tsconfig.json`'s `extends: "@takazudo/zudo-doc/tsconfig.base.json"`)
# and several `src/config/*.ts` shims that were byte-identical to package
# defaults (`settings-types.ts`, `tag-vocabulary-types.ts`, `color-schemes.ts`,
# `color-scheme-utils.ts`, …) — fixtures' `settings.ts` files now import their
# types straight from `@takazudo/zudo-doc/settings` instead of a local
# `./settings-types`. The host's real chrome bindings (SearchWidget,
# DocHistory, frontmatter renderers, …) moved from the deleted
# `pages/lib/_chrome.ts` into a single root file, `src/chrome-bindings.tsx`,
# wired via the `chromeBindingsModule` setting in the copied `zfb.config.ts` —
# so that one file is now copied per fixture too. Without it,
# `virtual:zudo-doc-chrome-bindings` still resolves (the routes plugin
# registers it unconditionally, defaulting to `export const chromeBindings =
# {};`), so a fixture would still BUILD, but host-bound slots with no package
# default (DocHistory) would silently render as no-ops — the smoke fixture's
# doc-history specs need the real binding.
#
# Topology emitted per fixture:
#
#   <fixture>/
#     zfb.config.ts          (copied — relative `./src/config/settings`
#                             import + the `chromeBindingsModule` setting)
#     tsconfig.json          (copied — `@/*` path; extends the package's
#                             `tsconfig.base.json`, which ships the ambient
#                             `zfb/config` + virtual-module shims)
#     pages/                 (copied from root)
#     plugins/               (copied from root, when present)
#     packages/              → ../../../packages
#     node_modules/          → ../../../node_modules
#     public/                (mixed: fixture-specific files plus COPIED
#                             top-level entries from root public/ — copied, not
#                             symlinked, because native publicDir #2358 does not
#                             follow symlinks)
#     .zfb/doc-history-meta.json   (always-empty — preBuild contract)
#     src/
#       chrome-bindings.tsx  (copied — the `chromeBindingsModule` target;
#                             relative imports of `../pages/lib/*` resolve
#                             against the fixture's own copied `pages/`)
#       config/
#         settings.ts        (fixture-specific, kept in git; types import
#                             from `@takazudo/zudo-doc/settings` directly)
#         tag-vocabulary.ts        (copied from root — the rest of
#         i18n.ts                   src/config/*.ts | *.tsx except
#         sidebars.ts               settings.ts; auto-overwrite keeps
#         contrast-utils.ts         drift in check)
#         frontmatter-preview-renderers.tsx
#       content/             (fixture-specific, kept in git)
#       components/          (copied from root)
#       lib/                 (copied from root)
#       styles/              (copied from root)
#       types/               (copied from root)
#       utils/               (copied from root)
#
# Build invocation (per fixture, end of this script):
#
#   SKIP_DOC_HISTORY=1 zfb build
#
# `SKIP_DOC_HISTORY=1` keeps the bootstrap independent of the host's
# git state. The smoke fixture needs real history for doc-history specs
# and gets its own per-fixture init() repo + a fixture-local build pass
# with `GEN_DOC_HISTORY=1` (postBuild JSON is opt-in for local builds, #1986).
#
# Fast path — E2E_FIXTURES env var:
#   E2E_FIXTURES=smoke ./e2e/setup-fixtures.sh  — set up and build only the
#   smoke fixture. Combine with the same var in playwright.config.ts to boot
#   only that fixture's webServer (zero stagger, one port). Default (unset)
#   keeps all 5.
#
# Skip-rebuild-when-fresh:
#   Each fixture stores a hash marker at <fixture>/.build-marker.sha256
#   covering all build inputs (fixture src/content + src/config, shared
#   inputs: pages/, plugins/, src/ dirs, packages/zudo-doc sources,
#   pnpm-lock.yaml, zfb.config.ts, and this script). When the hash matches
#   the marker on disk the build is skipped. E2E_FORCE_REBUILD=1 bypasses.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ALL_FIXTURES=(sidebar i18n theme smoke versioning)

# ---------------------------------------------------------------------------
# Resolve which fixtures to operate on (E2E_FIXTURES scoping).
# ---------------------------------------------------------------------------
# E2E_FIXTURES=smoke,i18n  — operate on those fixtures only.
# Default (unset or empty)  — operate on all 5.
if [ -n "${E2E_FIXTURES:-}" ]; then
  IFS=',' read -ra REQUESTED <<< "$E2E_FIXTURES"
  FIXTURES=()
  for req in "${REQUESTED[@]}"; do
    req="${req// /}"  # trim spaces
    for known in "${ALL_FIXTURES[@]}"; do
      if [ "$req" = "$known" ]; then
        FIXTURES+=("$req")
        break
      fi
    done
  done
  if [ "${#FIXTURES[@]}" -eq 0 ]; then
    echo "Warning: E2E_FIXTURES='${E2E_FIXTURES}' matched no known fixtures; falling back to all." >&2
    FIXTURES=("${ALL_FIXTURES[@]}")
  fi
else
  FIXTURES=("${ALL_FIXTURES[@]}")
fi

# Source dirs under repo-root `src/` that fixtures consume verbatim.
# `config` is intentionally NOT here — fixtures supply their own
# `settings.ts`; the rest of `src/config/` is copied below.
#
# Minimal-scaffold cutover (#2663): `hooks`, `mocks`, `plugins`, `scripts`
# were dropped — the host's `src/` no longer has those subdirectories (their
# former contents are either package-owned now or never existed post-#2661).
SRC_SHARED_DIRS=(
  components
  lib
  styles
  types
  utils
)

# Project-root files copied (not symlinked) into each fixture so their
# relative imports resolve from the fixture directory. `zfb-shim.d.ts` was
# dropped in #2661 — the ambient `zfb/config` types now ship from
# `@takazudo/zudo-doc/zfb-config-shim.d.ts`, pulled in transitively via
# tsconfig.json's `extends`.
ROOT_COPIED_FILES=(
  zfb.config.ts
  tsconfig.json
)

# Single files under repo-root `src/` copied (not symlinked, and not part of
# a SRC_SHARED_DIRS directory) because they have relative imports that must
# resolve from the fixture directory. `chrome-bindings.tsx` is the
# `chromeBindingsModule` target zfb.config.ts points at (#2663) — its
# `../pages/lib/*` imports resolve against the fixture's own copied
# `pages/`, and its `@/config/*` / `@/utils/*` imports resolve against the
# fixture's own settings + the shared dirs above.
SRC_SINGLE_FILES=(
  chrome-bindings.tsx
)

# Project-root first-party directories copied into each fixture. zfb's
# module-worker/preprocessing containment checks intentionally reject these
# graphs when they resolve through a symlink outside the fixture root.
ROOT_COPIED_DIRS=(
  pages
  plugins
)

# Project-root dependency directories symlinked at fixture root.
ROOT_SYMLINKED_DIRS=(
  packages
  node_modules
)

# ---------------------------------------------------------------------------
# Hash helper — computes a build-input hash for a given fixture.
# ---------------------------------------------------------------------------
# Covers everything the build actually consumes:
#   1. Fixture-specific inputs: src/content/ + src/config/
#   2. Shared inputs consumed via symlink/copy:
#      pages/, plugins/, src/{components,hooks,...}, packages/zudo-doc/
#   3. Root config files copied into fixture: zfb.config.ts, tsconfig.json, etc.
#   4. Lock file (pins zfb version): pnpm-lock.yaml
#   5. This script itself (structural change → rebuild needed)
#
# Strategy: use `git ls-files -s` for tracked paths (fast, content-addressed)
# and fall back to checksumming untracked files via find+shasum. This handles
# both clean checkouts (all tracked) and working-tree edits (untracked
# fixture content changes invalidate the marker correctly).
#
# Conservative default: if git or shasum is unavailable, return empty string
# so the marker never matches and we always rebuild.
compute_build_hash() {
  local fixture="$1"
  local fixture_dir="$REPO_ROOT/e2e/fixtures/$fixture"

  # Require shasum (macOS / Linux coreutils both ship it).
  if ! command -v shasum >/dev/null 2>&1; then
    echo ""
    return
  fi

  {
    # --- Fixture-specific inputs (content + per-fixture config) ---
    # Use find+shasum to capture actual file contents including untracked
    # edits, so local content changes always invalidate the marker.
    if [ -d "$fixture_dir/src/content" ]; then
      find "$fixture_dir/src/content" -type f | sort | xargs shasum 2>/dev/null || true
    fi
    if [ -d "$fixture_dir/src/config" ]; then
      # Only the committed settings.ts — copied configs are covered by the
      # shared inputs below.
      if [ -f "$fixture_dir/src/config/settings.ts" ]; then
        shasum "$fixture_dir/src/config/settings.ts" 2>/dev/null || true
      fi
    fi

    # --- Shared inputs (git-tracked file LIST, working-tree CONTENT) ---
    # pages/, plugins/, src/{components,lib,...}, packages/zudo-doc/
    #
    # `git ls-files` gives the tracked path list (respecting .gitignore, so
    # build output / nested node_modules never enter the hash); piping those
    # paths to `shasum` hashes their CURRENT WORKING-TREE bytes. This is
    # deliberately NOT `git ls-files -s` — the `-s` form hashes the *index*
    # blob, so an unstaged edit to a shared source (e.g. packages/zudo-doc/src
    # or pages/) would leave the hash unchanged and let a stale dist/ slip
    # through. A deleted tracked file makes shasum error → different hash →
    # rebuild (conservative, correct).
    (
      cd "$REPO_ROOT"
      git ls-files -z -- \
        pages/ \
        plugins/ \
        src/components/ \
        src/lib/ \
        src/styles/ \
        src/types/ \
        src/utils/ \
        src/config/ \
        src/chrome-bindings.tsx \
        packages/zudo-doc/ \
        pnpm-lock.yaml \
        zfb.config.ts \
        tsconfig.json \
        2>/dev/null | sort -z | xargs -0 shasum 2>/dev/null || true
    )

    # --- This script itself (structural change → rebuild) ---
    shasum "$REPO_ROOT/e2e/setup-fixtures.sh" 2>/dev/null || true

  } | shasum | awk '{print $1}'
}

# ---------------------------------------------------------------------------
# Check if a fixture's build is still fresh.
# Returns 0 (true) if fresh (skip build), 1 (false) if stale (must build).
# ---------------------------------------------------------------------------
is_build_fresh() {
  local fixture="$1"
  local fixture_dir="$REPO_ROOT/e2e/fixtures/$fixture"
  local marker="$fixture_dir/.build-marker.sha256"

  # E2E_FORCE_REBUILD=1 bypasses the freshness check unconditionally.
  if [ "${E2E_FORCE_REBUILD:-0}" = "1" ]; then
    return 1
  fi

  # dist/ must exist — if the build never ran or was cleaned, rebuild.
  if [ ! -d "$fixture_dir/dist" ]; then
    return 1
  fi

  # Marker must exist and be non-empty.
  if [ ! -s "$marker" ]; then
    return 1
  fi

  local current_hash
  current_hash="$(compute_build_hash "$fixture")"

  # If hash computation failed (empty string), conservatively rebuild.
  if [ -z "$current_hash" ]; then
    return 1
  fi

  local stored_hash
  stored_hash="$(cat "$marker")"

  [ "$current_hash" = "$stored_hash" ]
}

# ---------------------------------------------------------------------------
# Write the build marker for a fixture (call after a successful build).
# ---------------------------------------------------------------------------
write_build_marker() {
  local fixture="$1"
  local fixture_dir="$REPO_ROOT/e2e/fixtures/$fixture"
  local marker="$fixture_dir/.build-marker.sha256"

  local hash
  hash="$(compute_build_hash "$fixture")"
  if [ -n "$hash" ]; then
    printf '%s\n' "$hash" > "$marker"
  fi
}

setup_fixture() {
  local fixture="$1"
  local fixture_dir="$REPO_ROOT/e2e/fixtures/$fixture"

  echo "Setting up fixture: $fixture"

  mkdir -p "$fixture_dir/src/config"

  # ----- Copy shared first-party src/* dirs (everything but config + content) -----
  for dir in "${SRC_SHARED_DIRS[@]}"; do
    local source="$REPO_ROOT/src/$dir"
    # Mirror source removal as well as source contents. Checking the source
    # before deleting the destination would leave a live, stale copy behind
    # when a shared directory is retired upstream; that stale tree is no
    # longer represented in compute_build_hash() and could become "fresh".
    rm -rf "$fixture_dir/src/$dir"
    if [ ! -e "$source" ]; then
      continue
    fi
    cp -RL "$source" "$fixture_dir/src/$dir"
  done

  # ----- Prune stale gitignored copies of files retired from src/config/ -----
  # The copy loop below only copies files that currently exist under
  # src/config/ — it never deletes a fixture-side copy left over from a
  # previous run once the source file is gone. `design-token-panel-config.ts`
  # and `design-tokens-manifest.ts` were retired from src/config/ in #2682
  # (the showcase now consumes the package-default DTP config directly); a
  # fixture set up before that change keeps stale copies around otherwise,
  # since `e2e/fixtures/*/src/config/*` is gitignored.
  rm -f "$fixture_dir/src/config/design-token-panel-config.ts" \
    "$fixture_dir/src/config/design-tokens-manifest.ts"

  # ----- Copy src/config/* (except settings.ts) -----
  # Each fixture provides its own settings.ts; the rest of src/config/
  # is copied so relative imports inside i18n.ts / sidebars.ts / etc.
  # resolve against the fixture's settings.ts (which differs from
  # the repo-root one).
  for file in "$REPO_ROOT"/src/config/*.ts "$REPO_ROOT"/src/config/*.tsx; do
    [ -e "$file" ] || continue
    local basename
    basename="$(basename "$file")"
    if [ "$basename" = "settings.ts" ]; then
      continue
    fi
    cp -f "$file" "$fixture_dir/src/config/$basename"
  done

  # ----- Copy single src/ files (SRC_SINGLE_FILES) -----
  # chrome-bindings.tsx is the `chromeBindingsModule` target — copied (not
  # symlinked) alongside the config files above, same relative-import
  # reasoning.
  for file in "${SRC_SINGLE_FILES[@]}"; do
    [ -e "$REPO_ROOT/src/$file" ] || continue
    cp -f "$REPO_ROOT/src/$file" "$fixture_dir/src/$file"
  done

  # ----- Copy zfb.config.ts / tsconfig.json -----
  # zfb.config.ts has `import { settings } from "./src/config/settings"` (plus
  # the `chromeBindingsModule: "./src/chrome-bindings.tsx"` setting),
  # tsconfig.json has `"paths": { "@/*": ["src/*"] }` — both must resolve
  # from the fixture root.
  for file in "${ROOT_COPIED_FILES[@]}"; do
    [ -e "$REPO_ROOT/$file" ] || continue
    cp -f "$REPO_ROOT/$file" "$fixture_dir/$file"
  done

  # ----- Copy top-level first-party dirs (pages/, plugins/) -----
  for dir in "${ROOT_COPIED_DIRS[@]}"; do
    rm -rf "$fixture_dir/$dir"
    # `plugins/` is optional. Removing the fixture destination first keeps
    # repeated setup runs a true mirror if that optional source disappears.
    [ -e "$REPO_ROOT/$dir" ] || continue
    cp -RL "$REPO_ROOT/$dir" "$fixture_dir/$dir"
  done

  # The theme fixture intentionally exercises the package-owned docs route.
  # This lets fixture-local colorSchemes travel through the preset's virtual
  # route context instead of the showcase's legacy user-route context, which
  # is intentionally pinned to the package defaults.
  if [ "$fixture" = "theme" ]; then
    rm -rf "$fixture_dir/pages/docs"
  fi

  # ----- Symlink dependency dirs (packages/, node_modules/) -----
  for dir in "${ROOT_SYMLINKED_DIRS[@]}"; do
    [ -e "$REPO_ROOT/$dir" ] || continue
    rm -rf "$fixture_dir/$dir"
    ln -sfn "$REPO_ROOT/$dir" "$fixture_dir/$dir"
  done

  # ----- Public dir: merge fixture-specific files with root public/ -----
  # Fixture-specific files (e.g. smoke/public/test-images/) are kept in
  # git; on top of that we materialise each top-level entry from the root
  # `public/` so /img/logo.svg, the favicons, etc. resolve in the fixture build.
  #
  # These are COPIED (dereferencing symlinks via `cp -RL`), NOT symlinked:
  # zfb's native `publicDir` — which replaced the old copy-public-plugin in
  # #2358 — does NOT follow symlinks when copying `public/` → `dist/`, so a
  # symlinked favicon/img would silently never reach `dist/` and 404 at
  # runtime (the old plugin's recursive copy followed symlinks; native
  # publicDir does not). Real generated projects ship real files here, so this
  # only affects the symlink-sharing fixture topology.
  if [ -d "$REPO_ROOT/public" ]; then
    mkdir -p "$fixture_dir/public"
    for entry in "$REPO_ROOT"/public/*; do
      [ -e "$entry" ] || continue
      local entry_name
      entry_name="$(basename "$entry")"
      # Don't clobber a fixture-owned real entry of the same name (git-tracked).
      # A leftover symlink from the old symlink-based setup IS replaced.
      if [ -e "$fixture_dir/public/$entry_name" ] && [ ! -L "$fixture_dir/public/$entry_name" ]; then
        continue
      fi
      rm -rf "$fixture_dir/public/$entry_name"
      cp -RL "$entry" "$fixture_dir/public/$entry_name"
    done
  fi

  # ----- .zfb/doc-history-meta.json — required by the bundler -----
  # `pages/lib/_doc-history-area.tsx` and `_doc-metainfo-area.tsx`
  # statically import "#doc-history-meta", aliased via tsconfig.json
  # to .zfb/doc-history-meta.json. The doc-history plugin's preBuild
  # hook regenerates this file (or short-circuits to {} when
  # SKIP_DOC_HISTORY=1) — but esbuild needs the file to exist before
  # the bundle step starts. Seed it as `{}` so the very first build
  # has something to resolve against.
  mkdir -p "$fixture_dir/.zfb"
  if [ ! -f "$fixture_dir/.zfb/doc-history-meta.json" ]; then
    printf '{}\n' > "$fixture_dir/.zfb/doc-history-meta.json"
  fi

  # ----- package.json — required by zfb's adapter dispatch -----
  # zfb's cloudflare-adapter dispatch (zfb-build/src/adapter.rs) shells
  # out to `pnpm exec zfb-adapter-cloudflare bundle ...` from the project
  # root. pnpm refuses to exec without a package.json in the cwd
  # (ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE), so seed a minimal manifest
  # marking the fixture as a private, non-workspace package. The fixture
  # already inherits node_modules/ as a symlink to the root, so this
  # manifest is purely a pnpm-exec gate, not a real package.
  if [ ! -f "$fixture_dir/package.json" ]; then
    cat > "$fixture_dir/package.json" <<EOF
{
  "name": "zudo-doc-e2e-${fixture}-fixture",
  "private": true,
  "version": "0.0.0"
}
EOF
  fi

  # ----- wrangler.toml — fixture-local Workers config for `zfb preview` -----
  # When a fixture build emits dist/_worker.js, `zfb preview` runs in "adapter
  # mode" and hands off to `wrangler dev` (Workers — zfb >= 0.1.0-next.74;
  # earlier zfb ran `wrangler pages dev`, which is why this used to emit a
  # Pages-style config with pages_build_output_dir; wrangler rejects that
  # combination with "you've run a Workers-specific command in a Pages
  # project"). wrangler searches upward for the nearest wrangler.toml; without
  # a fixture-local one it climbs to the repo root, whose `main` / `[assets]`
  # paths resolve against the repo root instead of this fixture. A minimal
  # local Workers static-assets config (mirroring the root shape from
  # migration #1691) shadows the root so each fixture previews self-contained.
  #
  # [dev].inspector_port = 0 — give each concurrent fixture preview a RANDOM
  # free workerd inspector port. `wrangler dev` opens a devtools inspector
  # socket per instance; booting all five fixtures concurrently races the
  # same inspector port and the losers die with "Address already in use
  # (127.0.0.1:92xx)" (#2084 — the 3s playwright stagger alone is not
  # reliable under `wrangler dev`; reproduced 1-in-2 concurrent boots).
  cat > "$fixture_dir/wrangler.toml" <<EOF
# Generated by e2e/setup-fixtures.sh — fixture-local Workers static-assets
# config so \`zfb preview\` (adapter mode -> wrangler dev) resolves THIS
# fixture instead of climbing to the repo-root wrangler.toml.
name = "zudo-doc-e2e-${fixture}-fixture"
main = "./dist/_worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "404-page"
run_worker_first = false

# Random free workerd inspector port per instance — avoids the concurrent-boot
# inspector-port bind race under \`wrangler dev\` (#2084).
[dev]
inspector_port = 0
EOF

  echo "  Done: $fixture"
}

for fixture in "${FIXTURES[@]}"; do
  setup_fixture "$fixture"
done

echo "All fixtures set up."

# ---------------------------------------------------------------------------
# Smoke fixture: per-fixture git repo for doc-history specs.
# ---------------------------------------------------------------------------
# The doc-history integration walks the *fixture* directory's git history
# (not the repo root's) so we need a self-contained two-commit repo here.
# This mirrors the legacy harness — only the build invocation downstream
# changed.
#
# Run even if smoke wasn't in FIXTURES? No — only when smoke is targeted,
# otherwise we leave the existing smoke git repo intact (the freshness check
# below will skip rebuilding if inputs are unchanged anyway).
#
# Outer-tree hygiene (#2104): synthesizing commit #2 requires mutating the
# OUTER-tracked seed file on disk (`--allow-empty` won't do — it leaves the
# file untouched, so `git log --follow` yields 1 entry, not the 2 the
# doc-history data specs assert on). To keep the outer working tree clean
# between runs we register an EXIT finalizer (restore_smoke_seed) that
# `git checkout HEAD`s the file back. The finalizer runs on success,
# fresh-skip (the build below is bypassed), AND failure — because the
# freshness hash covers `src/content` bytes, a restore wired only into the
# build-executed path would leave the tree dirty on the common fresh-skip run.
smoke_targeted=0
for fixture in "${FIXTURES[@]}"; do
  if [ "$fixture" = "smoke" ]; then
    smoke_targeted=1
    break
  fi
done

smoke_history_outer_path="e2e/fixtures/smoke/src/content/docs/getting-started/index.mdx"

# EXIT finalizer: restore the outer-tracked seed file to HEAD so a `pnpm
# test:e2e` / `bash e2e/setup-fixtures.sh smoke` run never leaves the outer
# working tree dirty for this file. By the time this fires the smoke build has
# already consumed the on-disk "Updated for history test." content into dist/
# (or the build was skipped as fresh, in which case dist/ already has it), so
# discarding the on-disk mutation here is safe.
#
# NOTE: this restores ONLY the OUTER repo's working-tree copy of the file. The
# nested fixture repo at e2e/fixtures/smoke/.git is intentionally left dirty vs
# its own HEAD (its commit #2 captured the mutated bytes) — that is fine for
# `git log` / `git cat-file --follow` history walks and for the already-built
# dist/, and is the whole point of seeding a 2-commit history.
restore_smoke_seed() {
  [ "$smoke_targeted" = "1" ] || return 0
  (
    cd "$REPO_ROOT"
    if git ls-files --error-unmatch "$smoke_history_outer_path" >/dev/null 2>&1; then
      git checkout HEAD -- "$smoke_history_outer_path" 2>/dev/null || true
    fi
  )
}
trap restore_smoke_seed EXIT

if [ "$smoke_targeted" = "1" ]; then
  echo ""
  echo "Setting up git repo for smoke fixture (doc history)..."
  smoke_dir="$REPO_ROOT/e2e/fixtures/smoke"
  smoke_history_target="src/content/docs/getting-started/index.mdx"

  # Reset the seed file to its repo-committed state every run so the
  # "Updated for history test." block doesn't accumulate across re-bootstraps.
  # (The previous .git was a *fixture-local* repo seeded by the last run, so we
  # reach back to the *outer* repo for the canonical contents.)
  rm -rf "$smoke_dir/.git"
  (
    cd "$REPO_ROOT"
    if git ls-files --error-unmatch "$smoke_history_outer_path" >/dev/null 2>&1; then
      git checkout HEAD -- "$smoke_history_outer_path"
    fi
  )
  (
    cd "$smoke_dir"
    git init -q
    git add src/content/
    git -c user.email="test@example.com" -c user.name="Test" commit -q -m "Initial content"
    echo "" >> "$smoke_history_target"
    echo "Updated for history test." >> "$smoke_history_target"
    git add -A
    git -c user.email="test@example.com" -c user.name="Test" commit -q -m "Update getting started content"
  )
  echo "  Done: smoke git repo"
fi

# ---------------------------------------------------------------------------
# Pre-build all targeted fixtures sequentially (with freshness skip).
# ---------------------------------------------------------------------------
# Playwright's webServer entries only run `zfb preview` per fixture; the
# actual `zfb build` happens once here so we surface bundler errors at
# bootstrap time instead of inside the test runner. Sequential keeps the
# log readable and avoids any future races between concurrent zfb builds
# that share the same package dependency graph.
#
# Skip-rebuild-when-fresh: each fixture tracks a hash of its build inputs
# in <fixture>/.build-marker.sha256. When the hash matches the stored
# marker and dist/ exists, the build is skipped. E2E_FORCE_REBUILD=1
# bypasses this check unconditionally.
#
# SKIP_DOC_HISTORY=1 keeps the build independent of the host's git state
# for non-smoke fixtures. The smoke fixture instead builds with
# GEN_DOC_HISTORY=1 (postBuild JSON is opt-in for local builds, #1986) so its
# per-fixture two-commit repo (above) actually drives history output.
echo ""
echo "Pre-building fixtures sequentially..."
for fixture in "${FIXTURES[@]}"; do
  if is_build_fresh "$fixture"; then
    echo "  Skipping (fresh): $fixture"
    continue
  fi
  echo "  Building: $fixture"
  if [ "$fixture" = "smoke" ]; then
    # GEN_DOC_HISTORY=1: the doc-history postBuild per-page JSON is opt-in for
    # local builds (#1986), so the smoke fixture must request it explicitly —
    # its doc-history specs read those JSON manifests from dist/.
    #
    # INIT_CWD pin (#2106 — the real CI empty-data root cause): the postBuild
    # spawns `doc-history-generate` with a RELATIVE `--content-dir src/content/docs`,
    # which @takazudo/zudo-doc-history-server's resolveContentPath() resolves
    # against INIT_CWD (the pnpm --filter dev:history / CI build-history contract).
    # Under `pnpm test:e2e:ci`, pnpm sets INIT_CWD=<repo-root>, so the generate
    # scans the OUTER repo's src/content/docs (136 files) instead of THIS fixture's
    # (12). The git walk roots at the nested smoke .git (cwd), so the outer paths
    # become ../../../src/content/docs/... — outside the nested repo — and
    # `git log --follow` returns 0 entries, shipping an empty getting-started.json.
    # The smoke fixture build's true project root IS the fixture dir, so pin
    # INIT_CWD to it: content-dir then resolves to the fixture's own content and
    # the two-commit history is generated correctly. (The previously-attempted
    # safe.directory fix targeted a different, simulated mechanism and was
    # disproven by CI; this is the confirmed cause.)
    (cd "$REPO_ROOT/e2e/fixtures/$fixture" && INIT_CWD="$REPO_ROOT/e2e/fixtures/$fixture" GEN_DOC_HISTORY=1 "$REPO_ROOT/node_modules/.bin/zfb" build 2>&1) || {
      echo "  FAILED: $fixture build failed" >&2
      exit 1
    }
  else
    (cd "$REPO_ROOT/e2e/fixtures/$fixture" && SKIP_DOC_HISTORY=1 "$REPO_ROOT/node_modules/.bin/zfb" build 2>&1) || {
      echo "  FAILED: $fixture build failed" >&2
      exit 1
    }
  fi
  write_build_marker "$fixture"
  echo "  Built: $fixture"
done
echo "All fixtures built."
