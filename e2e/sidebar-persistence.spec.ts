import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

// Read the base path from settings.ts so URLs work regardless of config
function getBasePath(): string {
  const settingsPath = join(process.cwd(), "src", "config", "settings.ts");
  const content = readFileSync(settingsPath, "utf-8");
  const match = content.match(/base:\s*["']([^"']+)["']/);
  return match ? match[1].replace(/\/$/, "") : "";
}

const BASE = getBasePath();

// Desktop viewport so the sidebar is always visible
test.use({ viewport: { width: 1280, height: 800 } });

/** The desktop sidebar aside */
function desktopSidebar(page: Page): Locator {
  return page.locator("#desktop-sidebar");
}

/** Wait for the React sidebar island to hydrate and become interactive */
async function waitForSidebarHydration(page: Page) {
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached" });
  // Wait until React hydration is complete by checking that a toggle button
  // has a click handler attached (we test this by checking that React's
  // internal properties exist on the DOM element)
  await page.waitForFunction(() => {
    const sidebar = document.querySelector("#desktop-sidebar");
    if (!sidebar) return false;
    const btn = sidebar.querySelector('button[aria-label="Collapse"], button[aria-label="Expand"]');
    if (!btn) return false;
    // React 19 attaches __reactFiber or __reactProps on hydrated elements
    return Object.keys(btn).some(k => k.startsWith("__react"));
  }, null, { timeout: 5000 });
}

/**
 * Helper: find a category toggle button by its label text.
 * Returns the Playwright Locator for the toggle button.
 *
 * Sidebar categories render as:
 *   div.flex > [a|button with label] + [button aria-label="Collapse|Expand"]
 *
 * We use evaluate() to identify the correct button's test-id,
 * then use a Playwright locator to interact with it.
 */
function getCategoryToggle(page: Page, label: string): Locator {
  const sidebar = desktopSidebar(page);
  // Each toggle button shares a parent flex div with the label.
  // Use XPath to find the toggle button whose parent also contains the label text.
  // The aria-label on the toggle is either "Collapse" or "Expand".
  return sidebar.locator(
    `xpath=.//button[@aria-label="Collapse" or @aria-label="Expand"][../*[normalize-space(text())="${label}"]]`,
  );
}

/** Check if a category is open (retries automatically for timing) */
async function expectCategoryOpen(page: Page, label: string, expected: boolean) {
  const toggle = getCategoryToggle(page, label);
  const expectedLabel = expected ? "Collapse" : "Expand";
  await expect(toggle).toHaveAttribute("aria-label", expectedLabel, { timeout: 5000 });
}

test.describe("Sidebar category persistence", () => {
  // All tests use the Guides section which has subcategories: Sub A, Sub B

  test("auto-opened subcategory stays open after navigating to a sibling page", async ({
    page,
  }) => {
    // Navigate to Sub A > Page 1 — Sub A should auto-open
    await page.goto(`${BASE}/docs/guides/sub-a/page-1`);
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
    await page.goto(`${BASE}/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    // Manually open Sub B
    await getCategoryToggle(page, "Sub B").click();
    await expectCategoryOpen(page, "Sub B", true);

    // Navigate to a different page (Writing Docs — a leaf in Guides root)
    await desktopSidebar(page).getByRole("link", { name: "Writing Docs" }).click();
    await waitForSidebarHydration(page);

    // Sub B should still be open (saved to sessionStorage)
    await expectCategoryOpen(page, "Sub B", true);
  });

  test("manually closed subcategory stays closed after page navigation", async ({
    page,
  }) => {
    // Start on Sub A > Page 1 — Sub A auto-opens
    await page.goto(`${BASE}/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    await expectCategoryOpen(page, "Sub A", true);

    // Close Sub A manually
    await getCategoryToggle(page, "Sub A").click();
    await expectCategoryOpen(page, "Sub A", false);

    // Navigate to Writing Docs
    await desktopSidebar(page).getByRole("link", { name: "Writing Docs" }).click();
    await waitForSidebarHydration(page);

    // Sub A should still be closed
    await expectCategoryOpen(page, "Sub A", false);
  });

  test("sessionStorage key is populated correctly", async ({ page }) => {
    await page.goto(`${BASE}/docs/guides/sub-a/page-1`);
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
    await page.goto(`${BASE}/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    // Sub A is auto-opened, manually open Sub B
    await expectCategoryOpen(page, "Sub A", true);
    await getCategoryToggle(page, "Sub B").click();
    await expectCategoryOpen(page, "Sub B", true);

    // Navigate to Writing Docs (a leaf page)
    await desktopSidebar(page).getByRole("link", { name: "Writing Docs" }).click();
    await waitForSidebarHydration(page);

    // Both Sub A and Sub B should still be open
    await expectCategoryOpen(page, "Sub A", true);
    await expectCategoryOpen(page, "Sub B", true);

    // Navigate to Color (another leaf page)
    await desktopSidebar(page).getByRole("link", { name: "Color" }).click();
    await waitForSidebarHydration(page);

    // Both should still be open
    await expectCategoryOpen(page, "Sub A", true);
    await expectCategoryOpen(page, "Sub B", true);
  });
});
