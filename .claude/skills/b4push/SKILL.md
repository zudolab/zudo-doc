---
name: b4push
description: >-
  Run comprehensive pre-push validation. Use when: (1) Completing a PR or feature
  implementation, (2) Before pushing significant changes, (3) After large refactors,
  (4) User says 'b4push', 'before push', 'check everything', or 'ready to push'.
user-invocable: true
allowed-tools:
  - Bash
---

# Before Push Check

Run `pnpm b4push` from the project root. This executes `scripts/run-b4push.sh`, which is
the single source of truth for the step list — consult it directly rather than this summary
if the two ever appear to disagree.

## Steps (cheap → expensive)

The step list, its exact count, and step numbers all drift too often to hand-keep here.
Read the numbered header comment at the top of `scripts/run-b4push.sh` for the current,
authoritative step order — that file is the single source of truth; this skill only
summarizes the workflow around it.

Each step's elapsed time is recorded and printed as a breakdown in the final SUMMARY block.
Playwright E2E runs in CI (pr-checks e2e job); b4push intentionally excludes it for
time-budget reasons — see `TESTING.md` at repo root for the full tier rationale.

## Env overrides (skip expensive steps in non-interactive use)

```bash
B4PUSH_SKIP_HTML_VALIDATE=1 pnpm b4push   # skip HTML validation
B4PUSH_SKIP_PREVIEW_SMOKE=1 pnpm b4push   # skip the automated preview smoke
B4PUSH_SKIP_MANUAL_SMOKE=1  pnpm b4push   # skip the manual interactive smoke
```

Combine as needed, e.g. `B4PUSH_SKIP_PREVIEW_SMOKE=1 B4PUSH_SKIP_MANUAL_SMOKE=1 pnpm b4push`.

## On failure

b4push accumulates failures across all steps and reports a summary at the end — a single step failure does not abort the run. Read the `❌` lines in the summary to identify which steps failed.

1. Read the failure output to identify which steps failed
2. Auto-fix what you can:
   - Formatting: `pnpm format` to auto-fix MD/MDX formatting issues
   - Type errors: fix the TypeScript issues
   - Build errors: fix the MDX compilation or config issues
   - Unit/package test failures: investigate and fix the test or the underlying code
3. Re-run `pnpm b4push` to confirm all checks pass
4. Report the final status
