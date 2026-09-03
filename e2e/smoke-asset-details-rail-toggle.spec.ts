import { expect, test } from "./fixtures";
import { spaClick } from "./nav-helpers";

/**
 * E2E coverage for the asset details-rail collapse toggle (epic #3939,
 * #3941), confirmed here per #3942.
 *
 * Mirrors `sidebar-toc-toggle.spec.ts`'s structure, adapted to the asset
 * page's naming contract:
 *
 *   - html attribute: `data-asset-details-hidden` on `document.documentElement`
 *   - localStorage key: `zudo-doc-asset-details-visible` (only the exact
 *     value `"false"` means collapsed)
 *   - button hook: `[data-zd-asset-details-toggle]`
 *   - rail hook: `[data-zd-asset-details]`
 *   - breakpoint: lg / 1024px — the asset grid's OWN side-by-side switch,
 *     not the TOC toggle's xl/1280px
 */

// Mirrors ASSET_DETAILS_STORAGE_KEY / ASSET_DETAILS_HIDDEN_ATTR in
// packages/zudo-doc/src/asset-page/script.ts.
const ASSET_DETAILS_STORAGE_KEY = "zudo-doc-asset-details-visible";
const ASSET_DETAILS_HIDDEN_ATTR = "data-asset-details-hidden";

const CODE_ASSET = "/files/demo.js/";
// A non-asset doc page that carries a real, authored link into the asset
// viewer (see e2e/fixtures/smoke/src/content/docs/guides/asset-viewer-test.mdx),
// so the SPA-nav case below exercises a genuine cross-page-type transition.
const NON_ASSET_ORIGIN = "/docs/guides/asset-viewer-test";

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

test.describe("Asset details rail collapse toggle (#3941/#3942)", () => {
  test.describe("Real toggle interaction", () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test("clicking the toggle collapses the rail, updates the disclosure state and label, and persists; clicking again restores it", async ({
      page,
    }) => {
      await page.goto(CODE_ASSET, { waitUntil: "load" });

      const toggle = page.locator("[data-zd-asset-details-toggle]");
      await expect(toggle).toBeVisible();
      await expect(toggle).toBeEnabled({ timeout: 5000 });
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(toggle).toHaveAttribute("aria-label", "Hide details");

      await toggle.click();
      await page.waitForFunction(
        (attr) => document.documentElement.hasAttribute(attr),
        ASSET_DETAILS_HIDDEN_ATTR,
        { timeout: 5000 },
      );
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toHaveAttribute("aria-label", "Show details");
      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), ASSET_DETAILS_STORAGE_KEY))
        .toBe("false");

      await toggle.click();
      await page.waitForFunction(
        (attr) => !document.documentElement.hasAttribute(attr),
        ASSET_DETAILS_HIDDEN_ATTR,
        { timeout: 5000 },
      );
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(toggle).toHaveAttribute("aria-label", "Hide details");
      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), ASSET_DETAILS_STORAGE_KEY))
        .toBe("true");
    });
  });

  test.describe("Persistence / no flash", () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test("a hard reload with a stored collapsed preference never paints the rail open", async ({
      page,
    }) => {
      await page.goto(CODE_ASSET, { waitUntil: "load" });

      // Seed the collapsed preference via the real toggle so the persisted
      // value and the pre-paint script's expectations match production.
      await page.locator("[data-zd-asset-details-toggle]").click();
      await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), ASSET_DETAILS_STORAGE_KEY))
        .toBe("false");

      // rAF frame-sampling probe installed BEFORE the reload — attaching it
      // after goto/load would already be too late to catch a flash on the
      // new document's earliest frames. Mirrors
      // sidebar-hard-reload-flash.spec.ts's / sidebar-toc-toggle.spec.ts's
      // technique exactly.
      await page.addInitScript(() => {
        type Sample = { hidden: boolean; visibility: string | null };
        const probe: { samples: Sample[]; done: boolean } = { samples: [], done: false };
        (window as unknown as { __assetRailReloadProbe__: typeof probe }).__assetRailReloadProbe__ =
          probe;

        let framesAfterLoad = 0;
        const sample = () => {
          const html = document.documentElement;
          const el = document.querySelector("[data-zd-asset-details]");
          probe.samples.push({
            hidden: !!html && html.hasAttribute("data-asset-details-hidden"),
            visibility: el ? getComputedStyle(el).visibility : null,
          });
          if (probe.samples.length > 2000) {
            probe.done = true;
            return;
          }
          if (
            (window as unknown as { __assetRailReloadLoadFired__?: boolean })
              .__assetRailReloadLoadFired__
          ) {
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
            (
              window as unknown as { __assetRailReloadLoadFired__?: boolean }
            ).__assetRailReloadLoadFired__ = true;
          },
          { once: true },
        );

        requestAnimationFrame(sample);
      });

      await page.reload({ waitUntil: "load" });

      await page.waitForFunction(
        () =>
          (
            window as unknown as { __assetRailReloadProbe__?: { done: boolean } }
          ).__assetRailReloadProbe__?.done === true,
        undefined,
        { timeout: 10000 },
      );

      const samples = await page.evaluate(
        () =>
          (
            window as unknown as {
              __assetRailReloadProbe__?: { samples: unknown[] };
            }
          ).__assetRailReloadProbe__?.samples ?? [],
      );
      expect(samples.length).toBeGreaterThan(0);

      const presentSamples = (
        samples as Array<{ hidden: boolean; visibility: string | null }>
      ).filter((s) => s.visibility !== null);
      expect(presentSamples.length).toBeGreaterThan(0);

      // Every sampled frame where the rail exists must already carry the
      // hidden attribute — the pre-paint script (emitted in <head>, ahead of
      // the rail markup) has provably run by then.
      expect(presentSamples.every((s) => s.hidden)).toBe(true);
      // ...and the rail must already be at its settled hidden visibility —
      // never a visible intermediate frame (which would be a visible flash).
      expect(presentSamples.every((s) => s.visibility === "hidden")).toBe(true);
    });
  });

  test.describe("SPA-nav persistence — origin-page case", () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test("a stored collapsed preference applies on SPA entry from a non-asset page that never carried the attribute", async ({
      page,
    }) => {
      // `preserveHtmlAttrs` can only preserve an attribute that is ALREADY
      // present on <html> — a non-asset page never sets
      // data-asset-details-hidden, so this path exercises the controller's
      // own per-page storage read (#3941 D3 / the "known landmine" in #3939),
      // not attribute preservation across the SPA swap.
      await page.goto(NON_ASSET_ORIGIN, { waitUntil: "load" });
      await page.evaluate(
        (key) => localStorage.setItem(key, "false"),
        ASSET_DETAILS_STORAGE_KEY,
      );
      // Hard-load the non-asset page again so it starts life with the
      // collapsed preference already stored, exactly as the issue specifies.
      await page.reload({ waitUntil: "load" });
      await expect(
        page.locator("[data-zd-asset-details]"),
        "the origin page must not itself render an asset details rail",
      ).toHaveCount(0);

      const navigated = await spaClick(page, "/files/demo.js/");
      expect(navigated).toBe(true);
      await expect(page).toHaveURL(/\/files\/demo\.js\/$/);

      await expect
        .poll(() =>
          page.evaluate(
            (attr) => document.documentElement.hasAttribute(attr),
            ASSET_DETAILS_HIDDEN_ATTR,
          ),
        )
        .toBe(true);

      const rail = page.locator("[data-zd-asset-details]");
      await expect(rail).toHaveCSS("visibility", "hidden");
      await expect(page.locator("[data-zd-asset-details-toggle]")).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });

  test.describe("Storage disabled", () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test("the page still renders with the rail visible and the toggle still works for the session", async ({
      page,
    }) => {
      // Model private-mode/blocked-cookies storage: both getItem and setItem
      // throw, matching the unit-test fixture in
      // packages/zudo-doc/src/asset-page/__tests__/asset-page-script.test.ts.
      await page.addInitScript(() => {
        const throwing: Storage = {
          length: 0,
          clear: () => undefined,
          key: () => null,
          getItem: () => {
            throw new Error("storage disabled");
          },
          setItem: () => {
            throw new Error("storage disabled");
          },
          removeItem: () => undefined,
        };
        Object.defineProperty(window, "localStorage", {
          value: throwing,
          configurable: true,
        });
      });

      await page.goto(CODE_ASSET, { waitUntil: "load" });

      const rail = page.locator("[data-zd-asset-details]");
      const toggle = page.locator("[data-zd-asset-details-toggle]");
      await expect(rail).toBeVisible();
      await expect(rail).toHaveCSS("visibility", "visible");
      await expect(toggle).toBeEnabled({ timeout: 5000 });
      await expect(toggle).toHaveAttribute("aria-expanded", "true");

      // The toggle must still work for the SESSION even though nothing can
      // persist.
      await toggle.click();
      await page.waitForFunction(
        (attr) => document.documentElement.hasAttribute(attr),
        ASSET_DETAILS_HIDDEN_ATTR,
        { timeout: 5000 },
      );
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(rail).toHaveCSS("visibility", "hidden");
    });
  });
});
