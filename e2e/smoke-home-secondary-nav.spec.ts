import { test, expect } from "@playwright/test";

/**
 * Coverage for `siteTreeNavSecondary` (epic zudolab/zudo-doc#4235, integration
 * confirm sub #4244). The smoke fixture sets `siteTreeNavSecondary: ["guides"]`
 * (`e2e/fixtures/smoke/src/config/settings.ts`), which moves the real "guides"
 * top-level category out of the home-page `SiteTreeNav` grid and into the
 * `[data-home-secondary-nav]` row (`packages/zudo-doc/src/home-page/index.tsx`).
 *
 * `SiteTreeNav` is a `when: "idle"` island but still server-renders its markup
 * synchronously, so no hydration wait is needed to read its DOM — only
 * `page.goto` + Playwright's default auto-waiting locator assertions below.
 */
test.describe("home secondary nav (siteTreeNavSecondary)", () => {
  test("lists the moved category in the secondary row, not the grid", async ({ page }) => {
    await page.goto("/");

    const secondaryNav = page.locator("[data-home-secondary-nav]");
    await expect(secondaryNav).toBeVisible();

    const secondaryLink = secondaryNav.getByRole("link", { name: "Guides" });
    await expect(secondaryLink).toBeVisible();
    const href = await secondaryLink.getAttribute("href");
    expect(href, "secondary-nav link must carry a real href").toBeTruthy();
    expect(href).toMatch(/\/docs\/guides\/?$/);

    // The grid must no longer list "guides" as a top-level category.
    const grid = page.locator("[data-site-nav]");
    await expect(grid).toBeVisible();
    await expect(grid.getByRole("link", { name: "Guides", exact: true })).toHaveCount(0);

    // The link is a real, working navigation, not a dead href.
    await secondaryLink.click();
    await expect(page).toHaveURL(/\/docs\/guides\/?$/);
    await expect(page.locator("h1")).toContainText("Guides");
  });
});
