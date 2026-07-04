import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E regression for the desktop sidebar HARD-RELOAD flash (#2571 / #2575),
 * verifying #2577.
 *
 * Bug (#2571): a collapsed desktop sidebar briefly painted OPEN and animated
 * shut on a hard (full-document) reload. The `data-sidebar-hidden` restore
 * script originally lived near the end of `<body>` (afterSidebar slot) —
 * late enough that the browser could paint the expanded `<aside>` before the
 * script ran.
 *
 * Fix (#2575): the pre-paint script (`SIDEBAR_VISIBILITY_PREPAINT_SCRIPT` in
 * `packages/zudo-doc/src/sidebar-prepaint/index.tsx`) is now hoisted into the
 * page `<head>`, ahead of the `<aside id="desktop-sidebar">` markup, so it
 * commits `data-sidebar-hidden` on `<html>` before the sidebar is parsed or
 * painted. That fix was previously guarded only *structurally* (a unit test
 * asserting script-before-aside ordering in the emitted HTML) — this spec
 * adds the missing frame-level guard for the real hard-reload path, mirroring
 * the rAF frame-sampling technique `sidebar-spa-nav-flash.spec.ts` already
 * uses for the SPA-nav flash.
 *
 * Mechanism baked into the assertions:
 *   - Hidden state = attribute `data-sidebar-hidden` (empty string) on
 *     `document.documentElement`.
 *   - Persisted preference = `localStorage["zudo-doc-sidebar-visible"]`;
 *     collapsed = the exact string `"false"`.
 *   - Collapse CSS (`@media (min-width: 1024px)` in
 *     `packages/zudo-doc/src/features.css`):
 *     `html[data-sidebar-hidden] #desktop-sidebar { transform:
 *     translateX(calc(-1 * var(--zd-sidebar-w))); visibility: hidden; }`
 *     with a ~200ms `transform`/`visibility` transition — a late-applied
 *     attribute yields a visible open-to-shut slide (the flash); a
 *     pre-paint-applied attribute means the aside is born hidden with no
 *     transition to observe.
 *
 * Assertion technique: a final-state check alone would pass even with a
 * visible flash (the transition settles back to hidden well before any poll
 * could observe it). Instead we install an rAF sampler via
 * `page.addInitScript(...)` BEFORE the hard reload — this is the crux: a
 * sampler attached after `goto`/`load` runs is already too late, since the
 * flash (if any) happens on the very first painted frames of the new
 * document. The init script starts sampling at document-creation time (the
 * earliest point script can run) and records, per rAF-scheduled frame,
 * whether `<html>` carries `data-sidebar-hidden` and the computed transform
 * of `#desktop-sidebar`.
 */

const START_PAGE = "/docs/guides/sub-a/page-1";
// Same getting-started/guides section, reachable via the sidebar nav tree —
// used for the SPA-nav sanity case.
const NEXT_PAGE = "/docs/guides/sub-a/page-2";

// Mirrors SIDEBAR_STORAGE_KEY in
// packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx.
const SIDEBAR_STORAGE_KEY = "zudo-doc-sidebar-visible";

type HardReloadSample = { hidden: boolean; transform: string | null };
type HardReloadProbe = { samples: HardReloadSample[]; done: boolean };

declare global {
  interface Window {
    __hardReloadProbe__?: HardReloadProbe;
    __hardReloadLoadFired__?: boolean;
  }
}

test.describe("Desktop sidebar hard-reload flash (#2571 / #2575 / #2577)", () => {
  test.beforeEach(async ({ page }) => {
    // >=1280px per the #2577 checklist, comfortably inside the `lg:`
    // (>=1024px) desktop-sidebar breakpoint.
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("toggle persists to storage, and a hard reload never paints the collapsed sidebar open", async ({
    page,
  }) => {
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    await expect(sidebar).toHaveCount(1);

    // --- Checklist item 1: the real toggle writes the persisted preference ---
    await page.locator(".zd-desktop-sidebar-toggle").click();
    await expect
      .poll(() =>
        page.evaluate(
          (key) => localStorage.getItem(key),
          SIDEBAR_STORAGE_KEY,
        ),
      )
      .toBe("false");
    await page.waitForFunction(
      () => document.documentElement.hasAttribute("data-sidebar-hidden"),
      undefined,
      { timeout: 5000 },
    );

    // Wait for the collapse animation to FULLY settle before snapshotting the
    // baseline transform. `data-sidebar-hidden` commits immediately on click,
    // but the 200ms transform transition needs to finish or we'd capture a
    // mid-slide value instead of the settled hidden transform. Poll the
    // computed transform until two consecutive reads are equal (stable) —
    // same technique as sidebar-spa-nav-flash.spec.ts.
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

    const hiddenTransform = await sidebar.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(hiddenTransform).not.toBe("none");

    // --- Install the rAF probe BEFORE the hard reload (the crux: attaching
    // this after goto/load would already be too late to catch the flash on
    // the new document's earliest frames). `addInitScript` runs at document
    // creation, ahead of every other page script (including the pre-paint
    // script this spec verifies). ---
    await page.addInitScript(() => {
      const probe: HardReloadProbe = { samples: [], done: false };
      window.__hardReloadProbe__ = probe;

      let framesAfterLoad = 0;
      const sample = () => {
        // `addInitScript` runs at document-creation, BEFORE `<html>` is parsed,
        // so `document.documentElement` can be null on the earliest rAF frames
        // (and `#desktop-sidebar` even longer). Read both per-frame and
        // null-guard — a frame with no sidebar element can't paint a flash, so
        // it's simply recorded as `transform: null` and excluded from the
        // per-frame assertions below (which key off sidebar-present frames).
        const html = document.documentElement;
        const el = document.querySelector("#desktop-sidebar");
        probe.samples.push({
          hidden: !!html && html.hasAttribute("data-sidebar-hidden"),
          transform: el ? getComputedStyle(el).transform : null,
        });
        if (probe.samples.length > 2000) {
          // Safety valve — never spin forever if `load` never fires.
          probe.done = true;
          return;
        }
        if (window.__hardReloadLoadFired__) {
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
          window.__hardReloadLoadFired__ = true;
        },
        { once: true },
      );

      requestAnimationFrame(sample);
    });

    // --- Hard reload: full document navigation, not an SPA swap. ---
    await page.reload({ waitUntil: "load" });

    await page.waitForFunction(
      () => window.__hardReloadProbe__?.done === true,
      undefined,
      { timeout: 10000 },
    );

    const samples = await page.evaluate(
      () => window.__hardReloadProbe__?.samples ?? [],
    );

    // The sampler must have actually run.
    expect(samples.length).toBeGreaterThan(0);

    // Non-vacuous guard: the sidebar element was actually observed present
    // in at least one sampled frame (otherwise the assertions below would
    // trivially pass on an absent element).
    const presentSamples = samples.filter((s) => s.transform !== null);
    expect(presentSamples.length).toBeGreaterThan(0);

    // The flash is specifically the collapsed sidebar being PAINTED OPEN, so
    // the guarantee is anchored on frames where the `<aside>` actually exists
    // in the DOM. The moment `#desktop-sidebar` is first present, the pre-paint
    // script (emitted in `<head>`, ahead of the aside markup) has provably run,
    // so on EVERY sidebar-present frame `<html>` must already carry
    // `data-sidebar-hidden`...
    expect(presentSamples.every((s) => s.hidden)).toBe(true);

    // ...and the aside must be at the exact settled hidden transform — never an
    // identity/intermediate value (which would be a visible open frame / slide).
    expect(
      presentSamples.every((s) => s.transform === hiddenTransform),
    ).toBe(true);

    // Screenshot artifact at first settled paint (hidden-hard-reload case),
    // for the #2577 eyes-on record.
    await page.screenshot({
      path: "test-results/sidebar-hard-reload-hidden.png",
      fullPage: false,
    });
  });

  test("SPA-nav between docs pages keeps the sidebar hidden with no flash (frame-level proof lives in sidebar-spa-nav-flash.spec.ts)", async ({
    page,
  }) => {
    // This is the settled-state sanity check the #2577 checklist also asks
    // for. It intentionally does NOT re-implement the swap-window rAF
    // sampler — sidebar-spa-nav-flash.spec.ts (#2198/#2200) already proves,
    // frame-by-frame, that `data-sidebar-hidden` is never wiped mid-swap and
    // the aside never paints an intermediate/open transform during an SPA
    // navigation. Duplicating that machinery here would just be copy-drift.
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    await page.locator(".zd-desktop-sidebar-toggle").click();
    await page.waitForFunction(
      () => document.documentElement.hasAttribute("data-sidebar-hidden"),
      undefined,
      { timeout: 5000 },
    );
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
    const hiddenTransform = await sidebar.evaluate(
      (el) => getComputedStyle(el).transform,
    );

    const navigated = await spaClick(page, NEXT_PAGE);
    expect(navigated).toBe(true);

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

  test("with no stored sidebar preference, a fresh load shows the sidebar normally", async ({
    page,
  }) => {
    // A fresh Playwright test context has no localStorage, so this simply
    // asserts the default (no persisted preference) path — no toggle click,
    // no pre-seeded storage.
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const storedValue = await page.evaluate(
      (key) => localStorage.getItem(key),
      SIDEBAR_STORAGE_KEY,
    );
    expect(storedValue).toBeNull();

    const hidden = await page.evaluate(() =>
      document.documentElement.hasAttribute("data-sidebar-hidden"),
    );
    expect(hidden).toBe(false);

    const sidebar = desktopSidebar(page);
    await expect(sidebar).toHaveCount(1);
    const transform = await sidebar.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(transform).toBe("none");
  });
});
