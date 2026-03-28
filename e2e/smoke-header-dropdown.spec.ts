import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

/**
 * E2E tests for nested header navigation dropdown menus.
 *
 * Static HTML tests verify the dropdown markup and attributes in the
 * built output. Browser tests for hover/focus behavior are @local-only.
 */

const DOCS_PAGE = "/docs/getting-started";

test.describe("Header dropdown navigation (static)", () => {
  test("dropdown markup is present in built HTML", () => {
    const html = readDistFile("docs/getting-started/index.html");
    expect(html).toContain("data-nav-item-dropdown");
    expect(html).toContain('aria-haspopup="true"');
    expect(html).toContain('aria-expanded="false"');
  });

  test("dropdown trigger has correct label and href", () => {
    const html = readDistFile("docs/getting-started/index.html");
    // The dropdown trigger link should contain "Learn" and point to /docs/guides
    const dropdownMatch = html.match(
      /data-nav-item-dropdown[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/,
    );
    expect(dropdownMatch).toBeTruthy();
    expect(dropdownMatch![1]).toContain("/docs/guides");
    expect(dropdownMatch![2]).toContain("Learn");
  });

  test("dropdown panel contains child links", () => {
    const html = readDistFile("docs/getting-started/index.html");
    // Child links should be inside the dropdown
    const dropdownSection = html.match(
      /data-nav-item-dropdown[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
    );
    expect(dropdownSection).toBeTruthy();
    expect(dropdownSection![0]).toContain("Guides");
  });

  test("dropdown panel uses CSS-only hover pattern", () => {
    const html = readDistFile("docs/getting-started/index.html");
    // Verify the dropdown panel has group-hover:block and group-focus-within:block
    expect(html).toContain("group-hover:block");
    expect(html).toContain("group-focus-within:block");
  });
});

// Ensure desktop viewport for browser-based tests
test.use({ viewport: { width: 1280, height: 720 } });

test.describe("Header dropdown navigation (browser)", () => {
  test("dropdown panel shows on hover @local-only", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    const panel = dropdown.locator(":scope > div");

    await dropdown.hover();
    await expect(panel).toBeVisible();

    const childLinks = panel.locator("a");
    await expect(childLinks.first()).toBeVisible();
    await expect(childLinks.first()).toHaveText("Guides");
  });

  test("clicking a child link navigates @local-only", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    await dropdown.hover();

    const childLink = dropdown.locator(":scope > div a").first();
    await childLink.click();

    await page.waitForURL(/\/docs\/guides/);
  });

  test("dropdown opens on focus-within @local-only", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dropdown = page.locator("[data-nav-item-dropdown]");
    const panel = dropdown.locator(":scope > div");

    const trigger = dropdown.locator(":scope > a");
    await trigger.focus();

    await expect(panel).toBeVisible();
  });
});
