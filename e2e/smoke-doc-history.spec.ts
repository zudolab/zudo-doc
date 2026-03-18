import { test, expect } from "@playwright/test";

/**
 * E2E tests for the DocHistory component.
 *
 * Uses the getting-started page which has 2 git commits in the
 * smoke fixture. The DocHistory component uses client:idle hydration,
 * so it may take a moment to become interactive. History data is
 * fetched from /doc-history/getting-started.json.
 */

const PAGE = "/docs/getting-started";

test.describe("Doc History: revision panel and diff @local-only", () => {
  test("history trigger button is present", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // DocHistory uses client:idle, wait for hydration
    const triggerBtn = page.locator('[aria-label="View document history"]');
    await triggerBtn.waitFor({ state: "visible", timeout: 15_000 });
  });

  test("clicking trigger opens the history panel", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const triggerBtn = page.locator('[aria-label="View document history"]');
    await triggerBtn.waitFor({ state: "visible", timeout: 15_000 });

    await triggerBtn.click();

    // Panel should become visible (dialog[open])
    const panel = page.locator('dialog[aria-label="Document revision history"]');
    await expect(panel).toHaveAttribute("open", "", { timeout: 5000 });
  });

  test("revision list shows 2+ entries after data loads", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const triggerBtn = page.locator('[aria-label="View document history"]');
    await triggerBtn.waitFor({ state: "visible", timeout: 15_000 });

    await triggerBtn.click();

    // Wait for the spinner to disappear and entries to appear
    // Each revision entry has an A/B selection button
    const entryButtons = page.locator(
      '[aria-label^="Select revision"][aria-label$="as A"]',
    );
    await expect(entryButtons).toHaveCount(2, { timeout: 10_000 });
  });

  test("A/B selection buttons are present for each revision", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const triggerBtn = page.locator('[aria-label="View document history"]');
    await triggerBtn.waitFor({ state: "visible", timeout: 15_000 });

    await triggerBtn.click();

    // Verify panel is open before looking for entries
    const panel = page.locator('dialog[aria-label="Document revision history"]');
    await expect(panel).toHaveAttribute("open", "", { timeout: 5000 });

    // Wait for entries to load (fetch completes and spinner disappears)
    const aButtons = page.locator(
      '[aria-label^="Select revision"][aria-label$="as A"]',
    );
    await expect(aButtons).toHaveCount(2, { timeout: 15_000 });

    const bButtons = page.locator(
      '[aria-label^="Select revision"][aria-label$="as B"]',
    );
    await expect(bButtons).toHaveCount(2);
  });

  test("Compare button is present", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const triggerBtn = page.locator('[aria-label="View document history"]');
    await triggerBtn.waitFor({ state: "visible", timeout: 15_000 });

    await triggerBtn.click();

    // Wait for entries to load
    const aButtons = page.locator(
      '[aria-label^="Select revision"][aria-label$="as A"]',
    );
    await expect(aButtons).toHaveCount(2, { timeout: 10_000 });

    const compareBtn = page.getByRole("button", { name: "Compare" });
    await expect(compareBtn).toBeVisible();
  });

  test("clicking Compare shows diff viewer with a table", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const triggerBtn = page.locator('[aria-label="View document history"]');
    await triggerBtn.waitFor({ state: "visible", timeout: 15_000 });

    await triggerBtn.click();

    // Wait for entries to load
    const aButtons = page.locator(
      '[aria-label^="Select revision"][aria-label$="as A"]',
    );
    await expect(aButtons).toHaveCount(2, { timeout: 10_000 });

    // Click Compare (A and B are pre-selected by default: A=index 1, B=index 0)
    const compareBtn = page.getByRole("button", { name: "Compare" });
    await compareBtn.click();

    // Diff viewer should show a table
    const panel = page.locator('[aria-label="Document revision history"]');
    const diffTable = panel.locator("table");
    await expect(diffTable).toBeVisible({ timeout: 5000 });
  });

  test("pressing Escape closes the panel", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const triggerBtn = page.locator('[aria-label="View document history"]');
    await triggerBtn.waitFor({ state: "visible", timeout: 15_000 });

    await triggerBtn.click();

    // Verify panel is open
    const panel = page.locator('dialog[aria-label="Document revision history"]');
    await expect(panel).toHaveAttribute("open", "", { timeout: 5000 });

    // Press Escape — native dialog handles this
    await page.keyboard.press("Escape");

    // Panel should close (dialog no longer has open attribute)
    await expect(panel).not.toHaveAttribute("open", { timeout: 5000 });
  });
});
