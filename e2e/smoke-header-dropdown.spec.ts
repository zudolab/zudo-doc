import { test, expect } from "@playwright/test";

/**
 * E2E tests for nested header navigation dropdown menus.
 *
 * Tests verify that header nav items with children render as hover
 * dropdowns on desktop, with correct visibility, navigation, and
 * keyboard accessibility.
 *
 * The header nav is hidden below lg: breakpoint (1024px), so we
 * explicitly set a wide viewport for these tests.
 */

const DOCS_PAGE = "/docs/getting-started";

// Ensure desktop viewport — header nav is hidden below lg: (1024px)
test.use({ viewport: { width: 1280, height: 720 } });

test.describe("Header dropdown navigation", () => {
  test("dropdown items exist in header nav", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    await expect(dropdown).toBeVisible();

    // Should contain the parent trigger link
    const trigger = dropdown.locator(":scope > a");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText(/Learn/);
  });

  test("dropdown panel is hidden by default", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    const panel = dropdown.locator(":scope > div");
    await expect(panel).toBeHidden();
  });

  test("dropdown panel shows on hover @local-only", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    const panel = dropdown.locator(":scope > div");

    await dropdown.hover();
    await expect(panel).toBeVisible();

    // Verify child links are visible
    const childLinks = panel.locator("a");
    await expect(childLinks.first()).toBeVisible();
    await expect(childLinks.first()).toHaveText("Guides");
  });

  test("clicking a child link navigates to the page @local-only", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    await dropdown.hover();

    const childLink = dropdown.locator(":scope > div a").first();
    await childLink.click();

    await page.waitForURL(/\/docs\/guides/);
  });

  test("dropdown opens on focus-within (keyboard) @local-only", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    const panel = dropdown.locator(":scope > div");

    // Tab to the trigger link
    const trigger = dropdown.locator(":scope > a");
    await trigger.focus();

    await expect(panel).toBeVisible();
  });

  test("parent trigger link has correct href", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    const trigger = dropdown.locator(":scope > a");

    // The trigger should be an <a> with an href
    const href = await trigger.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toContain("/docs/guides");
  });

  test("trigger has correct aria attributes", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const trigger = page.locator("[data-nav-item-dropdown] > a");
    await expect(trigger).toHaveAttribute("aria-haspopup", "true");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
