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

/** The desktop sidebar aside (visible at lg breakpoint) */
function desktopSidebar(page: Page): Locator {
  // The desktop aside is the second one — it has `lg:block` class
  return page.locator("aside.hidden.lg\\:block");
}

/** Wait for the React sidebar island to hydrate */
async function waitForSidebarHydration(page: Page) {
  // The <nav> element is rendered by React after hydration
  await desktopSidebar(page).locator("nav").waitFor({ state: "attached" });
}

/**
 * Get the expand/collapse toggle button for a category.
 * Categories render as: <div><div class="flex ..."><a|button>{label}</a|button><button aria-label="Collapse|Expand">...</button></div>...</div>
 * We find the link/button with the exact label text, go up to the flex container, then find the toggle.
 */
function categoryToggle(page: Page, label: string): Locator {
  const sidebar = desktopSidebar(page);
  // Find a link or button with the exact category label text
  const labelEl = sidebar.locator("nav a, nav button", { hasText: label }).filter({ hasText: new RegExp(`^${label}$`) }).first();
  // The toggle button is a sibling in the same flex container
  return labelEl.locator("..").getByRole("button", { name: /Collapse|Expand/ });
}

/** Check if a category's children are visible by inspecting the toggle button's aria-label */
async function isCategoryOpen(page: Page, label: string): Promise<boolean> {
  const toggle = categoryToggle(page, label);
  const ariaLabel = await toggle.getAttribute("aria-label");
  return ariaLabel === "Collapse";
}

test.describe("Sidebar category persistence", () => {
  test("auto-opened category stays open after navigating to a page in a different category", async ({
    page,
  }) => {
    await page.goto(`${BASE}/docs/getting-started/introduction`);
    await waitForSidebarHydration(page);

    // "Getting Started" should be auto-opened (contains current page)
    expect(await isCategoryOpen(page, "Getting Started")).toBe(true);

    // Open Guides category
    await categoryToggle(page, "Guides").click();
    expect(await isCategoryOpen(page, "Guides")).toBe(true);

    // Click a page link under Guides
    await desktopSidebar(page).getByRole("link", { name: "Writing Docs" }).click();
    await waitForSidebarHydration(page);

    // After View Transition navigation:
    // - "Guides" should still be open (contains current page)
    expect(await isCategoryOpen(page, "Guides")).toBe(true);
    // - "Getting Started" should still be open (was saved to sessionStorage)
    expect(await isCategoryOpen(page, "Getting Started")).toBe(true);
  });

  test("manually opened category stays open after page navigation", async ({
    page,
  }) => {
    await page.goto(`${BASE}/docs/getting-started/introduction`);
    await waitForSidebarHydration(page);

    // Manually open "Reference" category
    await categoryToggle(page, "Reference").click();
    expect(await isCategoryOpen(page, "Reference")).toBe(true);

    // Navigate to another page within Getting Started
    await desktopSidebar(page).getByRole("link", { name: "Installation" }).click();
    await waitForSidebarHydration(page);

    // "Reference" should still be open (manually toggled, saved to sessionStorage)
    expect(await isCategoryOpen(page, "Reference")).toBe(true);
  });

  test("manually closed category stays closed after page navigation", async ({
    page,
  }) => {
    await page.goto(`${BASE}/docs/getting-started/introduction`);
    await waitForSidebarHydration(page);

    // "Getting Started" is auto-opened. Close it manually.
    await categoryToggle(page, "Getting Started").click();
    expect(await isCategoryOpen(page, "Getting Started")).toBe(false);

    // Open Guides and navigate to a page there
    await categoryToggle(page, "Guides").click();
    await desktopSidebar(page).getByRole("link", { name: "Components" }).click();
    await waitForSidebarHydration(page);

    // "Getting Started" should still be closed
    expect(await isCategoryOpen(page, "Getting Started")).toBe(false);
  });

  test("sessionStorage key is populated correctly", async ({ page }) => {
    await page.goto(`${BASE}/docs/getting-started/introduction`);
    await waitForSidebarHydration(page);

    // Wait for useEffect to sync auto-opened state to sessionStorage
    await expect(async () => {
      const stored = await page.evaluate(() => {
        const raw = sessionStorage.getItem("zd-sidebar-open");
        return raw ? JSON.parse(raw) : [];
      });
      expect(stored).toContain("getting-started");
    }).toPass({ timeout: 5000 });
  });

  test("multiple categories remain open across multiple navigations", async ({
    page,
  }) => {
    await page.goto(`${BASE}/docs/getting-started/introduction`);
    await waitForSidebarHydration(page);

    // Open Guides and Reference manually
    await categoryToggle(page, "Guides").click();
    await categoryToggle(page, "Reference").click();

    // Navigate to Guides > Color
    await desktopSidebar(page).getByRole("link", { name: "Color" }).click();
    await waitForSidebarHydration(page);

    // All three should be open
    expect(await isCategoryOpen(page, "Getting Started")).toBe(true);
    expect(await isCategoryOpen(page, "Guides")).toBe(true);
    expect(await isCategoryOpen(page, "Reference")).toBe(true);

    // Navigate to Reference > Configuration
    await desktopSidebar(page).getByRole("link", { name: "Configuration" }).click();
    await waitForSidebarHydration(page);

    // All three should still be open
    expect(await isCategoryOpen(page, "Getting Started")).toBe(true);
    expect(await isCategoryOpen(page, "Guides")).toBe(true);
    expect(await isCategoryOpen(page, "Reference")).toBe(true);
  });
});
