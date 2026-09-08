#!/usr/bin/env bash
# Fixture: the pre-#4044 shape of the LOCALE_CODES duplicate scan in
# scripts/setup-doc-skill.sh — a "${arr[@]}" expansion of an array declared
# empty ("LOCALE_CODES=()") with no "${#arr[@]}" length guard anywhere in the
# file. Under `set -u`, bash 3.2 treats this as an unbound-variable error
# while the array is still empty.
set -euo pipefail

LOCALE_CODES=()

for existing_code in "${LOCALE_CODES[@]}"; do
  echo "$existing_code"
done

LOCALE_CODES+=("ja")
