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
# and gets its own per-fixture init() repo + a second fixture-local
# build pass *with* doc-history enabled.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES=(sidebar i18n theme smoke versioning)

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
  if git ls-files --error-unmatch "e2e/fixtures/smoke/$smoke_history_target" >/dev/null 2>&1; then
    git checkout HEAD -- "e2e/fixtures/smoke/$smoke_history_target"
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

# ---------------------------------------------------------------------------
# Pre-build all fixtures sequentially.
# ---------------------------------------------------------------------------
# Playwright's webServer entries only run `zfb preview` per fixture; the
# actual `zfb build` happens once here so we surface bundler errors at
# bootstrap time instead of inside the test runner. Sequential keeps the
# log readable and avoids any future races between concurrent zfb builds
# that share the symlinked `pages/` tree.
#
# SKIP_DOC_HISTORY=1 keeps the build independent of the host's git state
# for non-smoke fixtures. The smoke fixture overrides this so its
# per-fixture two-commit repo (above) actually drives history output.
echo ""
echo "Pre-building fixtures sequentially..."
for fixture in "${FIXTURES[@]}"; do
  echo "  Building: $fixture"
  if [ "$fixture" = "smoke" ]; then
    (cd "$REPO_ROOT/e2e/fixtures/$fixture" && "$REPO_ROOT/node_modules/.bin/zfb" build 2>&1) || {
      echo "  FAILED: $fixture build failed" >&2
      exit 1
    }
  else
    (cd "$REPO_ROOT/e2e/fixtures/$fixture" && SKIP_DOC_HISTORY=1 "$REPO_ROOT/node_modules/.bin/zfb" build 2>&1) || {
      echo "  FAILED: $fixture build failed" >&2
      exit 1
    }
  fi
  echo "  Built: $fixture"
done
echo "All fixtures built."
