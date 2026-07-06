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
# The exempted files are deliberate no-op base stubs whose host counterparts
# are real "use client" islands. They ship WITHOUT the directive because the
# stub never emits an island marker in a generated project:
# - desktop-sidebar-toggle: the real, directive-carrying implementation is a
#   feature overlay (sidebarToggle) that replaces the stub when the feature is
#   enabled; the base stub serves feature-disabled scaffolds, where it renders
#   nothing. The overlay copy has a different template-relative key and stays
#   checked.
# - design-token-panel-bootstrap: base stub was DELETED in #2162 (gating zdtp
#   scaffolding behind the designTokenPanel feature). The real implementation
#   now lives only in the designTokenPanel feature overlay and is NOT in the
#   base template at all.
# - preset-generator: renders null and is only reachable through the MDX
#   component map when a doc page uses it; downstream projects replace the
#   stub to wire a real implementation (see the stub's header comment).
# Contrast ai-chat-modal: its base copy is Island-wrapped unconditionally in
# pages/lib/_body-end-islands.tsx, so even as a minimal component it MUST
# carry the directive — that is why it is NOT exempt (zudolab/zudo-doc#2047).
declare -A DIRECTIVE_EXEMPT=(
  ["base/src/components/desktop-sidebar-toggle.tsx"]=1
  ["base/src/components/preset-generator.tsx"]=1
  # S2 (#2344) — sidebar-tree.tsx, sidebar-toggle.tsx (base)
  # and desktop-sidebar-toggle.tsx (sidebarToggle feature overlay) are thin
  # re-export stubs.  "use client" lives in the package island source;
  # the local shim does not need to repeat it. (site-tree-nav.tsx's shim was
  # removed in the #2371/#2374 fast-follow — both index pages import the
  # package island @takazudo/zudo-doc/site-tree-nav-island directly now.)
  ["base/src/components/sidebar-tree.tsx"]=1
  ["base/src/components/sidebar-toggle.tsx"]=1
  ["features/sidebarToggle/files/src/components/desktop-sidebar-toggle.tsx"]=1
)

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
# These four prod paths used to be blanket-exempted in .template-drift-
# allowlist, which meant a real logic drift between the template copy and
# the package source (e.g. a missing bugfix or a missing regression test)
# was invisible to CI. They carry exactly one INTENTIONAL, permanent
# difference: the package source uses explicit ".js" import extensions
# (dist/ is consumed directly by Node ESM, which requires them on relative
# imports), while the template is compiled by the host's bundler (zfb/Vite,
# moduleResolution "Bundler"), which does not need them. So instead of a
# blanket exemption, these pairs get a NORMALIZED diff — comment lines and
# the ".js" relative-import extension are stripped from both sides before
# comparing — so any other difference (a real logic or test-coverage drift)
# still fails the check.
#
# The "canonical" copy these template files sync from is NOT a root-relative
# host path (the naive BASE_DIR/-stripped prod_path used by every other
# check_pair() call) — it's the workspace package source at
# packages/zudo-doc/src/integrations/claude-resources/, re-exported at
# runtime as @takazudo/zudo-doc/integrations/claude-resources. So the map
# value is the real comparison path, keyed by the usual stripped prod_path
# (used only for display / the DRIFTED report).
declare -A CLAUDE_RESOURCES_PARITY_PATHS=(
  ["src/integrations/claude-resources/__tests__/escape-for-mdx.test.ts"]="packages/zudo-doc/src/integrations/claude-resources/__tests__/escape-for-mdx.test.ts"
  ["src/integrations/claude-resources/__tests__/generate.test.ts"]="packages/zudo-doc/src/integrations/claude-resources/__tests__/generate.test.ts"
  ["src/integrations/claude-resources/escape-for-mdx.ts"]="packages/zudo-doc/src/integrations/claude-resources/escape-for-mdx.ts"
  ["src/integrations/claude-resources/generate.ts"]="packages/zudo-doc/src/integrations/claude-resources/generate.ts"
)

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
# global.css legacy-token guard (#2621)
# ---------------------------------------------------------------------------
# packages/create-zudo-doc/templates/base/src/styles/global.css is allowlisted
# in .template-drift-allowlist (~120 lines of intentional slot/feature/@source
# delta make byte parity with the showcase impossible), so check_pair() above
# never inspects it. That blind spot let it drift to the pre-ramp-restructure
# legacy 16-slot token set (--zd-sel-bg/fg, --color-p0..15, --zd-0..15) even
# after the ramp-native engine stopped emitting those vars — scaffolded
# projects would reference dead CSS custom properties. This guard runs
# UNCONDITIONALLY (the allowlist does not exempt it): it fails on any legacy-
# token reference, and separately asserts the ramp-native --zd-selection-bg
# marker is present so the file can't silently regress to pre-migration
# wording either.
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

  if ! grep -qF -- '--zd-selection-bg' "$global_css"; then
    echo "  [MISSING MARKER] base/src/styles/global.css does not reference --zd-selection-bg (ramp-native marker)"
    DRIFTED+=("base/src/styles/global.css (missing ramp-native marker)")
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
