#!/usr/bin/env bash
set -euo pipefail

if ((BASH_VERSINFO[0] < 4)); then
  echo "Error: bash 4+ is required (found bash $BASH_VERSION)." >&2
  echo "On macOS, install via: brew install bash" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALLOWLIST="$ROOT_DIR/.template-drift-allowlist"

# Load allowlist into an associative array
declare -A ALLOWED
if [[ -f "$ALLOWLIST" ]]; then
  while IFS= read -r line; do
    # Skip blank lines and comments
    [[ -z "$line" || "$line" == \#* ]] && continue
    ALLOWED["$line"]=1
  done < "$ALLOWLIST"
fi

# ---------------------------------------------------------------------------
# "use client" directive-parity exceptions
# ---------------------------------------------------------------------------
# The whole-file content check above skips anything in .template-drift-allowlist.
# Several allowlisted island components legitimately diverge in BODY from their
# host counterpart (no-op stubs, leaner downstream variants) but must still
# carry the same "use client" module directive — otherwise generated projects
# ship dead islands that never hydrate and zfb >= next.38 prints island-marker
# warnings. See zudolab/zudo-doc#2047.
#
# check_directive_parity() therefore enforces directive parity for every
# template/host pair INDEPENDENTLY of the content allowlist (.template-drift-
# allowlist entries, keyed by prod path, do NOT exempt a file here; this list
# is keyed by TEMPLATE-relative path and gates the directive check only).
#
# Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660 / Wave 7
# #2663): the base template's `src/components/**` directory — every entry this
# map used to reference — is GONE. The locked ~12-file manifest ships no
# component overrides at all; the package owns chrome/islands entirely (see
# packages/create-zudo-doc/CLAUDE.md's "Template Directories" table). The
# `sidebarToggle` feature (whose overlay was the map's other entry) is now
# pure settings-field emission too — its `templates/features/sidebarToggle/`
# directory is deleted. This map is therefore EMPTY today. It is kept (not
# deleted outright) as live infrastructure for the day a future feature
# genuinely needs a directive-exempt stub again — the "guard against
# exemption rot" loop below fails loudly the moment a stale entry is added
# back without a real template file to match, so an empty map costs nothing.
declare -A DIRECTIVE_EXEMPT=()

TEMPLATES_DIR="$ROOT_DIR/packages/create-zudo-doc/templates"

# True when the file's FIRST line is a "use client" module directive. The
# directive is only valid as the very first statement, so line 1 is checked
# strictly — a "use client" string buried after comments is not a directive.
has_use_client() {
  local first
  first="$(head -1 "$1")"
  # Tolerate a UTF-8 BOM and CRLF line ending so a byte-level oddity in one
  # copy cannot silently flip parity into a false result.
  first="${first#$'\xef\xbb\xbf'}"
  first="${first%$'\r'}"
  [[ "$first" == '"use client";' || "$first" == "'use client';" \
    || "$first" == '"use client"' || "$first" == "'use client'" ]]
}

DRIFTED=()

# ---------------------------------------------------------------------------
# claude-resources parity guard (#2533)
# ---------------------------------------------------------------------------
# Historically these four prod paths got a NORMALIZED diff (comment lines and
# the package's Node-ESM-required ".js" relative-import extension stripped
# from both sides) instead of a blanket allowlist exemption, so a real logic
# drift between the template copy and the package source stayed visible.
#
# Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2660): the
# `claudeResources` feature's template directory
# (templates/features/claudeResources/files/src/integrations/claude-resources/)
# was deleted entirely — empirically verified dead (nothing imported it; the
# package already ships the same generator/escape-helper logic behind
# @takazudo/zudo-doc/plugins/claude-resources, and the feature is now
# pure settings-field emission, same as most other features post package-first
# migration). There is no template-side claude-resources file left to diff, so
# this map is EMPTY. Kept (not deleted) as live infrastructure — should a
# future feature need a real, Node-ESM-vs-bundler-import-extension-normalized
# file copy again, the normalize_claude_resources_content /
# check_pair_normalized machinery below is ready to reuse; an empty map costs
# nothing since check_pair() only routes through it for a prod_path that is
# actually a key here.
declare -A CLAUDE_RESOURCES_PARITY_PATHS=()

# Strips pure comment lines (// line comments and /** ... */ JSDoc blocks,
# matched whole-line-only so no code line is touched) and drops the ".js"
# extension from relative-import specifiers, then drops blank lines left
# behind. Scoped to the narrow claude-resources pair set above — not a
# general-purpose comment stripper.
normalize_claude_resources_content() {
  sed -E \
    -e '\%^[[:space:]]*(//|/\*|\*)%d' \
    -e 's#(from "\.\.?/[^"]+)\.js"#\1"#' \
    -e "s#(from '\.\.?/[^']+)\.js'#\1'#" \
    "$1" | sed '/^[[:space:]]*$/d'
}

check_pair_normalized() {
  local template_file="$1"
  local prod_path="$2"
  local prod_file="$ROOT_DIR/${CLAUDE_RESOURCES_PARITY_PATHS[$prod_path]}"

  if [[ ! -f "$prod_file" ]]; then
    echo "  [MISSING IN PROD] $prod_path"
    DRIFTED+=("$prod_path")
    return
  fi

  local norm_tmpl norm_prod
  norm_tmpl="$(normalize_claude_resources_content "$template_file")"
  norm_prod="$(normalize_claude_resources_content "$prod_file")"

  if [[ "$norm_tmpl" != "$norm_prod" ]]; then
    echo "  [DIFF] $prod_path (claude-resources parity guard, #2533)"
    DRIFTED+=("$prod_path")
  fi
}

# ---------------------------------------------------------------------------
# global.css legacy-token guard (#2621, rewritten for the ~29-line minimal
# form by #2663)
# ---------------------------------------------------------------------------
# packages/create-zudo-doc/templates/base/src/styles/global.css is allowlisted
# in .template-drift-allowlist (the showcase's global.css carries ~300 lines
# of its OWN @theme token block that the minimal template intentionally does
# not — see the allowlist entry), so check_pair() above never inspects it.
# That blind spot originally let it drift to the pre-ramp-restructure legacy
# 16-slot token set (--zd-sel-bg/fg, --color-p0..15, --zd-0..15) even after
# the ramp-native engine stopped emitting those vars. This guard runs
# UNCONDITIONALLY (the allowlist does not exempt it): it fails on any legacy-
# token reference.
#
# Minimal-scaffold cutover (epic zudolab/zudo-doc#2651, Wave 6 #2655/#2660):
# the template's global.css no longer declares ANY `@theme` tokens itself —
# it ships a fixed `@import` chain and pulls the full token set (including
# the ramp-native --zd-selection-bg/-fg marker this guard used to grep for
# directly) from `@takazudo/zudo-doc/theme.css`. So the "hasn't silently
# regressed" marker is no longer the ramp-native CSS custom property itself
# (the template file never contains it) — it is the `@import
# "@takazudo/zudo-doc/theme.css";` line: if that import is ever removed, the
# scaffolded project loses its entire default token set (not just the
# selection-color pair), which is the failure this guard exists to catch.
#
# Pattern is deliberately exact — do NOT loosen to `--zd-sel` / `--zd-sel-`:
# that substring false-positives on the correctly-migrated --zd-selection-bg/
# -fg (which contain "--zd-sel" as a prefix). The surviving Tailwind token
# --color-sel-bg (Tier 2, not a legacy raw-palette var) must also not match.
GLOBAL_CSS_LEGACY_TOKEN_RE='--zd-sel-(bg|fg)|--color-p[0-9]|--zd-[0-9]'

check_global_css_legacy_tokens() {
  local global_css="$BASE_DIR/src/styles/global.css"

  if [[ ! -f "$global_css" ]]; then
    echo "  [MISSING] base/src/styles/global.css"
    DRIFTED+=("base/src/styles/global.css (missing)")
    return
  fi

  if grep -E -n -- "$GLOBAL_CSS_LEGACY_TOKEN_RE" "$global_css" >/dev/null; then
    echo "  [LEGACY TOKEN] base/src/styles/global.css references a pre-ramp-restructure token:"
    grep -E -n -- "$GLOBAL_CSS_LEGACY_TOKEN_RE" "$global_css" | sed 's/^/    /'
    DRIFTED+=("base/src/styles/global.css (legacy token)")
  fi

  if ! grep -qF -- '@takazudo/zudo-doc/theme.css' "$global_css"; then
    echo "  [MISSING MARKER] base/src/styles/global.css does not import @takazudo/zudo-doc/theme.css (default token-set marker)"
    DRIFTED+=("base/src/styles/global.css (missing default token-set import)")
  fi
}

check_pair() {
  local template_file="$1"
  local prod_path="$2" # relative to repo root

  # claude-resources pairs use the normalized parity guard above instead of
  # a raw byte diff (and are never allowlist-exempt — see .template-drift-
  # allowlist).
  if [[ -n "${CLAUDE_RESOURCES_PARITY_PATHS[$prod_path]+_}" ]]; then
    check_pair_normalized "$template_file" "$prod_path"
    return
  fi

  # Skip if in allowlist
  if [[ -n "${ALLOWED[$prod_path]+_}" ]]; then
    return
  fi

  local prod_file="$ROOT_DIR/$prod_path"

  if [[ ! -f "$prod_file" ]]; then
    echo "  [MISSING IN PROD] $prod_path"
    DRIFTED+=("$prod_path")
    return
  fi

  diff -q "$template_file" "$prod_file" >/dev/null 2>&1 && diff_exit=0 || diff_exit=$?
  if [[ $diff_exit -eq 1 ]]; then
    echo "  [DIFF] $prod_path"
    DRIFTED+=("$prod_path")
  elif [[ $diff_exit -ne 0 ]]; then
    echo "  [ERROR] diff failed (exit $diff_exit) for $prod_path" >&2
    DRIFTED+=("$prod_path")
  fi
}

check_directive_parity() {
  local template_file="$1"
  local prod_path="$2" # relative to repo root
  local tmpl_key="${template_file#"$TEMPLATES_DIR/"}"

  # Skip files explicitly exempted from directive parity (intentional no-op
  # base stubs that legitimately ship without the host's "use client").
  if [[ -n "${DIRECTIVE_EXEMPT[$tmpl_key]+_}" ]]; then
    return
  fi

  local prod_file="$ROOT_DIR/$prod_path"
  # No host counterpart → nothing to compare. The content-drift pass already
  # reports genuinely-missing prod files when they are not allowlisted.
  # "return 0" is load-bearing: a bare "return" after the failed [[ -f ]]
  # propagates status 1 and set -e aborts the whole scan on the first
  # template-only file.
  [[ -f "$prod_file" ]] || return 0

  local host_has=0 tmpl_has=0
  has_use_client "$prod_file" && host_has=1
  has_use_client "$template_file" && tmpl_has=1

  if [[ "$host_has" != "$tmpl_has" ]]; then
    echo "  [USE-CLIENT DRIFT] $prod_path (host=$host_has template=$tmpl_has) [$tmpl_key]"
    DRIFTED+=("$prod_path (\"use client\" directive)")
  fi
}

# Guard against exemption rot: every DIRECTIVE_EXEMPT key must still point at
# an existing template file that still ships WITHOUT the directive. A renamed
# or deleted stub — or a stub that gained "use client" — leaves a stale entry
# that would silently exempt a future file of the same name.
for tmpl_key in "${!DIRECTIVE_EXEMPT[@]}"; do
  exempt_file="$TEMPLATES_DIR/$tmpl_key"
  if [[ ! -f "$exempt_file" ]]; then
    echo "  [STALE EXEMPT] $tmpl_key — no such template file; remove the DIRECTIVE_EXEMPT entry"
    DRIFTED+=("$tmpl_key (stale DIRECTIVE_EXEMPT entry)")
  elif has_use_client "$exempt_file"; then
    echo "  [STALE EXEMPT] $tmpl_key — template now carries \"use client\"; remove the DIRECTIVE_EXEMPT entry"
    DRIFTED+=("$tmpl_key (obsolete DIRECTIVE_EXEMPT entry)")
  fi
done

echo "Checking base template files..."

BASE_DIR="$ROOT_DIR/packages/create-zudo-doc/templates/base"
while IFS= read -r -d '' template_file; do
  prod_path="${template_file#"$BASE_DIR/"}"
  check_pair "$template_file" "$prod_path"
  check_directive_parity "$template_file" "$prod_path"
done < <(find "$BASE_DIR" -type f -print0 | sort -z)

echo "Checking global.css legacy-token guard..."
check_global_css_legacy_tokens

echo "Checking feature template files..."

FEATURES_DIR="$ROOT_DIR/packages/create-zudo-doc/templates/features"
for feature_dir in "$FEATURES_DIR"/*/; do
  files_dir="${feature_dir}files"
  if [[ ! -d "$files_dir" ]]; then
    continue
  fi
  while IFS= read -r -d '' template_file; do
    prod_path="${template_file#"$files_dir/"}"
    check_pair "$template_file" "$prod_path"
    check_directive_parity "$template_file" "$prod_path"
  done < <(find "$files_dir" -type f -print0 | sort -z)
done

echo ""
if [[ ${#DRIFTED[@]} -eq 0 ]]; then
  echo "✅ No template drift detected."
  exit 0
else
  echo "❌ ${#DRIFTED[@]} file(s) have unexpected drift:"
  for f in "${DRIFTED[@]}"; do
    echo "   - $f"
  done
  exit 1
fi
