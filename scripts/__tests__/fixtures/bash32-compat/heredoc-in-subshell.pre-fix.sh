#!/usr/bin/env bash
# Fixture: the pre-#4044 shape of the CONFIG_LOCALE_DATA reader in
# scripts/setup-doc-skill.sh — a heredoc opened directly inside the `$( ... )`
# command substitution used for the assignment. bash 3.2's parser does not
# honour a heredoc opened this way: it scans the body as shell text instead
# of a literal block, so an unbalanced quote/backtick anywhere in it (as in
# the real ~243-line JS body that broke #4041) fails the WHOLE FILE to parse.
#
# This is a minimal reproduction of the real defect's SHAPE, not the real
# file reverted — see scripts/check-bash32-compat.mjs's header for why a
# fixture is used instead ("prove with a committed fixture, not by reverting
# the real file").
set -euo pipefail

CONFIG_LOCALE_DATA="$(node - "$ROOT_DIR" <<'NODE'
const fs = require("node:fs");
console.log("hello");
NODE
)"

echo "$CONFIG_LOCALE_DATA"
