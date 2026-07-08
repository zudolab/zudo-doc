import { test, expect } from "@playwright/test";

/**
 * E2E tests for the desktop Table of Contents component.
 *
 * Uses the toc-test page which has multiple h2/h3 headings with
 * enough body text for scroll spy detection. Desktop TOC is visible
 * at the xl breakpoint (1280px).
 *
 * Static markup assertions (heading-link presence, h3 indent class) were
 * split out to `smoke-toc-markup.spec.ts` as L3 dist reads
 * (zudolab/zudo-doc#2537) — they don't need a browser. Viewport-visibility
 * and scroll-spy behavior stay here since they depend on real layout/CSS
 * and scroll events.
 */

const PAGE = "/docs/guides/toc-test";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("TOC: desktop table of contents", () => {
  test("TOC nav is visible at xl viewport", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });
  });

  test("scroll spy sets aria-current on a heading after scrolling", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    // Scroll the Introduction heading to the top of the viewport so it enters
    // the scroll spy's active zone (top < viewportHeight / 2). Do not use
    // scrollIntoViewIfNeeded(): the heading can already be visible but still
    // sit below the active threshold after production HTML minification.
    await page.evaluate(() => {
      const el = document.getElementById("introduction");
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "start" });
      }
    });

    // Wait for the scroll spy debounce (200ms) to settle and mark a heading active
    const activeLink = tocNav.locator('a[aria-current="true"]');
    await expect(activeLink).toHaveCount(1, { timeout: 5000 });
  });

  test("scroll spy updates aria-current when scrolling to a different section", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    // Scroll to Introduction first to activate scroll spy.
    await page.evaluate(() => {
      const el = document.getElementById("introduction");
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "start" });
      }
    });
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
