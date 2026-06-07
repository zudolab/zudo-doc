#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)
#   2. Template drift check
#   3. Pin parity check (root pkg.json ↔ scaffold.ts zfb pins — W4A #1732)
#   4. Fixture settings drift check
#   5. Tags audit (--ci)
#   6. Design token lint
#   7. B4push/CI parity check (guard manifest meta-check — #1967)
#   8. Type checking (zfb check + workspace package typechecks)
#   9. Root unit tests (test:unit)
#  10. Build (zfb build)
#  11. Link check
#  12. HTML validation (html-validate dist/**/*.html)
#  13. Automated preview smoke (blocking)
#  14. Manual interactive smoke (operator-driven)
#
# CI parity (Playwright E2E + GitHub Actions) is intentionally parked
# to E9b until the post-cutover migration window closes.
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 10)
#   B4PUSH_SKIP_PREVIEW_SMOKE=1  — skip the automated preview smoke
#   B4PUSH_SKIP_MANUAL_SMOKE=1   — skip the manual interactive smoke

START_TIME=$(date +%s)
FAILURES=()
TOTAL_STEPS=14
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

# >>> b4push-ci-parity:guards
# Steps 1–7 are lightweight guard gates. They are delimited by the markers
# above/below so check-b4push-ci-parity.mjs can cross-check them against the
# REQUIRED_CI_GUARDS manifest without brittle full-file parsing.

# ── Step 1: Format check (mdx only) ───────────────────
step "Format check (mdx)"
if (cd "$ROOT_DIR" && pnpm format:check:mdx); then
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

# ── Step 3: Pin parity check (W4A — #1732) ───────────
# Verifies the @takazudo/zfb / @takazudo/zfb-runtime pins in root
# package.json match the literals in packages/create-zudo-doc/src/scaffold.ts.
# Pure-Node, no install needed — cheap, runs before typecheck.
step "Pin parity check (check:pin-parity)"
if (cd "$ROOT_DIR" && pnpm check:pin-parity); then
  pass "Pin parity check passed"
else
  fail "Pin parity check"
fi

# ── Step 4: Fixture settings drift check ─────────────
step "Fixture settings drift check"
if (cd "$ROOT_DIR" && pnpm check:fixture-settings-drift); then
  pass "Fixture settings drift check passed"
else
  fail "Fixture settings drift check"
fi

# ── Step 5: Tags audit ────────────────────────────────
step "Tags audit (tags:audit --ci)"
if (cd "$ROOT_DIR" && pnpm tags:audit --ci); then
  pass "Tags audit passed"
else
  fail "Tags audit"
fi

# ── Step 6: Design token lint ────────────────────────
step "Design token lint"
if (cd "$ROOT_DIR" && pnpm lint:tokens); then
  pass "Design token lint passed"
else
  fail "Design token lint"
fi

# ── Step 7: B4push/CI parity check ───────────────────
# Pure-Node check — verifies every lightweight guard gate in this file also
# has a corresponding CI job. See scripts/check-b4push-ci-parity.mjs.
step "B4push/CI parity check (check:b4push-ci-parity)"
if (cd "$ROOT_DIR" && pnpm check:b4push-ci-parity); then
  pass "B4push/CI parity check passed"
else
  fail "B4push/CI parity check"
fi

# <<< b4push-ci-parity:guards

# ── Step 8: Type checking ─────────────────────────────
# Prefer `zfb check` (the post-cutover entry point). If it fails to
# start (e.g. binary not yet built), fall back to `tsc --noEmit` so the
# typecheck still gates pushes.
step "Type checking (zfb check + packages)"
if (cd "$ROOT_DIR" && pnpm check); then
  pass "Type checking passed (zfb check)"
elif (cd "$ROOT_DIR" && pnpm exec tsc --noEmit); then
  pass "Type checking passed (tsc --noEmit fallback)"
else
  fail "Type checking"
fi

# Workspace package typechecks: `zfb check` only covers the root tsconfig
# (packages/ are excluded), so a red package typecheck was invisible to
# every gate until review-loop 2026-06-05 found one. Runs each package's
# own `typecheck` script (packages without one are skipped by pnpm).
if (cd "$ROOT_DIR" && pnpm -r --filter './packages/*' typecheck); then
  pass "Package typechecks passed"
else
  fail "Package typechecks"
fi

# ── Step 9: Root unit tests ───────────────────────────
# Root `test:unit` (vitest) guards src/**/__tests__ and scripts/__tests__,
# which previously ran in no local gate and no CI workflow (#1856). Runs
# before the expensive site build for fast logic-level feedback.
#
# Build @takazudo/zudo-doc first: several root suites import
# @takazudo/zudo-doc/theme, whose compiled dist/ does not exist on a fresh
# clone (`pnpm install` does not run the package's tsup build). CI's package
# and root test jobs build it for the same reason. Building here also leaves
# dist/ ready for the site build in the next step.
step "Root unit tests (test:unit)"
if (cd "$ROOT_DIR" && pnpm --filter @takazudo/zudo-doc build && pnpm test:unit); then
  pass "Root unit tests passed"
else
  fail "Root unit tests"
fi

# ── Step 10: Build ────────────────────────────────────
step "Build (zfb build)"
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 11: Link check ───────────────────────────────
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

# ── Step 12: HTML validation ──────────────────────────
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

# ── Step 13: Automated preview smoke (blocking) ──────
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

# ── Step 14: Manual interactive smoke ────────────────
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
