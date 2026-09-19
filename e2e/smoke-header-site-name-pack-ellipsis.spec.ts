import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { THEME_PACK_STORAGE_KEY, waitForActivePack } from "./theme-pack-helpers";

/**
 * All-packs regression gate for zudolab/zudo-doc#4305 (epic "Header Logo
 * Pack Ellipsis"), sub-issue #4307.
 *
 * `smoke-header-site-name-truncation.spec.ts` proves the header
 * truncate-instead-of-overflow fix (#4287/#4288/#4289) against the single
 * pack the smoke fixture ships by default ("default"). This spec sweeps
 * every theme pack the fixture runs — the switcher UI is off here
 * (`themePack: "default"` in `e2e/fixtures/smoke/src/config/settings.ts`),
 * but the runtime still ships all pack stylesheets and the
 * `window.__zudoDocThemePacks` global, so a pack can be activated the same
 * way `theme-pack-sidebar-active.spec.ts` does: write
 * `localStorage[THEME_PACK_STORAGE_KEY]`, reload, wait for
 * `<html data-theme-pack>` to settle.
 *
 * Some packs restyle the header (logo sizing, nav spacing, font choices) in
 * ways that can silently undo the anchor's truncate mechanism even though
 * the default pack is fine — that's the bug class this epic tracks, and
 * `swissgrid` / `riso` are the two packs already known to break it (fixed by
 * the sibling CSS change, #4306). Assertion 4 below only proves the
 * ellipsis MECHANISM (the CSS properties that make an overflowing anchor
 * clip with "…" instead of pushing the layout) is present when the anchor
 * is actually overflowing — it deliberately does not compare painted pixels
 * or a screenshot, because glyph metrics (and therefore exactly how much of
 * the string survives before the ellipsis) vary by font/rendering engine
 * across CI runners, which would make a pixel-level assertion flaky for
 * reasons unrelated to the mechanism under test.
 *
 * Written in wave 1, ahead of the CSS fix: it failed for `swissgrid` and
 * `riso` until #4306 landed. #4306 is now in, so this spec must pass for
 * EVERY pack — a `swissgrid`/`riso` failure here is a regression, not the
 * expected pre-fix state. Do not weaken the assertions to make it pass.
 *
 * Same CDP `Page.setFontSizes` lever as the truncation spec — the browser's
 * own font preference, not zoom, not injected CSS.
 *
 * `test.slow()` because activating each of the 31+ packs costs a full
 * `page.reload()`.
 */

const PAGE_PATH = "/docs/getting-started";

/** Keep in sync with `e2e/fixtures/smoke/src/config/settings.ts` — same
 *  constant `smoke-header-site-name-truncation.spec.ts` uses. */
const LONG_SITE_NAME = "Smoke Test Guide";

/** The two packs already known to break header truncation (tracked by the
 *  sibling CSS fix, #4306) — asserted as a vacuous-pass guard below: without
 *  naming them individually, "at least one pack overflows" would pass even
 *  if only one of the two actually did. */
const KNOWN_OVERFLOWING_PACKS = ["swissgrid", "riso"] as const;

/** The browser font preference this sweep runs at, via CDP
 *  `Page.setFontSizes` — the browser's own setting, not zoom, not CSS. */
const FONT_PREFERENCE_PX = 24;

async function setFontPreference(page: Page, px: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: px, fixed: px } });
}

/** Reads the packs the runtime actually shipped, the same global
 *  `theme-pack-sidebar-active.spec.ts`'s `enabledPackSlugs` reads. */
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
  await waitForFonts(page);
}

/** Packs override `--font-sans` with self-hosted faces, and fallback glyph
 *  metrics change whether the anchor overflows at all — measuring before the
 *  pack's fonts are in would make every width below (and the
 *  KNOWN_OVERFLOWING_PACKS guard in particular) depend on load timing. */
async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

interface PackMeasurement {
  rootFont: string;
  clusterRight: number;
  docScrollWidth: number;
  innerWidth: number;
  anchorScrollWidth: number;
  anchorClientWidth: number;
  anchorTitle: string | null;
  anchorDisplay: string;
  anchorTextOverflow: string;
  anchorOverflowX: string;
  anchorWhiteSpace: string;
}

async function measurePack(page: Page): Promise<PackMeasurement> {
  return page.evaluate(() => {
    const anchor = document.querySelector("[data-header-logo]");
    const rightCluster = document.querySelector("[data-header-right]");
    if (!anchor) throw new Error("[data-header-logo] not found");
    if (!rightCluster) throw new Error("[data-header-right] not found");
    const anchorStyle = getComputedStyle(anchor);
    const clusterRect = rightCluster.getBoundingClientRect();
    return {
      rootFont: getComputedStyle(document.documentElement).fontSize,
      clusterRight: clusterRect.right,
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      anchorScrollWidth: anchor.scrollWidth,
      anchorClientWidth: anchor.clientWidth,
      anchorTitle: anchor.getAttribute("title"),
      anchorDisplay: anchorStyle.display,
      anchorTextOverflow: anchorStyle.textOverflow,
      anchorOverflowX: anchorStyle.overflowX,
      anchorWhiteSpace: anchorStyle.whiteSpace,
    };
  });
}

test.describe("header site-name ellipsis across every theme pack at 390px / 24px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every shipped theme pack keeps the header right cluster in-bounds and the site name safely truncated", async ({
    page,
  }) => {
    test.slow();

    await setFontPreference(page, FONT_PREFERENCE_PX);
    await page.goto(PAGE_PATH, { waitUntil: "load" });
    await waitForFonts(page);

    const packSlugs = await enabledPackSlugs(page);
    // Vacuous-pass guard: must genuinely enumerate every shipped pack, not a
    // truncated or empty list.
    expect(
      packSlugs.length,
      `expected at least 31 shipped theme packs, got ${packSlugs.length}: ${packSlugs.join(", ")}`,
    ).toBeGreaterThanOrEqual(31);
    for (const known of KNOWN_OVERFLOWING_PACKS) {
      expect(packSlugs, `"${known}" must be a shipped pack for its guard below to mean anything`).toContain(
        known,
      );
    }

    const failures: string[] = [];
    const overflowingPacks = new Set<string>();

    for (const packSlug of packSlugs) {
      await activatePack(page, packSlug);
      const m = await measurePack(page);

      // 1. Re-check the font-preference lever after every pack switch — a
      //    pack reload that silently lost the 24px override would make every
      //    assertion below pass for a reason unrelated to truncation.
      //
      //    A pack may legitimately scale the whole rem system up on the root
      //    element (`beacon` sets `font-size: 112.5%`, landing the 24px
      //    preference at 27px), so the lever is proven by the root font being
      //    AT LEAST the requested 24px, not exactly it — the un-levered
      //    baseline is 16px (18px under beacon's scale), far below either. A
      //    pack that scaled the rem system DOWN would trip this and needs an
      //    explicit per-pack baseline here rather than a loosened threshold.
      //
      //    Recorded but NOT `continue`d: skipping the pack on a lever anomaly
      //    would silently drop it from a sweep whose entire purpose is to
      //    cover every pack. The failure below still fails the test.
      const rootFontPx = Number.parseFloat(m.rootFont);
      if (!Number.isFinite(rootFontPx) || rootFontPx < FONT_PREFERENCE_PX) {
        failures.push(
          `${packSlug}: font-preference lever did not apply (root font is ${m.rootFont}, expected >= ${FONT_PREFERENCE_PX}px)`,
        );
      }

      // 2. The right-hand control cluster (and the document as a whole)
      //    must stay inside the 390px viewport.
      if (m.clusterRight > 390) {
        failures.push(`${packSlug}: [data-header-right] right edge is ${m.clusterRight}px (> 390px)`);
      }
      if (m.docScrollWidth > m.innerWidth) {
        failures.push(
          `${packSlug}: document scrollWidth ${m.docScrollWidth}px > innerWidth ${m.innerWidth}px`,
        );
      }

      // 3. The full site name must always be recoverable via `title`,
      //    regardless of whether this pack visually truncates it.
      if (m.anchorTitle !== LONG_SITE_NAME) {
        failures.push(
          `${packSlug}: anchor title is ${JSON.stringify(m.anchorTitle)}, expected ${JSON.stringify(LONG_SITE_NAME)}`,
        );
      }

      // 4. Only when the anchor is actually clipped does the ellipsis
      //    mechanism need to be present — an anchor with room to spare has
      //    nothing to prove here.
      const isOverflowing = m.anchorScrollWidth > m.anchorClientWidth;
      if (isOverflowing) {
        overflowingPacks.add(packSlug);
        if (m.anchorDisplay !== "block" && m.anchorDisplay !== "flow-root") {
          failures.push(
            `${packSlug}: overflowing anchor has display "${m.anchorDisplay}", expected block or flow-root`,
          );
        }
        if (m.anchorTextOverflow !== "ellipsis") {
          failures.push(
            `${packSlug}: overflowing anchor has text-overflow "${m.anchorTextOverflow}", expected ellipsis`,
          );
        }
        if (m.anchorOverflowX !== "hidden") {
          failures.push(
            `${packSlug}: overflowing anchor has overflow-x "${m.anchorOverflowX}", expected hidden`,
          );
        }
        if (m.anchorWhiteSpace !== "nowrap") {
          failures.push(
            `${packSlug}: overflowing anchor has white-space "${m.anchorWhiteSpace}", expected nowrap`,
          );
        }
      }
    }

    // Vacuous-pass guard: `swissgrid` and `riso` are the two packs already
    // known to overflow the anchor individually — "at least one pack
    // clips" would pass even if only one of them did. Folded into the same
    // `failures` list (rather than a separate `expect` per pack) so a guard
    // failure is reported alongside any real per-pack assertion failures
    // instead of masking them behind an earlier throw.
    for (const known of KNOWN_OVERFLOWING_PACKS) {
      if (!overflowingPacks.has(known)) {
        failures.push(
          `guard: "${known}" was expected to individually overflow the anchor at 390px/24px, but did not`,
        );
      }
    }

    expect(failures, `${failures.length} pack(s) failed:\n${failures.join("\n")}`).toEqual([]);
  });
});
