# E2E Tests

## Architecture

5 Playwright fixtures, each with its own port, build, and `settings.ts`:

| Fixture | Port | Purpose |
|---|---|---|
| sidebar | 4500 | Sidebar persistence, filter |
| i18n | 4501 | Locale fallback, translation |
| theme | 4502 | Light/dark toggle, hydration |
| smoke | 4503 | General features (search, TOC, code blocks, mermaid, doc history, etc.) |
| versioning | 4504 | Version switcher, banners |

Configured in `playwright.config.ts`. Each fixture runs `astro preview` on its port.

## Adding Tests

**No new fixture needed in most cases.** The `testMatch` pattern is `${name}*.spec.ts`, so:

- `smoke-search.spec.ts` automatically runs against the smoke fixture
- `sidebar-filter.spec.ts` automatically runs against the sidebar fixture

To add a test: create `e2e/{fixture-name}-{feature}.spec.ts`. No config changes needed.

To add content for tests: add MDX files to the fixture's `src/content/docs/` directory, then enable any needed settings in its `src/config/settings.ts`.

## Two Test Patterns

**Static HTML tests** (no browser needed) — read pre-built `dist/` with `readFileSync`:

```typescript
import { readFileSync } from "node:fs";
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

Each fixture shares framework source from repo root via **symlinks**, but has its own content and settings:

- **Symlinked**: `components/`, `hooks/`, `integrations/`, `layouts/`, `plugins/`, `styles/`, `types/`, `utils/`, `node_modules/`
- **Copied** (has relative imports): `astro.config.ts`, `content.config.ts`, `src/config/*.ts` (except `settings.ts`)
- **Fixture-specific**: `src/config/settings.ts`, `src/content/docs/`

All fixtures are pre-built sequentially before Playwright runs (`astro build`), then Playwright only runs `astro preview`.

The smoke fixture also initializes a git repo for doc-history testing (2 commits).

## Commands

```bash
pnpm test:e2e                                           # Full suite (setup + all tests)
pnpm test:e2e:ci                                        # CI suite (skips @local-only tests)
npx playwright test e2e/smoke-search.spec.ts --project smoke  # Single test file
npx playwright test --project smoke                      # All tests for one fixture
```

## `@local-only` Tag

Tests that are too specific for CI (flaky DOM operations, timing-sensitive UI checks) can be tagged `@local-only` in the test title:

```typescript
test("HSL picker opens from color swatch @local-only", async ({ page }) => { ... });
```

- `pnpm test:e2e` — runs everything (local dev, `b4push`)
- `pnpm test:e2e:ci` — skips `@local-only` tests (CI workflows)

## Sidebar Test Helper

`e2e/sidebar-helpers.ts` exports `desktopSidebar(page)` and `waitForSidebarHydration(page)` for tests that interact with the sidebar Preact island.
