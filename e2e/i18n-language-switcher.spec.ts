import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";
import type { Page } from "@playwright/test";

// The i18n fixture uses zudo-doc's default `trailingSlash: false` output.
// Keep route expectations in the emitted href form; page.goto still accepts
// these canonical slashless URLs directly.
const PAGE_EN = "/docs/getting-started";
const PAGE_DE = "/de/docs/getting-started";
const DEFAULT_ONLY_PAGE = "/docs/default-only";
const SWITCHER = "[data-language-switcher]";

// Desktop viewport so the language disclosure is rendered in the header and
// all three configured labels can be inspected together.
test.use({ viewport: { width: 1280, height: 900 } });

async function languageLabels(page: Page): Promise<string[]> {
  return page
    .locator(`${SWITCHER} [data-language-menu] li`)
    .allTextContents()
    .then((labels: string[]) => labels.map((label) => label.trim()));
}

test.describe("i18n language disclosure: EN + JA + DE", () => {
  test("shows configured labels in order and navigates through the visible DE link", async ({
    page,
  }) => {
    await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });

    const switcher = page.locator(SWITCHER);
    const toggle = switcher.locator("[data-language-toggle]");
    const menu = switcher.locator("[data-language-menu]");
    await expect(switcher).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    expect(await languageLabels(page)).toEqual(["EN", "JA", "DE"]);
    await expect(menu.locator('[aria-current="page"]')).toHaveAttribute(
      "lang",
      "en",
    );
    await expect(menu.locator('a[lang="en"]')).toHaveCount(0);

    // This is a real visible-anchor click. The destination proves that the
    // configured DE label is not merely decorative or a stale hidden link.
    const deLink = menu.locator('a[lang="de"]');
    await expect(deLink).toBeVisible();
    await expect(deLink).toHaveAttribute("href", PAGE_DE);
    await Promise.all([page.waitForURL(/\/de\/docs\/getting-started\/?$/), deLink.click()]);
    await expect(page.locator("h1")).toHaveText("Erste Schritte");

    const postSwapMenu = page.locator(`${SWITCHER} [data-language-menu]`);
    await expect(page.locator(`${SWITCHER} [data-language-toggle]`)).toContainText("DE");
    await expect(postSwapMenu.locator('[aria-current="page"]')).toHaveAttribute(
      "lang",
      "de",
    );
    await expect(postSwapMenu.locator('a[lang="de"]')).toHaveCount(0);
  });

  test("supports click toggle, outside click, Escape focus restore, and normal Tab movement", async ({
    page,
  }) => {
    await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });

    const switcher = page.locator(SWITCHER);
    const toggle = switcher.locator("[data-language-toggle]");
    const menu = switcher.locator("[data-language-menu]");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();

    // A click outside the disclosure must close it without changing the URL.
    await page.locator("h1").click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    // Escape closes an open disclosure and returns focus to its trigger.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();

    // Once opened, ordinary Tab navigation reaches the first inactive locale
    // anchor in document order; no custom keyboard trap is needed.
    await toggle.click();
    const firstLocaleLink = menu.locator("a[lang]").first();
    await page.keyboard.press("Tab");
    await expect(firstLocaleLink).toBeFocused();
    await expect(firstLocaleLink).toBeVisible();
  });

  test("closes and rewires live hrefs across repeated same-locale SPA swaps", async ({
    page,
  }) => {
    await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });

    const cases = [
      { path: "/docs/guides", ja: "/ja/docs/guides", de: "/de/docs/guides" },
      {
        path: "/docs/guides/writing-docs",
        ja: "/ja/docs/guides/writing-docs",
        de: "/de/docs/guides/writing-docs",
      },
    ];

    for (const target of cases) {
      const switcher = page.locator(SWITCHER);
      const toggle = switcher.locator("[data-language-toggle]");
      const menu = switcher.locator("[data-language-menu]");

      // Leave the disclosure open when navigation starts. The persisted
      // header's after-swap refresh must close/reset it before re-wiring.
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(await spaClick(page, target.path)).toBe(true);
      await page.waitForURL((url) => url.pathname === target.path, { timeout: 5000 });

      const postToggle = page.locator(`${SWITCHER} [data-language-toggle]`);
      const postMenu = page.locator(`${SWITCHER} [data-language-menu]`);
      await expect(postToggle).toHaveAttribute("aria-expanded", "false");
      await expect(postMenu).toBeHidden();
      await expect(page.locator(`${SWITCHER} a[lang="ja"]`)).toHaveAttribute(
        "href",
        target.ja,
      );
      await expect(page.locator(`${SWITCHER} a[lang="de"]`)).toHaveAttribute(
        "href",
        target.de,
      );

      // A single click after repeated swaps must open the menu. If the init
      // script had accumulated document listeners, one event would toggle it
      // twice and leave aria-expanded false.
      await postToggle.click();
      await expect(postToggle).toHaveAttribute("aria-expanded", "true");
      await expect(postMenu).toBeVisible();
      await postToggle.click();
      await expect(postToggle).toHaveAttribute("aria-expanded", "false");
    }
  });
});

test.describe("i18n language disclosure: mobile inline footer", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps EN, JA, and DE available as inline footer links", async ({ page }) => {
    await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });

    const openSidebar = page.getByRole("button", { name: "Open sidebar" });
    await expect(openSidebar).toBeVisible();
    await openSidebar.click();

    const mobileSidebar = page.locator("aside[data-zd-mobile-sidebar]");
    await expect(mobileSidebar).toBeVisible();
    await expect(mobileSidebar.locator('[aria-current="true"]')).toHaveText("EN");
    await expect(mobileSidebar.locator('a[lang="ja"]')).toBeVisible();
    await expect(mobileSidebar.locator('a[lang="de"]')).toBeVisible();
  });

  test("suppresses the disclosure and inactive footer links on a default-locale-only page", async ({
    page,
  }) => {
    await page.goto(DEFAULT_ONLY_PAGE, { waitUntil: "domcontentloaded" });

    await expect(page.locator(SWITCHER)).toHaveCount(0);
    const openSidebar = page.getByRole("button", { name: "Open sidebar" });
    await expect(openSidebar).toBeVisible();
    await openSidebar.click();

    const mobileSidebar = page.locator("aside[data-zd-mobile-sidebar]");
    await expect(mobileSidebar).toBeVisible();
    await expect(mobileSidebar.locator('[aria-current="true"]')).toHaveText("EN");
    await expect(mobileSidebar.locator("a[lang]")).toHaveCount(0);
  });
});

test.describe("i18n language disclosure: no JavaScript", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("hover and focus/Tab expose usable locale links", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:4501",
      viewport: { width: 1280, height: 900 },
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    try {
      await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });

      const switcher = page.locator(SWITCHER);
      const toggle = switcher.locator("[data-language-toggle]");
      const menu = switcher.locator("[data-language-menu]");
      const deLink = menu.locator('a[lang="de"]');

      // The CSS group-hover rule is the no-JS disclosure path.
      await expect(menu).toBeHidden();
      await switcher.hover();
      await expect(menu).toBeVisible();
      await expect(deLink).toBeVisible();

      // Focusing the static button activates group-focus-within; normal Tab
      // then reaches a visible anchor in menu order.
      await toggle.focus();
      await expect(menu).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(menu.locator("a[lang]").first()).toBeFocused();
      await expect(deLink).toBeVisible();

      // Only click after visibility has been asserted: this is a real
      // no-JS navigation through the visible DE anchor, not a hidden-anchor
      // programmatic click.
      await Promise.all([page.waitForURL(/\/de\/docs\/getting-started\/?$/), deLink.click()]);
      await expect(page.locator("h1")).toHaveText("Erste Schritte");
    } finally {
      await context.close();
    }
  });
});
