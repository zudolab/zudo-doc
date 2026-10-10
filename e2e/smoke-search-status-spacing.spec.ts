import { test, expect, type Locator } from "@playwright/test";

async function topInset(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    const body = node.closest("[data-search-results]")!;
    return node.getBoundingClientRect().top - body.getBoundingClientRect().top
      + parseFloat(getComputedStyle(node).paddingTop);
  });
}

for (const width of [1280, 390]) {
  test(`search idle and status spacing matches result rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/docs/getting-started", { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    const body = page.locator("[data-search-results]");
    const placeholder = body.locator("[data-search-placeholder]");
    await expect(input).toBeFocused();
    const idleInset = await topInset(placeholder);
    expect(idleInset).toBeGreaterThan(0);

    await input.fill("zzzz-spacing-no-match-772918");
    const status = body.locator(":scope > p");
    await expect(status).toHaveText("No results found.");
    expect(await topInset(status)).toBe(idleInset);

    await input.fill("Getting Started");
    const row = body.locator("article a").first();
    await expect(row).toBeVisible();
    expect(await topInset(row)).toBe(idleInset);
    // The result row supplies the inset once; the body must not add it again.
    expect(await body.evaluate((node) => getComputedStyle(node).paddingTop)).toBe("0px");

    await input.fill("");
    await expect(placeholder).toBeVisible();
    expect(await topInset(placeholder)).toBe(idleInset);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-dialog]")).not.toBeVisible();
  });
}
