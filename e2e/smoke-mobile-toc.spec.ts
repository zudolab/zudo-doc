import { test, expect } from "@playwright/test";

/**
 * E2E tests for the mobile Table of Contents accordion.
 *
 * The mobile TOC is visible below the xl breakpoint (< 1280px).
 * It shows a "On this page" toggle button that expands a list
 * of heading links. Clicking a link closes the accordion.
 */

const PAGE = "/docs/guides/toc-test";

test.use({ viewport: { width: 375, height: 812 } });

test.describe("Mobile TOC: accordion behavior", () => {
  test("mobile TOC container is visible at mobile viewport", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // The xl:hidden wrapper is visible at mobile widths
    const mobileToc = page.locator(".xl\\:hidden").filter({
      has: page.locator('button:has-text("On this page")'),
    });
    await expect(mobileToc).toBeVisible({ timeout: 5000 });
  });

  test('"On this page" button is visible', async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const toggleBtn = page.getByRole("button", { name: "On this page" });
    await expect(toggleBtn).toBeVisible({ timeout: 5000 });
  });

  test("accordion is initially collapsed (aria-expanded=false)", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const toggleBtn = page.getByRole("button", { name: "On this page" });
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false", {
      timeout: 5000,
    });
  });

  test("clicking toggle expands accordion and shows heading links", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const toggleBtn = page.getByRole("button", { name: "On this page" });
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false", {
      timeout: 5000,
    });

    await toggleBtn.click();

    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Heading links should be visible after expanding
    const mobileToc = page.locator(".xl\\:hidden").filter({
      has: page.locator('button:has-text("On this page")'),
    });
    const introLink = mobileToc.getByRole("link", { name: "Introduction" });
    await expect(introLink).toBeVisible();
  });

  test("clicking a heading link closes the accordion", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const toggleBtn = page.getByRole("button", { name: "On this page" });
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Click a heading link
    const mobileToc = page.locator(".xl\\:hidden").filter({
      has: page.locator('button:has-text("On this page")'),
    });
    const configLink = mobileToc.getByRole("link", { name: "Configuration" });
    await configLink.click();

    // Accordion should close
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false", {
      timeout: 3000,
    });
  });
});
