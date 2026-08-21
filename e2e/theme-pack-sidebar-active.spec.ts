import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { desktopSidebar } from "./sidebar-helpers";
import {
  THEME_PACK_STORAGE_KEY,
  waitForActivePack,
} from "./theme-pack-helpers";

const PAGE = "/docs/getting-started/";
const CURRENT_ROW_SELECTOR = 'a[aria-current="page"]:not([data-nav-active])';
const MOBILE_CURRENT_ROW_SELECTOR =
  'aside[data-zd-mobile-sidebar] a[aria-current="page"]:not([data-nav-active])';

const CORRECTED_PACKS = {
  drift: { nestedRadius: "999px", nestedShadow: true },
  hearth: { nestedRadius: "8px", nestedShadow: true },
  sakura: { nestedRadius: "9999px", nestedShadow: true },
  scandi: { nestedRadius: "999px", nestedShadow: false },
  timberline: { nestedRadius: "4px", nestedShadow: true },
} as const;

test.use({ viewport: { width: 1280, height: 800 } });

type ActiveRowStyle = {
  backgroundColor: string;
  borderRadius: string;
  boxShadow: string;
};

function activeRowStyle(locator: Locator): Promise<ActiveRowStyle> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
    };
  });
}

function hasVisibleBackground(color: string): boolean {
  return color !== "transparent" && color !== "rgba(0, 0, 0, 0)";
}

async function enabledPackSlugs(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(
      (
        window as unknown as {
          __zudoDocThemePacks: { packs: Record<string, string> };
        }
      ).__zudoDocThemePacks.packs,
    ),
  );
}

async function activatePack(page: Page, packSlug: string): Promise<void> {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: THEME_PACK_STORAGE_KEY, value: packSlug },
  );
  await page.reload({ waitUntil: "load" });
  await waitForActivePack(page, packSlug);
}

test.describe("Theme-pack sidebar active-row shape", () => {
  test("keeps every non-pill current row square while preserving corrected packs' nested states", async ({
    page,
  }) => {
    test.slow();
    await page.goto(PAGE, { waitUntil: "load" });
    const packSlugs = await enabledPackSlugs(page);
    expect(packSlugs[0]).toBe("default");

    for (const packSlug of packSlugs) {
      await activatePack(page, packSlug);

      const currentRow = desktopSidebar(page).locator(CURRENT_ROW_SELECTOR);
      await expect(currentRow).toBeVisible();

      const square = await activeRowStyle(currentRow);
      expect(
        square.borderRadius,
        `${packSlug} rounded a non-pill desktop current row`,
      ).toBe("0px");

      const corrected = CORRECTED_PACKS[
        packSlug as keyof typeof CORRECTED_PACKS
      ];
      if (corrected) {
        expect(
          hasVisibleBackground(square.backgroundColor),
          `${packSlug} lost its current-row fill`,
        ).toBe(true);

        // Flip only the stable marker to prove the two CSS states without
        // reshaping the fixture's real navigation tree.
        await currentRow.evaluate((element) => {
          element.setAttribute("data-nav-active", "");
        });
        const markedRow = desktopSidebar(page).locator(
          'a[aria-current="page"][data-nav-active]',
        );
        const nested = await activeRowStyle(markedRow);
        expect(
          nested.borderRadius,
          `${packSlug} lost its nested active radius`,
        ).toBe(corrected.nestedRadius);
        if (corrected.nestedShadow) {
          expect(
            nested.boxShadow,
            `${packSlug} lost its nested active shadow`,
          ).not.toBe("none");
        }

        await markedRow.evaluate((element) => {
          element.removeAttribute("data-nav-active");
        });
        expect((await activeRowStyle(currentRow)).borderRadius).toBe("0px");
      }
    }
  });

  test("keeps Sakura and Scandi non-pill current rows square in the mobile drawer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE, { waitUntil: "load" });

    for (const packSlug of ["sakura", "scandi"]) {
      await activatePack(page, packSlug);
      const currentRow = page.locator(MOBILE_CURRENT_ROW_SELECTOR);
      await expect(currentRow).toHaveCount(1);
      expect(
        (await activeRowStyle(currentRow)).borderRadius,
        `${packSlug} rounded a non-pill mobile current row`,
      ).toBe("0px");
    }
  });
});
