import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// #3980 / #3985: Color overrides belong to the active scheme identity;
// Palette, Spacing, Font and Size overrides are shared within the current pack.
// Exercise the UI only: never seed or inspect zdtp's private storage envelope.
const SHELL = ".tokenpanel-shell";
const TOGGLE = 'header .ml-auto button[aria-label*="Switch to"]';
const PALETTE_VAR = "--palette-state-info";
const GLOBAL_EDITS = [
  {
    tab: "Spacing",
    id: "hsp-lg",
    cssVar: "--spacing-hsp-lg",
    input: "3",
    css: "3rem",
  },
  {
    tab: "Font",
    id: "font-sans",
    cssVar: "--font-sans",
    input: "Persistence Test, sans-serif",
    css: "Persistence Test, sans-serif",
  },
  {
    tab: "Size",
    id: "radius-lg",
    cssVar: "--radius-lg",
    input: "13",
    css: "13px",
  },
] as const;

async function openTab(page: Page, name: string) {
  // Changed-token badges extend the accessible tab name after an edit.
  await page.getByRole("tab", { name: new RegExp(`^${name}\\b`) }).click();
}

function bgSelect(page: Page) {
  return page
    .getByTestId("tokenpanel-semantic-ref-bg")
    .getByLabel("--zd-bg tier reference", { exact: true });
}

async function readCssVar(page: Page, name: string) {
  return page.evaluate(
    (cssVar) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim(),
    name,
  );
}

async function resolvedColor(page: Page, name: string) {
  return page.evaluate((cssVar) => {
    const probe = document.createElement("span");
    probe.style.visibility = "hidden";
    probe.style.color = `var(${cssVar})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

async function baseOption(page: Page, stop: number) {
  // Match the public Base ramp group rather than zdtp's generated option keys.
  const value = await bgSelect(page)
    .locator('optgroup[label="Base"] option')
    .nth(stop)
    .getAttribute("value");
  expect(value).not.toBeNull();
  return value!;
}

async function assertBackground(page: Page, stop: number) {
  await openTab(page, "Color");
  await expect(bgSelect(page)).toHaveValue(await baseOption(page, stop));
  // Resolve the custom property as a color: pristine defaults may still be
  // light-dark(...) expressions, while edits apply a var(--palette-...) ref.
  await expect
    .poll(() => resolvedColor(page, "--zd-bg"))
    .toBe(await resolvedColor(page, `--palette-base-${stop}`));
}

async function assertBackgroundSelection(page: Page, stop: number) {
  await openTab(page, "Color");
  await expect(bgSelect(page)).toHaveValue(await baseOption(page, stop));
}

async function switchMode(page: Page, target: "light" | "dark") {
  const oldShell = await page.locator(SHELL).elementHandle();
  expect(oldShell).not.toBeNull();
  await page.locator(TOGGLE).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", target);
  // data-theme changes before the bootstrap's coalesced rebuild. Wait for
  // that actual rebuild, so unchanged global values cannot false-pass early.
  await expect
    .poll(() => oldShell!.evaluate((element) => element.isConnected))
    .toBe(false);
  await oldShell!.dispose();
  await expect(page.locator(SHELL)).toBeVisible();
  await expect(page.locator(TOGGLE)).toHaveAttribute(
    "aria-label",
    `Switch to ${target === "light" ? "dark" : "light"} mode`,
  );
}

async function showPaletteStep(page: Page) {
  await openTab(page, "Palette");
  const group = page.getByTestId("palette-edit-group-header-state");
  if ((await group.getAttribute("aria-expanded")) !== "true")
    await group.click();
  await page.getByTestId("palette-edit-swatch-state-info").click();
}

async function assertGlobals(
  page: Page,
  paletteCss: string,
  paletteLabel: string,
) {
  await expect.poll(() => readCssVar(page, PALETTE_VAR)).toBe(paletteCss);
  await showPaletteStep(page);
  await expect(
    page.getByTestId("palette-edit-swatch-state-info"),
  ).toHaveAttribute("aria-label", paletteLabel);
  for (const edit of GLOBAL_EDITS) {
    await expect.poll(() => readCssVar(page, edit.cssVar)).toBe(edit.css);
    await openTab(page, edit.tab);
    await expect(
      page
        .getByTestId(`tier-item-${edit.id}`)
        .getByLabel(`${edit.cssVar} value`, { exact: true }),
    ).toHaveValue(edit.input);
  }
}

test("Color choices restore independently by mode while every global tab survives the same cycle", async ({
  page,
}) => {
  // Seed only the host's documented theme preference; the context has fresh
  // panel storage. The fixture's custom dark scheme retains Default Dark bg.
  await page.addInitScript(() =>
    localStorage.setItem("zudo-doc-theme", "light"),
  );
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator(TOGGLE)).toHaveAttribute(
    "aria-label",
    "Switch to dark mode",
  );
  await page.locator("#design-token-trigger").click();
  await expect(page.locator(SHELL)).toBeVisible();
  await assertBackground(page, 0);

  // Capture the host's pristine dark CSS before making any panel edits. The
  // select maps it to base-4, but the untouched host value can be a separate
  // light-dark(...) expression rather than zdtp's var(--palette-base-4).
  await switchMode(page, "dark");
  await assertBackgroundSelection(page, 4);
  const pristineDarkBackground = await resolvedColor(page, "--zd-bg");
  await switchMode(page, "light");
  await assertBackground(page, 0);

  await showPaletteStep(page);
  const paletteBefore = await readCssVar(page, PALETTE_VAR);
  await page
    .getByTestId("palette-edit-direct")
    .getByTestId("color-field-swatch")
    .click();
  await page.getByLabel("Hex color value", { exact: true }).fill("#804020");
  await page
    .getByRole("button", { name: "Close color picker", exact: true })
    .click();
  await expect
    .poll(() => readCssVar(page, PALETTE_VAR))
    .not.toBe(paletteBefore);
  const paletteCss = await readCssVar(page, PALETTE_VAR);
  const paletteLabel = await page
    .getByTestId("palette-edit-swatch-state-info")
    .getAttribute("aria-label");
  expect(paletteLabel).not.toBeNull();

  for (const edit of GLOBAL_EDITS) {
    await openTab(page, edit.tab);
    await page
      .getByTestId(`tier-item-${edit.id}`)
      .getByLabel(`${edit.cssVar} value`, { exact: true })
      .fill(edit.input);
  }
  await assertGlobals(page, paletteCss, paletteLabel!);

  await openTab(page, "Color");
  await bgSelect(page).selectOption(await baseOption(page, 1));
  await assertBackground(page, 1);

  // The light edit must NOT replace the pristine dark default (base-4).
  await switchMode(page, "dark");
  await assertBackgroundSelection(page, 4);
  await expect.poll(() => resolvedColor(page, "--zd-bg")).toBe(
    pristineDarkBackground,
  );
  await assertGlobals(page, paletteCss, paletteLabel!);

  await openTab(page, "Color");
  await bgSelect(page).selectOption(await baseOption(page, 3));
  await assertBackground(page, 3);

  await switchMode(page, "light");
  await assertBackground(page, 1);
  await assertGlobals(page, paletteCss, paletteLabel!);

  await switchMode(page, "dark");
  await assertBackground(page, 3);
  await assertGlobals(page, paletteCss, paletteLabel!);
});
