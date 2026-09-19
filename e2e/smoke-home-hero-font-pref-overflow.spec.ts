import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * Regression gate for zudolab/zudo-doc#4297/#4302.
 *
 * At a 390px viewport with the browser font preference raised to 24px, a
 * home-hero site name containing a long unbreakable word made the document
 * scroll horizontally — `document.documentElement.scrollWidth` measured 433
 * in a 390px viewport, with the hero `<h1>` itself rendering 476px wide.
 *
 * Root cause: `packages/zudo-doc/src/home-page/index.tsx`'s hero `<h1>`
 * carried `break-words` (`overflow-wrap: break-word`), which does not
 * reduce a long word's min-content width and overrode the
 * `overflow-wrap: anywhere` the heading would otherwise have inherited from
 * `.zd-home-inner`. The fix is `wrap-anywhere`
 * (`overflow-wrap: anywhere`) declared directly on the `<h1>`.
 *
 * The smoke fixture's `siteName` is "Smoke Test Guide" (no long word — does
 * not reproduce, and must not be changed here: the header-truncation gate
 * in smoke-header-site-name-truncation.spec.ts depends on that exact
 * string). Instead, this spec overwrites the hero `<h1>`'s `textContent` via
 * `page.evaluate` after load — the hero is server-rendered outside any
 * island, so nothing re-renders it and the substituted text stays put.
 *
 * The lever is CDP `Page.setFontSizes` — the browser's own font preference,
 * not zoom and not injected CSS — same technique as
 * smoke-home-sitemap-font-pref-overflow.spec.ts /
 * smoke-header-site-name-truncation.spec.ts.
 *
 * Untagged on purpose: this spec IS the CI gate; `test:e2e:ci` filters out
 * `@flaky` / `@local-only` / `@verification`.
 */

async function setFontPreference(page: Page, px: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: px, fixed: px } });
}

async function setHeroHeadingText(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => {
    const heading = document.querySelector(".zd-home-copy h1");
    if (!heading) throw new Error(".zd-home-copy h1 not found");
    heading.textContent = value;
  }, text);
}

async function measureHero(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector(".zd-home-copy h1");
    if (!heading) throw new Error(".zd-home-copy h1 not found");
    const rect = heading.getBoundingClientRect();
    const style = getComputedStyle(heading);
    return {
      rootFont: getComputedStyle(document.documentElement).fontSize,
      headingRight: rect.right,
      headingHeight: rect.height,
      lineHeight: parseFloat(style.lineHeight),
      textOverflow: style.textOverflow,
      overflowHidden: style.overflow === "hidden",
      text: heading.textContent ?? "",
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
}

test.describe("home hero heading with a long word at 390px / 24px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const longSiteName of ["Smoke Test Documentation", "Supercalifragilisticexpialidocious"]) {
    test(`hero heading wraps instead of overflowing for "${longSiteName}"`, async ({ page }) => {
      await setFontPreference(page, 24);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await setHeroHeadingText(page, longSiteName);

      const m = await measureHero(page);
      // Guards a vacuous pass: if the lever were silently inert the page
      // would render at 16px and the assertions below would pass for a
      // reason unrelated to the font-preference overflow this gate exists
      // for.
      expect(m.rootFont, "font-preference lever must have applied").toBe("24px");
      expect(m.text, "hero heading substitution must have applied").toBe(longSiteName);

      // The bug this gate exists for: no horizontal document overflow.
      expect(
        m.docScrollWidth,
        `document scrollWidth ${m.docScrollWidth} > innerWidth ${m.innerWidth}`,
      ).toBeLessThanOrEqual(m.innerWidth);

      // The heading itself must stay inside the viewport.
      expect(
        m.headingRight,
        `hero <h1> right edge is ${m.headingRight}px in a 390px viewport`,
      ).toBeLessThanOrEqual(390);

      // The fix mechanism: the heading actually wrapped onto more than one
      // line rather than merely fitting on a single (impossibly narrow) run.
      expect(
        m.headingHeight,
        `hero <h1> height (${m.headingHeight}px) must exceed one line-height (${m.lineHeight}px) — otherwise it never wrapped`,
      ).toBeGreaterThan(m.lineHeight);

      // Forbidden per the issue's visual contract: no ellipsis, no clipping.
      expect(m.textOverflow).not.toBe("ellipsis");
      expect(m.overflowHidden).toBe(false);
    });
  }
});
