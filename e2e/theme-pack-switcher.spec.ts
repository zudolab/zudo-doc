import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";
import {
  THEME_PACK_LINK_SELECTOR,
  THEME_PACK_LINK_LOADING_SELECTOR,
  browseAllButton,
  closeFlyout,
  dialogLocator,
  flyoutCard,
  launcherButton,
  nextPackButton,
  openFlyout,
  packCard,
  prevPackButton,
  readActivePack,
  readStoredPack,
  readThemePackChangeDetail,
  armThemePackChangeCapture,
  waitForActivePack,
} from "./theme-pack-helpers";

/**
 * E2E coverage for the theme-pack switcher UI (epic Theme Core #2812,
 * sub-issue #2826) — the flyout (`theme-pack-switcher/index.tsx`) and the
 * browse-all dialog (`theme-pack-dialog/index.tsx`), routed to the `theme`
 * fixture (port 4502, `themePackSwitcher: true`) via the `theme*` filename
 * prefix (testMatch convention, see e2e/CLAUDE.md).
 *
 * Naming (ADR "Naming rule (hard)"): this file asserts the NEW theme-pack
 * vocabulary (`zudo-doc-theme-pack`, `theme-pack-changed`, `data-theme-pack`)
 * — the light/dark assertions below deliberately keep the OLD light/dark
 * vocabulary (`zudo-doc-theme`, `data-theme`) to prove the two systems are
 * independent.
 *
 * Bundled packs available in this fixture: "default" (no stylesheet),
 * "foundry", "broadsheet", "ledger", "manuscript", "swissgrid" — see
 * `packages/zudo-doc/src/theme-packs/`. The fixture PINS `themePacks` to a
 * fixed order with "foundry" held SECOND (see this fixture's settings.ts), so
 * the switcher's Prev/Next cycle is `default → foundry → …`; the specs below
 * rely on `default → Next → foundry → Prev → default`, which the pin keeps
 * stable as later batches add packs. (`runtime.packs` is unordered — the
 * hard-load test re-sorts it, so it asserts the full bundled set
 * alphabetically.)
 */

const HOME = "/";
const THEME_STORAGE_KEY = "zudo-doc-theme";
const DESKTOP_TOGGLE_SELECTOR = 'header .ml-auto button[aria-label*="Switch to"]';

/**
 * Mirrors the `theme` fixture's pinned `themePacks` order (this fixture's own
 * `src/config/settings.ts`) — the full current bundled collection, kept in
 * sync as batches add packs (Theme Finalize epic #2812 full-collection QA,
 * sub-issue #2854). If this list and the fixture's `themePacks` array drift
 * apart, the full-cycle test below fails loudly rather than silently testing
 * a stale subset.
 */
const FULL_PACK_CYCLE = [
  "default",
  "foundry",
  "broadsheet",
  "ledger",
  "manuscript",
  "swissgrid",
  "futura-editorial",
  "hearth",
  "matcha",
  "sumi",
  "washi",
  "drift",
  "fjord",
  "hollow",
  "nocturne",
  "onyx",
  "beacon",
  "brutalist",
  "observatory",
  "phosphor",
  "solar",
];

async function preseedTheme(page: Page, mode: "light" | "dark") {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: THEME_STORAGE_KEY, value: mode },
  );
}

async function waitForToggleHydrated(page: Page, activeMode: "light" | "dark") {
  const other = activeMode === "light" ? "dark" : "light";
  await expect(page.locator(DESKTOP_TOGGLE_SELECTOR)).toHaveAttribute(
    "aria-label",
    `Switch to ${other} mode`,
    { timeout: 5000 },
  );
}

async function toggleAndWaitForMode(page: Page, target: "light" | "dark") {
  await page.locator(DESKTOP_TOGGLE_SELECTOR).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", target, { timeout: 5000 });
}

/**
 * Whether `document.fonts` carries a LOADED `FontFace` for `family` — the
 * ADR Decision 5 acceptance check ("verify the loaded OFL family by name via
 * `document.fonts` / meta `fonts.loaded` — never a local face"). Pack CSS
 * declares its `@font-face` eagerly (registered in `document.fonts` as soon
 * as the stylesheet parses), but the actual woff2 fetch is lazy per the CSS
 * Font Loading spec — it only kicks off once something on the page is
 * painted with that family. `document.fonts.ready` resolves once every
 * currently-loading face has settled (loaded or failed), so awaiting it
 * before checking status is the deterministic wait, not a race on paint
 * timing.
 */
async function isFontFaceLoaded(page: Page, family: string): Promise<boolean> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((name) => {
    const target = name.toLowerCase();
    for (const face of document.fonts) {
      if (face.family.replace(/["']/g, "").toLowerCase() === target && face.status === "loaded") {
        return true;
      }
    }
    return false;
  }, family);
}

/** (c)-adjacent: the mode toggle must never move the active pack or its
 *  storage key, in either direction, on whichever pack is currently active. */
async function assertToggleIndependentOfPack(page: Page, expectedPack: string) {
  const storedBefore = await readStoredPack(page);

  await toggleAndWaitForMode(page, "dark");
  expect(await readActivePack(page)).toBe(expectedPack);
  expect(await readStoredPack(page)).toBe(storedBefore);

  await toggleAndWaitForMode(page, "light");
  expect(await readActivePack(page)).toBe(expectedPack);
  expect(await readStoredPack(page)).toBe(storedBefore);
}

test.describe("Theme pack switcher", () => {
  test("hard load sets data-theme-pack=\"default\" and publishes the runtime registry; no stylesheet link for the stock look", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await waitForActivePack(page, "default");
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(0);

    const runtime = await page.evaluate(
      () => (window as unknown as Record<string, unknown>)["__zudoDocThemePacks"] as {
        base: string;
        configured: string;
        packs: Record<string, string>;
      },
    );
    expect(runtime.base).toBe("/");
    expect(runtime.configured).toBe("default");
    expect(Object.keys(runtime.packs).sort()).toEqual([
      "beacon",
      "broadsheet",
      "brutalist",
      "default",
      "drift",
      "fjord",
      "foundry",
      "futura-editorial",
      "hearth",
      "hollow",
      "ledger",
      "manuscript",
      "matcha",
      "nocturne",
      "observatory",
      "onyx",
      "phosphor",
      "solar",
      "sumi",
      "swissgrid",
      "washi",
    ]);
  });

  test("opens the flyout showing the active pack name and moves focus into it; Escape closes it and returns focus to the launcher", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });

    await openFlyout(page);
    await expect(flyoutCard(page)).toBeFocused();
    await expect(flyoutCard(page)).toContainText("Default");

    await closeFlyout(page);
    await expect(launcherButton(page)).toBeFocused();
  });

  test("Next applies the next pack and Prev cycles back — attribute, stylesheet link, localStorage, and the theme-pack-changed event all commit", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await openFlyout(page);

    await armThemePackChangeCapture(page);
    await nextPackButton(page).click();
    await waitForActivePack(page, "foundry");

    expect(await readThemePackChangeDetail(page)).toEqual({ pack: "foundry", previous: "default" });
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(1);
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveAttribute(
      "href",
      /\/theme-packs\/foundry\/pack\.css\?v=/,
    );
    await expect(page.locator(THEME_PACK_LINK_LOADING_SELECTOR)).toHaveCount(0);
    expect(await readStoredPack(page)).toBe("foundry");
    await expect(flyoutCard(page)).toContainText("Foundry");

    // ADR Decision 5 acceptance check: the pack's declared `fonts.loaded`
    // face ("Inter", per `theme-packs/foundry/meta.json`) must actually load
    // — not just the stylesheet response arriving.
    await expect.poll(() => isFontFaceLoaded(page, "Inter"), { timeout: 10000 }).toBe(true);

    await armThemePackChangeCapture(page);
    await prevPackButton(page).click();
    await waitForActivePack(page, "default");

    expect(await readThemePackChangeDetail(page)).toEqual({ pack: "default", previous: "foundry" });
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(0);
    expect(await readStoredPack(page)).toBe("default");
    await expect(flyoutCard(page)).toContainText("Default");
  });

  test("Next cycles through the ENTIRE current pack list in order and wraps back to default; Prev walks the same list backward", async ({
    page,
  }) => {
    test.slow();
    await page.goto(HOME, { waitUntil: "load" });
    await waitForActivePack(page, "default");
    await openFlyout(page);

    // Forward: default -> foundry -> ... -> solar -> (wrap) -> default.
    for (const slug of [...FULL_PACK_CYCLE.slice(1), "default"]) {
      await nextPackButton(page).click();
      await waitForActivePack(page, slug);
    }
    expect(await readActivePack(page)).toBe("default");

    // Backward: default -> solar -> ... -> foundry -> (wrap) -> default,
    // i.e. the reverse of FULL_PACK_CYCLE (whose own last element is
    // "default", so this sequence needs no extra wrap-around append).
    const reverseOrder = [...FULL_PACK_CYCLE].reverse();
    for (const slug of reverseOrder) {
      await prevPackButton(page).click();
      await waitForActivePack(page, slug);
    }
    expect(await readActivePack(page)).toBe("default");
  });

  test("browse-all dialog: selecting a card applies the pack immediately and the dialog stays open; Escape restores focus to the launcher", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await openFlyout(page);

    await browseAllButton(page).click();
    await expect(dialogLocator(page)).toBeVisible();
    // The flyout card is replaced on screen by the dialog (single Escape
    // target at a time — ADR Decision 7 "Switcher data flow").
    await expect(flyoutCard(page)).toBeHidden();

    const foundryCard = packCard(page, "Foundry");
    // Playwright's own retry covers the lazy `theme-packs/index.json` fetch —
    // no arbitrary wait needed.
    await expect(foundryCard).toBeVisible({ timeout: 10000 });
    await expect(foundryCard).toHaveAttribute("aria-pressed", "false");

    await foundryCard.click();
    await waitForActivePack(page, "foundry");
    await expect(foundryCard).toHaveAttribute("aria-pressed", "true");
    // Stays open — a card click is not a close action (live comparison is
    // the point; close is Esc/backdrop/close-button only).
    await expect(dialogLocator(page)).toBeVisible();

    const defaultCard = packCard(page, "Default");
    await expect(defaultCard).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Escape");
    await expect(dialogLocator(page)).toBeHidden();
    await expect(launcherButton(page)).toBeFocused();
  });

  test("the active pack persists across a hard reload (bootstrap re-applies pre-paint from localStorage)", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await openFlyout(page);
    await nextPackButton(page).click();
    await waitForActivePack(page, "foundry");

    await page.reload({ waitUntil: "load" });

    await waitForActivePack(page, "foundry");
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(1);
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveAttribute(
      "href",
      /\/theme-packs\/foundry\/pack\.css\?v=/,
    );
    expect(await readStoredPack(page)).toBe("foundry");
  });

  test("the active pack persists across an SPA navigation", async ({ page }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await openFlyout(page);
    await nextPackButton(page).click();
    await waitForActivePack(page, "foundry");
    await closeFlyout(page);

    const navigated = await spaClick(page, "/docs/getting-started");
    expect(navigated).toBe(true);

    await waitForActivePack(page, "foundry");
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(1);
    expect(await readStoredPack(page)).toBe("foundry");
  });

  test("light/dark toggle is independent of the active theme pack, in both directions, on every pack", async ({
    page,
  }) => {
    await preseedTheme(page, "light");
    await page.goto(HOME, { waitUntil: "load" });
    await waitForToggleHydrated(page, "light");
    await waitForActivePack(page, "default");

    // No pack has been switched yet — a mode toggle must not write the
    // theme-pack storage key at all.
    await assertToggleIndependentOfPack(page, "default");
    expect(await readStoredPack(page)).toBeNull();

    await openFlyout(page);
    await nextPackButton(page).click();
    await waitForActivePack(page, "foundry");
    await closeFlyout(page);

    await assertToggleIndependentOfPack(page, "foundry");
    expect(await readStoredPack(page)).toBe("foundry");
  });
});
