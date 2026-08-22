#!/usr/bin/env bash
set -euo pipefail

# Create the showcase's package-specific EN/JA changelog placeholders.
#
# Keeping this filesystem-only operation behind a repo-root parameter lets the
# release scripts use the same implementation that fixture tests exercise,
# without running version bumps, registry checks, snapshots, or git commands.

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <repo-root> <version>" >&2
  exit 1
fi

REPO_ROOT="$1"
VERSION="$2"

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[0-9]+)*)?$'; then
  echo "Error: Version must be semver format with an optional prerelease suffix." >&2
  exit 1
fi

write_changelog() {
  local locale="$1"
  local package_slug="$2"
  local changelog_dir="$REPO_ROOT/src/content/$locale/changelog/$package_slug"
  local changelog_file="$changelog_dir/$VERSION.mdx"

  mkdir -p "$changelog_dir"

  if [ -f "$changelog_file" ]; then
    echo "Warning: $changelog_file already exists — skipping"
    return
  fi

  # Each package/locale directory owns its ordering. Counting only sibling
  # release entries makes partially populated trees and future package lanes
  # independent from one another.
  local existing_count sidebar_position
  existing_count=$(find "$changelog_dir" -maxdepth 1 -type f -name '*.mdx' ! -name 'index.mdx' | wc -l | tr -d ' ')
  sidebar_position=$((1000 + existing_count + 1))

  if [ "$locale" = "docs-ja" ]; then
    tee "$changelog_file" > /dev/null <<MDXEOF
---
title: $VERSION
description: ${VERSION}のリリースノート。
sidebar_position: $sidebar_position
---

<!-- リリースノートをここに追加 -->

### 機能

- <!-- 新機能を記述 -->

### バグ修正

- <!-- バグ修正を記述 -->
MDXEOF
  else
    tee "$changelog_file" > /dev/null <<MDXEOF
---
title: $VERSION
description: Release notes for $VERSION.
sidebar_position: $sidebar_position
---

<!-- Add release notes here -->

### Features

- <!-- Describe new features -->

### Bug Fixes

- <!-- Describe bug fixes -->
MDXEOF
  fi

  echo "  ✓ Created $changelog_file (sidebar_position: $sidebar_position)"
}

echo "▶ Scaffolding package changelog entries..."
for package_slug in zudo-doc create-zudo-doc doc-history-server; do
  write_changelog "docs" "$package_slug"
  write_changelog "docs-ja" "$package_slug"
done
