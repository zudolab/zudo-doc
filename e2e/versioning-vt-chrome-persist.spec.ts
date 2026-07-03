/**
 * Permanent E2E regression spec for VT Chrome Persist (#1547) — versioning checks.
 *
 * Locked-down coverage (runs on every PR via pnpm test:e2e):
 *   6. Header version-switcher reflects the correct version label on a
 *      /v/{version}/docs/... route. Verified in two ways:
 *      a. Direct navigation: goto the versioned page, assert toggle shows "1.0.0".
 *      b. SPA swap: navigate within the versioned section (getting-started →
 *         installation) and assert the toggle still shows "1.0.0" — confirming
 *         the persisted header's version-switcher island stays consistent.
 *         The versioning fixture has two pages per version (getting-started and
 *         installation), so the SPA swap sub-test always has a second page to
 *         navigate to.
 *
 * The cross-version SPA swap (Latest → /v/1.0) is intentionally NOT checked
 * here: both pages share the same header persist key (header-en), so the
 * persisted header island may show a stale version label until the island's
 * own update logic fires (a separate concern from the chrome-persist feature).
 * What IS checked: the SSR-rendered state on a direct load to a versioned route.
 *
 * Sibling spec files cover other locked-down assertions:
 *   - smoke-vt-chrome-persist.spec.ts   (smoke fixture, port 4503)
 *   - i18n-vt-chrome-persist.spec.ts    (i18n fixture, port 4501)
 *
 * Root cause: zudolab/zudo-doc#1546 (Investigation #8 — version-switcher state)
 * W7A retro lesson: .claude/skills/l-lessons-zfb-migration-parity/SKILL.md
 *
 * b4push: auto-picked up by versioning*.spec.ts glob in playwright.config.ts.
 * CI: test:e2e (pnpm test:e2e) and test:e2e:ci (excludes @flaky).
 */

import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";

// Desktop viewport so the header is fully rendered.
test.use({ viewport: { width: 1280, height: 900 } });

const VERSIONED_PAGE = "/v/1.0/docs/getting-started/";
const VERSIONED_PAGE_2 = "/v/1.0/docs/installation/";
const LATEST_PAGE = "/docs/getting-started/";

// ---------------------------------------------------------------------------
// Test 6a: Version-switcher shows correct version on direct navigation
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: version-switcher state on versioned routes", () => {
  test("header version-switcher shows '1.0.0' on direct load of /v/1.0/ route", async ({
    page,
  }) => {
    // Navigate directly to the versioned page (full page load, not SPA).
    // This verifies that the SSR-rendered header correctly reflects the version.
    await page.goto(VERSIONED_PAGE, { waitUntil: "domcontentloaded" });

    const headerBanner = page.getByRole("banner");
    const toggle = headerBanner.locator("[data-version-toggle]");
    await expect(
      toggle,
      "version-switcher toggle should be visible on the versioned page",
    ).toBeVisible();

    const toggleText = await toggle.textContent();
    // The toggle renders as "<span>Version:</span><span>1.0.0</span>" so
    // textContent() gives "Version:1.0.0". Accept any text that contains "1.0".
    expect(
      toggleText ?? "",
      "version-switcher toggle should show '1.0.0' (or similar) on the versioned page",
    ).toMatch(/1\.0/);
  });

  test("header version-switcher shows 'Latest' on latest page and URL differs from versioned", async ({
    page,
  }) => {
    // Verify the latest page's toggle shows a different label from the versioned page.
    // This guards against a regression where both pages render the same label.
    await page.goto(LATEST_PAGE, { waitUntil: "domcontentloaded" });

    const headerBanner = page.getByRole("banner");
    const toggle = headerBanner.locator("[data-version-toggle]");
    await expect(
      toggle,
      "version-switcher toggle should be visible on the latest page",
    ).toBeVisible();

    const toggleText = await toggle.textContent();
    expect(
      toggleText ?? "",
      "version-switcher toggle should show 'Latest' on the latest page",
    ).toContain("Latest");
  });

  test("version-switcher toggle still shows '1.0.0' after same-locale SPA swap within versioned section", async ({
    page,
  }) => {
    // Navigate directly to the versioned page first.
    await page.goto(VERSIONED_PAGE, { waitUntil: "domcontentloaded" });

    const headerBanner = page.getByRole("banner");
    const toggle = headerBanner.locator("[data-version-toggle]");
    await expect(toggle).toBeVisible();

    // Assert that the second versioned page link exists in the page CONTENT.
    // The fixture's docs-v1/getting-started page carries an in-content link to
    // docs-v1/installation — content links are static HTML, unlike the sidebar
    // tree (whose versioned composition is hydration-dependent and does not
    // list v1-only pages from other pages). Hrefs may be emitted without a
    // trailing slash — accept both forms.
    const versionedPage2Bare = VERSIONED_PAGE_2.replace(/\/$/, "");
    const secondLinkLocator = page.locator(
      `main a[href="${versionedPage2Bare}"], main a[href="${versionedPage2Bare}/"]`,
    );
    await expect(
      secondLinkLocator,
      `Expected an in-content link to ${VERSIONED_PAGE_2} — the versioning fixture's docs-v1/getting-started page must link to docs-v1/installation`,
    ).toBeAttached();

    // Perform SPA swap within the versioned section.
    const swapFired = await spaClick(page, VERSIONED_PAGE_2);
    expect(
      swapFired,
      "zfb:after-swap should fire for same-locale SPA swap within /v/1.0/",
    ).toBe(true);

    // The version-switcher toggle should still show "1.0.0" after the swap.
    const afterText = await headerBanner.locator("[data-version-toggle]").textContent();
    expect(
      afterText ?? "",
      "version-switcher toggle should still show '1.0.0' after same-locale SPA swap within /v/1.0/",
    ).toMatch(/1\.0/);
  });
});

// ---------------------------------------------------------------------------
// #2553: the persisted header's version-switcher MENU (anchor hrefs, active
// row, trigger label) must be recomputed from the live pathname on
// zfb:after-swap — not just the toggle open/close behaviour. These assert the
// stale-menu regression that the tests above deliberately left uncovered.
//
// The fixture emits slashless hrefs (trailingSlash off), so href assertions
// tolerate an optional trailing slash.
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: version-switcher menu re-wire (#2553)", () => {
  test("menu anchor hrefs re-wire after a same-version SPA swap", async ({ page }) => {
    await page.goto(VERSIONED_PAGE, { waitUntil: "domcontentloaded" });

    // Scope to the persisted-header switcher (the only one carrying the
    // re-wire config); the inline breadcrumb switcher lives in <main> and is
    // re-rendered fresh on every swap, so it is intentionally not re-wired.
    const sw = page.getByRole("banner").locator("[data-version-rewire]");
    await expect(sw, "header version-switcher must opt into SPA re-wire").toBeAttached();

    const latestAnchor = sw.locator("[data-version-latest]");
    const v1Anchor = sw.locator('[data-version-slug="1.0"]');

    // Baseline: on the getting-started page the menu points there.
    await expect(v1Anchor).toHaveAttribute("href", /\/v\/1\.0\/docs\/getting-started\/?$/);
    await expect(latestAnchor).toHaveAttribute("href", /^\/docs\/getting-started\/?$/);

    // Tag the switcher DOM node so we can prove it persisted (a re-wire) rather
    // than being re-rendered by the router.
    await sw.evaluate((el) => el.setAttribute("data-persist-marker", "v1"));

    const swapFired = await spaClick(page, VERSIONED_PAGE_2);
    expect(swapFired, "zfb:after-swap should fire for the same-version SPA swap").toBe(true);
    await page.waitForURL(/\/v\/1\.0\/docs\/installation\/?$/);

    // Same DOM node → header genuinely persisted, so the hrefs below only
    // update because of the client re-wire (they would be stale pre-fix).
    await expect(
      sw,
      "the header switcher must be the same persisted DOM node after the swap",
    ).toHaveAttribute("data-persist-marker", "v1");

    await expect(v1Anchor).toHaveAttribute("href", /\/v\/1\.0\/docs\/installation\/?$/);
    await expect(latestAnchor).toHaveAttribute("href", /^\/docs\/installation\/?$/);
  });

  test("active row + trigger label re-wire on a cross-version SPA swap", async ({ page }) => {
    await page.goto(VERSIONED_PAGE, { waitUntil: "domcontentloaded" });

    const sw = page.getByRole("banner").locator("[data-version-rewire]");
    await expect(sw).toBeAttached();

    const triggerLabel = sw.locator("[data-version-trigger-label]");
    const latestAnchor = sw.locator("[data-version-latest]");
    const v1Anchor = sw.locator('[data-version-slug="1.0"]');

    // Baseline on the versioned page: label "1.0.0", the 1.0 row is active.
    await expect(triggerLabel).toHaveText(/1\.0/);
    await expect(v1Anchor).toHaveAttribute("aria-current", "page");

    await sw.evaluate((el) => el.setAttribute("data-persist-marker", "vc"));

    // SPA-navigate to the latest page via the switcher's own "Latest" menu
    // link — a cross-version swap under the shared header-en persist key.
    const swapFired = await spaClick(page, LATEST_PAGE);
    expect(swapFired, "zfb:after-swap should fire for the cross-version SPA swap").toBe(true);
    await page.waitForURL(/\/docs\/getting-started\/?$/);

    await expect(sw).toHaveAttribute("data-persist-marker", "vc");

    // Post-nav the active row + label must follow the latest page (would stay
    // stale on "1.0.0" pre-fix).
    await expect(triggerLabel).toHaveText(/Latest/);
    await expect(latestAnchor).toHaveAttribute("aria-current", "page");
    await expect(v1Anchor).not.toHaveAttribute("aria-current", "page");
  });
});
