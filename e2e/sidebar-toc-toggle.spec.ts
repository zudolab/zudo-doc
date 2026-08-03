import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";

/**
 * E2E coverage for the desktop TOC visibility toggle (epic #3252, #3257).
 *
 * 1:1 mirror of the desktop sidebar toggle's own e2e coverage
 * (`sidebar-toggle-layout.spec.ts` + `sidebar-hard-reload-flash.spec.ts`),
 * adapted to the TOC's naming contract and xl/1280px breakpoint:
 *
 *   - html attribute: `data-toc-hidden` on `document.documentElement`
 *   - localStorage key: `zudo-doc-toc-visible` (TOC_STORAGE_KEY)
 *   - button hook class: `.zd-desktop-toc-toggle`
 *   - TOC column hook class: `.zd-toc-col`
 *   - breakpoint: xl / 1280px — NOT the sidebar's lg/1024px
 *
 * Both `START_PAGE` and `NEXT_PAGE` carry `## ` headings so the package's
 * default TOC (`shouldRenderToc = !hideToc && headings.length > 0`) actually
 * renders on each — a SPA-nav persistence test between two headless pages
 * would prove nothing (see e2e/fixtures/sidebar/src/content/docs/guides/sub-a/
 * page-1.mdx and page-2.mdx).
 */

const START_PAGE = "/docs/guides/sub-a/page-1";
// Same guides/sub-a section, reachable via the sidebar nav tree, and — like
// START_PAGE — carries headings so its default TOC actually renders.
const NEXT_PAGE = "/docs/guides/sub-a/page-2";

// Mirrors TOC_STORAGE_KEY in
// packages/zudo-doc/src/desktop-toc-toggle-island/index.tsx.
const TOC_STORAGE_KEY = "zudo-doc-toc-visible";

// The xl breakpoint (1280px) the TOC toggle CSS gates on — NOT the sidebar's
// lg/1024px breakpoint.
const XL_VIEWPORT = { width: 1400, height: 900 };
const SUB_XL_VIEWPORT = { width: 1024, height: 900 };

test.describe("Desktop TOC toggle (#3252)", () => {
  test.describe("Attribute-driven layout", () => {
    test("hiding the TOC collapses the column, zeroes the band gap, and grows main", async ({
      page,
    }) => {
      await page.setViewportSize(XL_VIEWPORT);
      await page.goto(START_PAGE, { waitUntil: "load" });

      const tocCol = page.locator(".zd-toc-col");
      const band = page.locator(".zd-doc-content-band");
      const main = page.locator("main");
      await expect(tocCol).toHaveCount(1);
      await expect(band).toHaveCount(1);

      // TOC shown: non-zero column width and band gap.
      const shownTocWidth = await tocCol.evaluate((el) => getComputedStyle(el).width);
      expect(shownTocWidth).not.toBe("0px");
      const shownGap = await band.evaluate((el) => getComputedStyle(el).columnGap);
      expect(shownGap).not.toBe("0px");
      const shownMainWidth = await main.evaluate((el) => el.getBoundingClientRect().width);

      // Simulate the toggle hiding the TOC.
      await page.evaluate(() => {
        document.documentElement.setAttribute("data-toc-hidden", "");
      });

      // Column collapses to zero width...
      await expect(tocCol).toHaveCSS("width", "0px");
      // ...band gap collapses to zero (":has(> .zd-toc-col)" scoped rule)...
      await expect(band).toHaveCSS("column-gap", "0px");
      // ...and `main` (flex-1 min-w-0) absorbs the freed width itself — the
      // expand-main policy: no band max-width rule is keyed on
      // data-toc-hidden.
      const hiddenMainWidth = await main.evaluate((el) => el.getBoundingClientRect().width);
      expect(hiddenMainWidth).toBeGreaterThan(shownMainWidth);
    });
  });

  test.describe("Real toggle interaction", () => {
    test("clicking the button hides the TOC and persists, clicking again restores it", async ({
      page,
    }) => {
      await page.setViewportSize(XL_VIEWPORT);
      await page.goto(START_PAGE, { waitUntil: "load" });

      const toggle = page.locator(".zd-desktop-toc-toggle");
      await expect(toggle).toBeVisible();

      await toggle.click();
      await page.waitForFunction(
        () => document.documentElement.hasAttribute("data-toc-hidden"),
        undefined,
        { timeout: 5000 },
      );
      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), TOC_STORAGE_KEY))
        .toBe("false");

      await toggle.click();
      await page.waitForFunction(
        () => !document.documentElement.hasAttribute("data-toc-hidden"),
        undefined,
        { timeout: 5000 },
      );
      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), TOC_STORAGE_KEY))
        .toBe("true");
    });
  });

  test.describe("Persistence / no flash", () => {
    test("a hard reload with a stored hidden preference never paints the TOC open", async ({
      page,
    }) => {
      await page.setViewportSize(XL_VIEWPORT);
      await page.goto(START_PAGE, { waitUntil: "load" });

      // Seed the collapsed preference via the real toggle so the persisted
      // value and the pre-paint script's expectations match production.
      await page.locator(".zd-desktop-toc-toggle").click();
      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), TOC_STORAGE_KEY))
        .toBe("false");

      // rAF frame-sampling probe installed BEFORE the reload — attaching it
      // after goto/load would already be too late to catch a flash on the
      // new document's earliest frames. Mirrors
      // sidebar-hard-reload-flash.spec.ts's technique exactly.
      await page.addInitScript(() => {
        type Sample = { hidden: boolean; width: string | null };
        const probe: { samples: Sample[]; done: boolean } = { samples: [], done: false };
        (window as unknown as { __tocReloadProbe__: typeof probe }).__tocReloadProbe__ = probe;

        let framesAfterLoad = 0;
        const sample = () => {
          const html = document.documentElement;
          const el = document.querySelector(".zd-toc-col");
          probe.samples.push({
            hidden: !!html && html.hasAttribute("data-toc-hidden"),
            width: el ? getComputedStyle(el).width : null,
          });
          if (probe.samples.length > 2000) {
            probe.done = true;
            return;
          }
          if ((window as unknown as { __tocReloadLoadFired__?: boolean }).__tocReloadLoadFired__) {
            framesAfterLoad += 1;
            if (framesAfterLoad > 10) {
              probe.done = true;
              return;
            }
          }
          requestAnimationFrame(sample);
        };

        window.addEventListener(
          "load",
          () => {
            (window as unknown as { __tocReloadLoadFired__?: boolean }).__tocReloadLoadFired__ = true;
          },
          { once: true },
        );

        requestAnimationFrame(sample);
      });

      await page.reload({ waitUntil: "load" });

      await page.waitForFunction(
        () =>
          (window as unknown as { __tocReloadProbe__?: { done: boolean } }).__tocReloadProbe__
            ?.done === true,
        undefined,
        { timeout: 10000 },
      );

      const samples = await page.evaluate(
        () =>
          (window as unknown as { __tocReloadProbe__?: { samples: unknown[] } }).__tocReloadProbe__
            ?.samples ?? [],
      );
      expect(samples.length).toBeGreaterThan(0);

      const presentSamples = (samples as Array<{ hidden: boolean; width: string | null }>).filter(
        (s) => s.width !== null,
      );
      expect(presentSamples.length).toBeGreaterThan(0);

      // Every sampled frame where `.zd-toc-col` exists must already carry
      // `data-toc-hidden` — the pre-paint script (emitted in <head>, ahead of
      // the TOC column markup) has provably run by then.
      expect(presentSamples.every((s) => s.hidden)).toBe(true);
      // ...and the column must already be at its settled collapsed width —
      // never a wider intermediate value (which would be a visible flash).
      expect(presentSamples.every((s) => s.width === "0px")).toBe(true);
    });
  });

  test.describe("SPA-nav persistence", () => {
    test("hiding the TOC survives an SPA navigation to another page with a default TOC", async ({
      page,
    }) => {
      await page.setViewportSize(XL_VIEWPORT);
      await page.goto(START_PAGE, { waitUntil: "load" });

      await page.locator(".zd-desktop-toc-toggle").click();
      await page.waitForFunction(
        () => document.documentElement.hasAttribute("data-toc-hidden"),
        undefined,
        { timeout: 5000 },
      );

      const navigated = await spaClick(page, NEXT_PAGE);
      expect(navigated).toBe(true);

      await expect
        .poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-toc-hidden")))
        .toBe(true);

      // The destination page also renders a default TOC (it has headings) —
      // confirm ITS `.zd-toc-col` is collapsed too, not just the attribute.
      const tocCol = page.locator(".zd-toc-col");
      await expect(tocCol).toHaveCount(1);
      await expect(tocCol).toHaveCSS("width", "0px");
    });
  });

  test.describe("Breakpoint", () => {
    test("the toggle button is not visible below xl (1280px)", async ({ page }) => {
      await page.setViewportSize(SUB_XL_VIEWPORT);
      await page.goto(START_PAGE, { waitUntil: "load" });

      await expect(page.locator(".zd-desktop-toc-toggle")).not.toBeVisible();
    });
  });
});
