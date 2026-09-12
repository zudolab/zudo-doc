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
 * SCOPE — the 24px/390 case is asserted against the sitemap, not the document.
 * A *document*-level assertion at 24px/390 cannot pass on this fixture for a
 * reason unrelated to this island: the header's right control cluster
 * (`div.ml-auto.flex.shrink-0`) sits at right edge 400.2 inside a 390px header,
 * because the row is a `whitespace-nowrap` site-name anchor (`flex: 0 0 auto`,
 * 180.2px at a 24px root) plus a `shrink-0` cluster (136px), neither of which can
 * compress. That reproduces on `/docs/getting-started` with no sitemap on the
 * page. It is tracked as #4163 and deliberately out of scope here — fixing it
 * needs a header/design decision that #4160 forbids bundling in. The remaining
 * document-level assertions (390/16 and 1600/24) are enforced in full below.
 */

/** The exact showcase label that overflowed; also this fixture page's title. */
const LONG_TITLE = "packages/zudo-doc/src/__tests__/fixtures/target-manifest/CLAUDE.md";

/** A path-shaped title on a root-level fixture page (depth-0 sitemap leaf). */
const ROOT_LONG_TITLE =
  "packages/zudo-doc/src/__tests__/fixtures/target-manifest/depth-0-CLAUDE.md";

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

/**
 * Worst content overflow inside the sitemap: how far any sitemap link's laid-out
 * content exceeds that link's own box.
 *
 * Measuring the right EDGE of the boxes would be a rubber stamp — the leaf `<a>`
 * is `display: block`, so its border box is constrained to the container and never
 * moves; it is the unbreakable text run *inside* it that spills, which is why the
 * document grew. `scrollWidth - clientWidth` is what actually reacts to
 * `overflow-wrap`, and it is the same quantity #4159 measured on production
 * (worst link 419 vs a 304 client width).
 */
async function measureSitemapContentOverflow(page: Page) {
  return page.evaluate(() => {
    const section = document.querySelector(".zd-home-sitemap");
    if (!section) throw new Error(".zd-home-sitemap not found");
    const worst = [section, ...section.querySelectorAll("a")]
      .map((el) => ({
        overflow: el.scrollWidth - el.clientWidth,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        label: (el.textContent ?? "").trim().slice(0, 60),
      }))
      .reduce((a, b) => (b.overflow > a.overflow ? b : a));
    return { ...worst, rootFont: getComputedStyle(document.documentElement).fontSize };
  });
}

/** Measure one sitemap link's laid-out content against its own box. */
async function measureSitemapLinkContentOverflow(page: Page, title: string) {
  return page.evaluate((expectedTitle) => {
    const link = [...document.querySelectorAll(".zd-home-sitemap a")].find(
      (el) => (el.textContent ?? "").trim() === expectedTitle,
    );
    if (!link) throw new Error(`sitemap link not found: ${expectedTitle}`);
    return {
      overflow: link.scrollWidth - link.clientWidth,
      scrollWidth: link.scrollWidth,
      clientWidth: link.clientWidth,
      label: (link.textContent ?? "").trim(),
      rootFont: getComputedStyle(document.documentElement).fontSize,
    };
  }, title);
}

/** `SiteTreeNav` is an `when: "idle"` island — wait for the long label to be laid out. */
async function gotoHomeAndAwaitSitemap(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".zd-home-sitemap a", { hasText: LONG_TITLE })).toBeVisible();
}

test.describe("home sitemap with 24px browser font preference", () => {
  test.use({ viewport: { width: 390, height: 1000 } });

  test("no sitemap content overflows its own box at 390px / 24px", async ({ page }) => {
    await setFontPreference(page, 24);
    await gotoHomeAndAwaitSitemap(page);

    const m = await measureSitemapContentOverflow(page);
    // Guards a vacuous pass: if the lever were silently inert the page would
    // render at 16px and the overflow assertion below would pass for free.
    expect(m.rootFont, "font-preference lever must have applied").toBe("24px");
    expect(
      m.overflow,
      `"${m.label}" content is ${m.scrollWidth}px wide in a ${m.clientWidth}px box`,
    ).toBeLessThanOrEqual(1);
  });

  test("depth-0 path-shaped leaf stays inside its box at 390px / 24px", async ({ page }) => {
    await setFontPreference(page, 24);
    await gotoHomeAndAwaitSitemap(page);
    await expect(page.locator(".zd-home-sitemap a", { hasText: ROOT_LONG_TITLE })).toBeVisible();

    const m = await measureSitemapLinkContentOverflow(page, ROOT_LONG_TITLE);
    expect(m.rootFont, "font-preference lever must have applied").toBe("24px");
    expect(
      m.overflow,
      `"${m.label}" content is ${m.scrollWidth}px wide in a ${m.clientWidth}px box`,
    ).toBeLessThanOrEqual(1);
  });
});

test.describe("home sitemap overflow controls", () => {
  test("no document overflow at 390px / 16px (default font preference)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await gotoHomeAndAwaitSitemap(page);

    const m = await measure(page);
    expect(m.rootFont, "control must run at the default preference").toBe("16px");
    expect(
      m.scrollWidth,
      `scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}`,
    ).toBeLessThanOrEqual(m.innerWidth);
  });

  test("no document overflow at 1600px / 24px", async ({ page }) => {
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
