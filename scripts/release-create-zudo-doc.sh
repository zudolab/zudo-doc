#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# release-create-zudo-doc.sh — Bump root + create-zudo-doc versions in lockstep
#                               and scaffold EN+JA changelog entries
#
# WHY a new script instead of modifying version-bump.sh:
#   version-bump.sh is dual-purpose — it is also shipped to downstream
#   scaffolded projects via create-zudo-doc. Modifying it risks breaking that
#   contract. This sibling script reuses the same high-level logic (bump JSON,
#   scaffold MDX) but targets BOTH root package.json AND
#   packages/create-zudo-doc/package.json, and accepts prerelease semver
#   (e.g. 1.0.0-next.1) which version-bump.sh's strict regex would reject.
#
# Usage:
#   ./scripts/release-create-zudo-doc.sh <new-version>
#
# Examples:
#   ./scripts/release-create-zudo-doc.sh 0.2.0
#   ./scripts/release-create-zudo-doc.sh 1.0.0-next.1
#
# What it does:
#   1. Validates version format (semver + optional prerelease suffix)
#   2. Bumps version in root package.json
#   3. Bumps version in packages/create-zudo-doc/package.json
#   4. Scaffolds EN+JA changelog MDX entries
# ─────────────────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_JSON="$ROOT_DIR/package.json"
CREATE_PKG_JSON="$ROOT_DIR/packages/create-zudo-doc/package.json"

# ── Parse arguments ──────────────────────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: $0 <new-version>"
  echo ""
  echo "Examples:"
  echo "  $0 0.2.0           # stable release"
  echo "  $0 1.0.0-next.1    # prerelease"
  exit 1
fi

NEW_VERSION="$1"

# Validate: semver with optional prerelease (e.g. 1.0.0, 1.0.0-next.1, 1.0.0-beta.2, 1.0.0-rc.3)
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[0-9]+)*)?$'; then
  echo "Error: Version must be semver format with optional prerelease suffix."
  echo "  Valid:   0.2.0  1.0.0-next.1  2.0.0-beta.2  3.0.0-rc.1"
  echo "  Invalid: 1.0  v1.0.0  1.0.0.0"
  exit 1
fi

# ── Read current versions ─────────────────────────────────────────────────────

OLD_ROOT_VERSION=$(node -p "require('$PKG_JSON').version" 2>/dev/null)
OLD_CREATE_VERSION=$(node -p "require('$CREATE_PKG_JSON').version" 2>/dev/null)

echo "Root package:           $OLD_ROOT_VERSION → $NEW_VERSION"
echo "create-zudo-doc:        $OLD_CREATE_VERSION → $NEW_VERSION"

if [ "$OLD_ROOT_VERSION" = "$NEW_VERSION" ] && [ "$OLD_CREATE_VERSION" = "$NEW_VERSION" ]; then
  echo "Error: Both packages already at $NEW_VERSION — nothing to bump"
  exit 1
fi

# ── Step 1: Bump root package.json ───────────────────────────────────────────

echo ""
echo "▶ Bumping root package.json..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PKG_JSON', 'utf-8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  ✓ $PKG_JSON → $NEW_VERSION"

# ── Step 2: Bump packages/create-zudo-doc/package.json ───────────────────────

echo ""
echo "▶ Bumping packages/create-zudo-doc/package.json..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$CREATE_PKG_JSON', 'utf-8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$CREATE_PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  ✓ $CREATE_PKG_JSON → $NEW_VERSION"

# ── Step 3: Scaffold EN + JA changelog entries ────────────────────────────────

CHANGELOG_DIR="$ROOT_DIR/src/content/docs/changelog"
CHANGELOG_JA_DIR="$ROOT_DIR/src/content/docs-ja/changelog"

# Determine sidebar_position: count existing .mdx files (excluding index.mdx)
# High values produce descending sort (newest first). Index page uses position 10.
EXISTING_COUNT=$(find "$CHANGELOG_DIR" -maxdepth 1 -name '*.mdx' ! -name 'index.mdx' 2>/dev/null | wc -l | tr -d ' ')
SIDEBAR_POS=$((1000 + EXISTING_COUNT + 1))

CHANGELOG_FILE="$CHANGELOG_DIR/$NEW_VERSION.mdx"
CHANGELOG_JA_FILE="$CHANGELOG_JA_DIR/$NEW_VERSION.mdx"

if [ -f "$CHANGELOG_FILE" ]; then
  echo ""
  echo "Warning: $CHANGELOG_FILE already exists — skipping changelog scaffold"
else
  echo ""
  echo "▶ Scaffolding changelog entries (sidebar_position: $SIDEBAR_POS)..."

  mkdir -p "$CHANGELOG_DIR"
  mkdir -p "$CHANGELOG_JA_DIR"

  cat > "$CHANGELOG_FILE" << MDXEOF
---
title: $NEW_VERSION
description: Release notes for $NEW_VERSION.
sidebar_position: $SIDEBAR_POS
---

<!-- Add release notes here -->

### Features

- <!-- Describe new features -->

### Bug Fixes

- <!-- Describe bug fixes -->
MDXEOF
  echo "  ✓ $CHANGELOG_FILE"

  cat > "$CHANGELOG_JA_FILE" << MDXEOF
---
title: $NEW_VERSION
description: ${NEW_VERSION}のリリースノート。
sidebar_position: $SIDEBAR_POS
---

<!-- リリースノートをここに追加 -->

### 機能

- <!-- 新機能を記述 -->

### バグ修正

- <!-- バグ修正を記述 -->
MDXEOF
  echo "  ✓ $CHANGELOG_JA_FILE"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done! Both packages bumped to $NEW_VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Fill in changelog: src/content/docs/changelog/$NEW_VERSION.mdx"
echo "  2. Fill in Japanese:  src/content/docs-ja/changelog/$NEW_VERSION.mdx"
echo "  3. Run pnpm b4push to validate"
echo "  4. Commit, push, wait for CI, then:"
echo "     git tag v$NEW_VERSION && git push --tags"
echo "  5. Create a DRAFT GitHub release for tag v$NEW_VERSION"
echo "     Publishing the draft fires the publish-create-zudo-doc CI workflow."
