import { test, expect } from "@playwright/test";

/**
 * E2E tests for the ColorSchemePicker React island.
 *
 * The smoke fixture has colorMode disabled, so the ColorSchemePicker
 * <select> is rendered instead of ThemeToggle. There are two instances
 * (mobile sidebar + desktop header), so we scope to the desktop one
 * using the lg:flex container.
 */

const DOCS_PAGE = "/docs/getting-started";

// Use desktop viewport so the desktop picker is visible
test.use({ viewport: { width: 1280, height: 800 } });

/** Locate the desktop color scheme picker (inside the lg:flex header section) */
function desktopPicker(page: import("@playwright/test").Page) {
  return page.locator(".lg\\:flex").locator('select[aria-label="Color scheme"]');
}

test.describe("Color scheme picker", () => {
  test("color scheme select is present with multiple options", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const select = desktopPicker(page);
    await expect(select).toBeVisible({ timeout: 5000 });

    const optionCount = await select.locator("option").count();
    expect(optionCount).toBeGreaterThan(1);
  });

  test("changing color scheme updates inline CSS vars on :root", async ({
    page,
  }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const select = desktopPicker(page);
    await expect(select).toBeVisible({ timeout: 5000 });

    // Pick a specific known scheme that differs from default
    const options = await select.locator("option").allTextContents();
    const currentValue = await select.inputValue();
    const targetScheme = options.find((o) => o !== currentValue);
    expect(targetScheme).toBeTruthy();

    // Change scheme and verify inline style is applied to :root
    await select.selectOption(targetScheme!);

    // The applyScheme function sets inline styles on documentElement.
    // Wait for at least one --zd- property to appear in inline styles.
    await page.waitForFunction(() => {
      const style = document.documentElement.style;
      return style.getPropertyValue("--zd-bg") !== "";
    }, null, { timeout: 5000 });
  });

  test("localStorage is set after changing color scheme", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const select = desktopPicker(page);
    await expect(select).toBeVisible({ timeout: 5000 });

    const currentValue = await select.inputValue();
    const options = await select.locator("option").allTextContents();
    const differentOption = options.find((o) => o !== currentValue);
    expect(differentOption).toBeTruthy();

    await select.selectOption(differentOption!);

    const stored = await page.evaluate(() =>
      localStorage.getItem("zudo-doc-color-scheme"),
    );
    expect(stored).toBe(differentOption);
  });

  test("selected color scheme persists in localStorage after reload", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const select = desktopPicker(page);
    await expect(select).toBeVisible({ timeout: 5000 });

    // Pick a scheme and change to it
    const options = await select.locator("option").allTextContents();
    const currentValue = await select.inputValue();
    const targetScheme = options.find((o) => o !== currentValue);
    expect(targetScheme).toBeTruthy();
    await select.selectOption(targetScheme!);

    // Verify localStorage is set
    const stored = await page.evaluate(() =>
      localStorage.getItem("zudo-doc-color-scheme"),
    );
    expect(stored).toBe(targetScheme);

    // Reload the page
    await page.reload({ waitUntil: "load" });

    // localStorage should still have the selected scheme
    const storedAfterReload = await page.evaluate(() =>
      localStorage.getItem("zudo-doc-color-scheme"),
    );
    expect(storedAfterReload).toBe(targetScheme);

    // CSS pairs should also be persisted
    const cssPairs = await page.evaluate(() =>
      localStorage.getItem("zudo-doc-color-scheme-css"),
    );
    expect(cssPairs).toBeTruthy();
  });
});
