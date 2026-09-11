import { test, expect, type Page } from "@playwright/test";

/**
 * Regression gate for zudolab/zudo-doc#4160 (source #4134).
 *
 * At a 390px viewport with the *browser font preference* raised to 24px, the
 * homepage sitemap overflowed the document horizontally. The cause was a single
 * unbreakable path-shaped leaf label in `SiteTreeNav`
 * (`packages/zudo-doc/src/site-tree-nav-island/index.tsx`, `LeafNode`): Chromium
 * offers no soft-wrap opportunity after `/` or `_`, so the label rendered as one
 * ~346px-wide run inside a ~219px content box. The fix is `break-words` on the
 * leaf `<a>`, mirroring `sidebar-tree-island`, which already carries it and
 * therefore never reproduced.
 *
 * The lever is CDP `Page.setFontSizes` — the browser's own font preference, not
 * zoom and not injected CSS. It is honoured by Playwright's default headless
 * shell, so this spec needs no `channel`, no extra project, and no headed run.
 *
 * Untagged on purpose: this spec IS the CI gate, and `test:e2e:ci` filters out
 * `@flaky` / `@local-only` / `@verification`.
 *
 * KNOWN RED — second, independent defect (not #4160's sitemap bug).
 * The two 24px/390 tests below still fail after the `break-words` fix, by 10.2px.
 * The residual overflow is the header's right control cluster
 * (`div.ml-auto.flex.shrink-0`, right edge 400.2 inside a 390px header). The header
 * row is `whitespace-nowrap` site name (`flex: 0 0 auto`, 180.2px at a 24px root) +
 * `shrink-0` control cluster (136px) + the mobile toggle — none of which can
 * compress, so the row cannot fit 390px once rem-based type scales to a 24px
 * preference. It reproduces on `/docs/getting-started` too, with no sitemap on the
 * page, so it is entirely independent of this island.
 *
 * #4159 measured the *showcase* header clean at 24px/390 and #4160 therefore forbids
 * touching the header. The smoke fixture's `siteName` is "Smoke Test" (10 chars) vs
 * the showcase's "zudo-doc" (8), which is why the fixture reproduces what production
 * does not. Fixing it needs a header change — out of #4160's locked scope, pending a
 * scope decision.
 */

/** The exact showcase label that overflowed; also this fixture page's title. */
const LONG_TITLE = "packages/zudo-doc/src/__tests__/fixtures/target-manifest/CLAUDE.md";

async function setFontPreference(page: Page, px: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: px, fixed: px } });
}

async function measure(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    rootFont: getComputedStyle(document.documentElement).fontSize,
  }));
}

/** `SiteTreeNav` is an `when: "idle"` island — wait for the long label to be laid out. */
async function gotoHomeAndAwaitSitemap(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".zd-home-sitemap a", { hasText: LONG_TITLE })).toBeVisible();
}

test.describe("home sitemap with 24px browser font preference", () => {
  test.use({ viewport: { width: 390, height: 1000 } });

  test("no document horizontal overflow at 390px / 24px", async ({ page }) => {
    await setFontPreference(page, 24);
    await gotoHomeAndAwaitSitemap(page);

    const m = await measure(page);
    // Guards a vacuous pass: if the lever were silently inert the page would
    // render at 16px and the overflow assertion below would pass for free.
    expect(m.rootFont, "font-preference lever must have applied").toBe("24px");
    expect(
      m.scrollWidth,
      `scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}`,
    ).toBeLessThanOrEqual(m.innerWidth);
  });

  test("header controls stay inside the viewport and search still opens at 390px / 24px", async ({
    page,
  }) => {
    await setFontPreference(page, 24);
    await gotoHomeAndAwaitSitemap(page);

    expect((await measure(page)).rootFont, "font-preference lever must have applied").toBe("24px");

    const escaped = await page.evaluate(
      () =>
        [...document.querySelectorAll("header a, header button")]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5)).length,
    );
    expect(escaped, "no header control may sit outside the viewport").toBe(0);

    // Same lever smoke-search.spec.ts uses to open the dialog.
    await page.keyboard.press("Control+k");
    await expect(page.locator("[data-search-dialog]")).toBeVisible();
  });
});

test.describe("home sitemap overflow controls", () => {
  test("no overflow at 390px / 16px (default font preference)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await gotoHomeAndAwaitSitemap(page);

    const m = await measure(page);
    expect(m.rootFont, "control must run at the default preference").toBe("16px");
    expect(
      m.scrollWidth,
      `scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}`,
    ).toBeLessThanOrEqual(m.innerWidth);
  });

  test("no overflow at 1600px / 24px", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await setFontPreference(page, 24);
    await gotoHomeAndAwaitSitemap(page);

    const m = await measure(page);
    expect(m.rootFont, "font-preference lever must have applied").toBe("24px");
    expect(
      m.scrollWidth,
      `scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}`,
    ).toBeLessThanOrEqual(m.innerWidth);
  });
});
