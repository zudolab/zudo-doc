import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

export type ThemePreference = "light" | "dark" | "system";
export type ColorSchemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "zudo-doc-theme";
const APPEARANCE_TRIGGERS = '[data-zd-theme-menu] > button[aria-haspopup="menu"]';
const APPEARANCE_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/** The compact appearance button in the desktop header. */
export function appearanceTrigger(page: Page): Locator {
  return page.locator(`header .ml-auto ${APPEARANCE_TRIGGERS}`).first();
}

/** All menu triggers, including the one in the mobile sidebar footer. */
export function appearanceTriggers(page: Page): Locator {
  return page.locator(APPEARANCE_TRIGGERS);
}

export function appearanceMenu(page: Page): Locator {
  return page.getByRole("menu", { name: "Appearance", exact: true });
}

export function appearanceOption(page: Page, preference: ThemePreference): Locator {
  return appearanceMenu(page).getByRole("menuitemradio", {
    name: APPEARANCE_LABELS[preference],
    exact: true,
  });
}

export async function waitForThemePreference(
  page: Page,
  preference: ThemePreference,
  trigger: Locator = appearanceTrigger(page),
  timeout = 5000,
): Promise<void> {
  await expect(trigger).toHaveAttribute(
    "aria-label",
    `Appearance: ${APPEARANCE_LABELS[preference]}`,
    { timeout },
  );
}

export async function waitForAllThemePreferences(
  page: Page,
  preference: ThemePreference,
): Promise<void> {
  const triggers = appearanceTriggers(page);
  await expect(triggers).toHaveCount(2);
  for (const trigger of await triggers.all()) {
    await waitForThemePreference(page, preference, trigger);
  }
}

export async function waitForStoredThemePreference(
  page: Page,
  preference: ThemePreference,
): Promise<void> {
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY))
    .toBe(preference);
}

export async function openAppearanceMenu(
  page: Page,
  trigger: Locator = appearanceTrigger(page),
): Promise<void> {
  await expect(trigger).not.toHaveAttribute("aria-disabled", "true", { timeout: 10000 });
  await trigger.click();
  await expect(appearanceMenu(page)).toBeVisible();
}

export async function selectThemePreference(
  page: Page,
  preference: ThemePreference,
  trigger: Locator = appearanceTrigger(page),
): Promise<void> {
  await openAppearanceMenu(page, trigger);
  await appearanceOption(page, preference).click();
  await expect(appearanceMenu(page)).toBeHidden();
  await waitForThemePreference(page, preference, trigger);
}
