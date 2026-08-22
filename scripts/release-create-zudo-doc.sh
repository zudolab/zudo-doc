#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# release-create-zudo-doc.sh — Bump all published package versions in lockstep
#                               and scaffold package-specific EN+JA changelogs
#
# This repository-specific release script keeps all four package versions and
# published pins in lockstep, and accepts prerelease semver (e.g.
# 1.0.0-next.1). The separate generated-project version-bump skill owns the
# generic downstream workflow; scripts/version-bump.sh is showcase-only.
#
# Usage:
#   ./scripts/release-create-zudo-doc.sh [<new-version>|major|minor|patch|next|stable]
#
# Versioning policy — Scheme B (pre-1.0): the 0.x dev mainline ships CLEAN
# 0.MINOR.PATCH straight to the npm `latest` dist-tag. The 0.x major-zero is
# itself SemVer's "anything may change" signal, so no `-next` suffix is used on
# the mainline; a breaking 0.x change rides a minor bump (0.2 → 0.3), everything
# else a patch bump. `-next` prereleases are an OPT-IN escape hatch (the `next`
# keyword / an explicit X.Y.Z-next.N) for deliberate previews and the eventual
# 1.0.0-beta run-up — never the default. (See RELEASE.md.)
#
# Named bump modes:
#   major   — (X+1).0.0           (clean)
#   minor   — X.(Y+1).0           (clean; use for a breaking 0.x change)
#   patch   — X.Y.(Z+1)           (clean)
#   next    — opt-in prerelease escape hatch:
#               from stable X.Y.Z            → X.(Y+1).0-next.1
#               from prerelease X.Y.Z-next.N → X.Y.Z-next.(N+1)
#   stable  — X.Y.Z (strip -next.N suffix; error if already stable)
#   <semver>— use exactly this version (original explicit-version mode)
#   (none)  — auto: prerelease → graduate to clean X.Y.Z; stable → patch X.Y.(Z+1)
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
#   ./scripts/release-create-zudo-doc.sh 0.2.0            # explicit clean release
#   ./scripts/release-create-zudo-doc.sh minor            # X.(Y+1).0 (breaking 0.x change)
#   ./scripts/release-create-zudo-doc.sh patch            # X.Y.(Z+1)
#   ./scripts/release-create-zudo-doc.sh stable           # strip -next.N suffix → X.Y.Z
#   ./scripts/release-create-zudo-doc.sh next             # opt-in prerelease preview
#   DRY=1 FROM=0.2.0-next.9 ./scripts/release-create-zudo-doc.sh         # 0.2.0  (graduate)
#   DRY=1 FROM=0.2.0 ./scripts/release-create-zudo-doc.sh patch          # 0.2.1
#
# What it does (non-dry path):
#   1. Validates/computes version format (semver + optional prerelease suffix)
#   2. Bumps version in root package.json
#   3. Bumps version in packages/create-zudo-doc/package.json
#   4. Bumps version in packages/zudo-doc/package.json  (W4A — #1732)
#   5. Bumps version in packages/doc-history-server/package.json  (W4A — #1732)
#   6. Bumps the @takazudo/zudo-doc pin to ^<new-version> in BOTH lockstep
#      surfaces — the `ZUDO_DOC_PIN` constant in scaffold.ts (so the generated
#      package.json points at the zudo-doc version being released, W4A — #1732)
#      and the target-manifest fixture at
#      packages/zudo-doc/src/__tests__/fixtures/target-manifest/package.json
#      (which documents the published shape a consumer gets, #3306). Both are
#      rewritten by scripts/lib/rewrite-zudo-doc-pins.mjs. The @takazudo/zfb /
#      @takazudo/zfb-runtime pins in scaffold.ts are upstream-tracked separately
#      and gated by scripts/check-pin-parity.mjs — they are NOT touched here.
#   7. Scaffolds one EN+JA changelog MDX pair per published package
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
#   current — the existing version string (e.g. "0.2.0" or "0.2.0-next.9")
#   mode    — one of: major | minor | patch | next | stable | auto
#             "auto" applies the default derivation rule (Scheme B — clean):
#               - prerelease → graduate to the clean X.Y.Z (strip -next.N)
#               - stable     → patch bump X.Y.(Z+1)
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
      echo "$(( ver_major + 1 )).0.0"
      ;;
    minor)
      echo "${ver_major}.$(( ver_minor + 1 )).0"
      ;;
    patch)
      echo "${ver_major}.${ver_minor}.$(( ver_patch + 1 ))"
      ;;
    stable)
      if [ "$is_prerelease" = false ]; then
        echo "Error: current version '$cur' is already stable — nothing to strip" >&2
        exit 1
      fi
      echo "$core"
      ;;
    next)
      # Explicit prerelease escape hatch — opt-in only. Scheme B keeps the 0.x
      # mainline CLEAN, so prereleases are NOT the default; use this keyword for a
      # deliberate preview or the 1.0.0-beta run-up.
      if [ "$is_prerelease" = true ]; then
        # X.Y.Z-next.N → X.Y.Z-next.(N+1)
        # Extract the numeric suffix after the last dot in pre_part
        local pre_label pre_n
        pre_label="${pre_part%.*}"
        pre_n="${pre_part##*.}"
        echo "${core}-${pre_label}.$(( pre_n + 1 ))"
      else
        # stable → X.(Y+1).0-next.1  (preview the next minor)
        echo "${ver_major}.$(( ver_minor + 1 )).0-next.1"
      fi
      ;;
    auto)
      # Scheme B default: always produce a CLEAN version (no -next suffix).
      if [ "$is_prerelease" = true ]; then
        # In-flight prerelease X.Y.Z-next.N → graduate to the clean X.Y.Z.
        echo "$core"
      else
        # stable X.Y.Z → patch bump X.Y.(Z+1).  Use `minor` for a breaking 0.x change.
        echo "${ver_major}.${ver_minor}.$(( ver_patch + 1 ))"
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

# ── Scaffold pin freshness (early feedback, #3457) ────────────────────────────
#
# This is EARLY FEEDBACK ONLY, not the enforcement point — publication happens
# later, when a human publishes the GitHub Draft Release
# (.github/workflows/publish-create-zudo-doc.yml), and a scaffold pin can go
# stale in the gap between this script preparing the release and that publish.
# The gate that actually BLOCKS a stale release runs there, immediately before
# `npm publish`. Running it here too just means a release author learns about
# a stale pin now, while preparing, instead of days later at publish time. See
# RELEASE.md ("Scaffold pin freshness gate") for what a failure means, the
# remedy, and how prerelease pins are compared against the registry.

echo ""
echo "▶ Checking scaffold pin freshness against the npm registry..."
if (cd "$ROOT_DIR" && pnpm check:scaffold-pin-freshness); then
  echo "  ✓ scaffold pins are current"
else
  echo ""
  echo "Error: scaffold pin freshness check failed — a pin in packages/create-zudo-doc/src/scaffold.ts" >&2
  echo "        is stale, or the npm registry lookup failed. See RELEASE.md 'Scaffold pin freshness gate'." >&2
  echo "Remedy: bump the pin via /dev-bump-zudo-deps, then re-run 'pnpm check:pin-parity' to confirm every" >&2
  echo "        pin location still agrees, and re-run this script." >&2
  exit 1
fi

echo ""
echo "▶ Checking scaffold pins for a published satisfying version..."
if (cd "$ROOT_DIR" && pnpm check:scaffold-pin-published); then
  echo "  ✓ scaffold pins have a published satisfying version"
else
  echo ""
  echo "Error: scaffold pin published check failed — a pin has no satisfying version on the npm registry." >&2
  echo "        This can indicate an unfinished release from an earlier run. See RELEASE.md 'Scaffold pin published gate'." >&2
  echo "Remedy: finish or roll back the pending publication, then re-run this script." >&2
  exit 1
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

# ── Step 2c: Align @takazudo/zudo-doc pins — scaffold.ts + fixture (#3306) ────
# TWO surfaces spell out the released @takazudo/zudo-doc version as a literal
# and must move together:
#   - the exported `ZUDO_DOC_PIN` constant in scaffold.ts (used by both
#     generatePackageJson() and scaffold()), which is what a fresh scaffold's
#     generated package.json pins — including prerelease versions;
#   - packages/zudo-doc/src/__tests__/fixtures/target-manifest/package.json,
#     the fixture documenting the PUBLISHED shape a real consumer gets. Its pin
#     is documentary (the slow test extracts a packed tarball rather than
#     resolving from the registry), so drift there fails nothing on its own —
#     which is how it silently fell a full major behind (#3304).
# The rewrite lives in scripts/lib/rewrite-zudo-doc-pins.mjs rather than inline
# here: the release path's failure mode is "the next release breaks", provable
# only by releasing. Behind an importable seam taking the repo root as a
# parameter, this exact code is unit-tested against a temp tree
# (scripts/__tests__/rewrite-zudo-doc-pins.test.ts). It hard-fails if either
# pin cannot be located, and prints the ✓ line for each file it rewrites.
# The zfb pins are NOT touched — those track the upstream zfb release cadence
# and are gated by scripts/check-pin-parity.mjs.

echo ""
echo "▶ Aligning @takazudo/zudo-doc pins (scaffold.ts ZUDO_DOC_PIN + target-manifest fixture)..."
node "$ROOT_DIR/scripts/lib/rewrite-zudo-doc-pins.mjs" \
  --repo-root "$ROOT_DIR" \
  --version "$NEW_VERSION"

# ── Step 2d: Align @takazudo/zudo-doc-history-server pin in scaffold.ts ───────
# A docHistory-enabled generated package.json carries a direct
# @takazudo/zudo-doc-history-server dep (gated on the feature — it was briefly
# unconditional under #3080, until #3110 fixed the root cause and moved the pin
# back into the docHistory block as `deps[...] = "^X.Y.Z"`).
# It must move in lockstep too, otherwise the direct pin conflicts with the
# transitive range @takazudo/zudo-doc carries.
# NOTE: this WRITE-side regex accepts BOTH spellings the pin has used — the
# bracket-assignment form (`deps["…"] = "^X.Y.Z"`, current) and the
# object-literal-key form (`"…": "^X.Y.Z"`, #3080-era) — so it no longer breaks
# when the pin moves between a conditional block and the base `deps` literal.
# check-pin-parity.mjs's READ-side readScaffoldPin already tolerates both.
echo ""
echo "▶ Aligning @takazudo/zudo-doc-history-server pin in scaffold.ts..."
node -e "
  const fs = require('fs');
  const src = fs.readFileSync('$SCAFFOLD_TS', 'utf-8');
  const re = /(\"@takazudo\/zudo-doc-history-server\"\s*(?::|\]\s*=)\s*\")\^?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\")/;
  if (!re.test(src)) {
    console.error('Error: could not locate @takazudo/zudo-doc-history-server pin in $SCAFFOLD_TS');
    process.exit(1);
  }
  const next = src.replace(re, '\$1^$NEW_VERSION\$3');
  fs.writeFileSync('$SCAFFOLD_TS', next);
"
echo "  ✓ $SCAFFOLD_TS @takazudo/zudo-doc-history-server → ^$NEW_VERSION"

# ── Step 3: Scaffold package-specific EN + JA changelog entries ──────────────

echo ""
bash "$ROOT_DIR/scripts/lib/scaffold-package-changelogs.sh" \
  "$ROOT_DIR" \
  "$NEW_VERSION"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done! All four packages bumped to $NEW_VERSION"
echo "  (root, create-zudo-doc, zudo-doc, doc-history-server)"
echo "  scaffold.ts @takazudo/zudo-doc pin → ^$NEW_VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Fill all three package entries under src/content/docs/changelog/<package>/$NEW_VERSION.mdx"
echo "  2. Fill all three Japanese mirrors under src/content/docs-ja/changelog/<package>/$NEW_VERSION.mdx"
echo "     (use an explicit localized no-package-change entry when needed)."
echo "  3. Run pnpm gen:changelog and stage all three package CHANGELOG.md outputs."
echo "  4. Run B4PUSH_SKIP_PIN_PUBLISHED=1 pnpm b4push to validate."
echo "  5. Commit, push, wait for CI."
echo ""
echo "  Publish ORDER matters — zudo-doc and zudo-doc-history-server first,"
echo "  then create-zudo-doc (whose generated package.json pins @takazudo/zudo-doc ^$NEW_VERSION)."
echo ""
echo "  6a. Tag and draft zudo-doc-history-server and zudo-doc (always, in lockstep):"
echo "      git tag zudo-doc-history-server-$NEW_VERSION && git push origin zudo-doc-history-server-$NEW_VERSION"
echo "      git tag zudo-doc-v$NEW_VERSION && git push origin zudo-doc-v$NEW_VERSION"
echo "      Create DRAFT releases for each tag — publishing fires"
echo "      publish-zudo-doc-history-server.yml and publish-zudo-doc.yml."
echo ""
echo "  6b. After 6a is live on npm:"
echo "      git tag v$NEW_VERSION && git push origin v$NEW_VERSION"
echo "      Create a DRAFT release for v$NEW_VERSION — publishing fires"
echo "      publish-create-zudo-doc.yml."
