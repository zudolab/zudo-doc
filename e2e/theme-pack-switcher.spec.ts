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
  "academia",
  "bauhaus",
  "blueprint",
  "botanica",
  "eink",
  "riso",
  "sakura",
  "scandi",
  "tidepool",
  "timberline",
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

/** The open card's rendered width in px (`data-switcher-card`'s
 *  `w-[360px] max-w-[calc(100vw-2rem)]` — #3116). */
async function cardWidthPx(page: Page): Promise<number> {
  const box = await flyoutCard(page).boundingBox();
  expect(box).not.toBeNull();
  return (box as { x: number; y: number; width: number; height: number }).width;
}

/**
 * How many line fragments the card's description paragraph wraps across.
 * `Element.getClientRects()` reports a single border-box rect for a
 * block-level element regardless of internal wrapping, so this instead wraps
 * a `Range` around the element's inline content — the standard technique for
 * counting rendered text lines, since a Range's `getClientRects()` yields one
 * rect per line fragment of the text it spans.
 */
async function descriptionLineCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const description = document.querySelector(
      "[data-switcher-card] p.text-caption.text-muted",
    );
    if (description === null) return 0;
    const range = document.createRange();
    range.selectNodeContents(description);
    return range.getClientRects().length;
  });
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
      "academia",
      "bauhaus",
      "beacon",
      "blueprint",
      "botanica",
      "broadsheet",
      "brutalist",
      "default",
      "drift",
      "eink",
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
      "riso",
      "sakura",
      "scandi",
      "solar",
      "sumi",
      "swissgrid",
      "tidepool",
      "timberline",
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

  test("a long-description pack (Tidepool) keeps the open card at the fixed 360px width and wraps its description across multiple lines (#3116)", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });
    await openFlyout(page);

    // Apply via the browse-all dialog rather than cycling Prev/Next all the
    // way around — Tidepool sits last in this fixture's pinned cycle order
    // (see FULL_PACK_CYCLE above).
    await browseAllButton(page).click();
    await expect(dialogLocator(page)).toBeVisible();
    // The dialog replaces the flyout card on screen (ADR Decision 7).
    await expect(flyoutCard(page)).toBeHidden();

    const tidepoolCard = packCard(page, "Tidepool");
    await expect(tidepoolCard).toBeVisible({ timeout: 10000 });
    await tidepoolCard.click();
    await waitForActivePack(page, "tidepool");

    await page.keyboard.press("Escape");
    await expect(dialogLocator(page)).toBeHidden();

    // Reopen the flyout to measure the card holding the now-applied pack.
    await openFlyout(page);
    await expect(flyoutCard(page)).toContainText("Tidepool");

    const width = await cardWidthPx(page);
    expect(Math.abs(width - 360)).toBeLessThanOrEqual(2);

    // Tidepool's meta.json description (packages/zudo-doc/src/theme-packs/
    // tidepool/meta.json) is a 200+ character sentence — comfortably wider
    // than the card's ~328px text column (360px card minus 2 * 16px
    // p-hsp-lg padding) at the 14px text-caption size, so it reliably wraps
    // without needing to extend this fixture's data.
    expect(await descriptionLineCount(page)).toBeGreaterThan(1);
  });

  test("at a narrow viewport, the open card is clamped by max-w-[calc(100vw-2rem)] instead of holding the fixed 360px width (#3116)", async ({
    page,
  }) => {
    const NARROW_VIEWPORT_WIDTH = 320;
    await page.setViewportSize({ width: NARROW_VIEWPORT_WIDTH, height: 700 });
    await page.goto(HOME, { waitUntil: "load" });
    await openFlyout(page);

    const width = await cardWidthPx(page);

    // Well under the fixed 360px width — the clamp is active (the epic's
    // acceptance line: below ~392px viewport, i.e. 360 + 32, the card can no
    // longer hold 360px without exceeding calc(100vw - 2rem)).
    expect(width).toBeLessThan(340);
    // Roughly matches the calc(100vw - 2rem) formula (2rem = 32px at the
    // unmodified "default" pack's root font-size — no pack sets a root
    // font-size override on this fixture's HOME hard-load state). A generous
    // tolerance absorbs any scrollbar-gutter effect on 100vw rather than
    // pinning to exact arithmetic.
    const expectedClampedWidth = NARROW_VIEWPORT_WIDTH - 32;
    expect(Math.abs(width - expectedClampedWidth)).toBeLessThanOrEqual(20);
  });
});
