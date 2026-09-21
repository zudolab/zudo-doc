import { test, expect } from "./fixtures";
import { openMobileDrawer } from "./mobile-drawer-helpers";

/**
 * E2E regression for the mobile sidebar toggle's icon visibility (#4355).
 *
 * Both toggle icons are always in the DOM (hydration byte-stability); only the
 * inactive one is hidden. That used to be Tailwind's `.hidden` utility. In a
 * consumer whose build emits utilities inside `@layer utilities`, an UNLAYERED
 * author reset — `img, svg, … { display: block }`, the shape component packs
 * commonly ship — outranks every layered rule by cascade-layer precedence
 * whatever the source order. Both icons then computed to `display: block`,
 * stacked, and doubled the toggle's height, showing X and hamburger at once.
 *
 * Reproducing that here takes one extra step: THIS repo's zfb build emits its
 * utilities unlayered, so a bare injected reset loses to `.hidden` on
 * specificity and the bug stays invisible (a test that injects only the reset
 * passes against the broken code). `layerSiteStylesheets` therefore re-inserts
 * the site stylesheet wrapped in a layer first, putting the page in exactly
 * the cascade position the reporting consumer's build produces. The assertion
 * is on computed style, so it fails for any hiding mechanism an unlayered
 * consumer rule can outrank.
 */

const DOC_PAGE = "/docs/getting-started";

// The bug reproduced at 390px — below the `lg:` (1024px) breakpoint, where the
// mobile toggle is the visible control.
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const UNLAYERED_MEDIA_RESET =
  "img,svg,video,canvas,audio,iframe,embed,object{display:block}";

// Matches the toggle in both states — its `aria-label` flips when open.
const TOGGLE =
  'button[aria-label="Open sidebar"], button[aria-label="Close sidebar"]';

/**
 * Re-insert every linked site stylesheet inside a cascade layer.
 *
 * Nothing about the rules changes — only their cascade origin tier — which is
 * what the reporting consumer's `create-zudo-sg` global-stylesheet contract
 * produces natively. The built CSS carries no `@import`, so wrapping it
 * wholesale is safe; nested `@layer` statements inside a layer block are
 * valid and keep their relative order.
 */
async function layerSiteStylesheets(page: import("@playwright/test").Page) {
  const layered = await page.evaluate(async () => {
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    );
    for (const link of links) {
      const css = await (await fetch(link.href)).text();
      const style = document.createElement("style");
      style.textContent = `@layer zd-consumer-utilities{${css}}`;
      link.after(style);
      link.remove();
    }
    return links.length;
  });
  // Guard the emulation itself: with no stylesheet re-layered the reset below
  // would lose on specificity and the test would pass vacuously.
  expect(layered).toBeGreaterThan(0);
}

test.describe("Mobile sidebar toggle under an unlayered consumer SVG reset", () => {
  test("shows only the active icon in both states and keeps its height", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(DOC_PAGE, { waitUntil: "load" });

    const toggle = page.locator(TOGGLE);
    await expect(toggle).toBeVisible();

    // DOM order is [X icon, hamburger icon].
    const displays = () =>
      toggle
        .locator("svg")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).display));

    const heightBefore = (await toggle.boundingBox())?.height;
    expect(heightBefore).toBeGreaterThan(0);

    await layerSiteStylesheets(page);
    await page.addStyleTag({ content: UNLAYERED_MEDIA_RESET });

    // Closed: X hidden, hamburger shown — and the control has not grown by a
    // second stacked icon.
    expect(await displays()).toEqual(["none", "block"]);
    expect((await toggle.boundingBox())?.height).toBe(heightBefore);

    // Open: the states swap, still with the reset in force. `openMobileDrawer`
    // retries the click as a unit, which is also the hydration proof.
    await openMobileDrawer(page);
    expect(await displays()).toEqual(["block", "none"]);
    expect((await toggle.boundingBox())?.height).toBe(heightBefore);
  });
});
