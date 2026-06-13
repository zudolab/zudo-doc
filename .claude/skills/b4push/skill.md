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

Run `pnpm b4push` from the project root. This executes `scripts/run-b4push.sh`.

## Steps (cheap → expensive)

1. **Format check** — `pnpm format:check:mdx` (mdx-formatter for MD/MDX files)
2. **Template drift check** — `bash scripts/check-template-drift.sh` (host ↔ generator template parity)
3. **Pin parity check** — `pnpm check:pin-parity` (root package.json zfb pins ↔ scaffold.ts literals)
4. **Fixture settings drift check** — `pnpm check:fixture-settings-drift` (e2e fixtures ↔ root settings.ts)
5. **Tags audit** — `pnpm tags:audit --ci` (validates tag vocabulary)
6. **Design token lint** — `pnpm lint:tokens`
7. **B4push/CI parity check** — `pnpm check:b4push-ci-parity` (guard manifest meta-check)
8. **Type checking** — `pnpm check` (zfb check) + `pnpm check:pages` + `pnpm check:plugins` + workspace package typechecks
9. **Root unit tests** — `pnpm --filter @takazudo/zudo-doc build && pnpm test:unit` (builds dist/ first; required for import resolution)
10. **Package tests** — `pnpm test:packages` (~993 suite tests across workspace packages; dist/ already built by step 9)
11. **Package safelist check** — `pnpm check:package-safelist` (requires dist/safelist.css from step 9)
12. **Build** — `pnpm build` (zfb build → static HTML export to dist/)
13. **Link check** — `pnpm check:links -- --strict-broken --strict-absolute --allowlist=.check-links-allowlist`
14. **HTML validation** — `pnpm check:html` (html-validate dist/\*\*/\*.html)
15. **Automated preview smoke** — `pnpm smoke:preview` (blocking)
16. **Manual interactive smoke** — operator-driven (theme toggle, mobile menu, search, etc.)

Playwright E2E runs in CI (pr-checks e2e job); b4push intentionally excludes it for time-budget reasons.

## Env overrides (skip expensive steps in non-interactive use)

```bash
B4PUSH_SKIP_HTML_VALIDATE=1 pnpm b4push   # skip step 14
B4PUSH_SKIP_PREVIEW_SMOKE=1 pnpm b4push   # skip step 15
B4PUSH_SKIP_MANUAL_SMOKE=1  pnpm b4push   # skip step 16
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
