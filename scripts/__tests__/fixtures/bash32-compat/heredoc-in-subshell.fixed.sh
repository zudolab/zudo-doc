#!/usr/bin/env bash
# Fixture: the #4044-fixed shape of the same reader. The heredoc is moved to
# statement level inside a function; the function's stdout is then captured
# by a plain `$(read_config_locale_data)` call with no heredoc inside it.
# bash 3.2 parses this correctly.
set -euo pipefail

read_config_locale_data() {
  node - "$ROOT_DIR" <<'NODE'
const fs = require("node:fs");
console.log("hello");
NODE
}
CONFIG_LOCALE_DATA="$(read_config_locale_data)"

echo "$CONFIG_LOCALE_DATA"
