import { test, expect } from "./fixtures";
import { LOGO, checkLogoOverrides, setLogoTokens, typography } from "./header-logo-token-helpers";
import { browseAllButton, dialogLocator, openFlyout, packCard, waitForActivePack } from "./theme-pack-helpers";
import { THEME_STORAGE_KEY } from "./theme-helpers";
import { spaClickSelector } from "./nav-helpers";

// The built fixture includes generated utilities. Washi's explicit logo rule
// outranks the base selector, so this catches a registry-only implementation.
for (const pack of ["default", "washi"]) {
  for (const mode of ["light", "dark"] as const) {
    for (const width of [1280, 390]) {
      test(`${pack} logo tokens in ${mode} at ${width}px preserve controls and restore typography`, async ({ page, assertNoConsoleErrors }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme: mode });
        await page.addInitScript(({ key, mode }) => localStorage.setItem(key, mode), { key: THEME_STORAGE_KEY, mode });
        await page.goto("/docs/getting-started/", { waitUntil: "load" });
        await waitForActivePack(page, "default");
        if (pack === "washi") {
          await openFlyout(page);
          await browseAllButton(page).click();
          await expect(dialogLocator(page)).toBeVisible();
          await packCard(page, "Washi").click();
          await waitForActivePack(page, "washi");
          await page.keyboard.press("Escape");
          await expect(dialogLocator(page)).toBeHidden();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
        await page.evaluate(() => document.fonts.ready);
        const logo = page.locator(LOGO);
        const expectedFamily = pack === "default"
          ? (await typography(page.locator("header[data-header]"))).family
          : await page.evaluate(() => {
            const probe = document.createElement("span");
            probe.style.fontFamily = "var(--font-display)";
            document.body.append(probe);
            const family = getComputedStyle(probe).fontFamily;
            probe.remove();
            return family;
          });
        expect((await typography(logo)).family).toBe(expectedFamily);
        expect((await typography(logo)).weight).toBe("700");
        const controls = page.locator("[data-header-nav] a, [data-header-right] button");
        await checkLogoOverrides(page, controls);

        await setLogoTokens(page, "monospace", "300");
        const originalName = await logo.textContent();
        const longName = "A deliberately very long documentation site wordmark";
        await logo.evaluate((el, name) => { el.textContent = name; el.setAttribute("title", name); }, longName);
        await expect(logo).toHaveAttribute("title", longName);
        await expect(logo).toHaveAccessibleName(longName);
        const layout = await logo.evaluate((el) => {
          const style = getComputedStyle(el);
          const right = document.querySelector("[data-header-right]")!.getBoundingClientRect();
          return { clipped: el.scrollWidth > el.clientWidth, overflow: style.overflow, ellipsis: style.textOverflow, right: right.right, viewport: innerWidth };
        });
        expect(layout.overflow).toBe("hidden");
        expect(layout.ellipsis).toBe("ellipsis");
        if (width === 390) expect(layout.clipped).toBe(true);
        expect(layout.right).toBeLessThanOrEqual(layout.viewport);
        await expect(page.locator("#design-token-trigger")).toBeVisible();
        await page.locator("#design-token-trigger").click({ trial: true });
        // Tab from the preceding mobile control (or document start on desktop)
        // proves the anchor remains in the native keyboard order.
        await logo.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(logo).toBeFocused();
        expect(await logo.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
        await logo.evaluate((el, name) => { el.textContent = name; el.setAttribute("title", name!); }, originalName);
        await expect(logo).toHaveAttribute("href", "/");
        expect(await spaClickSelector(page, LOGO)).toBe(true);
        expect(new URL(page.url()).pathname).toBe("/");
        await expect.poll(() => typography(page.locator(LOGO))).toEqual({ family: "monospace", weight: "300" });
        await setLogoTokens(page);
        await expect.poll(() => typography(page.locator(LOGO))).toEqual({ family: expectedFamily, weight: "700" });
        assertNoConsoleErrors();
      });
    }
  }
}
