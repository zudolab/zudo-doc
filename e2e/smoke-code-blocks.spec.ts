import { test, expect } from "@playwright/test";

/**
 * E2E tests for the code block enhancer component.
 *
 * Verifies copy-to-clipboard and word wrap toggle buttons that are
 * dynamically injected by code-block-enhancer.astro after page load.
 */

const PAGE = "/docs/guides/code-blocks-test";

test.describe("Code blocks: copy and wrap buttons", () => {
  test("copy button is present on code blocks", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // Buttons are created dynamically after astro:page-load
    const copyBtn = page.locator('[aria-label="Copy code"]').first();
    await copyBtn.waitFor({ state: "attached", timeout: 10_000 });

    const count = await page.locator('[aria-label="Copy code"]').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("clicking copy button adds .copied class then removes it", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const copyBtn = page.locator('[aria-label="Copy code"]').first();
    await copyBtn.waitFor({ state: "attached", timeout: 10_000 });

    // Grant clipboard permission so the click handler succeeds
    await page.context().grantPermissions(["clipboard-write"]);

    await copyBtn.click();

    // .copied class should appear immediately after click
    await expect(copyBtn).toHaveClass(/copied/, { timeout: 3000 });

    // .copied class should be removed after 1500ms
    await expect(copyBtn).not.toHaveClass(/copied/, { timeout: 5000 });
  });

  test("wrap button exists on code blocks", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const wrapBtn = page.locator('[aria-label="Toggle word wrap"]').first();
    await wrapBtn.waitFor({ state: "attached", timeout: 10_000 });

    const count = await page.locator('[aria-label="Toggle word wrap"]').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("wrap button aria-pressed starts as false", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const wrapBtn = page.locator('[aria-label="Toggle word wrap"]').first();
    await wrapBtn.waitFor({ state: "attached", timeout: 10_000 });

    await expect(wrapBtn).toHaveAttribute("aria-pressed", "false");
  });
});
