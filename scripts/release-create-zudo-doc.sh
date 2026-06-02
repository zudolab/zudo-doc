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
#   ./scripts/release-create-zudo-doc.sh [<new-version>|major|minor|patch|next|stable]
#
# Named bump modes:
#   major   — (X+1).0.0-next.1  (from current, whatever it is)
#   minor   — X.(Y+1).0-next.1  (from current)
#   patch   — X.Y.(Z+1)-next.1  (from current)
#   next    — from stable X.Y.Z → X.(Y+1).0-next.1
#             from prerelease X.Y.Z-next.N → X.Y.Z-next.(N+1)  (same as auto)
#   stable  — X.Y.Z (strip -next.N suffix; error if already stable)
#   <semver>— use exactly this version (original explicit-version mode)
#   (none)  — auto-derive: stable → minor+next.1; prerelease → N+1
#
# Dry / compute-only path (no mutations, no git):
#   DRY=1 ./scripts/release-create-zudo-doc.sh [mode]
#   FROM=<current> DRY=1 ./scripts/release-create-zudo-doc.sh [mode]
#     FROM overrides the version read from package.json — useful for testing
#     all acceptance cases without actually changing package.json.
#   Prints:
#     next version: <computed>
#     pin string:   ^<computed>
#   Then exits 0. No files are modified.
#
# Examples:
#   ./scripts/release-create-zudo-doc.sh 0.2.0           # stable release (explicit)
#   ./scripts/release-create-zudo-doc.sh 1.0.0-next.1    # prerelease (explicit)
#   ./scripts/release-create-zudo-doc.sh minor            # X.(Y+1).0-next.1
#   ./scripts/release-create-zudo-doc.sh stable           # strip -next.N suffix
#   DRY=1 FROM=0.1.0 ./scripts/release-create-zudo-doc.sh         # 0.2.0-next.1
#   DRY=1 FROM=0.2.0-next.1 ./scripts/release-create-zudo-doc.sh  # 0.2.0-next.2
#
# What it does (non-dry path):
#   1. Validates/computes version format (semver + optional prerelease suffix)
#   2. Bumps version in root package.json
#   3. Bumps version in packages/create-zudo-doc/package.json
#   4. Bumps version in packages/zudo-doc/package.json  (W4A — #1732)
#   5. Bumps version in packages/doc-history-server/package.json  (W4A — #1732)
#   6. Bumps the @takazudo/zudo-doc pin in scaffold.ts to ^<new-version>
#      so the generated package.json points at the zudo-doc version being
#      released (W4A — #1732). The @takazudo/zfb / @takazudo/zfb-runtime
#      pins in scaffold.ts are upstream-tracked separately and gated by
#      scripts/check-pin-parity.mjs — they are NOT touched here.
#   7. Scaffolds EN+JA changelog MDX entries
# ─────────────────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_JSON="$ROOT_DIR/package.json"
CREATE_PKG_JSON="$ROOT_DIR/packages/create-zudo-doc/package.json"
ZUDO_DOC_PKG_JSON="$ROOT_DIR/packages/zudo-doc/package.json"
DHS_PKG_JSON="$ROOT_DIR/packages/doc-history-server/package.json"
SCAFFOLD_TS="$ROOT_DIR/packages/create-zudo-doc/src/scaffold.ts"

# ── Version computation ───────────────────────────────────────────────────────
#
# compute_next_version <current> <mode>
#   current — the existing version string (e.g. "0.1.0" or "0.2.0-next.1")
#   mode    — one of: major | minor | patch | next | stable | auto
#             "auto" applies the default derivation rule:
#               - stable   → X.(Y+1).0-next.1
#               - prerelease → X.Y.Z-next.(N+1)
# Prints the computed next version to stdout and returns 0.
# Exits non-zero on error (e.g. "stable" when already stable).
compute_next_version() {
  local cur="$1"
  local mode="$2"

  # Split into core (X.Y.Z) and prerelease (everything after the first "-")
  local core pre_part
  if echo "$cur" | grep -q -- '-'; then
    core="${cur%%-*}"
    pre_part="${cur#*-}"
  else
    core="$cur"
    pre_part=""
  fi

  # Parse X, Y, Z from core
  local IFS_SAVE="$IFS"
  IFS='.' read -r ver_major ver_minor ver_patch <<< "$core"
  IFS="$IFS_SAVE"

  local is_prerelease=false
  [ -n "$pre_part" ] && is_prerelease=true

  case "$mode" in
    major)
      echo "$(( ver_major + 1 )).0.0-next.1"
      ;;
    minor)
      echo "${ver_major}.$(( ver_minor + 1 )).0-next.1"
      ;;
    patch)
      echo "${ver_major}.${ver_minor}.$(( ver_patch + 1 ))-next.1"
      ;;
    stable)
      if [ "$is_prerelease" = false ]; then
        echo "Error: current version '$cur' is already stable — nothing to strip" >&2
        exit 1
      fi
      echo "$core"
      ;;
    next|auto)
      if [ "$is_prerelease" = true ]; then
        # X.Y.Z-next.N → X.Y.Z-next.(N+1)
        # Extract the numeric suffix after the last dot in pre_part
        local pre_label pre_n
        pre_label="${pre_part%.*}"
        pre_n="${pre_part##*.}"
        echo "${core}-${pre_label}.$(( pre_n + 1 ))"
      else
        # stable → X.(Y+1).0-next.1  (both "next" keyword and "auto" default)
        echo "${ver_major}.$(( ver_minor + 1 )).0-next.1"
      fi
      ;;
    *)
      # Explicit semver string passed in — validate and pass through
      if ! echo "$mode" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[0-9]+)*)?$'; then
        echo "Error: Version must be semver format with optional prerelease suffix." >&2
        echo "  Valid:   0.2.0  1.0.0-next.1  2.0.0-beta.2  3.0.0-rc.1" >&2
        echo "  Invalid: 1.0  v1.0.0  1.0.0.0" >&2
        exit 1
      fi
      echo "$mode"
      ;;
  esac
}

# ── Parse arguments ──────────────────────────────────────────────────────────

MODE="${1:-auto}"

# ── Resolve current version (FROM env overrides package.json — for dry testing) ─

if [ -n "${FROM:-}" ]; then
  CURRENT_VERSION="$FROM"
else
  CURRENT_VERSION=$(node -p "require('$PKG_JSON').version" 2>/dev/null)
fi

# ── Compute target version ────────────────────────────────────────────────────

NEW_VERSION=$(compute_next_version "$CURRENT_VERSION" "$MODE")

# ── Dry path ─────────────────────────────────────────────────────────────────
#
# DRY=1 prints the computed version and pin string, then exits without any
# mutations to package.json, scaffold.ts, or the git tree.

if [ "${DRY:-0}" = "1" ]; then
  echo "current version: $CURRENT_VERSION"
  echo "mode:            $MODE"
  echo "next version:    $NEW_VERSION"
  echo "pin string:      ^$NEW_VERSION"
  exit 0
fi

# ── Read current versions (real run) ─────────────────────────────────────────

OLD_ROOT_VERSION=$(node -p "require('$PKG_JSON').version" 2>/dev/null)
OLD_CREATE_VERSION=$(node -p "require('$CREATE_PKG_JSON').version" 2>/dev/null)
OLD_ZUDO_DOC_VERSION=$(node -p "require('$ZUDO_DOC_PKG_JSON').version" 2>/dev/null)
OLD_DHS_VERSION=$(node -p "require('$DHS_PKG_JSON').version" 2>/dev/null)

echo "Root package:           $OLD_ROOT_VERSION → $NEW_VERSION"
echo "create-zudo-doc:        $OLD_CREATE_VERSION → $NEW_VERSION"
echo "zudo-doc:               $OLD_ZUDO_DOC_VERSION → $NEW_VERSION"
echo "doc-history-server:     $OLD_DHS_VERSION → $NEW_VERSION"

if [ "$OLD_ROOT_VERSION" = "$NEW_VERSION" ] \
  && [ "$OLD_CREATE_VERSION" = "$NEW_VERSION" ] \
  && [ "$OLD_ZUDO_DOC_VERSION" = "$NEW_VERSION" ] \
  && [ "$OLD_DHS_VERSION" = "$NEW_VERSION" ]; then
  echo "Error: All packages already at $NEW_VERSION — nothing to bump"
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

# ── Step 2a: Bump packages/zudo-doc/package.json (W4A — #1732) ────────────

echo ""
echo "▶ Bumping packages/zudo-doc/package.json..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$ZUDO_DOC_PKG_JSON', 'utf-8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$ZUDO_DOC_PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  ✓ $ZUDO_DOC_PKG_JSON → $NEW_VERSION"

# ── Step 2b: Bump packages/doc-history-server/package.json (W4A — #1732) ─────

echo ""
echo "▶ Bumping packages/doc-history-server/package.json..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$DHS_PKG_JSON', 'utf-8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$DHS_PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  ✓ $DHS_PKG_JSON → $NEW_VERSION"

# ── Step 2c: Align @takazudo/zudo-doc pin in scaffold.ts (W4A — #1732) ────
# The generated downstream package.json pins ^X.Y.Z(-next.N)? of @takazudo/zudo-doc;
# when zudo-doc bumps, the pin must move with it so a fresh scaffold gets
# the version we just published — including prerelease versions.
# The regex matches both stable (^X.Y.Z) and prerelease (^X.Y.Z-next.N) pins.
# The two zfb pins on adjacent lines are NOT touched — those track the upstream
# zfb release cadence and are gated by scripts/check-pin-parity.mjs.

echo ""
echo "▶ Aligning @takazudo/zudo-doc pin in scaffold.ts..."
node -e "
  const fs = require('fs');
  const src = fs.readFileSync('$SCAFFOLD_TS', 'utf-8');
  const re = /(\"@takazudo\/zudo-doc\"\s*:\s*\")\^?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\")/;
  if (!re.test(src)) {
    console.error('Error: could not locate @takazudo/zudo-doc pin in $SCAFFOLD_TS');
    process.exit(1);
  }
  const next = src.replace(re, '\$1^$NEW_VERSION\$3');
  fs.writeFileSync('$SCAFFOLD_TS', next);
"
echo "  ✓ $SCAFFOLD_TS @takazudo/zudo-doc → ^$NEW_VERSION"

# ── Step 2d: Align @takazudo/zudo-doc-history-server pin in scaffold.ts ───────
# The docHistory feature adds a direct @takazudo/zudo-doc-history-server dep to
# the generated package.json (different syntax — a deps[...] = "..." assignment,
# not an object-literal key). It must move in lockstep too, otherwise the direct
# pin (^0.1.0) conflicts with the transitive range @takazudo/zudo-doc carries.
echo ""
echo "▶ Aligning @takazudo/zudo-doc-history-server pin in scaffold.ts..."
node -e "
  const fs = require('fs');
  const src = fs.readFileSync('$SCAFFOLD_TS', 'utf-8');
  const re = /(deps\[\"@takazudo\/zudo-doc-history-server\"\]\s*=\s*\")\^?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\")/;
  if (!re.test(src)) {
    console.error('Error: could not locate @takazudo/zudo-doc-history-server pin in $SCAFFOLD_TS');
    process.exit(1);
  }
  const next = src.replace(re, '\$1^$NEW_VERSION\$3');
  fs.writeFileSync('$SCAFFOLD_TS', next);
"
echo "  ✓ $SCAFFOLD_TS @takazudo/zudo-doc-history-server → ^$NEW_VERSION"

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
echo "  Done! All four packages bumped to $NEW_VERSION"
echo "  (root, create-zudo-doc, zudo-doc, doc-history-server)"
echo "  scaffold.ts @takazudo/zudo-doc pin → ^$NEW_VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Fill in changelog: src/content/docs/changelog/$NEW_VERSION.mdx"
echo "  2. Fill in Japanese:  src/content/docs-ja/changelog/$NEW_VERSION.mdx"
echo "  3. Run pnpm b4push to validate"
echo "  4. Commit, push, wait for CI."
echo ""
echo "  Publish ORDER matters — zudo-doc and zudo-doc-history-server first,"
echo "  then create-zudo-doc (whose generated package.json pins @takazudo/zudo-doc ^$NEW_VERSION)."
echo ""
echo "  5a. If zudo-doc-history-server or zudo-doc changed:"
echo "      git tag zudo-doc-history-server-$NEW_VERSION && git push origin zudo-doc-history-server-$NEW_VERSION"
echo "      git tag zudo-doc-v$NEW_VERSION && git push origin zudo-doc-v$NEW_VERSION"
echo "      Create DRAFT releases for each tag — publishing fires"
echo "      publish-zudo-doc-history-server.yml and publish-zudo-doc.yml."
echo ""
echo "  5b. After 5a is live on npm:"
echo "      git tag v$NEW_VERSION && git push origin v$NEW_VERSION"
echo "      Create a DRAFT release for v$NEW_VERSION — publishing fires"
echo "      publish-create-zudo-doc.yml."
