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

  // Regression guard for the sticky scroll-follow break (PR #3202). <Toc>'s nav
  // is `sticky top-[3.5rem]`, but a sticky box can only travel within its
  // PARENT's box — and zfb's classless <Island> div sits between the nav and
  // the layout wrapper doc-page-shell controls. When that wrapper was
  // `hidden xl:block` (#3082), the Island div was auto-height, collapsed to
  // exactly the nav's height, and the nav lost its entire travel range: it
  // scrolled off the top with the page instead of pinning. Asserting the nav's
  // viewport y at several offsets is what catches that — CSS-level checks on
  // the nav pass either way, since `position: sticky` / `top: 56px` were never
  // the thing that broke.
  test("TOC stays pinned to the viewport while the page scrolls", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tocNav = page.locator('[aria-label="Table of contents"]');
    await expect(tocNav).toBeVisible({ timeout: 5000 });

    // Matches `sticky top-[3.5rem]` on <Toc>'s nav — it clears the 3.5rem header.
    const STICKY_TOP = 56;

    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    // Guard the guard: if the fixture page ever gets short enough that it
    // barely scrolls, pinning becomes unfalsifiable and this test would pass
    // vacuously.
    expect(maxScroll).toBeGreaterThan(600);

    const navY = async () => {
      const box = await tocNav.boundingBox();
      return box === null ? null : Math.round(box.y);
    };

    await expect.poll(navY).toBe(STICKY_TOP);

    // Stay clear of the very bottom, where the content band's own end legitimately
    // starts pushing the sticky box back up.
    for (const fraction of [0.3, 0.6]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(maxScroll * fraction));
      await expect.poll(navY).toBe(STICKY_TOP);
    }
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
