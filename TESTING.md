# Testing Strategy

This document maps the test-wisdom framework onto this repo concretely. It is the
authoritative reference for what to run, when, and why. `CLAUDE.md` and `e2e/CLAUDE.md`
link here rather than duplicating policy.

---

## Test Levels

| Level | What | Scope | Command |
|-------|------|-------|---------|
| L1 | Vitest unit tests | `src/**/__tests__/`, `scripts/__tests__/` (~1,981 tests) + workspace packages (~1,535 tests) — counts as of 2026-07, see `pnpm test` / `pnpm test:unit` / `pnpm test:packages` | `pnpm test` |
| L1 Worker | Workers-runtime unit/integration tests | Custom entry export graph and SQLite `AiChatDailySpendCap` concurrency using `@cloudflare/vitest-pool-workers` | `pnpm test:worker` |
| L2 | *Not used* — jsdom/happy-dom + Testing Library DOM component tests | Intentionally skipped in this repo — see "Why L2 is skipped" below | — |
| L3 | Static dist reads + build-output verification | Read pre-built `dist/` HTML with `readFileSync` (Playwright specs using `makeDistReader(fixture)`); also covers the b4push build-output steps (link check, HTML validation, preview smoke) — see "L3 details" below | `E2E_FIXTURES=<fixture> npx playwright test --project <fixture> e2e/<fixture>-*.spec.ts` (e.g. `E2E_FIXTURES=versioning npx playwright test --project versioning e2e/versioning.spec.ts`) — any spec using `makeDistReader(fixture)` from `e2e/dist-helper.ts` |
| L4 | Playwright E2E | 5-fixture browser suite — interactive, full-build, full-browser; fixtures: sidebar (4500), i18n (4501), theme (4502), smoke (4503), versioning (4504) | `pnpm test:e2e` (local), `pnpm test:e2e:ci` (CI) |
| L5 | `/verify-ui` | Computed-style verification, screenshot-level visual assertion | Invoke the `/verify-ui` skill |
| L6 | Test-flow skills | Final-resort: full user-journey replay with screen observation | `/test-flow-html-preview-hydration`, `/test-flow-sidebar-width-restore` |

### Why L2 is skipped

L2 (jsdom/happy-dom + `@testing-library/*` DOM component tests) is **intentionally not
used** in this repo. Instead, SSR markup contracts — "this link/attribute must exist in the
server-rendered HTML before any JavaScript runs" — are tested with `preact-render-to-string`
under plain Node, at L1 cost (no simulated DOM environment needed). The `*-ssg.test.tsx`
files under `packages/zudo-doc/src/**/__tests__/` follow this pattern, alongside other
component tests using the same render-to-string technique. Island *interaction* (hydration,
event handlers, post-hydration DOM shape) is covered at L4 (Playwright), not L2.

Do not introduce `jsdom`/`@testing-library` without revisiting this decision — it would add
a second, redundant DOM-testing layer alongside the L4 suite that already covers interaction,
for a cost L1's render-to-string tests already absorb for markup-contract checks.

### L3 details

**L3 lives inside Playwright specs, not a standalone vitest runner — a deliberate deviation**
from the test-wisdom framework's L3 prescription (a plain vitest runner reading `dist/` via
`fs`/`path`). Here, `makeDistReader(fixture)` reads live inside `e2e/*.spec.ts` files
executed via `playwright test`, because each fixture's `dist/` is built once by the shared
Playwright setup (`setup-fixtures.sh`) and reused by both the dist-read specs and the browser
specs in the same run — a second, parallel vitest-driven build step just for dist reads
would duplicate that build.

**"No browser, no server" describes the assertion, not the process.** The fixture's
Playwright `webServer` entry still boots (`zfb preview`) for the documented command even when
the target spec never touches `page` — `playwright.config.ts` boots one `webServer` per
active fixture regardless of which specs in that fixture's project actually use it.

**Three b4push steps are also L3 in spirit** — they verify the *built* `dist/` rather than
source, just outside the Playwright/`makeDistReader` pattern: link check (step 20, reads
`dist/**/*.html` for broken links), HTML validation (step 21, `html-validate
dist/**/*.html`), and the automated preview smoke (step 22, `scripts/smoke-preview.mjs` —
boots a real `pnpm preview` server and asserts on live HTTP responses). These run as part of
`pnpm b4push` and CI's build-site job family, not as `*.spec.ts` files.

### When to use which level

- **Logic, data transforms, utilities, hooks** → L1 (`pnpm test`). Fast, no server needed.
- **Component prop/state → static markup contract** (does the SSR output change correctly
  for a given prop/state?) → L1 `preact-render-to-string` presence test, **not** L2 (unused —
  see above). If the change is about post-hydration interaction rather than markup, use L4.
- **Static HTML output** (SSG markup, SEO tags, rendered prose) → L3 static reads via
  `makeDistReader(fixture)` in `e2e/dist-helper.ts` (`e2e/smoke-dist-helper.ts` is a thin
  backward-compat re-export scoped to the smoke fixture — new specs targeting a different
  fixture should call `makeDistReader` directly).
- **Interactive UI, SPA navigation, islands, sidebar toggle, theme, search** → L4 Playwright.
- **Pixel-level layout, computed CSS, visual regression** → L5 `/verify-ui`.
- **Deeply reproduced user flows that L4 struggles to replicate reliably** → L6 test-flow skills (rare — reserve for known-hard flows).

---

## Test Tiers

| Tier | Description | What runs | Command |
|------|-------------|-----------|---------|
| T0 | Local fast pass | L1 unit + typecheck + single-fixture e2e | `pnpm test`, `pnpm check`, `E2E_FIXTURES=<fixture> npx playwright test --project <fixture>` |
| T1 | CI gates (authoritative) | pr-checks: guard jobs + typecheck + unit/package tests + build + full 5-fixture e2e (`pnpm test:e2e:ci`, ~3 min) | `pr-checks.yml` on every PR |
| T2 | Full-e2e split | *Not used* — see "Why T2 is unused" below | — |
| T3 | Nightly exam | Full suite + quarantine lane + slow integration tests | Auto: `exam.yml` on schedule; on-demand: `gh workflow run exam.yml --ref <branch>` |

`pnpm b4push` is the wisdom framework's **T4** (local heavy lane — convenience, not
enforcement), not T1. It is documented in the T1 section below, beside T1, purely for
workflow ergonomics: it's the last local check a developer runs immediately before pushing,
right before T1 CI takes over as the authoritative gate. It isn't its own table row above
because it never runs in CI — the table tracks *where in the pipeline* a tier executes.

### T0 — Local fast pass

Run before pushing, or when iterating on a change:

```bash
pnpm test          # L1: builds @takazudo/zudo-doc, runs ~1,981 root vitest + ~1,535 package tests (as of 2026-07)
pnpm check         # TypeScript typecheck (zfb check)
pnpm check:worker  # generated binding + custom Worker typecheck
pnpm test:worker   # builds first, then runs Workers-runtime/SQLite DO tests
pnpm verify:worker-dry-run # builds first, then verifies the Wrangler production bundle

# Single-fixture E2E fast path (builds only the named fixture, then runs only its tests):
E2E_FIXTURES=smoke npx playwright test --project smoke
E2E_FIXTURES=sidebar npx playwright test --project sidebar
```

The `E2E_FIXTURES=<name>` fast path builds only the named fixture (caches via
`.build-marker.sha256`; force-rebuild with `E2E_FORCE_REBUILD=1`) and boots only
its Playwright webServer. Repeated runs skip the build when inputs are unchanged.

### T1 — CI gates (authoritative)

**pr-checks e2e** is the authoritative pass/fail gate for E2E. It runs the full
5-fixture suite with `pnpm test:e2e:ci` (excluding `@flaky`, `@local-only`, and
`@verification` tests — see Tag Taxonomy below).

**b4push** (`pnpm b4push`) is the bounded local convenience pass — wisdom-tier **T4**, not
T1 (see the note above the tiers table); it's covered here for workflow ergonomics only. It
runs a 24-step suite
(format → template drift → no-host-alias guard → pin parity → fixture drift → tags/canonical audit →
current-only compatibility → token lint → component-tokens drift → e2e spec naming guard →
@flaky tracking-issue guard → wait-debt guard → b4push/CI parity → typecheck → Worker contract proof → unit tests →
package tests → safelist check → build → content-fallback check → link check → HTML validation → preview smoke →
manual smoke). Each step's elapsed time is recorded and printed as a breakdown in the final
SUMMARY block, so budget creep in any one step is visible instead of only the aggregate run
duration.

**b4push/CI parity scope.** The `check:b4push-ci-parity` guard (step 13) only cross-checks
the lightweight guard steps 1–13 (the `# >>> b4push-ci-parity:guards:begin` / `:end` region).
The heavy steps — typecheck, unit tests, package tests, safelist check, build, link check,
HTML validation, preview smoke — are intentionally outside this region and outside the parity
manifest. They run in CI as separate full-install jobs (not redundant pure-Node scripts), so
a straightforward ciNeedle match would need a different contract. The asymmetry is intentional:
b4push runs the heavy steps locally on the developer's machine; CI runs them in isolated
clean-runner jobs. Both paths cover the same behaviors, just orchestrated differently.

**E2E is CI-enforced, not local-gated.** `pnpm b4push` intentionally excludes
Playwright for two reasons:

1. **Time budget** — the full 5-fixture suite (build + browser) takes several minutes.
   b4push must stay fast enough to run before every push.
2. **Bypassability** — local runs are developer-controlled. CI cannot be bypassed;
   it is the single source of truth for green/red.

### T2 — Full-e2e split (not used)

The wisdom framework's trigger for T2 is T1 exceeding its ~10 minute budget. This repo's
full 5-fixture Playwright suite (`pnpm test:e2e:ci`, pr-checks' `e2e` job) completes in ~3
minutes — measured from recent `pr-checks.yml` runs — comfortably inside that budget, so
there is nothing to split out. Revisit if the suite's runtime grows enough to approach the
~10 minute mark.

### T3 — Nightly exam

`exam.yml` runs on a nightly cron (02:43 JST) and on demand:

```bash
gh workflow run exam.yml --ref <branch>
```

Use the `--ref` dispatch to validate a branch before merging when you suspect
environment-sensitive failures that don't appear locally. Exam runs four jobs:

- **e2e-full** — CI-safe lane + `@flaky` quarantine lane (allowed to fail)
- **slow-create** — `create-zudo-doc` slow integration tests (real `pnpm install` + `zfb build`)
- **slow-zudo-doc** — `@takazudo/zudo-doc` slow route-injection-build test (real `zfb build`s
  + `npm pack`; moved out of the default `pnpm test` / pr-checks package-tests lane, #2530)
- **theme-a11y** — rendered per-theme-pack WCAG contrast audit (`pnpm theme-a11y:audit`);
  see "Theme A11y Audit" below for its scope and wait-discipline notes (#3036)

Exam failures open a deduped GitHub issue via `scripts/file-exam-issue.sh`, scoped
per exam job (e2e-full / slow-create / slow-zudo-doc / theme-a11y) — dedup matches both
the shared `exam-failure` label AND the issue title, which embeds the job identity, so a
failure in one job never appends onto another job's open issue. Repeated failures for the
same job append comments to the same open issue; each job's next green run closes it via
`--green` (`if: success()` step, added right after the `if: failure()` step in each job)
with a closing comment, so the issue list doesn't accumulate stale entries (#2535).

### Theme A11y Audit (`theme-a11y` job — T3 nightly + on-demand dev tool)

`scripts/theme-a11y-audit.ts` (`pnpm theme-a11y:audit`) renders the **built** showcase
once per (theme pack × light/dark mode) in a real Playwright browser and reads computed
styles to check WCAG contrast on a fixed chrome + content element inventory. It requires
a prebuilt `dist/` and a browser, so — like `e2e-full` — it's too slow for pr-checks'
budget and lives here as a T3 nightly + on-demand job (`theme-a11y`), plus a local dev
tool for partial runs while iterating on a theme pack (`pnpm theme-a11y:audit --packs
<name> --modes light`).

**Scope split vs `pnpm contrast:audit`.** These two checks are not redundant:

- `pnpm contrast:audit` checks the 2 built-in **color schemes** (Default Light/Dark) by
  resolving their OKLCH values through the package resolvers — no browser, no theme-pack
  CSS. It's gated by `src/config/__tests__/contrast.test.ts` in `pnpm test:unit`
  (T0/T1). See the `color-scheme-a11y` skill.
- `pnpm theme-a11y:audit` checks every **theme pack**'s rendered CSS in a real browser —
  the only check that can catch pure-cascade theme-pack bugs (e.g. an active-nav chip
  losing contrast under one pack's stylesheet) that are structurally invisible to the
  static color-scheme check. This is what the `theme-a11y` exam job gates on.

**Wait-discipline note (self-imposed, not mechanically enforced).**
`scripts/theme-a11y-audit.ts` is the first standalone Playwright-browser script outside
`e2e/`. `scripts/check-wait-debt.mjs` (see "Mechanical enforcement" below) only scans
`e2e/` (excluding `e2e/fixtures/`), so this script's waits are **not** covered by that
guard. Hold it to the same standard anyway: no bare `waitForTimeout` — any wait added
here must carry a same-line `// wait-ok: <why>` comment, same convention as `e2e/`.

---

## Tag Taxonomy

Every new E2E test defaults to the CI-safe lane. Tags opt tests into special handling.

| Tag | Meaning | CI behavior | Requirements |
|-----|---------|-------------|--------------|
| (none) | CI-safe default — stable, deterministic | Runs in `test:e2e:ci` (pr-checks) and `test:e2e:ci:json` (exam's CI-safe lane) | None |
| `@flaky` | Quarantined — **non-deterministic** (intermittent) failure, known root cause | Excluded from `test:e2e:ci`; runs allowed-to-fail in exam's `@flaky` lane | Inline tracking-issue URL comment on the line above the `test()` call; fix/demote/delete deadline in the issue |
| `@local-only` | **Deterministically environment-dependent** — trustworthy on a real dev machine, not runnable in the CI container | Excluded from `test:e2e:ci` AND the ubuntu exam lane (it would fail there identically); runs in the full local `pnpm test:e2e` | Inline tracking-issue URL comment on the line above the `test()` call, documenting the environmental cause |
| `@verification` | One-time **"it was done"** proof — not a regression gate, demonstrates a change worked when it landed (test-wisdom's "verification artifact") | Excluded from the CI-enforced lanes — `test:e2e:ci` (pr-checks) and `test:e2e:ci:json` (exam CI-safe lane) — via `--grep-invert` (`package.json`); never added to the `@flaky` quarantine lane either, since it isn't flaky. Like `@local-only`, it still runs under the full local `pnpm test:e2e` — useful for the author re-running their own spec while it's still `@verification` | Delete the spec or propose promotion once its one-time purpose is served — see "`@verification` lifecycle" below. Never left indefinitely tagged. |
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

### `@verification` lifecycle

Tag an agent-authored one-off proof spec `@verification` when its only job is to
demonstrate that a specific change worked at the time it landed — not to guard against
future regressions (test-wisdom's "verification artifact" vs. "regression gate"
distinction). It is excluded from the CI-enforced lanes by the `--grep-invert` pattern in
`test:e2e:ci` and `test:e2e:ci:json` (`package.json`) — the same treatment `@local-only`
gets. The full local `pnpm test:e2e` still runs it, which is intentional: the author needs
to run their own `@verification` spec locally while it's still serving its one-time purpose.

```typescript
test("banner renders after the CSS fix @verification", async ({ page }) => { ... });
```

**Graduation requires reviewer sign-off — never self-promotion.** A `@verification` spec
becoming a permanent regression check is a deliberate, explicit decision, proposed in the
PR description and made by the reviewer, not the author. Graduation checklist:

1. **Determinism** — stable across repeated local runs, no flake.
2. **Tier assignment** — remove `@verification` and assign the tag/tier that matches its
   actual behavior (untagged for CI-safe L4, `@flaky` only if quarantining on purpose, etc.).
3. **Time-budget fit** — confirm it fits inside the target lane's budget (T1's ~10 min via
   `pnpm test:e2e:ci`, or T3's nightly `exam.yml`).

If a `@verification` spec's purpose has been served and nobody proposes graduation, delete
it — it must not accumulate indefinitely as dead weight in the suite.

---

## Quarantine Pipeline

`@flaky` is not a parking lot. Every quarantined test has a linked open issue and an
exit deadline. The exit path is exactly one of:

1. **Fix** — root-cause the flake, make the test deterministic, remove `@flaky`.
2. **Demote** — if the tested behavior is adequately covered by a static L3 read,
   rewrite the test as a `readDistFile` assertion and delete the browser test.
3. **Delete** — if the test covers something the codebase no longer does, delete it.

**Pass-on-retry is a triage signal, not a resolution.** When CI annotations show a
test passing on retry (via `scripts/report-retry-flakes.mjs` — runs in pr-checks and
in exam's e2e-full job, emits `::warning::flaky: <file> › <title> passed on retry N`
annotations), that test should enter the quarantine pipeline immediately. Do not let
retry-passes accumulate silently; they mask real intermittency.

The annotation now has a consumer (#2535): `report-retry-flakes.mjs` also files or
appends a deduped `retry-flake`-labeled GitHub issue per offending test (one open
issue per test, matched by file+title — see `scripts/lib/file-retry-flake-issue.mjs`),
using `GITHUB_TOKEN` (needs `issues: write`; wired as a job-level permission on
pr-checks' `e2e` job and via exam.yml's workflow-level `issues: write`). On fork PRs
the platform-issued token is read-only regardless of the requested permission, and if
the token is absent or `gh` fails for any reason the script degrades to
annotation-only — it never fails the job.

`playwright.config.ts`'s `trace: "on-first-retry"` + `screenshot: "only-on-failure"`
(#2535) mean a retry-pass also leaves a debuggable trace zip under `test-results/`
(Playwright's `outputDir` — a different directory from `playwright-report/`, which
only holds the list/JSON report output). Both pr-checks' `e2e` job and exam's
`e2e-full` job upload both directories as artifacts.

Note: two separate scripts handle flakiness signals —
`report-retry-flakes.mjs` = pr-checks + exam.yml retry annotations/issues;
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

These require a linked open issue, or — for the one action below marked otherwise —
explicit reviewer sign-off. No self-service exceptions:

| Action | Requirement |
|--------|-------------|
| Add `test.skip` | Linked open issue explaining why and when it unblocks |
| Add `@flaky` tag | Inline issue URL comment above the `test()` call; deadline in the issue |
| Loosen a tolerance (e.g. widen a pixel diff threshold) | Linked issue explaining the measurement uncertainty |
| Delete an assertion | Linked issue explaining what coverage was lost and what replaces it |
| Promote a `@verification` spec into a gate | **Reviewer sign-off, never self-promotion** — must pass the graduation checklist in "`@verification` lifecycle" above (determinism, tier assignment, time-budget fit) |

**Gate edits need fresh-context review.** Edits to `playwright.config.ts`,
`e2e/setup-fixtures.sh`, `.github/workflows/pr-checks.yml`, `.github/workflows/exam.yml`,
`scripts/run-b4push.sh`, `scripts/report-retry-flakes.mjs`, and `scripts/file-exam-issue.sh`
change the rules of the gate itself — the last two also auto-file/close GitHub issues, so a
bug in their dedup logic can spam or silently swallow signal. Route these through a
code review that reads the gate file from scratch — do not rely on the author's summary.

---

## Wait-Pattern Rules

All waits in E2E tests must be deterministic. Use state/event waits; never time waits.

| Pattern | Rule |
|---------|------|
| `waitForTimeout` | Forbidden unless annotated with a trailing `// wait-ok: <why>` comment on the SAME line, on a constant with a name (e.g. `DEBOUNCE_MS`). Even then, prefer an event or state wait. Mechanically enforced, zero-tolerance — see "Mechanical enforcement" below. |
| `waitForLoadState("networkidle")` | Forbidden. SPA navigations do not trigger new network requests; `networkidle` is inherently racy. |
| SPA navigation | Use `spaClick` / `spaClickSelector` from `e2e/nav-helpers.ts`. These install the `zfb:after-swap` listener and click atomically — no race window between listener registration and the click. |
| Sidebar hydration | Use `waitForSidebarHydration(page)` from `e2e/sidebar-helpers.ts` (desktop) or `waitForSidebarNav(page)` from `e2e/nav-helpers.ts` (i18n fixture). |
| Console errors | Use the extended `test` from `e2e/fixtures.ts` and call `assertNoConsoleErrors()`. Allowlist entries in `fixtures.ts` must have a `reason` string. |
| Arbitrary locator waits | Use Playwright's built-in locator assertions (`await expect(locator).toBeVisible()`, `locator.waitFor({ state: "attached" })`). These use Playwright's configured timeout, not an arbitrary in-page delay. |

### Mechanical enforcement (`scripts/check-wait-debt.mjs`)

`scripts/check-wait-debt.mjs` scans every git-tracked `.ts` file under `e2e/` (excluding
`e2e/fixtures/`, which is fixture content, not spec/helper code) for `waitForTimeout(` call
sites. Any call site without a `// wait-ok: <why>` comment on the same line fails the guard —
zero-tolerance, no ratchet/baseline file, since current debt is zero. Wired into `pnpm b4push`
(step 12) and its own pr-checks job (Wait-Debt Guard). Example:

```typescript
await page.waitForTimeout(RESIZE_DEBOUNCE_BUFFER_MS); // wait-ok: settle window for the 150ms ResizeObserver debounce (see comment above)
```

### The key invariant

*Every wait must be keyed to an observable state transition, not a duration.*

If a test needs `waitForTimeout`, that is usually a sign the code under test lacks a
testable event or state signal. Consider adding one to the production code rather than
sleeping in the test.

## Package Safelist Check

`scripts/check-package-safelist.mjs` (`pnpm check:package-safelist`) scans
`packages/zudo-doc/src/**/*.tsx` as raw text for responsive-variant and
arbitrary-value Tailwind classes, and fails if any of them are missing from
the generated `packages/zudo-doc/dist/safelist.css`. Because it scans raw
text rather than parsed JSX, a class name written in PROSE — e.g. a comment
contrasting one class with another — reads exactly like a live class
attribute and gets demanded of the generated safelist even though nothing
emits it.

A line carrying a trailing `// safelist-ok: <reason>` comment is excluded
from extraction, mirroring the `// wait-ok:` convention above — a plain,
shell-greppable substring with no reason-text validation. This is the ONLY
line-aware step: comment lines WITHOUT the marker are still scanned exactly
like any other source line (general comment-stripping was considered and
rejected — it would also blind the guard to real class usage sitting inside
a commented-out block). Example, from the TOC wrapper comment in
`packages/zudo-doc/src/doc-page-shell/index.tsx`:

```typescript
// `xl:flex` (NOT `xl:block`) is load-bearing for the TOC's sticky safelist-ok: prose contrast — `xl:flex` is the live class on this div below
```
