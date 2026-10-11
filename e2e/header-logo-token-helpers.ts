import type { Locator, Page } from "@playwright/test";
import { expect } from "./fixtures";

export const LOGO = "a[data-header-logo]";
export async function typography(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { family: style.fontFamily, weight: style.fontWeight };
  });
}

/** Replace both knobs atomically; omitted values restore the authored fallback. */
export async function setLogoTokens(page: Page, family?: string, weight?: string) {
  await page.evaluate(({ family, weight }) => {
    const root = document.documentElement.style;
    for (const [name, value] of [
      ["--zdc-header-logo-font", family],
      ["--zdc-header-logo-weight", weight],
    ]) {
      if (value) root.setProperty(name!, value);
      else root.removeProperty(name!);
    }
  }, { family, weight });
}

/** Real controls keep both properties through each independent override and removal. */
export async function checkLogoOverrides(page: Page, controls: Locator) {
  const logo = page.locator(LOGO);
  const baseline = await typography(logo);
  expect(baseline.family).not.toBe("monospace");
  expect(baseline.weight).not.toBe("300");
  const before = await controls.evaluateAll((els) => els.map((el) => {
    const style = getComputedStyle(el);
    return { family: style.fontFamily, weight: style.fontWeight };
  }));
  expect(before.length).toBeGreaterThan(0);
  for (const [family, weight] of [
    ["monospace", undefined],
    [undefined, "300"],
    ["monospace", "300"],
    [undefined, undefined],
  ]) {
    await setLogoTokens(page, family, weight);
    await expect.poll(() => typography(logo)).toEqual({
      family: family ?? baseline.family,
      weight: weight ?? baseline.weight,
    });
    expect(await controls.evaluateAll((els) => els.map((el) => {
      const style = getComputedStyle(el);
      return { family: style.fontFamily, weight: style.fontWeight };
    }))).toEqual(before);
  }
}
