import { test, expect } from "@playwright/test";
import { spaClick } from "./nav-helpers";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E regression for the desktop sidebar SPA-navigation flash (#2198 / #2200).
 *
 * Bug: a CLOSED desktop sidebar briefly flashed open and animated shut on every
 * same-section SPA navigation. zfb's `swapRootAttributes` copied the incoming
 * server-rendered document's `<html>` attributes over the live root during the
 * body swap, dropping the runtime `data-sidebar-hidden` value — so for one frame
 * the CSS saw the sidebar as visible and the 200ms transitions began animating
 * it open.
 *
 * Fix (#2200): doc-layout now mounts
 * `<ClientRouter preserveHtmlAttrs={["data-sidebar-hidden", "data-theme"]} />`
 * (zfb-runtime >= 0.1.0-next.52, zfb#1104). The router re-applies those runtime
 * attributes within the same synchronous swap, before paint, so the attribute is
 * NEVER absent on a painted frame and the freshly-swapped `<aside>` renders
 * directly in its hidden state (a newly-inserted element has no prior computed
 * value to transition from). The host-side capture/restore +
 * `data-sidebar-no-transition` guard was retired.
 *
 * This fixture enables `sidebarToggle`, so the real persisted toggle island and
 * pre-paint script are present — unlike sidebar-toggle-layout.spec.ts, which
 * sets `data-sidebar-hidden` via page.evaluate against a fixture WITHOUT the
 * island and therefore cannot exercise the swap-time race at all.
 *
 * Assertion technique: we do NOT assert only the final resting state — a 200ms
 * transform settles back to hidden long before most polls, so a final-state
 * check would pass even with a visible flash. Instead we instrument the swap
 * window itself and prove the invariant directly:
 *   1. `data-sidebar-hidden` is present at before-preparation AND after-swap, and
 *      on EVERY rAF-sampled frame of the swap (the attribute is never wiped).
 *   2. On every frame where `#desktop-sidebar` exists, its computed transform is
 *      the settled hidden transform — i.e. the sidebar can never paint open.
 */

const START_PAGE = "/docs/guides/sub-a/page-1";
// Same getting-started/guides section, reachable via the sidebar nav tree —
// a genuine same-section SPA hop (the case the bug fired on).
const NEXT_PAGE = "/docs/guides/sub-a/page-2";

test.describe("Desktop sidebar SPA-nav flash (#2198 / #2200)", () => {
  test("closed sidebar's data-sidebar-hidden survives an SPA navigation (never flashes open)", async ({
    page,
  }) => {
    // >=1024px so the `lg:` desktop-sidebar rules (and the toggle) are active.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    await expect(sidebar).toHaveCount(1);

    // The fix is wired via the SSR meta the ClientRouter emits — assert it lists
    // data-sidebar-hidden, so a regression that drops the option fails loudly
    // here rather than only as a flaky timing failure below.
    const preserved = await page.evaluate(() => {
      const meta = document.querySelector(
        'meta[name="zfb-preserve-html-attrs"]',
      );
      return meta?.getAttribute("content") ?? null;
    });
    expect(preserved).not.toBeNull();
    expect(preserved!.toLowerCase()).toContain("data-sidebar-hidden");

    // Collapse the sidebar via the real toggle button and wait for the island
    // to commit `data-sidebar-hidden` on <html>.
    await page.locator(".zd-desktop-sidebar-toggle").click();
    await page.waitForFunction(
      () => document.documentElement.hasAttribute("data-sidebar-hidden"),
      undefined,
      { timeout: 5000 },
    );

    // Wait for the collapse animation to FULLY settle before snapshotting the
    // baseline. Clicking the toggle starts a 200ms transform transition, but
    // `data-sidebar-hidden` is committed on <html> immediately on click — so
    // waiting for the attribute alone races the animation and would snapshot a
    // mid-slide transform (e.g. -4px instead of the settled -320px). Poll the
    // computed transform until two consecutive reads are equal (stable).
    await page.waitForFunction(
      () => {
        const el = document.querySelector("#desktop-sidebar");
        if (!el) return false;
        const w = window as unknown as { __prevHiddenTransform__?: string };
        const cur = getComputedStyle(el).transform;
        const stable = w.__prevHiddenTransform__ === cur;
        w.__prevHiddenTransform__ = cur;
        return stable;
      },
      undefined,
      { timeout: 5000, polling: 100 },
    );

    // Record the now-settled hidden-state transform as the baseline.
    const hiddenTransform = await sidebar.evaluate(
      (el) => getComputedStyle(el).transform,
    );

    // Instrument the swap: rAF-sample, across the entire swap window, whether
    // `data-sidebar-hidden` is present on <html> and the sidebar's transform.
    // The before-preparation listener starts the sampler; the after-swap
    // listener records the boundary state. Sampling continues a few frames past
    // after-swap to cover the post-swap resting state.
    await page.evaluate(() => {
      const w = window as unknown as {
        __flashProbe__: {
          hiddenAtBeforePrep: boolean | null;
          hiddenAtAfterSwap: boolean | null;
          // One tuple per sampled frame, kept in lockstep so a frame where
          // #desktop-sidebar is momentarily absent (the aside is NOT persisted
          // across swaps — #1510) cannot desync the hidden flag vs transform.
          samples: Array<{ hidden: boolean; transform: string | null }>;
          done: boolean;
        };
      };
      w.__flashProbe__ = {
        hiddenAtBeforePrep: null,
        hiddenAtAfterSwap: null,
        samples: [],
        done: false,
      };
      const probe = w.__flashProbe__;
      const html = document.documentElement;

      let sampling = false;
      let framesAfterSwap = 0;
      const sample = () => {
        if (!sampling) return;
        const el = document.querySelector("#desktop-sidebar");
        probe.samples.push({
          hidden: html.hasAttribute("data-sidebar-hidden"),
          transform: el ? getComputedStyle(el).transform : null,
        });
        if (probe.hiddenAtAfterSwap !== null) {
          framesAfterSwap += 1;
          if (framesAfterSwap > 5) {
            sampling = false;
            probe.done = true;
            return;
          }
        }
        requestAnimationFrame(sample);
      };

      document.addEventListener(
        "zfb:before-preparation",
        () => {
          probe.hiddenAtBeforePrep = html.hasAttribute("data-sidebar-hidden");
          sampling = true;
          requestAnimationFrame(sample);
        },
        { once: true },
      );
      document.addEventListener(
        "zfb:after-swap",
        () => {
          probe.hiddenAtAfterSwap = html.hasAttribute("data-sidebar-hidden");
        },
        { once: true },
      );
    });

    // Perform the genuine SPA navigation.
    const navigated = await spaClick(page, NEXT_PAGE);
    expect(navigated).toBe(true);

    // Let the sampler finish (covers the post-swap resting state).
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __flashProbe__: { done: boolean } };
        return w.__flashProbe__.done === true;
      },
      undefined,
      { timeout: 5000 },
    );

    const probe = await page.evaluate(() => {
      const w = window as unknown as {
        __flashProbe__: {
          hiddenAtBeforePrep: boolean | null;
          hiddenAtAfterSwap: boolean | null;
          samples: Array<{ hidden: boolean; transform: string | null }>;
        };
      };
      return w.__flashProbe__;
    });

    // The attribute is present when the swap begins and STILL present once the
    // body has been swapped — i.e. zfb-runtime preserved it across the wipe.
    expect(probe.hiddenAtBeforePrep).toBe(true);
    expect(probe.hiddenAtAfterSwap).toBe(true);

    // The sampler must have actually run during the swap.
    expect(probe.samples.length).toBeGreaterThan(0);

    // `data-sidebar-hidden` must be present on EVERY painted frame of the swap —
    // there is no frame where the CSS could see the sidebar as visible.
    const hiddenEveryFrame = probe.samples.every((s) => s.hidden);
    expect(hiddenEveryFrame).toBe(true);

    // For every frame where the sidebar element existed, it was at the settled
    // hidden transform — never partially or fully open. (Frames where the aside
    // is momentarily absent contribute `transform: null` and are skipped.)
    const neverPaintedOpen = probe.samples.every(
      (s) => s.transform === null || s.transform === hiddenTransform,
    );
    expect(neverPaintedOpen).toBe(true);

    // Non-vacuous: at least one frame observed the sidebar present at the hidden
    // transform during the swap window.
    const observedHiddenSidebar = probe.samples.some(
      (s) => s.transform === hiddenTransform,
    );
    expect(observedHiddenSidebar).toBe(true);

    // After everything settles the sidebar is still hidden and at the exact
    // same hidden transform it had before the nav — never opened.
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.hasAttribute("data-sidebar-hidden"),
        ),
      )
      .toBe(true);
    const finalTransform = await sidebar.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(finalTransform).toBe(hiddenTransform);
  });
});
