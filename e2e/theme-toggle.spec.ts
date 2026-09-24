import { test, expect } from "./fixtures";
import {
  THEME_STORAGE_KEY,
  appearanceMenu,
  appearanceOption,
  appearanceTrigger,
  appearanceTriggers,
  openAppearanceMenu,
  selectThemePreference,
  waitForAllThemePreferences,
  waitForStoredThemePreference,
  waitForThemePreference,
} from "./theme-helpers";

const HOME = "/";

test.describe("Appearance menu", () => {
  // Use the shared `page` fixture so assertNoConsoleErrors() observes the
  // same browser page. addInitScript runs before the first navigation.
  test("hydrates an explicit Light preference even when the device prefers Dark", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript((key) => {
      localStorage.setItem(key, "light");
    }, THEME_STORAGE_KEY);

    await page.goto(HOME, { waitUntil: "load" });

    await waitForAllThemePreferences(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(appearanceTrigger(page)).toHaveAttribute("aria-label", "Appearance: Light");

    assertNoConsoleErrors();
  });

  test("hydrates an explicit Dark preference when it matches the device", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, THEME_STORAGE_KEY);

    await page.goto(HOME, { waitUntil: "load" });

    await waitForAllThemePreferences(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    assertNoConsoleErrors();
  });

  test("defaults to System, follows live device changes and synchronizes both menu instances", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(HOME, { waitUntil: "load" });

    const trigger = appearanceTrigger(page);
    await waitForAllThemePreferences(page, "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await openAppearanceMenu(page, trigger);
    const selectedSystemOption = appearanceOption(page, "system");
    await expect(selectedSystemOption).toHaveAttribute("aria-checked", "true");
    await expect(selectedSystemOption).toHaveClass(/bg-accent\/10/);
    const triggerBox = await trigger.boundingBox();
    const optionBox = await selectedSystemOption.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(optionBox).not.toBeNull();
    expect(triggerBox!.width).toBe(40);
    expect(triggerBox!.height).toBe(40);
    expect(optionBox!.height).toBeGreaterThanOrEqual(44);
    await expect(appearanceMenu(page)).toContainText("Follows device · currently Dark");
    await page.keyboard.press("Escape");
    await expect(appearanceMenu(page)).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await waitForAllThemePreferences(page, "system");
    await expect(appearanceTriggers(page)).toHaveCount(2);
    assertNoConsoleErrors();
  });

  test("selects and persists Light, Dark and System preferences", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(HOME, { waitUntil: "load" });
    await waitForThemePreference(page, "system");

    await selectThemePreference(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await waitForStoredThemePreference(page, "light");
    await waitForAllThemePreferences(page, "light");

    await page.reload({ waitUntil: "load" });
    await waitForAllThemePreferences(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await selectThemePreference(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await waitForStoredThemePreference(page, "dark");
    await waitForAllThemePreferences(page, "dark");

    await page.reload({ waitUntil: "load" });
    await waitForAllThemePreferences(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await selectThemePreference(page, "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await waitForStoredThemePreference(page, "system");
    await waitForAllThemePreferences(page, "system");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await waitForAllThemePreferences(page, "system");
    await page.reload({ waitUntil: "load" });
    await waitForAllThemePreferences(page, "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("opens, selects and restores focus by keyboard", async ({ page }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await waitForThemePreference(page, "system");

    const trigger = appearanceTrigger(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(appearanceMenu(page)).toBeVisible();
    await expect(appearanceOption(page, "system")).toBeFocused();

    await page.keyboard.press("Home");
    await expect(appearanceOption(page, "light")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(appearanceMenu(page)).toBeHidden();
    await waitForAllThemePreferences(page, "light");
    await waitForStoredThemePreference(page, "light");

    await page.keyboard.press("Enter");
    await expect(appearanceMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(appearanceMenu(page)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("keeps the selected preference across View Transition navigation", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "light");
    }, THEME_STORAGE_KEY);

    await page.goto(HOME, { waitUntil: "load" });
    await waitForAllThemePreferences(page, "light");

    await page.getByRole("link", { name: "Getting Started" }).first().click();
    await page.waitForURL(/getting-started/);

    await waitForAllThemePreferences(page, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    assertNoConsoleErrors();
  });
});
