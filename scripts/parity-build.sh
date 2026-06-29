#!/usr/bin/env bash
# parity-build.sh — deterministic, CI-faithful build + baseline snapshot for epic #2420
#
# WHY THIS WRAPPER EXISTS (do NOT parity-build with a raw `pnpm build`):
#   CI builds from a clean clone, which lacks the gitignored, dev-only generated
#   content under src/content/docs/claude*/ (produced by `pnpm dev`'s
#   claude-watch / `pnpm setup:doc-skill`). Those pages are NOT in the deployed
#   site. When present locally they also inject sidebar entries into EVERY page,
#   so a raw `pnpm build` on a dev machine produces different HTML for every
#   route than CI does. To make parity reproducible and match CI exactly, this
#   wrapper relocates ALL gitignored content under src/content/ out of the tree
#   before `pnpm build`, then restores it afterward (trap-guarded, even on error).
#   Tracked content (e.g. src/content/docs-ja/claude/) is left untouched.
#
# Usage:
#   scripts/parity-build.sh                       # clean build only (dist/ ready for a manual diff)
#   scripts/parity-build.sh --generate            # clean build + (re)capture the baseline snapshot
#   scripts/parity-build.sh --verify              # clean build + diff vs baseline (exit 1 on any diff)
#   scripts/parity-build.sh --baseline <dir> [--generate|--verify]
#
# The diff harness (parity-diff.mjs) baseline dir contains:
#   html-manifest.json   — normalized-HTML sha256 per route (the HARD gate)
#   route-list.json      — list of all routes
#   asset-manifest.json  — normalized asset filename patterns
#   island-manifest.json — island component names found across all pages
#   fixtures/doc-history-meta.json — frozen git-history meta (ground-truth + drift detector)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BASELINE_DIR="$REPO_ROOT/_temp-resource/2420-collapse-wiring-shells/baseline"
MODE="build" # build | generate | verify

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline) BASELINE_DIR="$2"; shift 2;;
    --generate) MODE="generate"; shift;;
    --verify)   MODE="verify"; shift;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

FIXTURE_FILE="$BASELINE_DIR/fixtures/doc-history-meta.json"

cd "$REPO_ROOT"

echo "[parity-build] Repo root: $REPO_ROOT"
echo "[parity-build] Baseline:  $BASELINE_DIR"
echo "[parity-build] Mode:      $MODE"

# ── Relocate gitignored (dev-only generated) content so the build matches CI ──
STASH_DIR=""
RELOCATED=()
restore_generated() {
  local p
  for p in "${RELOCATED[@]:-}"; do
    [[ -z "$p" ]] && continue
    if [[ -e "$STASH_DIR/$p" ]]; then
      mkdir -p "$REPO_ROOT/$(dirname "$p")"
      rm -rf "$REPO_ROOT/$p"
      mv "$STASH_DIR/$p" "$REPO_ROOT/$p"
    fi
  done
  [[ -n "$STASH_DIR" && -d "$STASH_DIR" ]] && rm -rf "$STASH_DIR"
}
trap restore_generated EXIT

relocate_generated() {
  STASH_DIR="$(mktemp -d)"
  local line p
  # Gitignored paths under .claude/ and src/content/ are exactly what a clean CI
  # clone lacks. The build's claudeResources feature generates /docs/claude-*
  # routes from .claude/ (tracked skills/agents); a locally-generated, gitignored
  # skill such as .claude/skills/zudo-doc-wisdom/ would otherwise inject an extra
  # route + a sidebar entry on EVERY page, diverging from CI. (.claude/docs under
  # src/content/docs/claude*/ is dev-watch HMR output, not the build source, but
  # relocating it too is harmless and keeps the tree CI-clean.)
  # settings.local.json is this machine's Claude Code config, not build input —
  # never relocate it (would disturb the running harness).
  while IFS= read -r line; do
    p="${line#!! }"
    p="${p%/}"
    [[ -z "$p" ]] && continue
    [[ "$p" == *settings.local.json ]] && continue
    if [[ -e "$REPO_ROOT/$p" ]]; then
      mkdir -p "$STASH_DIR/$(dirname "$p")"
      mv "$REPO_ROOT/$p" "$STASH_DIR/$p"
      RELOCATED+=("$p")
    fi
  done < <(git -C "$REPO_ROOT" status --ignored --porcelain -- .claude/ src/content/ 2>/dev/null | grep '^!! ' || true)

  if [[ ${#RELOCATED[@]} -gt 0 ]]; then
    echo "[parity-build] Relocated ${#RELOCATED[@]} gitignored content path(s) for a CI-faithful build:"
    printf '  - %s\n' "${RELOCATED[@]}"
  else
    echo "[parity-build] No gitignored content under src/content/ — tree already clean."
  fi
}

relocate_generated

# ── Build ─────────────────────────────────────────────────────────────────────
echo "[parity-build] Running pnpm build (clean tree)..."
pnpm build

# ── doc-history-meta drift check (advisory) ──────────────────────────────────
if [[ -f "$FIXTURE_FILE" && -f "$REPO_ROOT/.zfb/doc-history-meta.json" ]]; then
  if diff -q "$FIXTURE_FILE" "$REPO_ROOT/.zfb/doc-history-meta.json" > /dev/null 2>&1; then
    echo "[parity-build] doc-history-meta: PASS — matches frozen fixture"
  else
    echo "[parity-build] NOTE: doc-history-meta differs from frozen fixture (git history for some content files changed)."
    echo "  If this is expected (e.g. baseline captured on a different commit), refresh with:"
    echo "    cp .zfb/doc-history-meta.json $FIXTURE_FILE"
  fi
fi

# ── Generate or verify ────────────────────────────────────────────────────────
case "$MODE" in
  generate)
    echo "[parity-build] Capturing baseline snapshot..."
    node "$SCRIPT_DIR/parity-diff.mjs" --generate --baseline "$BASELINE_DIR"
    echo "[parity-build] Done. Baseline captured. Re-run with --verify to confirm an empty diff."
    ;;
  verify)
    echo "[parity-build] Verifying against baseline..."
    node "$SCRIPT_DIR/parity-diff.mjs" --baseline "$BASELINE_DIR"
    echo "[parity-build] Done — parity verified."
    ;;
  *)
    echo "[parity-build] Done. dist/ is a clean build. Run 'node scripts/parity-diff.mjs' to diff."
    ;;
esac
