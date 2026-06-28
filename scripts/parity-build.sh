#!/usr/bin/env bash
# parity-build.sh — deterministic build + baseline snapshot for epic #2420
#
# Usage:
#   scripts/parity-build.sh [--baseline <dir>]
#
# What it does:
#   1. Injects the frozen doc-history-meta fixture into .zfb/ as a reference
#      (the pre-build step will overwrite it with equivalent git-history data;
#      the frozen copy serves as a ground-truth snapshot stored in git).
#   2. Runs `pnpm build` (preBuild regenerates .zfb/doc-history-meta.json from
#      real git history — deterministic for a fixed repo state).
#   3. Runs `parity-diff.mjs --generate` to capture the snapshot manifests into
#      the baseline dir.
#
# The diff harness (parity-diff.mjs) expects a baseline dir containing:
#   html-manifest.json   — normalized-HTML sha256 per route (the HARD gate)
#   route-list.json      — list of all routes
#   asset-manifest.json  — normalized asset filename patterns
#   island-manifest.json — island component names found across all pages
#
# The frozen fixture lives at:
#   <baseline>/fixtures/doc-history-meta.json
# It is committed to git so that readers can verify the git-generated meta
# is identical. The fixture is NOT injected during build (pre-build always
# overwrites .zfb/doc-history-meta.json from live git history); instead, after
# build we verify they match.
#
# Reproduce:
#   scripts/parity-build.sh
#   node scripts/parity-diff.mjs
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BASELINE_DIR="$REPO_ROOT/_temp-resource/2420-collapse-wiring-shells/baseline"
FIXTURE_FILE="$BASELINE_DIR/fixtures/doc-history-meta.json"

# Allow override via --baseline
while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline)
      BASELINE_DIR="$2"; shift 2;;
    *)
      echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

cd "$REPO_ROOT"

echo "[parity-build] Repo root: $REPO_ROOT"
echo "[parity-build] Baseline:  $BASELINE_DIR"

# ── Step 1: Ensure .zfb/ exists; place frozen fixture for reference ──────────
# The frozen fixture in git matches what git log produces for the baseline
# commit. Pre-build will regenerate .zfb/doc-history-meta.json from live git
# history (which must be identical for a parity comparison to be valid).
mkdir -p "$REPO_ROOT/.zfb"
if [[ -f "$FIXTURE_FILE" ]]; then
  cp "$FIXTURE_FILE" "$REPO_ROOT/.zfb/doc-history-meta.json"
  echo "[parity-build] Placed frozen fixture into .zfb/ (pre-build will regenerate from git)"
fi

# ── Step 2: Build ────────────────────────────────────────────────────────────
echo "[parity-build] Running pnpm build..."
pnpm build

# ── Step 3: Verify that post-build meta matches frozen fixture ───────────────
if [[ -f "$FIXTURE_FILE" && -f "$REPO_ROOT/.zfb/doc-history-meta.json" ]]; then
  if diff -q "$FIXTURE_FILE" "$REPO_ROOT/.zfb/doc-history-meta.json" > /dev/null 2>&1; then
    echo "[parity-build] doc-history-meta: PASS — matches frozen fixture"
  else
    echo "[parity-build] WARNING: doc-history-meta differs from frozen fixture."
    echo "  This means git history changed for some content files."
    echo "  Update the frozen fixture with:"
    echo "    cp .zfb/doc-history-meta.json $FIXTURE_FILE"
    echo "  Diff:"
    diff "$FIXTURE_FILE" "$REPO_ROOT/.zfb/doc-history-meta.json" | head -30 || true
  fi
fi

# ── Step 4: Generate snapshot manifests ──────────────────────────────────────
echo "[parity-build] Capturing baseline snapshot..."
node "$SCRIPT_DIR/parity-diff.mjs" --generate --baseline "$BASELINE_DIR"

echo "[parity-build] Done. Run 'node scripts/parity-diff.mjs' to verify empty diff."
