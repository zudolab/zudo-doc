#!/usr/bin/env bash
set -euo pipefail

# Step order (cheap → expensive):
#   1. Format check
#   2. Template drift check
#   3. Tags audit (--ci)
#   4. Design token lint
#   5. Type checking
#   6. Build
#   7. Link check
#   8. E2E & smoke tests

START_TIME=$(date +%s)
FAILURES=()
TOTAL_STEPS=8
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

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Step 1: Format check ─────────────────────────────
step "Format check"
if (cd "$ROOT_DIR" && pnpm run format:check); then
  pass "Format check passed"
else
  fail "Format check"
fi

# ── Step 2: Template drift check ─────────────────────
step "Template drift check"
if (cd "$ROOT_DIR" && bash scripts/check-template-drift.sh); then
  pass "Template drift check passed"
else
  fail "Template drift check"
fi

# ── Step 3: Tags audit ───────────────────────────────
step "Tags audit (tags:audit --ci)"
if (cd "$ROOT_DIR" && pnpm tags:audit --ci); then
  pass "Tags audit passed"
else
  fail "Tags audit"
fi

# ── Step 4: Design token lint ───────────────────────
step "Design token lint"
if (cd "$ROOT_DIR" && pnpm lint:tokens); then
  pass "Design token lint passed"
else
  fail "Design token lint"
fi

# ── Step 5: Type checking ────────────────────────────
step "Type checking (astro check)"
if (cd "$ROOT_DIR" && pnpm check); then
  pass "Type checking passed"
else
  fail "Type checking"
fi

# ── Step 6: Build ────────────────────────────────────
step "Build (astro build)"
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 7: Link check ────────────────────────────────
step "Link check (check-links)"
if (cd "$ROOT_DIR" && pnpm run check:links); then
  pass "Link check passed"
else
  fail "Link check"
fi

# ── Step 8: E2E & smoke tests ────────────────────────
step "E2E & smoke tests (playwright)"
if (cd "$ROOT_DIR" && pnpm test:e2e); then
  pass "E2E & smoke tests passed"
else
  fail "E2E & smoke tests"
fi

# ── Summary ──────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUMMARY (${DURATION}s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "✅ All $TOTAL_STEPS checks passed! Safe to push."
  exit 0
else
  echo "❌ ${#FAILURES[@]} check(s) failed:"
  for f in "${FAILURES[@]}"; do
    echo "   - $f"
  done
  exit 1
fi
