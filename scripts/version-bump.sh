#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# version-bump.sh — Bump the showcase version, create package changelogs,
#                    and optionally snapshot docs
# ─────────────────────────────────────────────────────────────
#
# Usage:
#   ./scripts/version-bump.sh <new-version> [--snapshot]
#
# Examples:
#   ./scripts/version-bump.sh 0.2.0
#   ./scripts/version-bump.sh 1.0.0 --snapshot
#
# What it does:
#   1. Updates the version in package.json
#   2. Creates one changelog entry per package and locale (three × EN/JA)
#   3. With --snapshot: copies current docs to a versioned directory
#      and adds the OLD version to settings.ts versions array
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Parse arguments ──────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: $0 <new-version> [--snapshot]"
  echo ""
  echo "Options:"
  echo "  --snapshot   Archive current docs as a versioned snapshot before bumping"
  echo ""
  echo "Examples:"
  echo "  $0 0.2.0              # Bump version + create package changelog entries"
  echo "  $0 1.0.0 --snapshot   # Also snapshot current docs as old version"
  exit 1
fi

NEW_VERSION="$1"
SNAPSHOT=false

if [ "${2:-}" = "--snapshot" ]; then
  SNAPSHOT=true
fi

# Validate version format (semver-like: digits.digits.digits with optional pre-release)
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in semver format (e.g., 0.2.0, 1.0.0)"
  exit 1
fi

# ── Read current version ─────────────────────────────────────

OLD_VERSION=$(node -p "require('$ROOT_DIR/package.json').version" 2>/dev/null)
echo "Current version: $OLD_VERSION"
echo "New version:     $NEW_VERSION"

if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
  echo "Error: New version is the same as the current version"
  exit 1
fi

# ── Step 1: Bump package.json version ────────────────────────

echo ""
echo "▶ Updating package.json version..."
node -e "
  const fs = require('fs');
  const pkgPath = '$ROOT_DIR/package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
"
echo "  ✓ package.json updated to $NEW_VERSION"

# ── Step 2: Create package-specific changelog entries ─────────

echo ""
bash "$ROOT_DIR/scripts/lib/scaffold-package-changelogs.sh" \
  "$ROOT_DIR" \
  "$NEW_VERSION"

# ── Step 3 (optional): Snapshot docs ─────────────────────────

if [ "$SNAPSHOT" = true ]; then
  echo ""
  echo "▶ Snapshotting current docs as version $OLD_VERSION..."

  # Derive slug from old version (e.g., "0.0.1" → "0.0")
  OLD_SLUG=$(echo "$OLD_VERSION" | sed 's/\.[0-9]*$//')

  SNAPSHOT_DIR="$ROOT_DIR/src/content/docs-v${OLD_SLUG}"
  SNAPSHOT_JA_DIR="$ROOT_DIR/src/content/docs-v${OLD_SLUG}-ja"

  if [ -d "$SNAPSHOT_DIR" ]; then
    echo "  Warning: $SNAPSHOT_DIR already exists, skipping snapshot"
  else
    cp -r "$ROOT_DIR/src/content/docs" "$SNAPSHOT_DIR"
    echo "  ✓ Copied docs → docs-v${OLD_SLUG}"

    if [ -d "$ROOT_DIR/src/content/docs-ja" ]; then
      cp -r "$ROOT_DIR/src/content/docs-ja" "$SNAPSHOT_JA_DIR"
      echo "  ✓ Copied docs-ja → docs-v${OLD_SLUG}-ja"
    fi

    # Add version entry to settings.ts
    echo ""
    echo "▶ Updating settings.ts versions array..."
    echo ""
    echo "  ⚠  Please add the following entry to the 'versions' array in"
    echo "     src/config/settings.ts:"
    echo ""
    echo "    {"
    echo "      slug: \"${OLD_SLUG}\","
    echo "      label: \"${OLD_VERSION}\","
    echo "      docsDir: \"src/content/docs-v${OLD_SLUG}\","
    echo "      locales: {"
    echo "        ja: { dir: \"src/content/docs-v${OLD_SLUG}-ja\" },"
    echo "      },"
    echo "      banner: \"unmaintained\","
    echo "    },"
    echo ""
    echo "  This step requires manual editing to avoid breaking the TypeScript file."
  fi
fi

# ── Summary ──────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done! Version bumped to $NEW_VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Edit each package entry under src/content/docs/changelog/<package>/$NEW_VERSION.mdx"
echo "  2. Edit each Japanese mirror under src/content/docs-ja/changelog/<package>/$NEW_VERSION.mdx"
if [ "$SNAPSHOT" = true ]; then
  echo "  3. Add the version entry to src/config/settings.ts (see above)"
fi
echo "  4. Commit the changes"
