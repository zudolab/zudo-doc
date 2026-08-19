/**
 * Regression spec for the mobile drawer's cross-section soft-navigation bug
 * (zudolab/zudo-doc#3525, root cause + fix in epic #3529).
 *
 * At mobile viewport the header persists across a same-locale SPA swap
 * (persist key `header-${lang}`), and the mobile drawer (`SidebarToggle`)
 * lives INSIDE that persisted header. `zfb`'s props-refresh path only fires
 * for a persisted element that is itself an island root — `<header>` is not
 * one — so before the #3530 fix, a same-locale CROSS-SECTION swap left the
 * drawer re-mounting from the previous page's serialized `data-props`: a
 * stale tree AND a stale active marker.
 *
 * No existing spec covers this: every persist spec is desktop-pinned
 * (`smoke-vt-chrome-persist.spec.ts` and siblings), and the one drawer nav
 * test (`smoke-mobile-sidebar.spec.ts:86`) is same-section and only asserts
 * that the drawer closed after navigating — it never proves cross-section
 * softness or checks tree/active-marker freshness.
 *
 * Journey — both hops are SPA soft navigations via real drawer links. The
 * smoke fixture's getting-started page has no article-body link into the
 * guides section, and the desktop header nav is `hidden ... lg:flex` at
 * this viewport, so the drawer's root menu is the only cross-section path:
 *
 *   1. /docs/getting-started (origin, a single-page section) — open the
 *      drawer (the retry-click doubles as the hydration wait) and record
 *      the baseline tree + active marker + persisted-header snapshot.
 *   2. Close, reopen, click "Back to main menu", soft-navigate via the
 *      "Learn" root-menu link to /docs/guides — the CROSS-SECTION hop.
 *   3. Reopen, soft-navigate via the now-visible "Writing Docs" child link
 *      to /docs/guides/page-1 — a same-section hop that lands on an
 *      unambiguous destination leaf carrying its own active marker.
 *   4. Reopen and assert: the destination-only leaf is present and active,
 *      the origin-only leaf is gone, the persisted header survived both
 *      halves of the persist contract (DOM identity AND its computed
 *      `viewTransitionName`), and exactly one Navigation Timing entry
 *      exists for the whole journey (a hard load anywhere would add a
 *      second — this is the automated proxy for the source issue's
 *      five-point softness proof).
 */
import { test, expect, type Page } from "@playwright/test";
import { spaClick } from "./nav-helpers";

test.use({ viewport: { width: 390, height: 844 } });

const GETTING_STARTED = "/docs/getting-started";
const GUIDES_INDEX_HREF = "/docs/guides";
const GUIDES_PAGE_1_HREF = "/docs/guides/page-1";

function mobileSidebar(page: Page) {
  return page.locator("[data-zd-mobile-sidebar]");
}

/**
 * Open the mobile drawer via the hamburger, retrying the click as a unit.
 *
 * `SidebarToggle` is `Island({ when: "visible" })` — its `onClick` only
 * exists once the island has hydrated, and the zfb runtime dispatches no
 * event and mutates no DOM attribute on mount completion, so there is no
 * better signal to poll. A click issued before hydration is silently
 * dropped. Retrying the click-and-check as a unit via `toPass` (mirrors
 * `theme-pack-helpers.ts`'s `openFlyout`) makes a dropped first click
 * self-heal instead of flaking — and succeeding at all proves hydration
 * completed. Module evaluation (which runs `ensureNestedIslandPropsRefresh`
 * as a side effect, `sidebar-toggle-island/index.tsx:20`) strictly precedes
 * the mount call in zfb's island-mount chain, so "the button is clickable"
 * is a safe proxy for "the before-swap refresh listener is registered" —
 * navigating before this wait is the documented uncovered race
 * (`nested-island-props-refresh.ts`'s "Known gap" comment) and would make
 * the whole regression proof meaningless.
 */
async function openMobileDrawer(page: Page): Promise<void> {
  const hamburger = page.locator('button[aria-label="Open sidebar"]');
  const closeButton = page.locator('button[aria-label="Close sidebar"]');
  await expect(async () => {
    await hamburger.click();
    await expect(closeButton).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10000 });
}

/**
 * Close the drawer via the backdrop overlay, not the hamburger button.
 *
 * `z-modal-backdrop` (50) sits ABOVE the header's `z-toolbar` (20) by design
 * (`sidebar-toggle-island/index.tsx`'s backdrop comment) — the open drawer
 * is a modal surface that dims the whole viewport, hamburger included. A
 * real pointer click therefore cannot land on the "Close sidebar" button
 * while the drawer is open (mirrors `smoke-mobile-sidebar.spec.ts`'s
 * "clicking backdrop closes the sidebar" test, which dispatches directly on
 * the backdrop for the same reason).
 */
async function closeMobileDrawer(page: Page): Promise<void> {
  await page.locator("header div.fixed.inset-0").dispatchEvent("click");
  await expect(page.locator('button[aria-label="Open sidebar"]')).toBeVisible({ timeout: 5000 });
}

interface HeaderPersistSnapshot {
  marker: number;
  viewTransitionName: string | null;
}

/**
 * Tag the persisted `<header>` with a unique marker property and read its
 * computed `viewTransitionName`, so a later read can prove BOTH halves of
 * "the persist survived": DOM-node identity (the marker survives only if
 * it is literally the same element) and the named view-transition CSS
 * assignment (which a persist regression could disturb independently).
 */
async function tagHeaderForPersistCheck(page: Page): Promise<HeaderPersistSnapshot> {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) throw new Error("Expected a <header> element");
    const marker = Date.now() + Math.random();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (header as any).__drawerSwapMarker__ = marker;
    return { marker, viewTransitionName: getComputedStyle(header).viewTransitionName };
  });
}

async function readHeaderPersistSnapshot(page: Page): Promise<HeaderPersistSnapshot | null> {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return null;
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marker: (header as any).__drawerSwapMarker__ as number,
      viewTransitionName: getComputedStyle(header).viewTransitionName,
    };
  });
}

test.describe("Mobile drawer: cross-section soft-navigation regression (#3525/#3529)", () => {
  test("drawer tree and active marker refresh after a cross-section SPA swap, header persist intact", async ({
    page,
  }) => {
    await page.goto(GETTING_STARTED, { waitUntil: "domcontentloaded" });

    // ---- Step 1: origin baseline --------------------------------------
    await openMobileDrawer(page);
    const sidebarPanel = mobileSidebar(page);
    const gettingStartedLink = sidebarPanel.getByRole("link", {
      name: "Getting Started",
      exact: true,
    });
    const writingDocsLink = sidebarPanel.getByRole("link", { name: "Writing Docs", exact: true });

    await expect(
      gettingStartedLink,
      "origin section's own leaf should be the active marker",
    ).toHaveAttribute("aria-current", "page");
    await expect(
      writingDocsLink,
      "destination-only guides leaf must not exist yet on the origin section's tree",
    ).toHaveCount(0);

    const baseline = await tagHeaderForPersistCheck(page);

    // ---- Step 2: close, reopen, soft-navigate cross-section via the
    // drawer's root menu (the only cross-section path at this viewport) --
    await closeMobileDrawer(page);
    await openMobileDrawer(page);
    await sidebarPanel.getByRole("button", { name: "Back to main menu" }).click();

    const learnLink = sidebarPanel.getByRole("link", { name: "Learn", exact: true });
    await expect(learnLink, "root menu should list the guides section's entry point").toBeVisible();

    const crossSectionSwapFired = await spaClick(page, GUIDES_INDEX_HREF);
    expect(crossSectionSwapFired, "zfb:after-swap did not fire for the cross-section hop").toBe(
      true,
    );

    const afterCrossSection = await readHeaderPersistSnapshot(page);
    expect(afterCrossSection, "header should still exist after the cross-section swap").not.toBeNull();
    expect(
      afterCrossSection!.marker,
      "header DOM node should be the same instance after the cross-section swap",
    ).toBe(baseline.marker);
    expect(
      afterCrossSection!.viewTransitionName,
      "header viewTransitionName should be unchanged after the cross-section swap",
    ).toBe(baseline.viewTransitionName);

    // ---- Step 3: reopen, soft-navigate to the unambiguous destination leaf
    await openMobileDrawer(page);
    await expect(
      gettingStartedLink,
      "origin-only leaf should already be gone once the drawer shows the guides tree",
    ).toHaveCount(0);
    await expect(
      writingDocsLink,
      "destination guides leaf should now be present in the reopened tree",
    ).toBeVisible();

    const sameSectionSwapFired = await spaClick(page, GUIDES_PAGE_1_HREF);
    expect(sameSectionSwapFired, "zfb:after-swap did not fire for the same-section hop").toBe(
      true,
    );

    // ---- Step 4: reopen and assert the full regression contract --------
    await openMobileDrawer(page);

    await expect(
      writingDocsLink,
      "destination-ONLY tree item should appear",
    ).toBeVisible();
    await expect(writingDocsLink, "destination link should carry the active marker").toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(writingDocsLink).toHaveAttribute("data-nav-active", "");

    await expect(gettingStartedLink, "origin-only tree item should be gone").toHaveCount(0);

    const final = await readHeaderPersistSnapshot(page);
    expect(final, "header should still exist at the end of the journey").not.toBeNull();
    expect(
      final!.marker,
      "header DOM node should still be the same instance at the end of the journey",
    ).toBe(baseline.marker);
    expect(
      final!.viewTransitionName,
      "header viewTransitionName should still be unchanged at the end of the journey",
    ).toBe(baseline.viewTransitionName);

    const navigationEntryCount = await page.evaluate(
      () => performance.getEntriesByType("navigation").length,
    );
    expect(
      navigationEntryCount,
      "exactly one Navigation Timing entry should exist for the whole journey — a hard load at any hop would add a second",
    ).toBe(1);
  });
});
