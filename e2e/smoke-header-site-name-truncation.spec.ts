import { test, expect, type Page } from "@playwright/test";

/**
 * Regression gate for zudolab/zudo-doc#4287/#4288/#4289.
 *
 * At a 390px viewport with the browser font preference raised to 24px, the
 * header's right-control cluster (`[data-header-right]`) used to be pushed
 * past the 390px edge whenever the site name was long enough — the row was
 * mobile-toggle + `whitespace-nowrap` site-name anchor (`flex: 0 0 auto`) +
 * `shrink-0` control cluster, and nothing in it could shrink. #4288 made the
 * anchor `min-w-0 truncate` (with a `title` attribute carrying the full
 * name) and gave the mobile hamburger `shrink-0` so it can no longer absorb
 * the deficit either — the anchor is now the row's only flexible item, and a
 * width deficit is absorbed there as an ellipsis instead of an overflow.
 *
 * The smoke fixture's `siteName` was deliberately lengthened to "Smoke Test
 * Guide" (`e2e/fixtures/smoke/src/config/settings.ts`) so this is a genuine
 * end-to-end gate against real build output, not a synthetic DOM state —
 * approach (a) from #4289. Five other assertions elsewhere depend on the
 * exact string and were updated in lockstep: smoke-llms-txt.spec.ts:28,42 and
 * smoke-seo.spec.ts:8,15,49.
 *
 * The name was tuned (measured empirically, not guessed) to overflow the
 * header's available anchor box at 390px/24px (269px content in a 146px box
 * — 123px of margin, not borderline) while comfortably fitting at the
 * default 390px/16px (179px content in a 179px box). A longer candidate,
 * "Smoke Test Documentation", was tried first and rejected: it also
 * overflowed the UNRELATED home-hero heading (`zd-home-copy`/`<h1>`) at
 * 390px/24px, a pre-existing responsive gap that has nothing to do with the
 * header fix — tracked separately as #4297 rather than folded into this gate.
 *
 * The lever is CDP `Page.setFontSizes` — the browser's own font preference,
 * not zoom and not injected CSS — same technique as
 * smoke-home-sitemap-font-pref-overflow.spec.ts.
 *
 * Untagged on purpose: this spec IS the CI gate; `test:e2e:ci` filters out
 * `@flaky` / `@local-only` / `@verification`.
 */

/** The smoke fixture's (intentionally long) site name — keep in sync with
 *  `e2e/fixtures/smoke/src/config/settings.ts`. */
const LONG_SITE_NAME = "Smoke Test Guide";

async function setFontPreference(page: Page, px: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: px, fixed: px } });
}

async function measureAnchor(page: Page) {
  return page.evaluate(() => {
    const anchor = document.querySelector("[data-header-logo]");
    const rightCluster = document.querySelector("[data-header-right]");
    if (!anchor) throw new Error("[data-header-logo] not found");
    if (!rightCluster) throw new Error("[data-header-right] not found");
    const clusterRect = rightCluster.getBoundingClientRect();
    return {
      rootFont: getComputedStyle(document.documentElement).fontSize,
      anchorScrollWidth: anchor.scrollWidth,
      anchorClientWidth: anchor.clientWidth,
      anchorTitle: anchor.getAttribute("title"),
      anchorText: (anchor.textContent ?? "").trim(),
      clusterRight: clusterRect.right,
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
}

test.describe("header site-name truncation at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("long site name truncates so the right cluster and all four mobile controls fit at 390px / 24px", async ({
    page,
  }) => {
    await setFontPreference(page, 24);
    await page.goto("/docs/getting-started", { waitUntil: "domcontentloaded" });

    const m = await measureAnchor(page);
    // Guards a vacuous pass: if the lever were silently inert the page would
    // render at 16px and the assertions below would pass for a reason
    // unrelated to truncation.
    expect(m.rootFont, "font-preference lever must have applied").toBe("24px");

    // The bug this gate exists for: the right cluster must not be pushed
    // past the viewport edge.
    expect(
      m.clusterRight,
      `[data-header-right] right edge is ${m.clusterRight}px in a 390px viewport`,
    ).toBeLessThanOrEqual(390);
    expect(
      m.docScrollWidth,
      `document scrollWidth ${m.docScrollWidth} > innerWidth ${m.innerWidth}`,
    ).toBeLessThanOrEqual(m.innerWidth);

    // The fix mechanism: the anchor is genuinely clipped (not just narrower
    // by coincidence) and carries the full name in `title` as the a11y/UX
    // fallback for the truncated text.
    expect(
      m.anchorScrollWidth,
      `anchor content (${m.anchorScrollWidth}px) must exceed its box (${m.anchorClientWidth}px) — ` +
        `otherwise this proves nothing about truncation`,
    ).toBeGreaterThan(m.anchorClientWidth);
    expect(m.anchorTitle).toBe(LONG_SITE_NAME);

    // All four mobile right-cluster controls for the smoke fixture's
    // headerRightItems (design-token-panel trigger, ai-chat trigger,
    // github-link, search — theme-toggle is `hidden lg:flex` and absent
    // below 1024px, per zudolab/zudo-doc#4287's gotcha 2) must stay visible
    // and reachable, not just the cluster's outer box.
    const designTokenTrigger = page.locator("#design-token-trigger");
    const aiChatTrigger = page.locator("#ai-chat-trigger");
    const githubLink = page.locator('[data-header-right] a[href^="https://github.com/example/repo"]');
    const searchTrigger = page.locator("[data-open-search]");

    await expect(designTokenTrigger).toBeVisible();
    await expect(aiChatTrigger).toBeVisible();
    await expect(githubLink).toBeVisible();
    await expect(searchTrigger).toBeVisible();

    // `trial: true` runs Playwright's actionability checks (visible, stable,
    // receives pointer events, enabled) without dispatching the click —
    // proves "clickable" for the trigger/link controls without opening an
    // external tab or an AI chat panel this spec doesn't otherwise exercise.
    await designTokenTrigger.click({ trial: true });
    await aiChatTrigger.click({ trial: true });
    await githubLink.click({ trial: true });

    // The search control gets a real click, proving end-to-end interactivity
    // for at least one control: its dialog must actually open.
    await searchTrigger.click();
    await expect(page.locator("[data-search-dialog]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-dialog]")).not.toBeVisible();
  });

  test("long site name shows no ellipsis and no layout change at the default 16px font preference", async ({
    page,
  }) => {
    // No CDP call — the default (unmodified) browser font preference, i.e.
    // ordinary browsing. Proves the truncation CSS is overflow-safety, not a
    // forced clip: the same long name that must truncate at 24px renders in
    // full at the default size, so the common case is visually unchanged.
    await page.goto("/docs/getting-started", { waitUntil: "domcontentloaded" });

    const m = await measureAnchor(page);
    expect(m.rootFont, "must run at the default preference").toBe("16px");
    expect(m.anchorText).toBe(LONG_SITE_NAME);
    expect(
      m.anchorScrollWidth,
      `anchor content (${m.anchorScrollWidth}px) must fit its box (${m.anchorClientWidth}px) — ` +
        `an ellipsis here would mean truncation fires even when there is room`,
    ).toBeLessThanOrEqual(m.anchorClientWidth);
    expect(
      m.clusterRight,
      `[data-header-right] right edge is ${m.clusterRight}px in a 390px viewport`,
    ).toBeLessThanOrEqual(390);
  });
});
