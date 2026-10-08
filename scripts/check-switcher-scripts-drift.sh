#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
GENERATED_PATH="packages/zudo-doc/src/i18n-version/switcher-generated-scripts.ts"
git ls-files --error-unmatch -- "$GENERATED_PATH" >/dev/null
node packages/zudo-doc/scripts/gen-switcher-scripts.mjs
git diff --exit-code -- "$GENERATED_PATH"
echo 'OK — switcher scripts match their committed generation.'
