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

## Steps (cheap → expensive) — ~22-step suite

1. **Format check (mdx)** — `pnpm format:check:mdx`
2. **Template drift check** — `bash scripts/check-template-drift.sh` (host ↔ generator template parity)
3. **No-host-alias-in-package guard** (#2344) — `pnpm check:no-host-alias-in-package` (`packages/zudo-doc/src/**` must not import the host `@/` alias)
4. **Pin parity check** (W4A #1732) — `pnpm check:pin-parity` (root package.json zfb pins ↔ scaffold.ts literals)
5. **Fixture settings drift check** — `pnpm check:fixture-settings-drift` (e2e fixtures ↔ root settings.ts)
6. **Tags audit** — `pnpm tags:audit --ci` (validates tag vocabulary)
7. **Design token lint** — `pnpm lint:tokens`
8. **Z-index codegen drift check** (#2148) — `pnpm check:z-index`
9. **Component-tokens codegen drift check** (#2448) — `pnpm check:component-tokens`
10. **E2E spec naming guard** (#2095) — `pnpm check:e2e-spec-naming`
11. **@flaky/@local-only tracking-issue guard** (#2292) — `pnpm check:flaky-tracking-issue`
12. **Wait-debt guard** (#2538) — `pnpm check:wait-debt` (zero-tolerance `waitForTimeout` annotation check)
13. **B4push/CI parity check** (#1967) — `pnpm check:b4push-ci-parity` (guard manifest meta-check; steps 1–13 above are the checked guard region)
14. **Type checking** — `pnpm check` (zfb check) + `pnpm check:pages` + workspace package typechecks
15. **Root unit tests** — `pnpm --filter @takazudo/zudo-doc build && pnpm test:unit` (builds dist/ first; required for import resolution)
16. **Package tests** — `pnpm test:packages` (~1,535 suite tests across workspace packages as of 2026-07; dist/ already built by step 15)
17. **Package safelist check** (#1994) — `pnpm check:package-safelist` (requires dist/safelist.css from step 15)
18. **Build** — `pnpm build` (zfb build → static HTML export to dist/)
19. **Link check** — `pnpm check:links -- --strict-broken --strict-absolute --allowlist=.check-links-allowlist`
20. **HTML validation** — `pnpm check:html` (html-validate dist/\*\*/\*.html)
21. **Automated preview smoke** — `pnpm smoke:preview` (blocking)
22. **Manual interactive smoke** — operator-driven (theme toggle, mobile menu, search, etc.)

Each step's elapsed time is recorded and printed as a breakdown in the final SUMMARY block.
Playwright E2E runs in CI (pr-checks e2e job); b4push intentionally excludes it for
time-budget reasons — see `TESTING.md` at repo root for the full tier rationale.

## Env overrides (skip expensive steps in non-interactive use)

```bash
B4PUSH_SKIP_HTML_VALIDATE=1 pnpm b4push   # skip step 20
B4PUSH_SKIP_PREVIEW_SMOKE=1 pnpm b4push   # skip step 21
B4PUSH_SKIP_MANUAL_SMOKE=1  pnpm b4push   # skip step 22
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
