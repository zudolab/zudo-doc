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
# template/host pair INDEPENDENTLY of the content allowlist. A few template
# files are intentional no-op base stubs that legitimately ship WITHOUT the
# host's directive (permanent stubs with no feature counterpart, not registered
# as live islands in the generated page tree). They are keyed by their
# template-relative path so the exemption applies to the base stub ONLY — the
# real feature-template counterparts (which DO carry the directive) stay checked.
declare -A DIRECTIVE_EXEMPT=(
  ["base/src/components/design-token-panel-bootstrap.tsx"]=1
  ["base/src/components/desktop-sidebar-toggle.tsx"]=1
  ["base/src/components/preset-generator.tsx"]=1
)

TEMPLATES_DIR="$ROOT_DIR/packages/create-zudo-doc/templates"

# True when the file's FIRST line is a "use client" module directive. The
# directive is only valid as the very first statement, so line 1 is checked
# strictly — a "use client" string buried after comments is not a directive.
has_use_client() {
  local first
  first="$(head -1 "$1")"
  [[ "$first" == '"use client";' || "$first" == "'use client';" \
    || "$first" == '"use client"' || "$first" == "'use client'" ]]
}

DRIFTED=()

check_pair() {
  local template_file="$1"
  local prod_path="$2" # relative to repo root

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
  [[ -f "$prod_file" ]] || return

  local host_has=0 tmpl_has=0
  has_use_client "$prod_file" && host_has=1
  has_use_client "$template_file" && tmpl_has=1

  if [[ "$host_has" != "$tmpl_has" ]]; then
    echo "  [USE-CLIENT DRIFT] $prod_path (host=$host_has template=$tmpl_has) [$tmpl_key]"
    DRIFTED+=("$prod_path (\"use client\" directive)")
  fi
}

echo "Checking base template files..."

BASE_DIR="$ROOT_DIR/packages/create-zudo-doc/templates/base"
while IFS= read -r -d '' template_file; do
  prod_path="${template_file#"$BASE_DIR/"}"
  check_pair "$template_file" "$prod_path"
  check_directive_parity "$template_file" "$prod_path"
done < <(find "$BASE_DIR" -type f -print0 | sort -z)

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
