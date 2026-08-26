import { expect, test } from "@playwright/test";

const EMBED_URL = "/browser-embed/";
const HOME_URL = "/";
const DESKTOP_THEME_TOGGLE =
  'header [data-zfb-island="ThemeToggle"] button[aria-label*="Switch to"]';

test("browser bundle renders md-wasm content through route context and real chrome CSS", async ({
  page,
}) => {
  await page.goto(EMBED_URL);
  await expect(page.locator("html")).toHaveAttribute("data-browser-embed-ready", "");

  const stylesheets = page.locator('link[rel="stylesheet"]');
  await expect(stylesheets).toHaveCount(1);
  await expect(stylesheets).toHaveAttribute("href", "/browser-embed/compiled.css");

  const header = page.locator("header[data-header]");
  const sidebar = page.locator('aside[aria-label="Documentation sidebar"]');
  const pager = page.locator("nav[data-doc-pager]");
  const content = page.locator(".zd-content");
  await expect(header).toHaveCSS("height", "56px");
  await expect(header).toHaveCSS("display", "flex");
  await expect(sidebar).toHaveCSS("background-color", "oklch(0.185 0.005 65)");
  await expect(pager).toHaveCSS("display", "grid");
  await expect(content).toHaveCSS("font-size", "19.2px");
  await expect(content).toHaveCSS("line-height", "31.2px");

  const mdWasmHtml = await page.evaluate(() => window.browserEmbed.mdWasmHtml);
  expect(mdWasmHtml).toContain(
    '<Note title="Heads up"><p>First paragraph with <strong>bold</strong>',
  );
  expect(mdWasmHtml).toContain("<p>Second paragraph in the note.</p></Note>");
  expect(mdWasmHtml).toContain(
    "<Important><p>First important paragraph.</p><p>Second important paragraph.</p></Important>",
  );

  for (const variant of ["note", "important"]) {
    const body = page.locator(`[data-admonition="${variant}"] .admonition-body`);
    const paragraphs = body.locator(":scope > p");
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.first()).toHaveCSS("margin-top", "0px");
    const expectedGap = await body.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.marginTop = "var(--spacing-vsp-sm)";
      element.append(probe);
      const value = getComputedStyle(probe).marginTop;
      probe.remove();
      return value;
    });
    await expect(paragraphs.nth(1)).toHaveCSS("margin-top", expectedGap);
  }

  const baselineAccent = await page.locator("html").evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--zd-accent").trim(),
  );
  await page.evaluate(() => window.browserEmbed.applyFoundryThemePack());
  await expect(page.locator('link[data-zd-theme-pack-css]')).toHaveAttribute(
    "href",
    "/browser-embed/theme-packs/foundry/pack.css",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme-pack", "foundry");
  const foundryAccent = await page.locator("html").evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--zd-accent").trim(),
  );
  expect(foundryAccent).not.toBe(baselineAccent);
  expect(foundryAccent).toBe("light-dark(#0969da, #4493f8)");
  expect(await content.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(
    "Inter",
  );
});

test("Chromium page.route holds /assets/islands*.js through the real pending window", async ({
  browserName,
  page,
}) => {
  expect(browserName).toBe("chromium");

  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  const islandsEntryPattern = /\/assets\/islands[^/]*\.js(?:\?.*)?$/;
  await page.route(islandsEntryPattern, async (route) => {
    requested = true;
    await held;
    await route.continue();
  });

  const navigation = page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
  try {
    await expect.poll(() => requested).toBe(true);
    const island = page.locator('[data-zfb-island="ThemeToggle"]');
    const toggle = page.locator(DESKTOP_THEME_TOGGLE);
    await expect(island).not.toHaveAttribute("data-zfb-island-mounted", "");
    await expect(toggle).toHaveAttribute("data-zd-pending", "");
    await expect(toggle).toHaveAttribute("aria-disabled", "true");
    await expect(toggle).not.toHaveAttribute("disabled", "");
    await expect(toggle).not.toHaveAttribute("inert", "");
    await expect(toggle).toHaveCSS("opacity", "0.7");
    await expect(toggle).toHaveCSS("pointer-events", "none");

    const initialTheme = await page.locator("html").getAttribute("data-theme");
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", initialTheme!);

    release();
    await navigation;
    await expect(island).toHaveAttribute("data-zfb-island-mounted", "");
    await expect(toggle).not.toHaveAttribute("data-zd-pending", "");
    await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
    await expect(toggle).toHaveCSS("opacity", "1");
    await expect(toggle).toHaveCSS("pointer-events", "auto");

    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", initialTheme!);
    const keyboardTheme = await page.locator("html").getAttribute("data-theme");
    await toggle.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", keyboardTheme!);
  } finally {
    release();
    await navigation.catch(() => undefined);
    await page.unroute(islandsEntryPattern);
  }
});
