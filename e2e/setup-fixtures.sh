#!/bin/bash
# Setup symlinks and copies for E2E test fixtures.
# Each fixture has its own content and settings but shares framework source
# from the repo root via symlinks. Config files that contain relative imports
# (astro.config.ts, content.config.ts) are copied instead of symlinked so
# their imports resolve from the fixture directory.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

setup_fixture() {
  local fixture="$1"
  local fixture_dir="$REPO_ROOT/e2e/fixtures/$fixture"

  echo "Setting up fixture: $fixture"

  # Ensure src directory exists
  mkdir -p "$fixture_dir/src"

  # Symlink framework source directories (no relative imports to config)
  for dir in components hooks integrations layouts plugins styles types utils; do
    ln -sfn "$REPO_ROOT/src/$dir" "$fixture_dir/src/$dir"
  done

  # Pages directory: i18n fixture needs DE routes (not in repo root),
  # so we symlink individual subdirs and copy DE pages from fixture template.
  # Other fixtures just symlink the whole directory.
  if [ "$fixture" = "i18n" ]; then
    rm -rf "$fixture_dir/src/pages"
    mkdir -p "$fixture_dir/src/pages"
    for subdir in "$REPO_ROOT"/src/pages/*/; do
      local dirname
      dirname="$(basename "$subdir")"
      if [ "$dirname" != "api" ]; then
        ln -sfn "$subdir" "$fixture_dir/src/pages/$dirname"
      fi
    done
    # Symlink top-level page files (404.astro, index.astro)
    for file in "$REPO_ROOT"/src/pages/*.astro; do
      ln -sfn "$file" "$fixture_dir/src/pages/$(basename "$file")"
    done
    # Copy DE route pages from fixture template
    if [ -d "$fixture_dir/_pages-de" ]; then
      cp -r "$fixture_dir/_pages-de/." "$fixture_dir/src/pages/de"
    fi
  else
    # Symlink pages directory, but exclude api/ (which requires adapter)
    rm -rf "$fixture_dir/src/pages"
    mkdir -p "$fixture_dir/src/pages"
    for item in "$REPO_ROOT"/src/pages/*; do
      local itemname
      itemname="$(basename "$item")"
      if [ "$itemname" != "api" ]; then
        ln -sfn "$item" "$fixture_dir/src/pages/$itemname"
      fi
    done
  fi

  # Copy config files that have relative imports (import { settings } from "./settings")
  # — symlinking would resolve to the repo root's settings, breaking fixture isolation
  for file in "$REPO_ROOT"/src/config/*.ts; do
    local basename
    basename="$(basename "$file")"
    if [ "$basename" != "settings.ts" ]; then
      cp -f "$file" "$fixture_dir/src/config/$basename"
    fi
  done

  # Copy (not symlink) files with relative imports so they resolve from fixture dir
  cp -f "$REPO_ROOT/astro.config.ts" "$fixture_dir/astro.config.ts"
  cp -f "$REPO_ROOT/src/content.config.ts" "$fixture_dir/src/content.config.ts"

  # Symlink node_modules from repo root
  ln -sfn "$REPO_ROOT/node_modules" "$fixture_dir/node_modules"

  echo "  Done: $fixture"
}

for fixture in sidebar i18n theme smoke versioning; do
  setup_fixture "$fixture"
done

echo "All fixtures set up."

# For smoke fixture: create a local git repo so doc-history integration
# finds multi-revision history for content files
echo ""
echo "Setting up git repo for smoke fixture (doc history)..."
smoke_dir="$REPO_ROOT/e2e/fixtures/smoke"
# Clean up any previous git repo (ignore errors if none exists)
rm -rf "$smoke_dir/.git"
(
  cd "$smoke_dir"
  git init
  git add src/content/
  git -c user.email="test@example.com" -c user.name="Test" commit -m "Initial content"
  # Modify a file to create a second revision
  echo "" >> src/content/docs/getting-started/index.mdx
  echo "Updated for history test." >> src/content/docs/getting-started/index.mdx
  git add -A
  git -c user.email="test@example.com" -c user.name="Test" commit -m "Update getting started content"
)
echo "  Done: smoke git repo"

# Pre-build all fixtures sequentially to avoid Astro 6 Vite virtual module
# race conditions. When Playwright launches multiple webServers in parallel,
# concurrent Astro builds sharing source files via symlinks can hit a race
# where virtual modules (CSS/scripts) are requested before the parent .astro
# file's compile metadata is cached. Building sequentially first and then
# running only `astro preview` in Playwright avoids this entirely.
echo ""
echo "Pre-building fixtures sequentially..."
for fixture in sidebar i18n theme smoke versioning; do
  echo "  Building: $fixture"
  (cd "$REPO_ROOT/e2e/fixtures/$fixture" && ./node_modules/.bin/astro build 2>&1) || {
    echo "  FAILED: $fixture build failed" >&2
    exit 1
  }
  echo "  Built: $fixture"
done
echo "All fixtures built."
