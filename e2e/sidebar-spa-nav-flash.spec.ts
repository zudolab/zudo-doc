import { test, expect } from "@playwright/test";
import { spaClick } from "./nav-helpers";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E regression for the desktop sidebar SPA-navigation flash (#2198).
 *
 * Bug: a CLOSED desktop sidebar briefly flashed open and animated shut on every
 * same-section SPA navigation. zfb's `swapRootAttributes` wipes the
 * `data-sidebar-hidden` attribute off <html> during the body swap, so for one
 * frame the CSS saw the sidebar as visible and the 200ms transitions began
 * animating it open; the toggle island's `zfb:after-swap` restore then reversed
 * the animation (visible -> hidden slide). The net effect was a visible flash +
 * slide on a sidebar the user had deliberately collapsed.
 *
 * Fix: on `zfb:before-preparation` the persisted `DesktopSidebarToggle` island
 * adds a transient `data-sidebar-no-transition` marker on <html> that zeroes the
 * sidebar geometry transitions (global.css), and removes it on a double rAF
 * AFTER the `zfb:after-swap` restore — so the wipe and the restore both apply
 * instantly (no painted/animated frame) while a later user toggle still
 * animates normally.
 *
 * This fixture enables `sidebarToggle`, so the real persisted toggle island and
 * pre-paint script are present — unlike sidebar-toggle-layout.spec.ts, which
 * sets `data-sidebar-hidden` via page.evaluate against a fixture WITHOUT the
 * island and therefore cannot exercise the swap-time race at all.
 *
 * Assertion technique (per #2198 brief): we do NOT assert only the final
 * resting state — a 200ms transform settles back to hidden long before most
 * polls, so a final-state check would pass even with a visible flash. Instead
 * we instrument the swap window itself:
 *   1. Confirm the marker is active for the full duration of the swap (set on
 *      before-preparation, still present at after-swap).
 *   2. rAF-sample `getComputedStyle(#desktop-sidebar).transitionProperty`
 *      throughout the swap and assert it is `none` on every frame — i.e. the
 *      sidebar geometry can never animate while the swap is in flight.
 */

const START_PAGE = "/docs/guides/sub-a/page-1";
// Same getting-started/guides section, reachable via the sidebar nav tree —
// a genuine same-section SPA hop (the case the bug fired on).
const NEXT_PAGE = "/docs/guides/sub-a/page-2";

test.describe("Desktop sidebar SPA-nav flash (#2198)", () => {
  test("closed sidebar never animates across an SPA navigation", async ({
    page,
  }) => {
    // >=1024px so the `lg:` desktop-sidebar rules (and the toggle) are active.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    await expect(sidebar).toHaveCount(1);

    // Collapse the sidebar via the real toggle button and wait for the island
    // to commit `data-sidebar-hidden` on <html>.
    await page.locator(".zd-desktop-sidebar-toggle").click();
    await page.waitForFunction(
      () => document.documentElement.hasAttribute("data-sidebar-hidden"),
      undefined,
      { timeout: 5000 },
    );

    // Record the hidden-state transform as the baseline. The transition itself
    // has already settled here (we waited for the attribute, and the click
    // animation has completed by hydration + attribute wait).
    const hiddenTransform = await sidebar.evaluate(
      (el) => getComputedStyle(el).transform,
    );

    // Instrument the swap: install probes that (a) record marker presence at the
    // two swap boundaries and (b) rAF-sample the sidebar's transition-property
    // across the entire swap window. The before-preparation listener starts the
    // sampler; the after-swap listener records the boundary state. Sampling
    // continues for a few extra frames after after-swap to cover the double-rAF
    // marker removal so we also prove the marker is gone afterwards.
    await page.evaluate(() => {
      const w = window as unknown as {
        __flashProbe__: {
          markerAtBeforePrep: boolean | null;
          markerAtAfterSwap: boolean | null;
          // One tuple per sampled frame, kept in lockstep so a frame where
          // #desktop-sidebar is momentarily absent (the aside is NOT persisted
          // across swaps — #1510) cannot desync marker vs transition.
          samples: Array<{ marker: boolean; transition: string | null }>;
          done: boolean;
        };
      };
      w.__flashProbe__ = {
        markerAtBeforePrep: null,
        markerAtAfterSwap: null,
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
          marker: html.hasAttribute("data-sidebar-no-transition"),
          transition: el ? getComputedStyle(el).transitionProperty : null,
        });
        // Stop a few frames after after-swap so we also capture the marker
        // removal (double rAF) and the post-swap resting state.
        if (probe.markerAtAfterSwap !== null) {
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
          probe.markerAtBeforePrep = html.hasAttribute(
            "data-sidebar-no-transition",
          );
          sampling = true;
          requestAnimationFrame(sample);
        },
        { once: true },
      );
      document.addEventListener(
        "zfb:after-swap",
        () => {
          probe.markerAtAfterSwap = html.hasAttribute(
            "data-sidebar-no-transition",
          );
        },
        { once: true },
      );
    });

    // Perform the genuine SPA navigation.
    const navigated = await spaClick(page, NEXT_PAGE);
    expect(navigated).toBe(true);

    // Let the sampler finish (covers the post-swap double-rAF marker removal).
    await page.waitForFunction(() => {
      const w = window as unknown as { __flashProbe__: { done: boolean } };
      return w.__flashProbe__.done === true;
    }, undefined, { timeout: 5000 });

    const probe = await page.evaluate(() => {
      const w = window as unknown as {
        __flashProbe__: {
          markerAtBeforePrep: boolean | null;
          markerAtAfterSwap: boolean | null;
          samples: Array<{ marker: boolean; transition: string | null }>;
        };
      };
      return w.__flashProbe__;
    });

    // The marker must be set the moment the swap begins and still present when
    // the body has been swapped + the attribute restored — i.e. it brackets the
    // entire wipe/restore race.
    expect(probe.markerAtBeforePrep).toBe(true);
    expect(probe.markerAtAfterSwap).toBe(true);

    // The sampler must have actually run during the swap.
    expect(probe.samples.length).toBeGreaterThan(0);

    // While the marker is active, the sidebar geometry transition must be
    // suppressed — so no frame can paint a partially-open sidebar. For every
    // frame where the marker was present AND the sidebar element existed, its
    // computed transition-property must be `none`. (Frames where the aside is
    // momentarily absent contribute `transition: null` and are skipped — they
    // cannot paint a sidebar anyway.)
    const suppressedWhileMarked = probe.samples.every(
      (s) => !s.marker || s.transition === null || s.transition === "none",
    );
    expect(suppressedWhileMarked).toBe(true);

    // The probe must have actually observed the marker active on at least one
    // frame with the sidebar present (otherwise the suppression check above is
    // vacuously true).
    const observedSuppression = probe.samples.some(
      (s) => s.marker && s.transition === "none",
    );
    expect(observedSuppression).toBe(true);

    // The marker is eventually removed (double rAF after after-swap), so a later
    // user toggle still animates. The tail of the samples must show it gone.
    const lastSample = probe.samples[probe.samples.length - 1];
    expect(lastSample?.marker).toBe(false);

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
