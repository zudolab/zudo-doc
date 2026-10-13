import { test, expect } from "./fixtures";
import { appearanceMenu, appearanceTriggers, openAppearanceMenu } from "./theme-helpers";
import {
  classicScrollbarGutter,
  expectNaturalFit,
  measureAppearanceMenu,
  readScrollState,
  visibleAppearanceTrigger,
} from "./appearance-geometry";

const DOC = "/docs/getting-started";

// Playwright's headless Chromium hides scrollbars by default; drop that flag so
// the popup and page render real space-taking scrollbars (#4567). launchOptions
// is worker-scoped, so it must be set at the file top level.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test.describe("Appearance popup geometry with classic scrollbars", () => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [568, 320]] as const) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${width}x${height} ${scheme}: all rows fit without an inner scrollbar`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(DOC, { waitUntil: "load" });
        expect(await classicScrollbarGutter(page)).toBeGreaterThan(0);
        await expect(appearanceTriggers(page).first()).not.toHaveAttribute("aria-disabled", "true", { timeout: 10000 });

        const trigger = await visibleAppearanceTrigger(page);
        const before = await readScrollState(page);
        await openAppearanceMenu(page, trigger);
        const geometry = await measureAppearanceMenu(appearanceMenu(page), trigger);
        expectNaturalFit(geometry, scheme === "dark" ? "Dark" : "Light");
        if (height === 320) {
          // The drawer's sidebar-footer trigger sits at the bottom edge here,
          // so the menu must open above it rather than be clipped below.
          expect(geometry.menu.bottom).toBeLessThanOrEqual(geometry.trigger.top);
        }
        await page.keyboard.press("Escape");
        await expect(appearanceMenu(page)).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(await readScrollState(page)).toEqual(before);
      });
    }
  }
});
