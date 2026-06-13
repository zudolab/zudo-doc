# Testing Strategy

This document maps the test-wisdom framework onto this repo concretely. It is the
authoritative reference for what to run, when, and why. `CLAUDE.md` and `e2e/CLAUDE.md`
link here rather than duplicating policy.

---

## Test Levels

| Level | What | Scope | Command |
|-------|------|-------|---------|
| L1 | Vitest unit tests | ~1,485 tests: `src/**/__tests__/`, `scripts/__tests__/`, workspace packages | `pnpm test` |
| L3 | Static dist reads | Read pre-built `dist/` HTML with `readFileSync` — no browser, no server | `E2E_FIXTURES=smoke npx playwright test --project smoke e2e/smoke-html-preview.spec.ts` (or any smoke spec using `e2e/smoke-dist-helper.ts`) |
| L4 | Playwright E2E | 5-fixture browser suite — interactive, full-build, full-browser; fixtures: sidebar (4500), i18n (4501), theme (4502), smoke (4503), versioning (4504) | `pnpm test:e2e` (local), `pnpm test:e2e:ci` (CI) |
| L5 | `/verify-ui` | Computed-style verification, screenshot-level visual assertion | Invoke the `/verify-ui` skill |
| L6 | Test-flow skills | Final-resort: full user-journey replay with screen observation | `/test-flow-html-preview-hydration`, `/test-flow-sidebar-width-restore` |

### When to use which level

- **Logic, data transforms, utilities, hooks** → L1 (`pnpm test`). Fast, no server needed.
- **Static HTML output** (SSG markup, SEO tags, rendered prose) → L3 static reads. Read `e2e/smoke-dist-helper.ts` for the `readDistFile()` helper and the smoke fixture's `dist/` path resolution pattern.
- **Interactive UI, SPA navigation, islands, sidebar toggle, theme, search** → L4 Playwright.
- **Pixel-level layout, computed CSS, visual regression** → L5 `/verify-ui`.
- **Deeply reproduced user flows that L4 struggles to replicate reliably** → L6 test-flow skills (rare — reserve for known-hard flows).

---

## Test Tiers

| Tier | Description | What runs | Command |
|------|-------------|-----------|---------|
| T0 | Local fast pass | L1 unit + typecheck + single-fixture e2e | `pnpm test`, `pnpm check`, `E2E_FIXTURES=<fixture> npx playwright test --project <fixture>` |
| T1 | CI gates (authoritative) | pr-checks full e2e + b4push bounded pass | PR check workflow + `pnpm b4push` before pushing |
| T3 | Nightly exam | Full suite + quarantine lane + slow integration tests | Auto: `exam.yml` on schedule; on-demand: `gh workflow run exam.yml --ref <branch>` |

### T0 — Local fast pass

Run before pushing, or when iterating on a change:

```bash
pnpm test          # L1: builds @takazudo/zudo-doc, runs ~1,485 vitest + ~993 package tests
pnpm check         # TypeScript typecheck (zfb check)

# Single-fixture E2E fast path (builds only the named fixture, then runs only its tests):
E2E_FIXTURES=smoke npx playwright test --project smoke
E2E_FIXTURES=sidebar npx playwright test --project sidebar
```

The `E2E_FIXTURES=<name>` fast path builds only the named fixture (caches via
`.build-marker.sha256`; force-rebuild with `E2E_FORCE_REBUILD=1`) and boots only
its Playwright webServer. Repeated runs skip the build when inputs are unchanged.

### T1 — CI gates (authoritative)

**pr-checks e2e** is the authoritative pass/fail gate for E2E. It runs the full
5-fixture suite with `pnpm test:e2e:ci` (excluding `@flaky` tests).

**b4push** (`pnpm b4push`) is the bounded local convenience pass — a 17-step suite
(format → template drift → pin parity → fixture drift → tags audit → token lint →
e2e spec naming guard → b4push/CI parity → typecheck → unit tests → package tests →
safelist check → build → link check → HTML validation → preview smoke → manual smoke).

**E2E is CI-enforced, not local-gated.** `pnpm b4push` intentionally excludes
Playwright for two reasons:

1. **Time budget** — the full 5-fixture suite (build + browser) takes several minutes.
   b4push must stay fast enough to run before every push.
2. **Bypassability** — local runs are developer-controlled. CI cannot be bypassed;
   it is the single source of truth for green/red.

### T3 — Nightly exam

`exam.yml` runs on a nightly cron (02:43 JST) and on demand:

```bash
gh workflow run exam.yml --ref <branch>
```

Use the `--ref` dispatch to validate a branch before merging when you suspect
environment-sensitive failures that don't appear locally. Exam runs two jobs:

- **e2e-full** — CI-safe lane + `@flaky` quarantine lane (allowed to fail)
- **slow-create** — `create-zudo-doc` slow integration tests (real `pnpm install` + `zfb build`)

Exam failures open a deduped GitHub issue via `scripts/file-exam-issue.sh`. One open
issue per workflow; the script closes the previous one and opens a fresh one when a new
failure occurs, so the issue list doesn't accumulate stale entries.

---

## Tag Taxonomy

Every new E2E test defaults to the CI-safe lane. Tags opt tests into special handling.

| Tag | Meaning | CI behavior | Requirements |
|-----|---------|-------------|--------------|
| (none) | CI-safe default — stable, deterministic | Runs in `test:e2e:ci` (pr-checks) and `test:e2e` (exam CI-safe lane) | None |
| `@flaky` | Quarantined — **non-deterministic** (intermittent) failure, known root cause | Excluded from `test:e2e:ci`; runs allowed-to-fail in exam's `@flaky` lane | Inline tracking-issue URL comment on the line above the `test()` call; fix/demote/delete deadline in the issue |
| `@local-only` | **Deterministically environment-dependent** — trustworthy on a real dev machine, not runnable in the CI container | Excluded from `test:e2e:ci` AND the ubuntu exam lane (it would fail there identically); runs in the full local `pnpm test:e2e` | Inline tracking-issue URL comment on the line above the `test()` call, documenting the environmental cause |
| `@heavy` | Slow-but-deterministic (hypothetical) | Would run in CI but in a separate slow lane | N/A — no `@heavy` tests currently exist |

`@flaky` and `@local-only` are **distinct, single-meaning** tags — this is deliberate.
The pre-refactor `@local-only` was a graveyard that conflated "flaky", "heavy", and
"environment-specific", ran nowhere, and carried no tracking issue. The redefinition
splits those meanings: non-determinism → `@flaky`, slowness → `@heavy`, genuine
environment-dependence → `@local-only`. Each now **requires a tracking issue**.

### Why the burn-in alone could not place every test

A local burn-in (`--repeat-each=N`) proves *determinism* but not *CI-capability* — it
runs on a dev machine, not in the CI container. During the refactor it cleared 26
previously-`@local-only` tests as genuinely stable AND CI-safe (untagged), and 4
`smoke-doc-history` revision-data tests were quarantined `@local-only` because they
passed locally yet rendered 0 entries in CI: the smoke fixture's doc-history JSON came
back empty in the Playwright container. CI was the gate that caught that
environment-dependence — the layered design working as intended. The cause was later
root-caused and fixed (zudolab/zudo-doc#2106): under `pnpm test:e2e:ci`, pnpm sets
`INIT_CWD=<repo-root>`, so the smoke fixture's `doc-history-generate` resolved its
relative `--content-dir src/content/docs` against the **outer** repo instead of the
fixture, walking paths outside the nested smoke `.git` → 0 entries. `setup-fixtures.sh`
now pins `INIT_CWD` to the fixture dir for the smoke build, so the two-commit history
generates correctly and those 4 tests are **un-quarantined**. (An earlier
`safe.directory` attempt addressed a different, *simulated* mechanism — dubious
ownership via `GIT_TEST_ASSUME_DIFFERENT_OWNER=1` — and was disproven by CI.) Both the
`@local-only` and `@flaky` sets are now empty (the healthy state).

### How to tag a test as @flaky

If a test genuinely needs quarantining (not just a loose assertion or fragile wait):

```typescript
// zudolab/zudo-doc#NNNN — brief description of flake cause; deadline: YYYY-MM
test("feature works correctly @flaky", async ({ page }) => { ... });
```

The tracking-issue URL comment is required. `scripts/report-flaky-lane.mjs` reads
it to post pass/fail telemetry back to the issue on every exam run.

---

## Quarantine Pipeline

`@flaky` is not a parking lot. Every quarantined test has a linked open issue and an
exit deadline. The exit path is exactly one of:

1. **Fix** — root-cause the flake, make the test deterministic, remove `@flaky`.
2. **Demote** — if the tested behavior is adequately covered by a static L3 read,
   rewrite the test as a `readDistFile` assertion and delete the browser test.
3. **Delete** — if the test covers something the codebase no longer does, delete it.

**Pass-on-retry is a triage signal, not a resolution.** When CI annotations show a
test passing on retry (via `scripts/report-retry-flakes.mjs` — runs in pr-checks,
emits `::warning::flaky: <file> › <title> passed on retry N` annotations), that test
should enter the quarantine pipeline immediately. Do not let retry-passes accumulate
silently; they mask real intermittency.

Note: two separate scripts handle flakiness signals —
`report-retry-flakes.mjs` = pr-checks retry annotations;
`report-flaky-lane.mjs` = exam.yml quarantine telemetry (posts to the `@flaky` test's
linked tracking issue).

---

## Retry Budgets

| Context | Budget | Notes |
|---------|--------|-------|
| Local | 0 retries | Run tests cold; retry manually only to confirm reproduction |
| CI pr-checks | 1 retry | A single retry is the safety net for rare infra glitches |
| CI exam | 1 retry | Same; `@flaky` lane is allowed-to-fail, not retried-to-pass |
| > 2 retries anywhere | Smell | More than 2 retries masks a real problem; fix the test |

Playwright's retry count is configured in `playwright.config.ts`. If CI needs more than
1 retry to green a test suite, that is a signal to quarantine or fix, not to raise the
retry budget.

---

## Anti-Gaming Rules

These require a linked open issue — no exceptions:

| Action | Requirement |
|--------|-------------|
| Add `test.skip` | Linked open issue explaining why and when it unblocks |
| Add `@flaky` tag | Inline issue URL comment above the `test()` call; deadline in the issue |
| Loosen a tolerance (e.g. widen a pixel diff threshold) | Linked issue explaining the measurement uncertainty |
| Delete an assertion | Linked issue explaining what coverage was lost and what replaces it |

**Gate edits need fresh-context review.** Edits to `playwright.config.ts`,
`e2e/setup-fixtures.sh`, `.github/workflows/pr-checks.yml`, `.github/workflows/exam.yml`,
and `scripts/run-b4push.sh` change the rules of the gate itself. Route these through a
code review that reads the gate file from scratch — do not rely on the author's summary.

---

## Wait-Pattern Rules

All waits in E2E tests must be deterministic. Use state/event waits; never time waits.

| Pattern | Rule |
|---------|------|
| `waitForTimeout` | Forbidden unless the constant has a name (e.g. `DEBOUNCE_MS`) and a why-comment. Even then, prefer an event or state wait. |
| `waitForLoadState("networkidle")` | Forbidden. SPA navigations do not trigger new network requests; `networkidle` is inherently racy. |
| SPA navigation | Use `spaClick` / `spaClickSelector` from `e2e/nav-helpers.ts`. These install the `zfb:after-swap` listener and click atomically — no race window between listener registration and the click. |
| Sidebar hydration | Use `waitForSidebarHydration(page)` from `e2e/sidebar-helpers.ts` (desktop) or `waitForSidebarNav(page)` from `e2e/nav-helpers.ts` (i18n fixture). |
| Console errors | Use the extended `test` from `e2e/fixtures.ts` and call `assertNoConsoleErrors()`. Allowlist entries in `fixtures.ts` must have a `reason` string. |
| Arbitrary locator waits | Use Playwright's built-in locator assertions (`await expect(locator).toBeVisible()`, `locator.waitFor({ state: "attached" })`). These use Playwright's configured timeout, not an arbitrary in-page delay. |

### The key invariant

*Every wait must be keyed to an observable state transition, not a duration.*

If a test needs `waitForTimeout`, that is usually a sign the code under test lacks a
testable event or state signal. Consider adding one to the production code rather than
sleeping in the test.
