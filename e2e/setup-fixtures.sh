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

  # Symlink framework source directories
  for dir in components hooks integrations layouts pages plugins styles types utils; do
    ln -sfn "$REPO_ROOT/src/$dir" "$fixture_dir/src/$dir"
  done

  # Symlink individual config files (not settings.ts — each fixture has its own)
  for file in "$REPO_ROOT"/src/config/*.ts; do
    local basename
    basename="$(basename "$file")"
    if [ "$basename" != "settings.ts" ]; then
      ln -sfn "$file" "$fixture_dir/src/config/$basename"
    fi
  done

  # Copy (not symlink) files with relative imports so they resolve from fixture dir
  cp -f "$REPO_ROOT/astro.config.ts" "$fixture_dir/astro.config.ts"
  cp -f "$REPO_ROOT/src/content.config.ts" "$fixture_dir/src/content.config.ts"

  # Symlink node_modules from repo root
  ln -sfn "$REPO_ROOT/node_modules" "$fixture_dir/node_modules"

  echo "  Done: $fixture"
}

for fixture in sidebar i18n theme smoke; do
  setup_fixture "$fixture"
done

echo "All fixtures set up."
