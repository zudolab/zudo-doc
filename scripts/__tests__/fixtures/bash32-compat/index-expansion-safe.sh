#!/usr/bin/env bash
# Negative fixture: "${!arr[@]}" (index expansion) on an array declared
# empty ("LOCALE_CODES=()") with NO length guard anywhere in the file.
# Index expansion on an empty array was measured safe on bash 3.2.57 during
# #4044 — guarding it would add dead code — so this must NOT be flagged even
# though the array-expansion check above would flag the equivalent "[@]"
# value expansion in the same unguarded shape.
set -euo pipefail

LOCALE_CODES=()

for locale_index in "${!LOCALE_CODES[@]}"; do
  echo "${LOCALE_CODES[$locale_index]}"
done

LOCALE_CODES+=("ja")
