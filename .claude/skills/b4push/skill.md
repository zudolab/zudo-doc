---
name: b4push
description: >-
  Run comprehensive pre-push validation covering format check, type checking, build, and E2E/smoke
  tests. Use when: (1) Completing a PR or feature implementation, (2) Before pushing significant
  changes, (3) After large refactors, (4) User says 'b4push', 'before push', 'check everything', or
  'ready to push'.
user-invocable: true
allowed-tools:
  - Bash
---

# Before Push Check

Run `pnpm b4push` from the project root. This executes `scripts/run-b4push.sh`:

1. **Format check** — `pnpm run format:check` (mdx-formatter for MD/MDX + prettier for Astro)
2. **Type checking** — `pnpm check` (astro check with strict TypeScript)
3. **Build** — `pnpm build` (static HTML export to dist/)
4. **E2E & smoke tests** — `pnpm test:e2e` (Playwright tests including page smoke tests)

Takes ~1-2 min. All steps must pass.

## On failure

1. Read the failure output to identify which step failed
2. Auto-fix what you can:
  - Formatting: `pnpm run format` to auto-fix all formatting issues
  - Type errors: fix the TypeScript issues
  - Build errors: fix the Astro/MDX compilation issues
  - E2E failures: investigate and fix the test or the underlying code
3. Re-run `pnpm b4push` to confirm all checks pass
4. Report the final status
