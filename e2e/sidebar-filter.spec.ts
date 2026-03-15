import { test, expect } from "@playwright/test";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E tests for the sidebar filter input in SidebarTree.
 *
 * The filter input allows users to narrow the sidebar tree to items
 * matching the typed query. It uses client-side filtering of NavNode
 * labels via the filterTree function.
 *
 * Sidebar fixture content structure:
 *   getting-started/index.mdx
 *   guides/index.mdx
 *   guides/page-1.mdx           (title: "Writing Docs")
 *   guides/sub-a/page-1.mdx     (title: "Test Page 1")
 *   guides/sub-a/page-2.mdx     (title: "Test Page 2")
 *   guides/sub-a/page-3.mdx     (title: "Test Page 3")
 *   guides/sub-b/page-1.mdx     (title: "Test Page 1")
 *   guides/sub-b/page-2.mdx     (title: "Test Page 2")
 */

const GUIDES_PAGE = "/docs/guides/sub-a/page-1";

test.describe("Sidebar filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("filter input is visible in the sidebar", async ({ page }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    const filterInput = sidebar.locator('input[placeholder^="Filter"]');
    await expect(filterInput).toBeVisible();
  });

  test("typing 'Sub A' filters to show only Sub A items", async ({ page }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    const filterInput = sidebar.locator('input[placeholder^="Filter"]');

    await filterInput.fill("Sub A");

    // Sub A category should be visible
    await expect(
      sidebar.locator('button[aria-label="Collapse Sub A"], button[aria-label="Expand Sub A"]'),
    ).toBeVisible({ timeout: 3000 });

    // Sub B category should not be visible
    await expect(
      sidebar.locator('button[aria-label="Collapse Sub B"], button[aria-label="Expand Sub B"]'),
    ).not.toBeVisible();
  });

  test("clearing filter restores all items", async ({ page }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    const filterInput = sidebar.locator('input[placeholder^="Filter"]');

    // Filter to narrow results
    await filterInput.fill("Sub A");
    await expect(
      sidebar.locator('button[aria-label="Collapse Sub B"], button[aria-label="Expand Sub B"]'),
    ).not.toBeVisible();

    // Clear the filter
    await filterInput.fill("");

    // Sub B should be visible again
    await expect(
      sidebar.locator('button[aria-label="Collapse Sub B"], button[aria-label="Expand Sub B"]'),
    ).toBeVisible({ timeout: 3000 });
  });

  test("typing partial match 'page' shows items with 'page' in label", async ({ page }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    const filterInput = sidebar.locator('input[placeholder^="Filter"]');

    await filterInput.fill("page");

    // "Test Page" items exist under Sub A and Sub B — both categories
    // should remain visible since their children match
    await expect(
      sidebar.locator('button[aria-label="Collapse Sub A"], button[aria-label="Expand Sub A"]'),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      sidebar.locator('button[aria-label="Collapse Sub B"], button[aria-label="Expand Sub B"]'),
    ).toBeVisible({ timeout: 3000 });

    // "Writing Docs" should not match "page"
    await expect(sidebar.getByRole("link", { name: "Writing Docs", exact: true })).not.toBeVisible();
  });

  test("Ctrl+/ focuses the filter input", async ({ page }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    const filterInput = sidebar.locator('input[placeholder^="Filter"]');

    // Ensure filter input is not focused initially
    await expect(filterInput).not.toBeFocused();

    // Press Ctrl+/
    await page.keyboard.press("Control+/");

    // Filter input should now be focused
    await expect(filterInput).toBeFocused({ timeout: 3000 });
  });
});
