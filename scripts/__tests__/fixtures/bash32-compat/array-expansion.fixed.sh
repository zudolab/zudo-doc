#!/usr/bin/env bash
# Fixture: the #4044-fixed shape — the same loop wrapped in the
# "${#arr[@]}" -gt 0 length guard this file's other arrays already use.
set -euo pipefail

LOCALE_CODES=()

if [ "${#LOCALE_CODES[@]}" -gt 0 ]; then
  for existing_code in "${LOCALE_CODES[@]}"; do
    echo "$existing_code"
  done
fi

LOCALE_CODES+=("ja")
