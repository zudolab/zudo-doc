import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests for the frontmatter-preview block rendered-vs-hidden behavior.
 *
 * Three scenarios:
 * 1. System-only frontmatter → block absent.
 * 2. Custom frontmatter → block visible with correct rows (and ignored keys absent).
 * 3. Auto-index category page → block absent (no entry, auto-generated).
 *
 * Fixture content:
 * - /docs/getting-started — system-only frontmatter (title, sidebar_position)
 * - /docs/guides/frontmatter-preview-test — custom fields: author, status
 * - /docs/auto-index-category — auto-generated index (no index.mdx)
 */

test.describe("Frontmatter Preview: rendered-vs-hidden behavior", () => {
  test("system-only frontmatter → block absent", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const block = page.locator('[data-testid="frontmatter-preview"]');
    await expect(block).not.toBeAttached();
  });

  test("custom frontmatter → block visible with correct rows", async ({
    page,
  }) => {
    await page.goto("/docs/guides/frontmatter-preview-test", {
      waitUntil: "load",
    });

    // Block must be present
    const block = page.locator('[data-testid="frontmatter-preview"]');
    await expect(block).toBeVisible();

    // Custom field rows must appear
    const tbody = block.locator("tbody");
    await expect(tbody.locator("tr")).toHaveCount(2);

    const keyTexts = await tbody.locator("td:first-child").allTextContents();
    expect(keyTexts).toContain("author");
    expect(keyTexts).toContain("status");

    // System-managed keys must NOT appear
    expect(keyTexts).not.toContain("title");
    expect(keyTexts).not.toContain("sidebar_position");
  });

  test("auto-index category page → block absent", async ({ page }) => {
    await page.goto("/docs/auto-index-category", { waitUntil: "load" });

    const block = page.locator('[data-testid="frontmatter-preview"]');
    await expect(block).not.toBeAttached();
  });
});
