import { test, expect } from "./fixtures";
import { spaClickSelector } from "./nav-helpers";
import { THEME_STORAGE_KEY } from "./theme-helpers";
import type { Locator, Page } from "@playwright/test";

/**
 * Asset index tree rows: hovering or keyboard-focusing a folder summary or a
 * file link turns that row's visible text, icons and metadata accent. Colors
 * are read from the visible descendants and compared against the live
 * `--color-accent` token, so a theme or author override still drives them.
 */

type Tokens = { accent: string; fg: string; muted: string };

async function resolveTokens(page: Page): Promise<Tokens> {
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
    };
    probe.remove();
    return tokens;
  });
}

async function expectColors(locators: Locator[], expected: string) {
  for (const locator of locators) {
    await expect
      .poll(() => locator.evaluate((el) => getComputedStyle(el).color))
      .toBe(expected);
  }
}

async function keyboardFocus(page: Page, target: Locator) {
  await page.mouse.move(1, 1);
  await page.keyboard.press("Shift");
  await target.focus();
  expect(await target.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
  expect(await target.evaluate((el) => el.matches(":hover"))).toBe(false);
}

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(1, 1);
}

function folderParts(summary: Locator) {
  return {
    chevron: summary.locator(":scope > svg").first(),
    icon: summary.locator(":scope > svg:visible").nth(1),
    name: summary.locator(":scope > span").first(),
    meta: summary.locator(":scope > span").last(),
  };
}

function fileParts(link: Locator) {
  return {
    icon: link.locator(":scope > svg"),
    name: link.locator(":scope > span").first(),
    meta: link.locator(":scope > span").last(),
  };
}

async function assertTreeAccent(page: Page) {
  const t = await resolveTokens(page);
  expect(t.accent).not.toBe(t.fg);
  expect(t.accent).not.toBe(t.muted);

  const tree = page.locator("[data-zd-asset-tree]");
  const nestedSummary = tree.locator("summary", { hasText: "nested/" }).first();
  const innerFile = tree.locator('a[href$="/files/nested/inner.txt/"]');
  const demoFile = tree.locator('a[href$="/files/demo.js/"]');
  const folder = folderParts(nestedSummary);
  const inner = fileParts(innerFile);
  const demo = fileParts(demoFile);
  await expect(nestedSummary).toBeVisible();
  await expect(innerFile).toBeVisible();

  const folderRest = async () => {
    await expectColors([folder.chevron, folder.icon, folder.meta], t.muted);
    await expectColors([folder.name], t.fg);
  };

  await folderRest();
  await expectColors([inner.icon, inner.meta], t.muted);
  await expectColors([inner.name], t.fg);

  // Folder hover recolors its own row, not the files beneath it.
  await nestedSummary.hover();
  await expectColors([folder.chevron, folder.icon, folder.name, folder.meta], t.accent);
  await expectColors([inner.icon, inner.meta], t.muted);
  await expectColors([inner.name], t.fg);

  // Nested file hover recolors its own row, not the ancestor folder summary.
  await innerFile.hover();
  await expectColors([inner.icon, inner.name, inner.meta], t.accent);
  await folderRest();
  await expectColors([demo.icon, demo.meta], t.muted);

  // Keyboard focus, pointer parked away.
  await keyboardFocus(page, nestedSummary);
  await expectColors([folder.chevron, folder.icon, folder.name, folder.meta], t.accent);
  await expectColors([inner.icon, inner.meta], t.muted);
  await keyboardFocus(page, demoFile);
  await expectColors([demo.icon, demo.name, demo.meta], t.accent);
  await folderRest();
  await blur(page);
  await expectColors([demo.icon, demo.meta], t.muted);
}

test.describe("Asset tree accent interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("folder and file rows turn accent on hover and keyboard focus (Default Dark)", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "dark"), THEME_STORAGE_KEY);
    await page.goto("/files/", { waitUntil: "load" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await assertTreeAccent(page);

    // The disclosure still toggles from the keyboard, keeping the icon swap.
    const summary = page.locator("[data-zd-asset-tree] summary", { hasText: "nested/" }).first();
    const details = summary.locator("xpath=..");
    await keyboardFocus(page, summary);
    await page.keyboard.press("Enter");
    await expect.poll(() => details.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
    await expect(summary.locator(":scope > svg:visible")).toHaveCount(2);
    await page.keyboard.press(" ");
    await expect.poll(() => details.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
    assertNoConsoleErrors();
  });

  test("Default Light keeps the same row-scoped accent", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "light"), THEME_STORAGE_KEY);
    await page.goto("/files/", { waitUntil: "load" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await assertTreeAccent(page);
    assertNoConsoleErrors();
  });

  test("a non-orange accent override drives the rows after client-side navigation", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/files/demo.js/", { waitUntil: "load" });
    expect(
      await spaClickSelector(page, 'nav[aria-label="Breadcrumb"] a[href="/files/"]'),
    ).toBe(true);
    await expect(page.locator("[data-zd-asset-index-page]")).toBeVisible();
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--color-accent", "rgb(0, 128, 255)"),
    );
    expect((await resolveTokens(page)).accent).toBe("rgb(0, 128, 255)");
    await assertTreeAccent(page);
    assertNoConsoleErrors();
  });

  test("narrow layout hides metadata but still tints the visible name and icons", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/files/", { waitUntil: "load" });
    const t = await resolveTokens(page);
    const link = page.locator('[data-zd-asset-tree] a[href$="/files/demo.js/"]');
    const demo = fileParts(link);
    await expect(demo.meta).toBeHidden();
    await link.hover();
    await expectColors([demo.icon, demo.name], t.accent);
    assertNoConsoleErrors();
  });
});
