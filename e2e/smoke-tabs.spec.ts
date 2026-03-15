import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Tabs component.
 *
 * Tab buttons are created dynamically by tabs-init.astro script
 * after page load. Tests wait for [data-tab-btn] to appear before
 * asserting.
 */

const PAGE = "/docs/guides/code-blocks-test";

test.describe("Tabs: interactive tab switching", () => {
  test("tab container is present", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const tabContainer = page.locator("[data-tabs]");
    await expect(tabContainer).toBeAttached();
  });

  test("tab buttons are rendered after JS initialization", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // Wait for tab buttons to be created dynamically
    const firstTabBtn = page.locator("[data-tab-btn]").first();
    await firstTabBtn.waitFor({ state: "attached", timeout: 10_000 });

    const tabBtns = page.locator("[data-tab-btn]");
    const count = await tabBtns.count();
    expect(count).toBe(3); // JavaScript, Python, Rust
  });

  test("first tab button is selected by default", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const firstTabBtn = page.locator("[data-tab-btn]").first();
    await firstTabBtn.waitFor({ state: "attached", timeout: 10_000 });

    // First tab (JavaScript) should be selected
    await expect(firstTabBtn).toHaveText("JavaScript");
    await expect(firstTabBtn).toHaveAttribute("aria-selected", "true");
  });

  test("non-active tab buttons have aria-selected=false", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const firstTabBtn = page.locator("[data-tab-btn]").first();
    await firstTabBtn.waitFor({ state: "attached", timeout: 10_000 });

    const secondTabBtn = page.locator("[data-tab-btn]").nth(1);
    const thirdTabBtn = page.locator("[data-tab-btn]").nth(2);

    await expect(secondTabBtn).toHaveAttribute("aria-selected", "false");
    await expect(thirdTabBtn).toHaveAttribute("aria-selected", "false");
  });

  test("clicking a tab switches selection and panel visibility", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const firstTabBtn = page.locator("[data-tab-btn]").first();
    await firstTabBtn.waitFor({ state: "attached", timeout: 10_000 });

    // Find the Python tab button
    const pythonBtn = page.locator('[data-tab-btn="py"]');
    await expect(pythonBtn).toHaveText("Python");

    // Click Python tab
    await pythonBtn.click();

    // Python tab should now be selected
    await expect(pythonBtn).toHaveAttribute("aria-selected", "true");

    // JavaScript tab should no longer be selected
    await expect(firstTabBtn).toHaveAttribute("aria-selected", "false");

    // Python panel should be visible, JavaScript panel should be hidden
    const tabContainer = page.locator("[data-tabs]");
    const jsPanel = tabContainer.locator('.tab-panel[data-tab-value="js"]');
    const pyPanel = tabContainer.locator('.tab-panel[data-tab-value="py"]');

    expect(await jsPanel.getAttribute("hidden")).not.toBeNull();
    expect(await pyPanel.getAttribute("hidden")).toBeNull();
  });
});
