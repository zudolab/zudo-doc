import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Color Tweak Panel React island.
 *
 * Uses the "theme" fixture (port 4502) which has colorMode (light/dark)
 * and colorTweakPanel enabled. The panel is rendered via client:only="react"
 * on doc pages (doc-layout.astro) and starts closed; it can be toggled via
 * a custom event or the header icon.
 */

const DOC_PAGE = "/docs/getting-started";
const THEME_STORAGE_KEY = "zudo-doc-theme";

// Use desktop viewport to ensure header icons are visible
test.use({ viewport: { width: 1280, height: 800 } });

/** Ensure the tweak panel is visible. Waits for the React island to mount,
 *  then opens the panel only if it isn't already open. */
async function ensureTweakPanelOpen(page: import("@playwright/test").Page) {
  // Wait for the client:only React island to be present in the DOM
  await page.waitForFunction(() => {
    return document.querySelector('astro-island[component-url*="color-tweak-panel"]') !== null;
  }, null, { timeout: 10000 });
  // Allow React useEffect to register event listeners
  await page.waitForTimeout(500);

  // Check if panel is already open (e.g. restored from localStorage)
  const panelText = page.getByText("Color Tweak Panel");
  const isAlreadyOpen = await panelText.isVisible().catch(() => false);
  if (!isAlreadyOpen) {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("toggle-color-tweak-panel"));
    });
  }
  await expect(panelText).toBeVisible({ timeout: 5000 });
}

/** Locate the desktop theme toggle button in the header */
function themeToggle(page: import("@playwright/test").Page) {
  return page.locator('header .ml-auto button[aria-label*="Switch to"]');
}

test.describe("Color tweak panel", () => {
  test("panel opens and closes", async ({ page }) => {
    await page.goto(DOC_PAGE, { waitUntil: "load" });

    // Panel should not be visible initially
    await expect(page.getByText("Color Tweak Panel")).not.toBeVisible();

    // Open via custom event
    await ensureTweakPanelOpen(page);

    // Verify panel content is visible (palette section header)
    await expect(page.getByText("Palette")).toBeVisible();

    // Close via the close button
    await page.getByRole("button", { name: "Close panel" }).click();

    // Panel should disappear
    await expect(page.getByText("Color Tweak Panel")).not.toBeVisible();
  });

  test("panel opens via header icon button", async ({ page }) => {
    await page.goto(DOC_PAGE, { waitUntil: "load" });

    // Wait for the React island to mount
    await page.waitForFunction(() => {
      return document.querySelector('astro-island[component-url*="color-tweak-panel"]') !== null;
    }, null, { timeout: 10000 });
    await page.waitForTimeout(500);

    // Click the header trigger button
    const trigger = page.locator("#color-tweak-trigger");
    await expect(trigger).toBeVisible({ timeout: 5000 });
    await trigger.click();

    // Panel should appear
    await expect(page.getByText("Color Tweak Panel")).toBeVisible({ timeout: 5000 });
  });

  test("HSL picker opens from color swatch", async ({ page }) => {
    await page.goto(DOC_PAGE, { waitUntil: "load" });
    await ensureTweakPanelOpen(page);

    // Click the first palette swatch (p0)
    const firstSwatch = page.locator('button[title^="p0:"]');
    await expect(firstSwatch).toBeVisible({ timeout: 5000 });
    await firstSwatch.click();

    // HSL picker popover should appear with H/S/L sliders and hex input.
    // The popover closes on any scroll event (capture phase), so verify all
    // elements in a single evaluate to avoid Playwright scroll closing the popover.
    const hueSlider = page.getByRole("slider", { name: "Hue" });
    await expect(hueSlider).toBeVisible({ timeout: 3000 });

    const pickerElements = await page.evaluate(() => {
      const hue = document.querySelector('input[aria-label="Hue"]');
      const sat = document.querySelector('input[aria-label="Saturation"]');
      const lgt = document.querySelector('input[aria-label="Lightness"]');
      const hex = document.querySelector('input[aria-label="Hex color value"]');
      return { hue: !!hue, sat: !!sat, lgt: !!lgt, hex: !!hex };
    });
    expect(pickerElements.hue).toBe(true);
    expect(pickerElements.sat).toBe(true);
    expect(pickerElements.lgt).toBe(true);
    expect(pickerElements.hex).toBe(true);

    // Close via Escape key
    await page.keyboard.press("Escape");

    // Picker should close (Hue slider no longer visible)
    await expect(hueSlider).not.toBeVisible({ timeout: 3000 });
  });

  test("shiki theme selector persists across reload", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(DOC_PAGE, { waitUntil: "load" });
    await ensureTweakPanelOpen(page);

    // Find the shikiTheme select
    const select = page.locator("select").filter({ has: page.locator('option[value="nord"]') });
    await expect(select).toBeVisible({ timeout: 5000 });

    // Change to "nord"
    await select.selectOption("nord");
    expect(await select.inputValue()).toBe("nord");

    // Reload — panel should auto-open from localStorage OPEN_KEY
    await page.reload({ waitUntil: "load" });
    await ensureTweakPanelOpen(page);

    // Verify the select still shows "nord" (persisted via localStorage)
    const selectAfter = page.locator("select").filter({ has: page.locator('option[value="nord"]') });
    await expect(selectAfter).toBeVisible({ timeout: 5000 });
    expect(await selectAfter.inputValue()).toBe("nord");

    await context.close();
  });

  test("scheme change clears inline styles when toggling light/dark", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Start in dark mode
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, THEME_STORAGE_KEY);

    await page.goto(DOC_PAGE, { waitUntil: "load" });
    await ensureTweakPanelOpen(page);

    // Use the panel's persist mechanism: click a swatch, change color via hex input.
    // This exercises the real code path that sets inline styles.
    const firstSwatch = page.locator('button[title^="p0:"]');
    await expect(firstSwatch).toBeVisible({ timeout: 5000 });
    await firstSwatch.click();

    // Wait for HSL picker, type a new hex value
    const hexInput = page.getByLabel("Hex color value");
    await expect(hexInput).toBeVisible({ timeout: 3000 });
    await hexInput.fill("#ff0000");
    // Trigger change by pressing Enter then Escape to close picker
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");

    // Wait for the inline style to be applied
    await page.waitForFunction(() => {
      return document.documentElement.style.getPropertyValue("--zd-0") !== "";
    }, null, { timeout: 5000 });

    // Toggle light/dark mode via theme toggle button
    const toggle = themeToggle(page);
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await toggle.click();

    // After scheme change, inline style overrides should be cleared
    await page.waitForFunction(() => {
      return document.documentElement.style.getPropertyValue("--zd-0") === "";
    }, null, { timeout: 5000 });

    const clearedVar = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--zd-0"),
    );
    expect(clearedVar).toBe("");

    await context.close();
  });

  test("export modal shows shikiTheme", async ({ page }) => {
    await page.goto(DOC_PAGE, { waitUntil: "load" });
    await ensureTweakPanelOpen(page);

    // Change shikiTheme to "github-dark"
    const select = page.locator("select").filter({ has: page.locator('option[value="github-dark"]') });
    await expect(select).toBeVisible({ timeout: 5000 });
    await select.selectOption("github-dark");

    // Click Export button
    await page.getByRole("button", { name: "Export" }).click();

    // Verify the export modal dialog appears (scope to the one with "Export Color Scheme" text)
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify the generated code contains the shikiTheme
    const codeContent = await dialog.locator("code").textContent();
    expect(codeContent).toContain('shikiTheme: "github-dark"');
  });
});
