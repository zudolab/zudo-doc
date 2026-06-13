# E2E Tests

> **Status (post-zfb cutover):** the fixture setup harness (`setup-fixtures.sh`, `playwright.config.ts`) is now retargeted onto zfb (epic 1337 task 3a). Per-spec selector retargeting (task 3b) is the remaining E9b work — some specs may still encode Astro-era markup until that lands.

For test policy (levels, tiers, tag taxonomy, quarantine pipeline, retry budgets,
anti-gaming rules, wait-pattern rules) see **[TESTING.md](../TESTING.md)** at repo root.

## Architecture

5 Playwright fixtures, each with its own port, build, and `settings.ts`:

| Fixture | Port | Purpose |
|---|---|---|
| sidebar | 4500 | Sidebar persistence, filter |
| i18n | 4501 | Locale fallback, translation |
| theme | 4502 | Light/dark toggle, hydration |
| smoke | 4503 | General features (search, TOC, code blocks, mermaid, doc history, etc.) |
| versioning | 4504 | Version switcher, banners |

Configured in `playwright.config.ts`. Each fixture's webServer entry runs `zfb preview` against the pre-built `dist/` produced by `setup-fixtures.sh`.

## Adding Tests

**No new fixture needed in most cases.** The `testMatch` pattern is `${name}*.spec.ts`, so:

- `smoke-search.spec.ts` automatically runs against the smoke fixture
- `sidebar-filter.spec.ts` automatically runs against the sidebar fixture

To add a test: create `e2e/{fixture-name}-{feature}.spec.ts`. No config changes needed.

To add content for tests: add MDX files to the fixture's `src/content/docs/` directory, then enable any needed settings in its `src/config/settings.ts`.

## Two Test Patterns

**Static HTML tests** (no browser needed) — read pre-built `dist/` with `readFileSync`:

```typescript
import { readDistFile } from "./smoke-dist-helper";
const html = readDistFile("docs/some-page/index.html");
expect(html).toContain("expected string");
```

**Browser tests** — use Playwright `page` fixture for interactive features:

```typescript
test("feature works", async ({ page }) => {
  await page.goto("/docs/some-page");
  await expect(page.locator('[aria-label="Search"]')).toBeVisible();
});
```

## Fixture Setup Pipeline (`setup-fixtures.sh`)

Each fixture shares the project tree from repo root via **symlinks**, but has its own content and settings.

- **Symlinked at fixture root**: `pages/`, `plugins/`, `packages/`, `node_modules/`
- **Symlinked under `src/`**: `components/`, `hooks/`, `lib/`, `mocks/`, `plugins/`, `scripts/`, `styles/`, `types/`, `utils/`
- **Copied** (relative imports): `zfb.config.ts`, `zfb-shim.d.ts`, `tsconfig.json`, and every `src/config/*.ts | *.tsx` *except* `settings.ts`
- **Fixture-specific** (kept in git per fixture): `src/config/settings.ts`, `src/content/`, optionally `public/<fixture-only-files>/`
- **Seed file**: `.zfb/doc-history-meta.json` is created as `{}` so the bundler's static `#doc-history-meta` import resolves on the first run; the doc-history plugin's preBuild hook overwrites it on subsequent builds.

All fixtures are pre-built sequentially with `zfb build` (with `SKIP_DOC_HISTORY=1` for non-smoke fixtures) before Playwright runs; the runner then only spawns `zfb preview` per fixture. The smoke fixture also initialises a git repo for doc-history specs (2 commits) and is built with `GEN_DOC_HISTORY=1` so the per-page JSON manifests land in `dist/doc-history/` — the postBuild JSON generation is opt-in for local builds (#1986), so the smoke fixture requests it explicitly.

## Commands

```bash
pnpm test:e2e                                           # Full suite (setup + all tests)
pnpm test:e2e:ci                                        # CI suite (excludes @flaky tests)
npx playwright test e2e/smoke-search.spec.ts --project smoke  # Single test file
npx playwright test --project smoke                      # All tests for one fixture
E2E_FIXTURES=smoke npx playwright test --project smoke  # Fast path: build + boot only smoke
```

**Fast path**: `E2E_FIXTURES=<name>` scopes both `setup-fixtures.sh` (builds only that fixture) and `playwright.config.ts` (boots only its webServer, zero stagger); repeated runs skip the build when inputs are unchanged (`e2e/fixtures/<name>/.build-marker.sha256` tracks the hash); `E2E_FORCE_REBUILD=1` forces a full rebuild.

## Sidebar Test Helpers

`e2e/sidebar-helpers.ts` exports `desktopSidebar(page)` and `waitForSidebarHydration(page)` for tests that interact with the sidebar Preact island.

`e2e/nav-helpers.ts` exports `spaClick`, `spaClickSelector` (SPA navigation via `zfb:after-swap`), and `waitForSidebarNav` (i18n fixture sidebar hydration wait).

## Console-Error Fixture

`e2e/fixtures.ts` exports an extended `test` with a `consoleErrors` fixture (collects `console` type=error + `pageerror`) and an `assertNoConsoleErrors()` helper; import from `"./fixtures"` instead of `"@playwright/test"` when a spec needs zero-error assertions. Every allowlist entry in the `ALLOWLIST` array must have a `reason` string — do not add entries without justification.

## Nightly Exam Dispatch

To trigger the full nightly suite (`exam.yml`) against any branch on demand:

```bash
gh workflow run exam.yml --ref <branch>
```
