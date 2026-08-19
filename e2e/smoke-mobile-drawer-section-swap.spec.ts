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
 *      `viewTransitionName`), and the single Navigation Timing entry still
 *      names the ORIGIN URL (a hard load anywhere would reset the
 *      per-document timeline with that hop's URL instead — this is the
 *      automated proxy for the source issue's five-point softness proof).
 */
import { test, expect, type Page } from "@playwright/test";
import { spaClickSelector } from "./nav-helpers";
import {
  closeMobileDrawer,
  drawerLinkSelector,
  mobileSidebar,
  openMobileDrawer,
} from "./mobile-drawer-helpers";

test.use({ viewport: { width: 390, height: 844 } });

const GETTING_STARTED = "/docs/getting-started";
const GUIDES_INDEX_HREF = "/docs/guides";
const GUIDES_PAGE_1_HREF = "/docs/guides/page-1";

// Drawer plumbing lives in the shared helper module (`mobile-drawer-helpers.ts`).
// Two rationale notes specific to THIS spec:
//
//   - `openMobileDrawer` succeeding is also the hydration gate for the
//     regression proof: module evaluation (which runs
//     `ensureNestedIslandPropsRefresh` as a side effect,
//     `sidebar-toggle-island/index.tsx`) strictly precedes the mount call in
//     zfb's island-mount chain, so "the button is clickable" is a safe proxy
//     for "the before-swap refresh listener is registered" — navigating
//     before this wait is the documented uncovered race
//     (`nested-island-props-refresh.ts`'s "Known gap" comment) and would make
//     the whole regression proof meaningless.
//
//   - The SPA clicks MUST go through `drawerLinkSelector`: the bare-href
//     `spaClick` takes the first document-order `a[href]` match, and any
//     header re-composition could silently move that onto the hidden desktop
//     `Learn` link — leaving this spec green without ever exercising the
//     drawer path it exists to prove.

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
    // The journey's own step budgets (4 drawer opens at 10s each, 2 swap waits
    // at 10s each, a close at 5s) sum well past Playwright's 30s default; a
    // single slow-CI hydration retry would otherwise kill the test mid-journey
    // with a timeout that says nothing about the regression under test.
    test.setTimeout(90_000);
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
    expect(
      baseline.viewTransitionName,
      "persisted header should carry a real view-transition-name (features.css assigns zfb-header) — a 'none' baseline would make every later comparison vacuous",
    ).not.toBe("none");

    // ---- Step 2: close, reopen, soft-navigate cross-section via the
    // drawer's root menu (the only cross-section path at this viewport) --
    await closeMobileDrawer(page);
    await openMobileDrawer(page);
    await sidebarPanel.getByRole("button", { name: "Back to main menu" }).click();

    const learnLink = sidebarPanel.getByRole("link", { name: "Learn", exact: true });
    await expect(learnLink, "root menu should list the guides section's entry point").toBeVisible();

    const crossSectionSwapFired = await spaClickSelector(
      page,
      drawerLinkSelector(GUIDES_INDEX_HREF),
    );
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

    const sameSectionSwapFired = await spaClickSelector(
      page,
      drawerLinkSelector(GUIDES_PAGE_1_HREF),
    );
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

    // The Navigation Timing timeline is per-document, so a hard load does NOT
    // "add a second entry" — it replaces the document and resets the timeline
    // to exactly one entry again. The count alone can never catch one; the
    // single entry's URL can: it must still be the journey's ORIGIN, whereas a
    // hard load at any hop would leave that hop's URL here instead.
    const navigationEntryUrls = await page.evaluate(() =>
      performance.getEntriesByType("navigation").map((entry) => entry.name),
    );
    expect(
      navigationEntryUrls,
      "exactly one Navigation Timing entry should exist for the whole journey",
    ).toHaveLength(1);
    expect(
      navigationEntryUrls[0],
      "the only hard load should be the journey's origin — this is the automated proxy for the source issue's softness proof",
    ).toContain(GETTING_STARTED);
  });
});
