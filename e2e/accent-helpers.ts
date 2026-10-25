import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

export type AccentTokens = { accent: string; fg: string; muted: string; bg: string };

/** Resolve the live color tokens through a probe, so overrides are honored. */
export async function resolveAccentTokens(page: Page): Promise<AccentTokens> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const read = (name: string) => {
      probe.style.color = `var(${name})`;
      return getComputedStyle(probe).color;
    };
    const tokens = {
      accent: read("--color-accent"),
      fg: read("--color-fg"),
      muted: read("--color-muted"),
      bg: read("--color-bg"),
    };
    probe.remove();
    return tokens;
  });
}

export async function expectColor(locator: Locator, expected: string): Promise<void> {
  await expect
    .poll(() => locator.evaluate((el) => getComputedStyle(el).color))
    .toBe(expected);
}

export async function expectColors(locators: Locator[], expected: string): Promise<void> {
  for (const locator of locators) await expectColor(locator, expected);
}

/** Park the pointer away from every row, then keyboard-focus `target`. */
export async function keyboardFocus(page: Page, target: Locator): Promise<void> {
  await page.mouse.move(1, 1);
  await page.keyboard.press("Shift");
  await target.focus();
  expect(await target.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
  expect(await target.evaluate((el) => el.matches(":hover"))).toBe(false);
}

export async function clearInteraction(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(1, 1);
}
