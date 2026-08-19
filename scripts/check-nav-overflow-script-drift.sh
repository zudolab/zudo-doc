#!/usr/bin/env bash
set -euo pipefail

# scripts/check-nav-overflow-script-drift.sh
#
# Guard check (zudolab/zudo-doc#3535, epic #3533): proves the committed
# packages/zudo-doc/src/header/nav-overflow-generated-script.ts is
# byte-identical to what scripts/gen-nav-overflow-script.mjs produces from
# the CURRENT src/current-path/index.ts, src/header/nav-active.ts,
# src/header/nav-class-tokens.ts, and src/transitions/page-events.ts sources.
# nav-overflow-generated-script.ts is tracked in git (a deliberate departure
# from the gitignored routes-src/ convention — see the generator's header
# comment and #3534), so a plain `git diff` after a fresh regeneration is a
# real drift guard.
#
# Mirrors scripts/check-search-widget-drift.sh (#3421, #3431) — same
# git-tracked-first assertion, same write-if-changed re-run + git-diff shape.
#
# Re-runs the generator's write-if-changed CLI entry point, then git-diffs
# the tracked path. A non-empty diff means one of the four source files
# changed but the generated file was never regenerated and re-committed.
#
# Usage: pnpm check:nav-overflow-drift (or bash scripts/check-nav-overflow-script-drift.sh)
# Exit 0 = committed file matches a fresh generation. Exit 1 = drift detected.
#
# Wired into:
#   - scripts/run-b4push.sh (guard step)
#   - .github/workflows/pr-checks.yml (package-tests job — the generator
#     imports the `esbuild` dependency directly, so this can't run as a
#     no-install pure-Node guard job; it rides an already-installed job)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GENERATED_PATH="packages/zudo-doc/src/header/nav-overflow-generated-script.ts"

cd "$ROOT_DIR"

# The whole guard rests on the file being TRACKED: `git diff -- <path>` on an
# untracked path always exits 0, so re-adding a .gitignore line (or a
# `git rm --cached`) would silently turn this check into a no-op forever.
# Assert tracking first so that regression fails loudly instead.
if ! git ls-files --error-unmatch -- "$GENERATED_PATH" >/dev/null 2>&1; then
  echo "Nav-overflow-script drift check FAILED — $GENERATED_PATH is not tracked in git."
  echo ""
  echo "Since zudolab/zudo-doc#3534 this generated file is committed on purpose"
  echo "(see the generator's header comment); an untracked file would make the"
  echo "\`git diff\` below vacuously pass."
  echo ""
  echo "Fix: remove any .gitignore entry for it and commit the file:"
  echo "  pnpm --filter @takazudo/zudo-doc gen:nav-overflow-script"
  echo "  git add $GENERATED_PATH"
  echo ""
  exit 1
fi

node packages/zudo-doc/scripts/gen-nav-overflow-script.mjs

if git diff --exit-code -- "$GENERATED_PATH"; then
  echo "OK — nav-overflow-script drift check passed. nav-overflow-generated-script.ts matches a fresh generation."
  exit 0
fi

echo ""
echo "Nav-overflow-script drift check FAILED — the committed $GENERATED_PATH"
echo "does not match what the generator produces from the current"
echo "current-path/index.ts / header/nav-active.ts / header/nav-class-tokens.ts /"
echo "transitions/page-events.ts sources."
echo ""
echo "This means one of those four source files changed but the generated"
echo "file was never regenerated and committed."
echo ""
echo "Fix: regenerate and commit the result:"
echo "  pnpm --filter @takazudo/zudo-doc gen:nav-overflow-script"
echo "  git add $GENERATED_PATH"
echo ""
exit 1
