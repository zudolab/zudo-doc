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
 * CI: test:e2e (pnpm test:e2e) and test:e2e:ci (skips @local-only).
 */

import { test, expect } from "@playwright/test";
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

  test("version-switcher toggle still shows '1.0.0' after same-locale SPA swap within versioned section @local-only", async ({
    page,
  }) => {
    // Navigate directly to the versioned page first.
    await page.goto(VERSIONED_PAGE, { waitUntil: "domcontentloaded" });

    const headerBanner = page.getByRole("banner");
    const toggle = headerBanner.locator("[data-version-toggle]");
    await expect(toggle).toBeVisible();

    // Assert that the second versioned page link exists in the sidebar.
    // The fixture includes docs-v1/installation/index.mdx so this always holds.
    const secondLinkLocator = page.locator(
      `#desktop-sidebar a[href="${VERSIONED_PAGE_2}"]`,
    );
    await expect(
      secondLinkLocator,
      `Expected a sidebar link to ${VERSIONED_PAGE_2} — the versioning fixture must include docs-v1/installation/index.mdx`,
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
