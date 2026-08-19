# Testing Strategy

This document maps the test-wisdom framework onto this repo concretely. It is the
authoritative reference for what to run, when, and why. `CLAUDE.md` and `e2e/CLAUDE.md`
link here rather than duplicating policy.

## Archetype and deliberate deltas

This repo is two test-wisdom archetypes at once: an **SSG / docs site** (the
showcase) and an **npm library / CLI** (three lockstep-published packages). The
SSG side needs build-output verification, HTML validation, link checking, and
browser coverage for its interactive islands. The npm-library side needs package
unit tests plus checks over the artifact that will be packed and published. The
npm-library escalation trigger is: **ships a package → add a pack/publish check**;
#3484 and #3489 are this repo's answer to that trigger.

The repo records its other archetype deltas here rather than silently inheriting
the playbook defaults: L2 is replaced by SSR string contracts, the slow unit lane
is a blocking PR lane, and the visual-regression baseline is deliberately skipped
(see the sections below). These are decisions, not missing coverage.

---

## Test Levels

| Level | What | Scope | Command |
|-------|------|-------|---------|
| L1 | Vitest unit tests | `src/**/__tests__/`, `scripts/__tests__/` (~1,981 tests) + 4 workspace packages (2,971 tests: search-worker 44, doc-history-server 73, create-zudo-doc 603, zudo-doc 2,251) — reproduce the package census with `pnpm test:packages` | `pnpm test` |
| L1 Worker | Workers-runtime unit/integration tests | Custom entry export graph and SQLite `AiChatDailySpendCap` concurrency using `@cloudflare/vitest-pool-workers` | `pnpm test:worker` |
| L2 | *Not used* — jsdom/happy-dom + Testing Library DOM component tests | Intentionally skipped in this repo — see "Why L2 is skipped" below | — |
| L3 | Static dist reads + build-output verification | Read pre-built `dist/` HTML with `readFileSync` (Playwright specs using `makeDistReader(fixture)`); also covers the b4push build-output steps (link check, HTML validation, preview smoke) — see "L3 details" below | `E2E_FIXTURES=<fixture> npx playwright test --project <fixture> e2e/<fixture>-*.spec.ts` (e.g. `E2E_FIXTURES=versioning npx playwright test --project versioning e2e/versioning.spec.ts`) — any spec using `makeDistReader(fixture)` from `e2e/dist-helper.ts` |
| L4 | Playwright E2E | 5-fixture browser suite — interactive, full-build, full-browser; fixtures: sidebar (4500), i18n (4501), theme (4502), smoke (4503), versioning (4504) | `pnpm test:e2e` (local), `pnpm test:e2e:ci` (CI) |
| L5 | `/verify-ui` | Computed-style verification plus informal screenshot review; no committed screenshot baseline | Invoke the `/verify-ui` skill |
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
source, just outside the Playwright/`makeDistReader` pattern: link check (step 25, reads
`dist/**/*.html` for broken links), HTML validation (step 26, `html-validate
dist/**/*.html`), and the automated preview smoke (step 27, `scripts/smoke-preview.mjs` —
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

### Deliberate visual-regression skip

The Playwright `toHaveScreenshot` matcher appears nowhere in executable test
source (verify with `rg -n "toHaveScreenshot" e2e packages src scripts`). The
theme packs and the design-token panel are arguably design-critical surfaces that
could justify a committed baseline, but this repo deliberately does not carry one
today. Their coverage is the existing computed-style `/verify-ui` checks, theme
accessibility audit, and interactive Playwright tests. Add a baseline only as an
explicit, reviewed decision with stable snapshot ownership; the absence of one is
a stated archetype delta, not an oversight.

---

## Test Tiers

| Tier | Description | What runs | Command |
|------|-------------|-----------|---------|
| T0 | Local fast pass | L1 unit + typecheck + single-fixture e2e | `pnpm test`, `pnpm check`, `E2E_FIXTURES=<fixture> npx playwright test --project <fixture>` |
| T1 | CI gates (authoritative) | pr-checks: guard jobs + typecheck + unit/package tests + build + full 5-fixture e2e (`pnpm test:e2e:ci`, historical job-level median 242s; final sample 190s) | `pr-checks.yml` on every PR |
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
pnpm test          # L1: builds @takazudo/zudo-doc, runs ~1,981 root vitest + 2,971 package tests across 4 packages
pnpm check         # TypeScript typecheck (zfb check)
pnpm check:worker  # generated binding + custom Worker typecheck
pnpm test:worker   # builds first, then runs Workers-runtime/SQLite DO tests
pnpm verify:worker-dry-run # builds first, then verifies the Wrangler production bundle

# Single-fixture E2E fast path. Run setup-fixtures.sh yourself: playwright.config.ts
# has no globalSetup, so a bare `npx playwright test` builds nothing and would run
# against a stale fixture dist/ (cheap no-op when already warm).
export E2E_FIXTURES=smoke
bash e2e/setup-fixtures.sh && npx playwright test --project smoke
```

`E2E_FIXTURES=<name>` scopes both halves — `setup-fixtures.sh` builds only that
fixture and the runner boots only its webServer. It builds only the named fixture (caches via
`.build-marker.sha256`; force-rebuild with `E2E_FORCE_REBUILD=1`) and boots only
its Playwright webServer. Repeated runs skip the build when inputs are unchanged.

### T1 — CI gates (authoritative)

**pr-checks e2e** is the authoritative pass/fail gate for E2E. It runs the full
5-fixture suite with `pnpm test:e2e:ci` (excluding `@flaky`, `@local-only`, and
`@verification` tests — see Tag Taxonomy below).

**Slow Unit Tests** (#3492, #3493) is also a required PR lane, not a nightly lane. It runs the
subprocess-heavy root specs and the two retiered `create-zudo-doc` specs on every
PR, while keeping those costs out of the default unit/package critical paths.
They remain blocking because they cover release-relevant behavior; the other
registry-install/full-build slow specs stay in the nightly `slow-create` job.

**b4push** (`pnpm b4push`) is the bounded local convenience pass — wisdom-tier **T4**, not
T1 (see the note above the tiers table); it's covered here for workflow ergonomics only. It
runs a 28-step suite
(format → template drift → no-host-alias guard → pin parity → fixture drift → tags/canonical audit →
current-only compatibility → token lint → component-tokens drift → e2e spec naming guard →
@flaky tracking-issue guard → wait-debt guard → search-widget-script commit drift → publish contract →
dist-mutation guard → required-checks manifest/parity → typecheck → Worker contract proof → root unit tests →
slow unit tests → package tests → safelist check → build → content-fallback allowlist scan → link check →
HTML validation → preview smoke → manual smoke). Each step's elapsed time is recorded and printed as a breakdown in the final
SUMMARY block, so budget creep in any one step is visible instead of only the aggregate run
duration.

The content-fallback step is the allowlist-gated half of the content-bridge guard; the
non-allowlisted half (`strictContentBridge: true` in `zfb.config.ts`) fails plain
`pnpm build`/CI directly and is not a b4push step at all — see the header of
`scripts/check-content-fallback.mjs` for why both exist.

**b4push/CI parity scope.** The `check:b4push-ci-parity` guard (step 16) only cross-checks
the lightweight guard steps 1–16 (the `# >>> b4push-ci-parity:guards:begin` / `:end` region).
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
2. **Bypassability** — local runs are developer-controlled. The required PR
   contexts are the authoritative merge signal, subject to the deliberate solo-
   maintainer exceptions recorded in "Required checks and live protection" below.

### T2 — Full-e2e split (not used)

The wisdom framework's trigger for T2 is T1 exceeding its ~10 minute budget. This repo's
full 5-fixture Playwright suite (`pnpm test:e2e:ci`, pr-checks' `E2E Tests` job) has a
historical job-level median of 242s and a final optimized sample of 190s, comfortably
inside that budget, so there is nothing to split out. Revisit if the suite's runtime grows
enough to approach the ~10 minute mark. The timing protocol is documented below; do not
substitute workflow-level queue-inclusive timestamps.

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

### T4 — Local heavy lane (`pnpm b4push`)

T4 is a convenience layer, never an enforcement substitute for T1. The structural
target for `pnpm b4push` is a finite, warm-tree 28-step pass with the full per-step
timing breakdown printed by `scripts/run-b4push.sh` (the timing state is set up in
`scripts/run-b4push.sh:54-69`, in the `START_TIME`/`TOTAL_STEPS` and `STEP_*` block).
It includes the blocking slow
unit subset, but deliberately excludes the full five-fixture Playwright run and
the registry-install/full-build slow-create sweep reserved for T3. A 5–10 minute
wall-clock result is a soft design target, not a hard gate: local machines are
noisy, so pass/fail is completion plus structural boundedness, not a single timing
threshold. Use `pnpm b4push` to reproduce the lane and its timings.

### CI runtime parity (#3485)

The heavy local lane must use CI's runtime: `.nvmrc` is the Node 22 selector, and
every `pr-checks.yml` job uses `actions/setup-node` with `node-version-file:
.nvmrc`. Run `node --version && npm --version && pnpm --version` before T4 and
use the Node 22/npm 10 pairing used by CI. A local T4 pass under another Node/npm
major is blind to runtime-dependent lifecycle behavior by construction; that is
why `pnpm b4push` once passed while the release path died (#3485).

### Measurement protocol and throughput evidence

Every CI timing claim in this document uses the job-level
`started_at` → `completed_at` interval, not workflow-level timestamps:

```sh
gh api repos/zudolab/zudo-doc/actions/runs/<id>/jobs \
  --jq '.jobs[] | select(.name == "E2E Tests") | {name, startedAt: .started_at, completedAt: .completed_at}'
```

`gh run list`'s workflow-level `createdAt` → `updatedAt` includes runner-queue
wait and workflow orchestration, so it cannot support a claim about test execution
time. With the job-level protocol, the five pre-change E2E jobs have a historical
median of 242s and the first final-configuration sample was 190s. The local
#3499 protocol used `CI=1 npx playwright test --retries=0` for five separate full
invocations: the medians were 133.28s (baseline), 104.57s (remove the obsolete
stagger), and 81.75s (`fullyParallel: true`); the final
`CI=1 npx playwright test --retries=0 --repeat-each=3` pass was 951/951. These
local measurements are throughput evidence, not CI timing claims.

#3491's setup-node caching experiment is also recorded by job-level timings: the
median runner-seconds regressed from 814 to 885, so caching was reverted. The only
remaining #3491 work is redundant-build cleanup; there is no setup-node cache
contract to preserve.

### Required checks and live main protection (#3494, #3498)

`.required-checks-manifest` is the reviewed source of truth and
`node scripts/check-required-checks.mjs` verifies that it covers the workflow's
jobs. Live `main` protection currently requires exactly these 23 contexts, in the
manifest order:

```text
Package Unit Tests
Pin Parity Check
Fixture Settings Drift Check
Lint Gates
B4push/CI Parity Check
E2E Tests
Build Site
Build Doc History
Type Check
Root Unit Tests
HTML validate
Worker Contract Proof
Package Safelist Check
Template Drift Check
No-Host-Alias-In-Package Guard
E2E Spec Naming Guard
Flaky Tracking-Issue Guard
Wait-Debt Guard
Component-Tokens Codegen Drift Check
A2 No-Stub Parity Gate
Dist-Mutating Test Guard
Publish Contract Gates
Slow Unit Tests
```

Re-read the live state with `gh api repos/zudolab/zudo-doc/branches/main/protection`.
The rollback was exercised and the final state reapplied. A deliberately failing
`Type Check` on scratch PR #3523 produced GitHub's `mergeStateStatus=BLOCKED` /
`mergeable_state=blocked`, proving that a required context blocks policy merge.
The live protection still has `enforce_admins: false` and no required PR reviews;
those are deliberate solo-maintainer deviations, not evidence that CI is
universally unbypassable. `Preview Deploy` and `Required Checks Manifest Guard`
remain reasoned allowlist entries rather than required contexts.

### Dist guard and immutable artifact convention (#3488)

`node scripts/check-dist-mutating-tests.mjs` runs in both b4push and the
`Dist-Mutating Test Guard` PR job. It is deliberately narrow: it catches known
direct build/package-lifecycle command launches in default-lane specs, but does
not claim to detect indirect wrappers, aliases, or direct filesystem writers.
The broader repository rule is a **convention**:

> A test that reads a built artifact should own an immutable snapshot of it. No
> default-lane test may launch a build or package-lifecycle command.

The 5.6.1 failure is the worked example. Fast-tier tarball tests used
`npm pack --dry-run --json --ignore-scripts` against a live package directory;
npm 10.9.4 still ran `prepare` despite `--ignore-scripts`, mutating the `dist/`
being read, while npm 11.x did not:

| npm runtime | Observed behavior for the same pack command |
|-------------|----------------------------------------------|
| 10.9.4 | Runs `prepare` despite `--ignore-scripts` |
| 11.x | Does not run `prepare` in this case |

`--ignore-scripts` is a flag, not a property. A test's read-only-ness must not
depend on one npm implementation. The tests now pack a sanitized throwaway
snapshot with lifecycle hooks removed, while the convention remains broader than
the mechanically checkable guard.

### Publish-contract job (#3484, #3489)

The `Publish Contract Gates` PR job builds `@takazudo/zudo-doc`, runs
`pnpm --filter @takazudo/zudo-doc check:prepack-contract`, and executes
`npm pack --dry-run` from `packages/zudo-doc`. This is the npm-archetype gate over
the publishable artifact, not a source-only unit check. The `create-zudo-doc`
publish contract is intentionally mapped to the existing build and package-test
jobs rather than duplicated here; both package paths are covered before release.

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
// Load-bearing for the TOC's sticky scroll-follow: this wrapper must
// be `xl:flex`, never `xl:block`.  safelist-ok: `xl:block` names the rejected alternative in prose; only `xl:flex` below is emitted
```

The marker is a **trailing** annotation, so put the class name it exempts on a
line that ends at a natural clause boundary. Appending it to a line that breaks
mid-sentence technically satisfies the guard but leaves the prose unreadable.
