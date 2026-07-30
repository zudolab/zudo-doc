import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";
import {
  THEME_PACK_LINK_SELECTOR,
  THEME_PACK_LINK_LOADING_SELECTOR,
  closeFlyout,
  nextPackButton,
  openFlyout,
  waitForActivePack,
} from "./theme-pack-helpers";

/**
 * E2E regression for the theme-pack soft-nav FOUC (epic zudolab/zudo-doc#3136,
 * confirm sub-issue #3138).
 *
 * Bug: on a site with a non-default active theme pack, every SPA soft
 * navigation briefly flashed the DEFAULT zudo-doc chrome before the
 * theme-pack look returned. Cause: zfb's ClientRouter head swap removed the
 * runtime pack `<link>` because the incoming SSR head never carried a link
 * with a matching href — the swap's href-match persistence rule only keeps a
 * live head link in place when the INCOMING document already has one at the
 * same href, so the pack link was always spliced out, then (at best)
 * reinserted after paint by the after-swap fallback handler.
 *
 * Fix (`da3c9d9a5`): `buildThemePackBootstrap`
 * (`packages/zudo-doc/src/theme/theme-pack-provider.tsx`) now also registers
 * a `zfb:before-swap` listener that injects a matching
 * `<link data-zd-theme-pack-css>` into `event.newDocument.head` BEFORE zfb
 * runs the swap. The incoming document now satisfies the href-match rule, so
 * the LIVE (already loaded, already applied) link is never removed at all —
 * zero removal, zero refetch, zero unstyled frame. The after-swap handler
 * remains as fallback/cleanup only.
 *
 * Assertion technique (mirrors `sidebar-spa-nav-flash.spec.ts`'s header
 * comment): polling only the post-swap resting state cannot catch a flash —
 * by the time a poll observes it, a same-frame remove-then-reinsert would
 * already look identical to "never removed". Instead this spec proves the
 * invariant directly across the ENTIRE swap window:
 *   1. Stamp the live pack `<link>` with a JS marker property (proves element
 *      IDENTITY — a same-href replacement link would not carry the marker).
 *   2. Install a `MutationObserver` on `document.head` that records every
 *      removal of a `link[data-zd-theme-pack-css]` node, for the whole test
 *      (not just one swap) — a remove-then-reinsert is caught even if both
 *      happen inside the same task/frame, which rAF sampling could miss.
 *   3. Watch `<html data-theme-pack>` for any PAINT-VISIBLE wrong value, two
 *      ways: a `MutationObserver` that checks the settled value at each
 *      callback, plus a `requestAnimationFrame` sampler.
 *
 *      Deliberately NOT asserted here: the intermediate values a single
 *      mutation batch passes through. zfb's `swapRootAttributes`
 *      (`@takazudo/zfb-runtime/dist/client-router/swap-functions.js`) strips
 *      EVERY `<html>` attribute, applies the incoming document's, then
 *      re-applies the `preserveHtmlAttrs` set last — all in one synchronous
 *      function. So `data-theme-pack` provably transits
 *      `null` -> "default" -> "foundry" on every swap (measured: all three
 *      land in ONE observer callback, which is delivered at the microtask
 *      checkpoint AFTER the task completes). The browser cannot paint
 *      mid-task, so those intermediates are unobservable to a user — a
 *      per-record reconstruction would fail on correct code.
 *
 *      This is why the link and the attribute need DIFFERENT techniques. A
 *      same-task remove-then-reinsert of the `<link>` is a real flash: the
 *      reinserted stylesheet is non-blocking and applies asynchronously, so
 *      a frame paints unstyled. A same-task attribute churn is not: style
 *      resolution at paint time reads only the final value. Hence removal
 *      counting + identity for the link (step 2), settled/frame sampling for
 *      the attribute.
 * Both observers are installed ONCE, before the first navigation, and stay
 * attached across the swap (a soft nav keeps the same `window`/`document`
 * realm — that continuity is exactly what the bug exploited) — so the same
 * cumulative counters cover both the forward SPA nav and the subsequent
 * `page.goBack()` history traversal without re-arming.
 *
 * Routed to the `theme` fixture (port 4502, `themePackSwitcher: true`,
 * "foundry" pinned second in the fixture's `themePacks` cycle — see
 * `e2e/fixtures/theme/src/config/settings.ts`) via the `theme*` filename
 * prefix (testMatch convention, see `e2e/CLAUDE.md`).
 *
 * Navigation pair: the theme fixture ships a single real doc page
 * (`/docs/getting-started`), so the SPA hop below is doc page <-> home —
 * the same pair `theme-pack-switcher.spec.ts`'s own
 * "persists across an SPA navigation" test already relies on. The doc page's
 * breadcrumb renders a `href="/"` Home crumb (`packages/zudo-doc/src/breadcrumb`),
 * which is what `spaClick` clicks here.
 */

const DOC_PAGE = "/docs/getting-started";
const HOME = "/";

test.describe("Theme-pack SPA-nav flash (#3136 / #3138)", () => {
  test("the active pack's stylesheet link is never removed across an SPA navigation or a history traversal", async ({
    page,
  }) => {
    await page.goto(DOC_PAGE, { waitUntil: "load" });
    await openFlyout(page);
    await nextPackButton(page).click();
    await waitForActivePack(page, "foundry");
    await closeFlyout(page);

    // Precondition: the zero-flash guarantee assumes a committed link
    // already exists — start from a clean, settled state (no in-flight
    // loading-variant link left over from the switch).
    await expect(page.locator(THEME_PACK_LINK_SELECTOR)).toHaveCount(1);
    await expect(page.locator(THEME_PACK_LINK_LOADING_SELECTOR)).toHaveCount(0);

    // Stamp the live link's identity and arm both observers, once, before
    // the first navigation.
    const armed = await page.evaluate(() => {
      const link = document.querySelector<HTMLLinkElement>(
        "link[data-zd-theme-pack-css]",
      );
      if (!link) return false;

      const w = window as unknown as {
        __packLinkProbe__: {
          originalHref: string | null;
          linkRemovals: number;
          badSettledAttrs: string[];
          badFrameAttrs: string[];
          framesSampled: number;
        };
      };
      (link as unknown as Record<string, unknown>).__zdPackLinkMarker__ = true;
      w.__packLinkProbe__ = {
        originalHref: link.getAttribute("href"),
        linkRemovals: 0,
        badSettledAttrs: [],
        badFrameAttrs: [],
        framesSampled: 0,
      };

      const headObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.removedNodes)) {
            if (
              node instanceof HTMLElement &&
              node.matches("link[data-zd-theme-pack-css]")
            ) {
              w.__packLinkProbe__.linkRemovals += 1;
            }
          }
        }
      });
      headObserver.observe(document.head, { childList: true });

      // Callbacks fire at the microtask checkpoint, after the mutating task
      // has run to completion — so the value read here is the one the next
      // paint will use. A batch that SETTLES on the wrong value is a real
      // flash and is caught; intermediates within a batch are not (see the
      // header comment).
      const attrObserver = new MutationObserver(() => {
        const settled = document.documentElement.getAttribute("data-theme-pack");
        if (settled !== "foundry") {
          w.__packLinkProbe__.badSettledAttrs.push(String(settled));
        }
      });
      attrObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme-pack"],
      });

      // Direct paint-level evidence: sample at every rendering opportunity
      // for the rest of the test. Runs across both navigations.
      const sampleFrame = () => {
        w.__packLinkProbe__.framesSampled += 1;
        const value = document.documentElement.getAttribute("data-theme-pack");
        if (value !== "foundry") {
          w.__packLinkProbe__.badFrameAttrs.push(String(value));
        }
        requestAnimationFrame(sampleFrame);
      };
      requestAnimationFrame(sampleFrame);

      return true;
    });
    expect(armed).toBe(true);

    // Forward SPA navigation via the breadcrumb's Home link.
    const navigatedHome = await spaClick(page, HOME);
    expect(navigatedHome).toBe(true);
    await waitForActivePack(page, "foundry");

    await assertPackLinkNeverRemoved(page);

    // History traversal (browser back) shares the exact same swap path
    // (zfb's popstate handler runs the identical zfb:before-swap /
    // zfb:after-swap sequence) — re-assert the same invariants without
    // re-arming the head/attribute observers, since they are still attached.
    // `page.goBack()` resolves once the history URL commits, which can be
    // BEFORE zfb's swap has even started — and since data-theme-pack is
    // already "foundry" here, a plain waitForActivePack would pass
    // immediately without the swap ever running. Arm a zfb:after-swap wait
    // first (mirrors spaClick's technique) so the assertions genuinely
    // observe a completed back-navigation swap.
    await waitForAfterSwap(page, () => page.goBack());
    await waitForActivePack(page, "foundry");

    await assertPackLinkNeverRemoved(page);
  });
});

/**
 * Arm a one-shot `zfb:after-swap` listener, run `action` (e.g.
 * `page.goBack()`), then wait for the swap to actually complete. Mirrors
 * `spaClick`'s listener-then-wait shape in `nav-helpers.ts`; unlike
 * `spaClick`, `action` is a Playwright API call rather than an in-page click,
 * so there is no click-vs-listener race to guard against — the arm step is
 * awaited to completion before `action` runs.
 */
async function waitForAfterSwap(page: Page, action: () => Promise<unknown>): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __zfbBackSwapFired__?: boolean }).__zfbBackSwapFired__ = false;
    document.addEventListener(
      "zfb:after-swap",
      () => {
        (window as unknown as { __zfbBackSwapFired__?: boolean }).__zfbBackSwapFired__ = true;
      },
      { once: true },
    );
  });
  await action();
  await page.waitForFunction(
    () =>
      (window as unknown as { __zfbBackSwapFired__?: boolean }).__zfbBackSwapFired__ === true,
    undefined,
    { timeout: 10000 },
  );
}

/**
 * Read the cumulative probe state and assert the non-removal / identity /
 * attribute-continuity invariants. Safe to call repeatedly across multiple
 * navigations — the counters never reset.
 */
async function assertPackLinkNeverRemoved(page: Page) {
  const probe = await page.evaluate(() => {
    const w = window as unknown as {
      __packLinkProbe__: {
        originalHref: string | null;
        linkRemovals: number;
        badSettledAttrs: string[];
        badFrameAttrs: string[];
        framesSampled: number;
      };
    };
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>("link[data-zd-theme-pack-css]"),
    );
    const marked = links.filter(
      (link) => (link as unknown as Record<string, unknown>).__zdPackLinkMarker__ === true,
    );
    return {
      ...w.__packLinkProbe__,
      linkCount: links.length,
      markedCount: marked.length,
      markedConnected: marked.length === 1 ? marked[0]!.isConnected : false,
      markedHref: marked.length === 1 ? marked[0]!.getAttribute("href") : null,
    };
  });

  // The head MutationObserver never saw the pack link removed — not even
  // transiently within the same swap.
  expect(probe.linkRemovals).toBe(0);

  // Exactly one pack-link node exists, and it is THE SAME element that was
  // marked before the navigation (identity, not just a same-href
  // replacement) — still connected, with its href unchanged.
  expect(probe.linkCount).toBe(1);
  expect(probe.markedCount).toBe(1);
  expect(probe.markedConnected).toBe(true);
  expect(probe.markedHref).toBe(probe.originalHref);

  // The <html data-theme-pack> attribute never SETTLED on, nor was ever
  // painted at, any value other than the active slug across the whole swap
  // window. The frame count guards against a vacuous pass (an rAF sampler
  // that never ran would report no bad frames either).
  expect(probe.badSettledAttrs).toEqual([]);
  expect(probe.badFrameAttrs).toEqual([]);
  expect(probe.framesSampled).toBeGreaterThan(0);

  // No loading-variant link left dangling either.
  await expect(page.locator(THEME_PACK_LINK_LOADING_SELECTOR)).toHaveCount(0);
}
