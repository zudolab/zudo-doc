import { test, expect } from "@playwright/test";

/**
 * E2E tests for the desktop Table of Contents component.
 *
 * Uses the toc-test page which has multiple h2/h3 headings with
 * enough body text for scroll spy detection. Desktop TOC is visible
 * at the xl breakpoint (1280px).
 */

const PAGE = "/docs/guides/toc-test";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("TOC: desktop table of contents", () => {
  test("TOC nav is visible at xl viewport", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });
  });

  test("TOC contains h2 heading links", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    const h2Headings = [
      "Introduction",
      "Getting Started",
      "Configuration",
      "Content Authoring",
      "Deployment",
    ];

    for (const heading of h2Headings) {
      const link = tocNav.getByRole("link", { name: heading, exact: true });
      await expect(link).toBeVisible();
    }
  });

  test("TOC contains h3 heading links", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    const h3Headings = [
      "Prerequisites",
      "Installation",
      "Basic Settings",
      "Advanced Options",
      "Writing MDX",
      "Using Components",
    ];

    for (const heading of h3Headings) {
      const link = tocNav.getByRole("link", { name: heading, exact: true });
      await expect(link).toBeVisible();
    }
  });

  test("h3 list items have ml-hsp-lg class", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    // Find h3 heading links and check their parent li
    const h3Link = tocNav.getByRole("link", { name: "Prerequisites", exact: true });
    const parentLi = h3Link.locator("..");
    await expect(parentLi).toHaveClass(/ml-hsp-lg/);
  });

  test("scroll spy sets aria-current on a heading after scrolling @local-only", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    // Scroll to the Introduction heading to ensure it enters the active zone.
    // The scroll spy uses a debounce and position-based detection, so we need
    // the heading to be near the top of the viewport.
    await page.locator("#introduction").scrollIntoViewIfNeeded();

    // Wait for the scroll spy debounce (200ms) to settle and mark a heading active
    const activeLink = tocNav.locator('a[aria-current="true"]');
    await expect(activeLink).toHaveCount(1, { timeout: 5000 });
  });

  test("scroll spy updates aria-current when scrolling to a different section @local-only", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    // Scroll to Introduction first to activate scroll spy
    await page.locator("#introduction").scrollIntoViewIfNeeded();
    const activeLink = tocNav.locator('a[aria-current="true"]');
    await expect(activeLink).toHaveCount(1, { timeout: 5000 });

    // Scroll the Deployment heading to the top of the viewport so it enters
    // the scroll spy's active zone (top < viewportHeight / 2)
    await page.evaluate(() => {
      const el = document.getElementById("deployment");
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "start" });
      }
    });

    // Wait for scroll spy debounce to settle and update aria-current
    const deploymentLink = tocNav.getByRole("link", { name: "Deployment", exact: true });
    await expect(deploymentLink).toHaveAttribute("aria-current", "true", {
      timeout: 5000,
    });
  });
});
