import { test, expect } from "./fixtures";
import { checkLogoOverrides } from "./header-logo-token-helpers";

test("logo overrides preserve the real language disclosure typography and keyboard behavior", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/docs/getting-started/", { waitUntil: "load" });
  const toggle = page.locator("[data-language-toggle]");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator("[data-language-menu]")).toBeVisible();
  await checkLogoOverrides(page, page.locator("[data-header-nav] a, [data-language-toggle], [data-language-menu] a"));
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(page.locator("[data-language-menu]")).toBeHidden();
  assertNoConsoleErrors();
});
