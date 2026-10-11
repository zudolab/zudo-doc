import { test, expect } from "./fixtures";
import { checkLogoOverrides } from "./header-logo-token-helpers";

for (const width of [1280, 390]) {
  test(`logo overrides leave the real search control unchanged at ${width}px`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/docs/getting-started/", { waitUntil: "load" });
    const search = page.locator("[data-open-search]");
    await expect(search).toBeVisible();
    await checkLogoOverrides(page, page.locator("[data-header-nav] a, [data-open-search]"));
    await search.click();
    await expect(page.locator("[data-search-dialog]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-dialog]")).toBeHidden();
    assertNoConsoleErrors();
  });
}
