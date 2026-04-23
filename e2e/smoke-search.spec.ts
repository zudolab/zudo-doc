import { test, expect } from "@playwright/test";

/**
 * E2E tests for the search dialog (<site-search> custom element).
 *
 * The search component uses MiniSearch with an async-loaded index
 * from /search-index.json. Tests verify keyboard shortcuts, input focus,
 * result rendering, navigation, and close behavior.
 */

const DOCS_PAGE = "/docs/getting-started";

test.describe("Search dialog", () => {
  test("Ctrl+K opens the search dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const dialog = page.locator("[data-search-dialog]");
    await expect(dialog).not.toBeVisible();

    await page.keyboard.press("Control+k");

    await expect(dialog).toBeVisible();
  });

  test("search input is focused when dialog opens", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");

    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });
  });

  test("typing a query shows results", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    await input.fill("Getting Started");

    // Wait for results to appear (index loads async)
    const results = page.locator("[data-search-results] article");
    await expect(results.first()).toBeVisible({ timeout: 10000 });

    // Should have at least one result
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking a result navigates to that page", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    await input.fill("Guides");

    // Wait for results
    const firstResultLink = page.locator("[data-search-results] article a").first();
    await expect(firstResultLink).toBeVisible({ timeout: 10000 });

    // Get the href of the result
    const href = await firstResultLink.getAttribute("href");
    expect(href).toBeTruthy();

    // Click the result
    await firstResultLink.click();

    // Should navigate to the result page
    await page.waitForURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
      timeout: 5000,
    });
  });

  test("Escape closes the dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");
    const dialog = page.locator("[data-search-dialog]");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).not.toBeVisible();
  });

  test("clicking backdrop closes the dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");
    const dialog = page.locator("[data-search-dialog]");
    await expect(dialog).toBeVisible();

    // Click on the dialog element itself (the backdrop area)
    // The dialog uses click-on-self to detect backdrop clicks
    await dialog.click({ position: { x: 1, y: 1 } });

    await expect(dialog).not.toBeVisible();
  });

  test("nonsense query shows 'No results found.'", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    await input.fill("xyznonexistent123");

    // Wait for "No results found." text to appear
    const noResults = page.locator("[data-search-results]").getByText("No results found.");
    await expect(noResults).toBeVisible({ timeout: 10000 });
  });

  test("matched keywords are highlighted with mark elements", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    const searchQuery = "Getting Started";
    await input.fill(searchQuery);

    // Wait for results
    const results = page.locator("[data-search-results] article");
    await expect(results.first()).toBeVisible({ timeout: 10000 });

    // Verify mark elements exist in results
    const marks = page.locator("[data-search-results] article mark");
    await expect(marks.first()).toBeVisible({ timeout: 5000 });

    // Verify highlighted text matches query terms (case-insensitive)
    const markTexts = await marks.allTextContents();
    expect(markTexts.length).toBeGreaterThan(0);
    const queryTerms = searchQuery.toLowerCase().split(/\s+/);
    for (const text of markTexts) {
      const lower = text.toLowerCase();
      expect(
        queryTerms.some((term) => lower.includes(term)),
        `Expected "${text}" to contain one of: ${queryTerms.join(", ")}`,
      ).toBeTruthy();
    }

    // Regression guard (#364): <mark> must resolve its background and
    // foreground colors from --color-matched-keyword-bg / --color-matched-keyword-fg,
    // not from --color-warning via color-mix. If someone reverts the CSS to
    // color-mix(--color-warning ...), computed styles will diverge and this
    // assertion will fail.
    const colors = await marks.first().evaluate((el) => {
      const root = document.documentElement;
      const rootStyle = getComputedStyle(root);
      const markStyle = getComputedStyle(el);
      return {
        markBg: markStyle.backgroundColor,
        markFg: markStyle.color,
        tokenBg: rootStyle.getPropertyValue("--color-matched-keyword-bg").trim(),
        tokenFg: rootStyle.getPropertyValue("--color-matched-keyword-fg").trim(),
      };
    });
    expect(colors.tokenBg.length, "expected --color-matched-keyword-bg to be defined on :root").toBeGreaterThan(0);
    expect(colors.tokenFg.length, "expected --color-matched-keyword-fg to be defined on :root").toBeGreaterThan(0);
    // Resolve the token values to rgb() for a robust computed-style match.
    const resolved = await page.evaluate(({ bg, fg }) => {
      const probe = document.createElement("div");
      probe.style.position = "fixed";
      probe.style.left = "-9999px";
      document.body.appendChild(probe);
      probe.style.backgroundColor = bg;
      const rgbBg = getComputedStyle(probe).backgroundColor;
      probe.style.color = fg;
      const rgbFg = getComputedStyle(probe).color;
      probe.remove();
      return { rgbBg, rgbFg };
    }, { bg: colors.tokenBg, fg: colors.tokenFg });
    expect(colors.markBg).toBe(resolved.rgbBg);
    expect(colors.markFg).toBe(resolved.rgbFg);
  });
});
