import { test, expect, type Page, type Locator } from "@playwright/test";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E tests for sidebar category open/close persistence across
 * View Transition page navigations.
 *
 * The sidebar uses sessionStorage ("zd-sidebar-open") to remember
 * which categories are expanded. Without this, React islands re-mount
 * on every View Transition and categories collapse.
 *
 * These tests use the Guides section which has subcategories (Sub A, Sub B).
 * The sidebar is section-scoped — only the current nav section's tree is shown.
 */

/**
 * Helper: find a category toggle button by its label text.
 * Returns the Playwright Locator for the toggle button.
 *
 * Sidebar categories render as:
 *   div.flex > [a|button with label] + [button aria-label="Collapse <label>|Expand <label>"]
 *
 * We find the toggle by matching aria-label that starts with Collapse/Expand
 * and ends with the category label text.
 */
function getCategoryToggle(page: Page, label: string): Locator {
  const sidebar = desktopSidebar(page);
  // Match toggle button whose aria-label is "Collapse <label>" or "Expand <label>"
  return sidebar.locator(
    `button[aria-label="Collapse ${label}"], button[aria-label="Expand ${label}"]`,
  );
}

/** Check if a category is open (retries automatically for timing) */
async function expectCategoryOpen(page: Page, label: string, expected: boolean) {
  const toggle = getCategoryToggle(page, label);
  const expectedLabel = expected ? `Collapse ${label}` : `Expand ${label}`;
  await expect(toggle).toHaveAttribute("aria-label", expectedLabel, { timeout: 5000 });
}

test.describe("Sidebar category persistence @local-only", () => {
  // All tests use the Guides section which has subcategories: Sub A, Sub B

  test("auto-opened subcategory stays open after navigating to a sibling page", async ({
    page,
  }) => {
    // Navigate to Sub A > Page 1 — Sub A should auto-open
    await page.goto(`/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    await expectCategoryOpen(page, "Sub A", true);

    // Navigate to a sibling page (Page 2)
    await desktopSidebar(page).getByRole("link", { name: "Test Page 2" }).click();
    await waitForSidebarHydration(page);

    // Sub A should still be open
    await expectCategoryOpen(page, "Sub A", true);
  });

  test("manually opened subcategory stays open after navigating away", async ({
    page,
  }) => {
    // Start on Sub A > Page 1
    await page.goto(`/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    // Manually open Sub B
    await getCategoryToggle(page, "Sub B").click();
    await expectCategoryOpen(page, "Sub B", true);

    // Navigate to a different page (Writing Docs — a leaf in Guides root)
    await desktopSidebar(page).getByRole("link", { name: "Writing Docs", exact: true }).click();
    await waitForSidebarHydration(page);

    // Sub B should still be open (saved to sessionStorage)
    await expectCategoryOpen(page, "Sub B", true);
  });

  test("manually closed subcategory stays closed after page navigation", async ({
    page,
  }) => {
    // Start on Sub A > Page 1 — Sub A auto-opens
    await page.goto(`/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    await expectCategoryOpen(page, "Sub A", true);

    // Close Sub A manually
    await getCategoryToggle(page, "Sub A").click();
    await expectCategoryOpen(page, "Sub A", false);

    // Navigate to Writing Docs (a leaf in Guides root)
    await desktopSidebar(page).getByRole("link", { name: "Writing Docs", exact: true }).click();
    await waitForSidebarHydration(page);

    // Sub A should still be closed
    await expectCategoryOpen(page, "Sub A", false);
  });

  test("sessionStorage key is populated correctly", async ({ page }) => {
    await page.goto(`/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    // Wait for useEffect to sync auto-opened state to sessionStorage
    await expect(async () => {
      const stored = await page.evaluate(() => {
        const raw = sessionStorage.getItem("zd-sidebar-open");
        return raw ? JSON.parse(raw) : [];
      });
      expect(stored).toContain("guides");
    }).toPass({ timeout: 5000 });
  });

  test("multiple subcategories remain open across navigations", async ({
    page,
  }) => {
    // Start on Sub A > Page 1
    await page.goto(`/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    // Sub A is auto-opened, manually open Sub B
    await expectCategoryOpen(page, "Sub A", true);
    await getCategoryToggle(page, "Sub B").click();
    await expectCategoryOpen(page, "Sub B", true);

    // Navigate to Writing Docs (a leaf page in Guides root)
    await desktopSidebar(page).getByRole("link", { name: "Writing Docs", exact: true }).click();
    await waitForSidebarHydration(page);

    // Both Sub A and Sub B should still be open
    await expectCategoryOpen(page, "Sub A", true);
    await expectCategoryOpen(page, "Sub B", true);

    // Navigate to Sub A > Test Page 3 (another page within Guides)
    await desktopSidebar(page).getByRole("link", { name: "Test Page 3" }).click();
    await waitForSidebarHydration(page);

    // Both should still be open
    await expectCategoryOpen(page, "Sub A", true);
    await expectCategoryOpen(page, "Sub B", true);
  });
});
