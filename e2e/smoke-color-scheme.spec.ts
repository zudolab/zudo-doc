import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Color Tweak Panel scheme chooser.
 *
 * The tweak panel is enabled in the smoke fixture. The scheme chooser
 * is a <select> inside the panel that loads color scheme presets.
 */

const DOCS_PAGE = "/docs/getting-started";

test.use({ viewport: { width: 1280, height: 800 } });

/** Open the tweak panel by clicking the palette icon in the header */
async function openTweakPanel(page: import("@playwright/test").Page) {
  const trigger = page.locator("#color-tweak-trigger");
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  // Wait for the panel to appear
  const panel = page.locator('[aria-label="Load color scheme preset"]');
  await expect(panel).toBeVisible({ timeout: 5000 });
  return panel;
}

test.describe("Color tweak panel scheme chooser", () => {
  test("scheme chooser select is present with multiple options", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const select = await openTweakPanel(page);
    const optionCount = await select.locator("option").count();
    // Should have the disabled placeholder + at least 2 bundled schemes + presets
    expect(optionCount).toBeGreaterThan(3);
  });

  test("loading a preset updates CSS vars on :root", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const select = await openTweakPanel(page);

    // Pick a known preset (Dracula)
    await select.selectOption("Dracula");

    // Wait for CSS variables to be applied
    await page.waitForFunction(() => {
      const style = document.documentElement.style;
      return style.getPropertyValue("--zd-bg") !== "";
    }, null, { timeout: 5000 });
  });

  test("loading a preset persists tweak state in localStorage", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const select = await openTweakPanel(page);
    await select.selectOption("Nord");

    const stored = await page.evaluate(() =>
      localStorage.getItem("zudo-doc-tweak-state"),
    );
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.palette).toHaveLength(16);
  });
});
