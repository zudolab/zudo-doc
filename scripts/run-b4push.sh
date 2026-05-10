#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)
#   2. Template drift check
#   3. Fixture settings drift check
#   4. Tags audit (--ci)
#   5. Design token lint
#   6. Type checking (zfb check)
#   7. Build (zfb build)
#   8. Link check
#   9. HTML validation (html-validate dist/**/*.html)
#  10. Automated preview smoke (blocking)
#  11. Manual interactive smoke (operator-driven)
#
# CI parity (Playwright E2E + GitHub Actions) is intentionally parked
# to E9b until the post-cutover migration window closes.
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 9)
#   B4PUSH_SKIP_PREVIEW_SMOKE=1  — skip the automated preview smoke
#   B4PUSH_SKIP_MANUAL_SMOKE=1   — skip the manual interactive smoke

START_TIME=$(date +%s)
FAILURES=()
TOTAL_STEPS=11
CURRENT_STEP=0

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ Step $CURRENT_STEP/$TOTAL_STEPS: $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAILURES+=("$1"); }
skip() { echo "⏭  $1 (skipped)"; }

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Step 1: Format check (mdx only) ───────────────────
step "Format check (mdx)"
if (cd "$ROOT_DIR" && pnpm run format:check); then
  pass "Format check passed"
else
  fail "Format check"
fi

# ── Step 2: Template drift check ──────────────────────
step "Template drift check"
if (cd "$ROOT_DIR" && bash scripts/check-template-drift.sh); then
  pass "Template drift check passed"
else
  fail "Template drift check"
fi

# ── Step 3: Fixture settings drift check ─────────────
step "Fixture settings drift check"
if (cd "$ROOT_DIR" && pnpm check:fixture-settings-drift); then
  pass "Fixture settings drift check passed"
else
  fail "Fixture settings drift check"
fi

# ── Step 4: Tags audit ────────────────────────────────
step "Tags audit (tags:audit --ci)"
if (cd "$ROOT_DIR" && pnpm tags:audit --ci); then
  pass "Tags audit passed"
else
  fail "Tags audit"
fi

# ── Step 5: Design token lint ────────────────────────
step "Design token lint"
if (cd "$ROOT_DIR" && pnpm lint:tokens); then
  pass "Design token lint passed"
else
  fail "Design token lint"
fi

# ── Step 6: Type checking ─────────────────────────────
# Prefer `zfb check` (the post-cutover entry point). If it fails to
# start (e.g. binary not yet built), fall back to `tsc --noEmit` so the
# typecheck still gates pushes.
step "Type checking (zfb check)"
if (cd "$ROOT_DIR" && pnpm check); then
  pass "Type checking passed (zfb check)"
elif (cd "$ROOT_DIR" && pnpm exec tsc --noEmit); then
  pass "Type checking passed (tsc --noEmit fallback)"
else
  fail "Type checking"
fi

# ── Step 7: Build ─────────────────────────────────────
step "Build (zfb build)"
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 8: Link check ────────────────────────────────
#
# Strict on broken links + absolute MDX-source warnings (real 404s
# / sub-path bypass). Trailing-slash warnings stay warn-only — they
# 301-redirect rather than 404 and the allowlist would need a new
# entry every time the basePath rewriter regresses, which is the
# exact noise-floor we already detect via build-time signals.
#
# Allowlist file at `.check-links-allowlist` carries the known
# pre-existing exceptions (JA→EN cross-locale references, runtime-
# generated route URLs that don't have MDX sources). Delete an
# entry whenever the underlying issue gets fixed so the strict
# gate then catches future regressions of the same shape.
step "Link check (check-links --strict-broken --strict-absolute)"
if (cd "$ROOT_DIR" && pnpm run check:links -- --strict-broken --strict-absolute --allowlist=.check-links-allowlist); then
  pass "Link check passed"
else
  fail "Link check"
fi

# ── Step 9: HTML validation ───────────────────────────
step "HTML validation (html-validate)"
if [[ "${B4PUSH_SKIP_HTML_VALIDATE:-}" == "1" ]]; then
  skip "HTML validation (B4PUSH_SKIP_HTML_VALIDATE=1)"
else
  if (cd "$ROOT_DIR" && pnpm run check:html); then
    pass "HTML validation passed"
  else
    fail "HTML validation"
  fi
fi

# ── Step 10: Automated preview smoke (blocking) ──────
step "Preview smoke (automated)"
if [[ "${B4PUSH_SKIP_PREVIEW_SMOKE:-}" == "1" ]]; then
  skip "Preview smoke (B4PUSH_SKIP_PREVIEW_SMOKE=1)"
else
  if (cd "$ROOT_DIR" && pnpm run smoke:preview); then
    pass "Preview smoke passed"
  else
    fail "Preview smoke"
  fi
fi

# ── Step 11: Manual interactive smoke ────────────────
step "Manual interactive smoke"
if [[ "${B4PUSH_SKIP_MANUAL_SMOKE:-}" == "1" ]]; then
  skip "Manual smoke (B4PUSH_SKIP_MANUAL_SMOKE=1)"
else
  cat <<'MANUAL'
Run `pnpm preview` in another terminal and exercise:
  • theme toggle (light/dark)
  • mobile menu (narrow viewport)
  • search dropdown (header search)
  • code-block syntax highlighting
  • mermaid diagram renders
  • image enlarge (click an inline image)
  • doc-history widget (sidebar/footer history list)

Press [Enter] when all flows look healthy, or Ctrl-C to abort.
MANUAL
  if read -r _; then
    pass "Manual smoke acknowledged"
  else
    fail "Manual smoke (aborted)"
  fi
fi

# ── Summary ──────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUMMARY (${DURATION}s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "✅ All $TOTAL_STEPS checks passed (or skipped). Safe to push."
  exit 0
else
  echo "❌ ${#FAILURES[@]} check(s) failed:"
  for f in "${FAILURES[@]}"; do
    echo "   - $f"
  done
  exit 1
fi
