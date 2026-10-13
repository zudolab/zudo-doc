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

import { spaClick } from "./nav-helpers";
import {
  expectNaturalFit,
  measureAppearanceMenu,
  readScrollState,
  visibleAppearanceTrigger,
} from "./appearance-geometry";

const HOME = "/";
const DOC = "/docs/getting-started";

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
    // R1-A: no visible footer; the device mode is inline in the System row and
    // the full helper is the System option's accessible description.
    await expect(appearanceMenu(page).getByText("Follows device", { exact: false })).toBeHidden();
    await expect(selectedSystemOption).toHaveAccessibleName("System");
    await expect(selectedSystemOption).toHaveAccessibleDescription("Follows device · currently Dark");
    await expect(selectedSystemOption.locator("[data-zd-device-mode]")).toHaveText("Dark");
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

    const href = await page.getByRole("link", { name: "Getting Started" }).first().getAttribute("href");
    expect(href).toBeTruthy();
    expect(await spaClick(page, href!)).toBe(true);
    await expect(page).toHaveURL(/getting-started/);

    // Doc chrome includes the sidebar footer menu in addition to the two home menus.
    // Wait for the actual swap, not only the early history URL update.
    await waitForAllThemePreferences(page, "light", 3);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    assertNoConsoleErrors();
  });

  test("keeps the inline device status truthful under a manual preference", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript((key) => {
      localStorage.setItem(key, "light");
    }, THEME_STORAGE_KEY);
    await page.goto(HOME, { waitUntil: "load" });
    await waitForAllThemePreferences(page, "light");

    await openAppearanceMenu(page);
    const system = appearanceOption(page, "system");
    await expect(appearanceOption(page, "light")).toHaveAttribute("aria-checked", "true");
    await expect(system.locator("[data-zd-device-mode]")).toHaveText("Dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(system.locator("[data-zd-device-mode]")).toHaveText("Light");
    await expect(system).toHaveAccessibleDescription("Follows device · currently Light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(system.locator("[data-zd-device-mode]")).toHaveText("Dark");
    // The device change never touches the manual page theme or preference.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await waitForAllThemePreferences(page, "light");
    await waitForStoredThemePreference(page, "light");
    assertNoConsoleErrors();
  });

  test("open, arrow, select and Escape keep the document scroll position", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(DOC, { waitUntil: "load" });
    await waitForThemePreference(page, "system");
    await page.evaluate(() => window.scrollTo(0, 200));
    const before = await readScrollState(page);
    const trigger = appearanceTrigger(page);

    await openAppearanceMenu(page, trigger);
    await expect(appearanceOption(page, "system")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(appearanceOption(page, "light")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(appearanceMenu(page)).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(appearanceMenu(page)).toBeVisible();
    await expect(appearanceOption(page, "system")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(appearanceOption(page, "light")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(appearanceMenu(page)).toBeHidden();
    await waitForThemePreference(page, "light");
    await openAppearanceMenu(page, trigger);
    await appearanceOption(page, "system").click();
    await expect(appearanceMenu(page)).toBeHidden();
    expect(await readScrollState(page)).toEqual(before);
  });

  test("sizes naturally with enlarged root text", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(DOC, { waitUntil: "load" });
    await waitForThemePreference(page, "system");
    // 200% root text: rem-based rows and the rem-based menu width grow naturally.
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const trigger = await visibleAppearanceTrigger(page);
    await openAppearanceMenu(page, trigger);
    const geometry = await measureAppearanceMenu(appearanceMenu(page), trigger);
    expectNaturalFit(geometry, "Dark");
    expect(geometry.menu.width).toBeGreaterThan(236);
  });
});
