import { test, expect } from "./fixtures";
import { appearanceMenu, openAppearanceMenu, THEME_STORAGE_KEY } from "./theme-helpers";
import { expectNaturalFit, measureAppearanceMenu, readScrollState, visibleAppearanceTrigger } from "./appearance-geometry";
import { spaClick } from "./nav-helpers";
import { openMobileDrawer } from "./mobile-drawer-helpers";

const labels = {
  en: { title: "Appearance", light: "Light", dark: "Dark", system: "System", helper: "Follows device · currently " },
  ja: { title: "外観", light: "ライト", dark: "ダーク", system: "システム", helper: "デバイスの設定に従います · 現在は" },
} as const;

for (const locale of ["en", "ja"] as const) {
  const text = labels[locale];
  const doc = `${locale === "ja" ? "/ja" : ""}/docs/getting-started`;
  test.describe(`${locale} Appearance interaction`, () => {
    test("localized names and live device status remain truthful under manual Light", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.addInitScript((key) => localStorage.setItem(key, "light"), THEME_STORAGE_KEY);
      await page.goto(doc);
      const trigger = await visibleAppearanceTrigger(page);
      await expect(trigger).toHaveAttribute("aria-label", `${text.title}: ${text.light}`);
      await openAppearanceMenu(page, trigger, locale);
      const menu = appearanceMenu(page, locale);
      await expect(menu.getByRole("menuitemradio")).toHaveCount(3);
      for (const name of [text.light, text.dark, text.system]) {
        await expect(menu.getByRole("menuitemradio", { name, exact: true })).toHaveCount(1);
      }
      const system = menu.getByRole("menuitemradio", { name: text.system, exact: true });
      await expect(menu.getByRole("menuitemradio", { name: text.light, exact: true })).toHaveAttribute("aria-checked", "true");
      for (const mode of ["dark", "light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: mode });
        await expect(system).toHaveAccessibleName(text.system);
        await expect(system).toHaveAccessibleDescription(`${text.helper}${text[mode]}`);
        await expect(system.locator("[data-zd-device-mode]")).toHaveText(text[mode]);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      }
      expectNaturalFit(await measureAppearanceMenu(menu, trigger), text.dark);
    });

    for (const drawer of [false, true]) {
      test(`${drawer ? "drawer" : "header"} keyboard focus follows surrounding order without scrolling`, async ({ page }) => {
        await page.setViewportSize(drawer ? { width: 390, height: 844 } : { width: 1440, height: 900 });
        await page.goto(doc);
        if (drawer) await openMobileDrawer(page);
        const trigger = drawer
          ? page.locator('[data-zd-mobile-sidebar] [data-zd-theme-menu] > button[aria-haspopup="menu"]')
          : await visibleAppearanceTrigger(page);
        await trigger.scrollIntoViewIfNeeded();
        await expect(trigger).not.toHaveAttribute("aria-disabled", "true");
        const menu = appearanceMenu(page, locale);
        const option = (name: string) => menu.getByRole("menuitemradio", { name, exact: true });
        if (!drawer) await page.evaluate(() => window.scrollTo(0, 200));
        const before = await readScrollState(page);
        if (!drawer) expect(before.windowY).toBeGreaterThan(0);
        const activeMarker = () => page.evaluate(() => {
          const active = document.activeElement;
          return active ? `${active.tagName}|${active.getAttribute("aria-label")}|${active.textContent}` : "";
        });
        await trigger.focus();
        await page.keyboard.press("Tab");
        const next = await activeMarker();
        expect(next).not.toBe("");
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(option(text.system)).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(option(text.light)).toBeFocused();
        await expect(option(text.system)).toHaveAttribute("aria-checked", "true");
        await expect(option(text.light)).toHaveAttribute("aria-checked", "false");
        await expect(option(text.light)).toHaveCSS("outline-width", "2px");
        await expect(option(text.system)).toHaveClass(/bg-accent\/10/);
        await page.keyboard.press("ArrowUp");
        await expect(option(text.system)).toBeFocused();
        await page.keyboard.press("Home");
        await expect(option(text.light)).toBeFocused();
        await page.keyboard.press("Space");
        await expect(menu).toBeHidden();
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute("aria-label", `${text.title}: ${text.light}`);
        await page.keyboard.press("Enter");
        await expect(option(text.light)).toBeFocused();
        await page.keyboard.press("End");
        await expect(option(text.system)).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await openAppearanceMenu(page, trigger, locale);
        await expect(option(text.light)).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(menu).toBeHidden();
        expect(await activeMarker()).toBe(next);
        await openAppearanceMenu(page, trigger, locale);
        await expect(option(text.light)).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(menu).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(await readScrollState(page)).toEqual(before);
        if (drawer) await expect(page.locator('button[aria-label="Close sidebar"]')).toBeVisible();
      });
    }

    test("outside click and localized navigation dismiss the menu", async ({ page }) => {
      await page.goto(doc);
      const trigger = await visibleAppearanceTrigger(page);
      await openAppearanceMenu(page, trigger, locale);
      const menu = appearanceMenu(page, locale);
      await page.getByRole("heading", { level: 1 }).click();
      await expect(menu).toBeHidden();
      await openAppearanceMenu(page, trigger, locale);
      expect(await spaClick(page, locale === "ja" ? "/ja/" : "/")).toBe(true);
      await expect(menu).toBeHidden();
      await expect(page).toHaveURL(new RegExp(locale === "ja" ? "/ja/?$" : "/$"));
    });

    test("200% root text fits without losing localized status", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(doc);
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      const trigger = await visibleAppearanceTrigger(page);
      await openAppearanceMenu(page, trigger, locale);
      const geometry = await measureAppearanceMenu(appearanceMenu(page, locale), trigger);
      expectNaturalFit(geometry, text.dark);
      expect(geometry.menu.width).toBeGreaterThan(236);
    });
  });
}
