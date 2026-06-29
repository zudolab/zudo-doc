#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)
#   2. Template drift check
#   3. No-host-alias-in-package guard (#2344) — package must not import the `@/` host alias
#   4. Pin parity check (root pkg.json ↔ scaffold.ts zfb pins — W4A #1732)
#   5. Fixture settings drift check
#   6. Tags audit (--ci)
#   7. Design token lint
#   8. Z-index codegen drift check (check:z-index — #2148)
#   9. E2E spec naming guard (#2095) — asserts fixture-prefix + no orphan specs
#  10. @flaky/@local-only tracking-issue guard (#2292) — every quarantined test must link an issue
#  11. B4push/CI parity check (guard manifest meta-check — #1967)
#  12. Type checking (zfb check + workspace package typechecks)
#  13. Root unit tests (test:unit) — builds @takazudo/zudo-doc as a side-effect
#  14. Package tests (test:packages) — ~993 suite tests across workspace packages
#  15. Package safelist check (#1994) — requires dist/safelist.css from step 13
#  16. Build (zfb build)
#  17. Link check
#  18. HTML validation (html-validate dist/**/*.html)
#  19. Automated preview smoke (blocking)
#  20. Manual interactive smoke (operator-driven)
#
# Playwright E2E runs in CI (pr-checks e2e job); b4push intentionally excludes
# it for time-budget reasons — the bounded fast pass stays fast.
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 16)
#   B4PUSH_SKIP_PREVIEW_SMOKE=1  — skip the automated preview smoke
#   B4PUSH_SKIP_MANUAL_SMOKE=1   — skip the manual interactive smoke

START_TIME=$(date +%s)
FAILURES=()
TOTAL_STEPS=21
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

# >>> b4push-ci-parity:guards:begin
# Steps 1–11 are lightweight guard gates. They are delimited by the markers
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

# ── Step 3: No-host-alias-in-package guard (#2344) ────
# Pure-Node check — fails if packages/zudo-doc/src/** imports the host `@/`
# alias, which does not exist in published/scaffolded consumers (a silent
# package-boundary leak). Structural enforcement of the package-first core
# constraint.
step "No-host-alias-in-package guard (check:no-host-alias-in-package)"
if (cd "$ROOT_DIR" && pnpm check:no-host-alias-in-package); then
  pass "No-host-alias-in-package guard passed"
else
  fail "No-host-alias-in-package guard"
fi

# ── Step 4: Pin parity check (W4A — #1732) ───────────
# Verifies the @takazudo/zfb / @takazudo/zfb-runtime pins in root
# package.json match the literals in packages/create-zudo-doc/src/scaffold.ts.
# Pure-Node, no install needed — cheap, runs before typecheck.
step "Pin parity check (check:pin-parity)"
if (cd "$ROOT_DIR" && pnpm check:pin-parity); then
  pass "Pin parity check passed"
else
  fail "Pin parity check"
fi

# ── Step 5: Fixture settings drift check ─────────────
step "Fixture settings drift check"
if (cd "$ROOT_DIR" && pnpm check:fixture-settings-drift); then
  pass "Fixture settings drift check passed"
else
  fail "Fixture settings drift check"
fi

# ── Step 6: Tags audit ────────────────────────────────
step "Tags audit (tags:audit --ci)"
if (cd "$ROOT_DIR" && pnpm tags:audit --ci); then
  pass "Tags audit passed"
else
  fail "Tags audit"
fi

# ── Step 7: Design token lint ────────────────────────
step "Design token lint"
if (cd "$ROOT_DIR" && pnpm lint:tokens); then
  pass "Design token lint passed"
else
  fail "Design token lint"
fi

# ── Step 8: Z-index codegen drift check ──────────────
# pnpm check:z-index routes through the @takazudo/zudo-doc `gen-z-index` bin
# (--check mode, S9b #2334) — re-runs the z-index @theme codegen into a buffer
# and fails if src/styles/global.css drifts from src/config/z-index-tokens.ts
# (the single source of truth). Also the structural guard for CSS-file raw
# z-index: every z-index now flows through this generated block.
step "Z-index codegen drift check (check:z-index)"
if (cd "$ROOT_DIR" && pnpm check:z-index); then
  pass "Z-index codegen drift check passed"
else
  fail "Z-index codegen drift check"
fi

# ── Step 9: Component-tokens codegen drift check ─────
# pnpm check:component-tokens routes through the @takazudo/zudo-doc
# `gen-component-tokens` bin (--check mode, #2448) — re-runs the --zdc-*
# component token codegen into a buffer and fails if
# packages/zudo-doc/src/content.css drifts from
# packages/zudo-doc/src/config/component-tokens.ts (the single source of truth).
step "Component-tokens codegen drift check (check:component-tokens)"
if (cd "$ROOT_DIR" && pnpm check:component-tokens); then
  pass "Component-tokens codegen drift check passed"
else
  fail "Component-tokens codegen drift check"
fi

# ── Step 10: E2E spec naming guard (#2095) ────────────
# Pure-Node check — asserts (a) every e2e/*.spec.ts starts with a known
# fixture prefix so Playwright's testMatch glob actually picks it up, and
# (b) no *.spec.ts files exist outside e2e/ except those allowlisted in
# .check-e2e-spec-naming-allowlist.
step "E2E spec naming guard (check:e2e-spec-naming)"
if (cd "$ROOT_DIR" && pnpm check:e2e-spec-naming); then
  pass "E2E spec naming guard passed"
else
  fail "E2E spec naming guard"
fi

# ── Step 11: @flaky/@local-only tracking-issue guard ──
# Pure-Node check — asserts every test tagged @flaky or @local-only has a
# GitHub issue URL in a comment on the line(s) immediately preceding the
# test() call. Without the URL, quarantine telemetry (report-flaky-lane.mjs)
# is silent and the exit deadline is untracked (#2292).
step "@flaky/@local-only tracking-issue guard (check:flaky-tracking-issue)"
if (cd "$ROOT_DIR" && pnpm check:flaky-tracking-issue); then
  pass "@flaky/@local-only tracking-issue guard passed"
else
  fail "@flaky/@local-only tracking-issue guard"
fi

# ── Step 12: B4push/CI parity check ──────────────────
# Pure-Node check — verifies every lightweight guard gate in this file also
# has a corresponding CI job. See scripts/check-b4push-ci-parity.mjs.
step "B4push/CI parity check (check:b4push-ci-parity)"
if (cd "$ROOT_DIR" && pnpm check:b4push-ci-parity); then
  pass "B4push/CI parity check passed"
else
  fail "B4push/CI parity check"
fi

# <<< b4push-ci-parity:guards:end

# ── Step 13: Type checking ─────────────────────────────
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

# pages/ typecheck: `zfb check` (root tsconfig) excludes pages/ by design
# (zfb injects its own page-runner types at build time). tsconfig.pages.json
# provides the needed zfb/* path mappings to cover the ~50 page files that
# had zero typecheck coverage before this gate was added (#2018).
if (cd "$ROOT_DIR" && pnpm check:pages); then
  pass "pages/ typecheck passed"
else
  fail "pages/ typecheck"
fi

# plugins/ typecheck: root tsconfig excludes plugins/ (plain .mjs files).
# tsconfig.plugins.json enables checkJs with strict mode for all six
# plugins/*.mjs files (#2026).
if (cd "$ROOT_DIR" && pnpm check:plugins); then
  pass "plugins/ typecheck passed"
else
  fail "plugins/ typecheck"
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

# ── Step 14: Root unit tests ──────────────────────────
# Root `test:unit` (vitest) guards src/**/__tests__ and scripts/__tests__,
# which previously ran in no local gate and no CI workflow (#1856). Runs
# before the expensive site build for fast logic-level feedback.
#
# Build @takazudo/zudo-doc first: several root suites import
# @takazudo/zudo-doc/theme, whose compiled dist/ does not exist on a fresh
# clone (`pnpm install` does not run the package's tsup build). CI's package
# and root test jobs build it for the same reason. Building here also leaves
# dist/safelist.css ready for the safelist check in step 14.
step "Root unit tests (test:unit)"
if (cd "$ROOT_DIR" && pnpm --filter @takazudo/zudo-doc build && pnpm test:unit); then
  pass "Root unit tests passed"
else
  fail "Root unit tests"
fi

# ── Step 15: Package tests ────────────────────────────
# Runs all workspace package test suites (~993 tests). Closes the local/CI
# asymmetry where package tests ran in CI but not in b4push (#1851/#1856).
# dist/ is already built by step 14 — no extra prep needed.
step "Package tests (test:packages)"
if (cd "$ROOT_DIR" && pnpm test:packages); then
  pass "Package tests passed"
else
  fail "Package tests"
fi

# ── Step 16: Package safelist check ──────────────────
# Verifies that the generated dist/safelist.css in packages/zudo-doc/ covers
# every responsive-variant + arbitrary-value utility class used in
# packages/zudo-doc/src/**/*.tsx. Catches regressions where gen-safelist.mjs
# misses a new utility class before it reaches consumers (#1994).
# Requires dist/safelist.css — produced by the package build in step 14.
step "Package safelist check (check:package-safelist)"
if (cd "$ROOT_DIR" && pnpm check:package-safelist); then
  pass "Package safelist check passed"
else
  fail "Package safelist check"
fi

# ── Step 17: Build ────────────────────────────────────
step "Build (zfb build)"
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 18: Link check ───────────────────────────────
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

# ── Step 19: HTML validation ──────────────────────────
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

# ── Step 20: Automated preview smoke (blocking) ──────
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

# ── Step 21: Manual interactive smoke ────────────────
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
