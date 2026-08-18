#!/usr/bin/env bash
set -euo pipefail

# scripts/check-search-widget-drift.sh
#
# Guard check (zudolab/zudo-doc#3431): proves the committed
# packages/zudo-doc/src/search-widget-script/generated-script.ts is
# byte-identical to what scripts/gen-search-widget-script.mjs produces from
# the CURRENT scoring.ts + transitions/page-events.ts sources. generated-
# script.ts is tracked in git (a deliberate departure from the gitignored
# routes-src/ convention — see the generator's header comment and #3421), so
# a plain `git diff` after a fresh regeneration is a real drift guard.
#
# Re-runs the generator's write-if-changed CLI entry point, then git-diffs
# the tracked path. A non-empty diff means scoring.ts or page-events.ts
# changed but the generated file was never regenerated and re-committed.
#
# Usage: pnpm check:search-widget-drift (or bash scripts/check-search-widget-drift.sh)
# Exit 0 = committed file matches a fresh generation. Exit 1 = drift detected.
#
# Wired into:
#   - scripts/run-b4push.sh (guard step)
#   - .github/workflows/pr-checks.yml (package-tests job — the generator
#     imports the `esbuild` dependency directly, so this can't run as a
#     no-install pure-Node guard job; it rides an already-installed job)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GENERATED_PATH="packages/zudo-doc/src/search-widget-script/generated-script.ts"

cd "$ROOT_DIR"

# The whole guard rests on the file being TRACKED: `git diff -- <path>` on an
# untracked path always exits 0, so re-adding the old .gitignore line (or a
# `git rm --cached`) would silently turn this check into a no-op forever.
# Assert tracking first so that regression fails loudly instead.
if ! git ls-files --error-unmatch -- "$GENERATED_PATH" >/dev/null 2>&1; then
  echo "Search-widget-script drift check FAILED — $GENERATED_PATH is not tracked in git."
  echo ""
  echo "Since zudolab/zudo-doc#3431 this generated file is committed on purpose"
  echo "(see the generator's header comment); an untracked file would make the"
  echo "\`git diff\` below vacuously pass."
  echo ""
  echo "Fix: remove any .gitignore entry for it and commit the file:"
  echo "  pnpm --filter @takazudo/zudo-doc gen:search-widget-script"
  echo "  git add $GENERATED_PATH"
  echo ""
  exit 1
fi

node packages/zudo-doc/scripts/gen-search-widget-script.mjs

if git diff --exit-code -- "$GENERATED_PATH"; then
  echo "OK — search-widget-script drift check passed. generated-script.ts matches a fresh generation."
  exit 0
fi

echo ""
echo "Search-widget-script drift check FAILED — the committed $GENERATED_PATH"
echo "does not match what the generator produces from the current"
echo "scoring.ts / transitions/page-events.ts sources."
echo ""
echo "This means scoring.ts or transitions/page-events.ts changed but the"
echo "generated file was never regenerated and committed."
echo ""
echo "Fix: regenerate and commit the result:"
echo "  pnpm --filter @takazudo/zudo-doc gen:search-widget-script"
echo "  git add $GENERATED_PATH"
echo ""
exit 1
