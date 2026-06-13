#!/bin/bash
# Setup symlinks and copies for E2E test fixtures (zfb topology).
#
# Each fixture has its own `src/config/settings.ts` and its own
# `src/content/`, but shares the rest of the project tree (pages,
# plugins, src/components, etc.) via symlinks back to the repo root.
#
# Files that contain relative imports (zfb.config.ts → "./src/config/...",
# tsconfig.json → "src/*", "#doc-history-meta") are *copied* so their
# imports resolve from the fixture directory; everything else is symlinked.
#
# Pre-zfb-cutover this script symlinked `src/{components,layouts,...}`,
# copied `astro.config.ts` + `src/content.config.ts`, and ran `astro build`.
# That topology is gone now — pages are file-routed under `pages/` and the
# engine config lives at the project root as `zfb.config.ts`.
#
# Topology emitted per fixture:
#
#   <fixture>/
#     zfb.config.ts          (copied — relative `./src/config/settings`)
#     zfb-shim.d.ts          (copied — same reason)
#     tsconfig.json          (copied — `@/*` + `#doc-history-meta` paths)
#     pages/                 → ../../../pages
#     plugins/               → ../../../plugins
#     packages/              → ../../../packages
#     node_modules/          → ../../../node_modules
#     public/                (mixed: fixture-specific files plus
#                             symlinked top-level entries from root public/)
#     .zfb/doc-history-meta.json   (always-empty — preBuild contract)
#     src/
#       config/
#         settings.ts        (fixture-specific, kept in git)
#         tag-vocabulary.ts        (copied from root — was committed
#         tag-vocabulary-types.ts   per-fixture historically; auto-overwrite
#         settings-types.ts         keeps drift in check)
#         color-schemes.ts          (and any other src/config/*.ts | *.tsx
#         color-scheme-utils.ts     except settings.ts)
#         frontmatter-preview-*
#         i18n.ts
#         sidebars.ts
#       content/             (fixture-specific, kept in git)
#       components/          → ../../../../src/components
#       hooks/               → ../../../../src/hooks
#       lib/                 → ../../../../src/lib
#       mocks/               → ../../../../src/mocks
#       plugins/             → ../../../../src/plugins
#       scripts/             → ../../../../src/scripts
#       styles/              → ../../../../src/styles
#       types/               → ../../../../src/types
#       utils/               → ../../../../src/utils
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
SRC_SHARED_DIRS=(
  components
  hooks
  lib
  mocks
  plugins
  scripts
  styles
  types
  utils
)

# Project-root files copied (not symlinked) into each fixture so their
# relative imports resolve from the fixture directory.
ROOT_COPIED_FILES=(
  zfb.config.ts
  zfb-shim.d.ts
  tsconfig.json
)

# Project-root directories symlinked at fixture root.
ROOT_SYMLINKED_DIRS=(
  pages
  plugins
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
    # pages/, plugins/, src/{components,hooks,...}, packages/zudo-doc/
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
        src/hooks/ \
        src/lib/ \
        src/mocks/ \
        src/plugins/ \
        src/scripts/ \
        src/styles/ \
        src/types/ \
        src/utils/ \
        src/config/ \
        packages/zudo-doc/ \
        pnpm-lock.yaml \
        zfb.config.ts \
        zfb-shim.d.ts \
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

  # ----- Symlink shared src/* dirs (everything but config + content) -----
  for dir in "${SRC_SHARED_DIRS[@]}"; do
    local source="$REPO_ROOT/src/$dir"
    if [ ! -e "$source" ]; then
      continue
    fi
    rm -rf "$fixture_dir/src/$dir"
    ln -sfn "$source" "$fixture_dir/src/$dir"
  done

  # ----- Copy src/config/* (except settings.ts) -----
  # Each fixture provides its own settings.ts; the rest of src/config/
  # is copied so relative imports inside i18n.ts / color-schemes.ts /
  # etc. resolve against the fixture's settings.ts (which differs from
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

  # ----- Copy zfb.config.ts / zfb-shim.d.ts / tsconfig.json -----
  # zfb.config.ts has `import { settings } from "./src/config/settings"`,
  # tsconfig.json has `"paths": { "@/*": ["src/*"], "#doc-history-meta": [...] }`,
  # both must resolve from the fixture root.
  for file in "${ROOT_COPIED_FILES[@]}"; do
    [ -e "$REPO_ROOT/$file" ] || continue
    cp -f "$REPO_ROOT/$file" "$fixture_dir/$file"
  done

  # ----- Symlink top-level dirs (pages/, plugins/, packages/, node_modules/) -----
  for dir in "${ROOT_SYMLINKED_DIRS[@]}"; do
    [ -e "$REPO_ROOT/$dir" ] || continue
    rm -rf "$fixture_dir/$dir"
    ln -sfn "$REPO_ROOT/$dir" "$fixture_dir/$dir"
  done

  # ----- Public dir: merge fixture-specific files with root public/ -----
  # Fixture-specific files (e.g. smoke/public/test-images/) are kept in
  # git; on top of that we symlink each top-level entry from the root
  # `public/` so /img/logo.svg etc. resolve in the fixture build.
  if [ -d "$REPO_ROOT/public" ]; then
    mkdir -p "$fixture_dir/public"
    for entry in "$REPO_ROOT"/public/*; do
      [ -e "$entry" ] || continue
      local entry_name
      entry_name="$(basename "$entry")"
      # Don't clobber a fixture-owned entry of the same name.
      if [ -e "$fixture_dir/public/$entry_name" ] && [ ! -L "$fixture_dir/public/$entry_name" ]; then
        continue
      fi
      ln -sfn "$entry" "$fixture_dir/public/$entry_name"
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

  # ----- wrangler.toml — fixture-local Pages config for `zfb preview` -----
  # When a fixture build emits dist/_worker.js, `zfb preview` runs in "adapter
  # mode" and hands off to `wrangler pages dev`, which searches upward for the
  # nearest wrangler.toml. Without a fixture-local one it climbs to the repo
  # root — now a Cloudflare *Workers* static-assets config (migration #1691:
  # `main`, `[assets]`, `preview_urls`). `pages dev` rejects those fields and
  # aborts ("Unexpected fields found in assets field: preview_urls" + a bogus
  # repo-root assets.directory). A minimal local Pages config shadows the root
  # so each fixture previews self-contained.
  cat > "$fixture_dir/wrangler.toml" <<EOF
# Generated by e2e/setup-fixtures.sh — fixture-local Pages config so
# \`zfb preview\` (adapter mode -> wrangler pages dev) resolves THIS fixture
# instead of climbing to the repo-root Workers-assets wrangler.toml.
name = "zudo-doc-e2e-${fixture}-fixture"
pages_build_output_dir = "dist"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]
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
# that share the symlinked `pages/` tree.
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
