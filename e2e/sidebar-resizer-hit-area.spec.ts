import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E regression for the sidebar-resizer STRADDLE geometry (#3117).
 *
 * Bug: the drag handle used to sit entirely INSIDE the sidebar's right edge
 * (`left: calc(var(--zd-sidebar-w) - 20px); width: 20px`). Whenever the
 * sidebar content actually overflowed, the native y-scrollbar painted on top
 * of most of that strip and captured the pointer, leaving only a sliver of
 * the handle draggable.
 *
 * Fix (#3117): the handle now STRADDLES the edge —
 * `left: calc(var(--zd-sidebar-w) - 4px); width: 16px`
 * (`packages/zudo-doc/src/sidebar-resizer/sidebar-resizer-init.tsx` /
 * `index.ts` — kept in parity by
 * `packages/zudo-doc/src/sidebar-resizer/__tests__/geometry-parity.test.ts`).
 * That's 4px INSIDE the sidebar (still frequently covered by the scrollbar)
 * plus 12px OUTSIDE it, over the main content column's left padding — a zone
 * no native scrollbar ever paints into, since a scrollbar is confined to its
 * own scrolling element's box. `sidebarRight + 6px` (this spec's drag start
 * point) sits solidly inside that outside strip: precisely the zone a
 * scrollbar previously made unreachable.
 *
 * This is a real hit-test, not a geometry-math unit test: it drives an actual
 * `page.mouse` pointer sequence at pixel coordinates derived from the live
 * `#desktop-sidebar` bounding box, so a regression that shrinks/moves the
 * handle would make the drag land on ordinary page content instead and this
 * spec would fail on the width/localStorage assertions below.
 *
 * The `sidebar` e2e fixture's content set is tiny (8 pages) and never
 * naturally overflows `#desktop-sidebar` at any reasonable viewport height —
 * so {@link forceSidebarOverflow} pads out the nav's content height to
 * guarantee a REAL native scrollbar renders. Without a genuine scrollbar in
 * play, this spec would pass just as well against the pre-#3117 fully-inside
 * geometry, defeating its own purpose.
 */

const START_PAGE = "/docs/guides/sub-a/page-1";
const LS_KEY = "zudo-doc-sidebar-width";
// Mirrors SIDEBAR_STORAGE_KEY in
// packages/zudo-doc/src/desktop-sidebar-toggle-island/index.tsx.
const SIDEBAR_VISIBLE_KEY = "zudo-doc-sidebar-visible";
const HANDLE_SELECTOR = "[data-sidebar-resizer]";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function requireSidebarBox(page: Page): Promise<Box> {
  const box = await desktopSidebar(page).boundingBox();
  expect(box).not.toBeNull();
  return box as Box;
}

/**
 * Force `#desktop-sidebar` into a genuine overflow-y:auto scroll state,
 * regardless of how many real pages this fixture's content set happens to
 * have. Padding the nav's own content height (not the aside itself) keeps
 * the aside's box — and therefore the fixed-position resizer handle pinned
 * to its edge — geometrically unaffected; only `scrollHeight` grows.
 */
async function forceSidebarOverflow(page: Page): Promise<void> {
  await page.addStyleTag({ content: "#desktop-sidebar nav { min-height: 3000px; }" });
  const overflowing = await desktopSidebar(page).evaluate(
    (el) => el.scrollHeight > el.clientHeight,
  );
  expect(overflowing).toBe(true);
}

test.describe("Sidebar resizer hit area (#3117 straddle geometry)", () => {
  test.beforeEach(async ({ page }) => {
    // >=1024px so the `lg:` desktop-sidebar rules are active, and so the
    // resizer script's own self-guard (`getComputedStyle(sidebar).position
    // === "fixed"`) passes.
    await page.setViewportSize({ width: 1600, height: 900 });
  });

  test("a pointer-drag starting just outside the sidebar's right edge (the strip a scrollbar used to make unreachable) resizes the sidebar and persists the width", async ({
    page,
  }) => {
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);
    await forceSidebarOverflow(page);

    await page.locator(HANDLE_SELECTOR).waitFor({ state: "attached" });

    const { x, y, width, height } = await requireSidebarBox(page);
    const sidebarRight = x + width;
    // Inside the new 12px OUTSIDE strip: [sidebarRight, sidebarRight + 12].
    const startX = sidebarRight + 6;
    const startY = y + height / 2;
    // "drag ±80px" per the epic's live-check item (#3118 item 4). The
    // resizer computes the committed width from the pointer's absolute
    // clientX at drag-end (sidebarLeft is 0), not from the drag delta, so
    // dragging further right from a start point past the edge still yields a
    // clear, well-clamped width increase.
    const endX = startX + 80;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.mouse.up();

    // The resizer only commits on drag-end (mouseup / lostpointercapture),
    // not on every pointermove — see the `commit()` / `onUp` wiring in
    // sidebar-resizer-init.tsx. `expect.poll` covers the frame between the
    // synthetic mouseup resolving and the resulting layout settling.
    await expect
      .poll(() => desktopSidebar(page).evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(width + 40);

    const widthAfter = await desktopSidebar(page).evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    const stored = await page.evaluate((key) => localStorage.getItem(key), LS_KEY);
    expect(stored).not.toBeNull();
    expect(Math.abs(Number(stored) - widthAfter)).toBeLessThanOrEqual(1);
  });

  test("the desktop sidebar toggle still collapses the sidebar with the widened handle in place", async ({
    page,
  }) => {
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    // Sanity: the handle this test's premise is about actually exists here —
    // a regression that stopped rendering it would make this test vacuous.
    await page.locator(HANDLE_SELECTOR).waitFor({ state: "attached" });

    // The straddle geometry's outside strip (sidebarRight .. sidebarRight+12)
    // overlaps the LEFT half of the toggle button's own box (`left:
    // var(--zd-sidebar-w)`, `w-[1.5rem]` = 24px, so sidebarRight ..
    // sidebarRight+24). Both carry the same `z-sidebar` tier, so this is a
    // genuine "does the click still land on the button" question, not just a
    // geometry-math check — a real regression here would make this locator
    // click time out (Playwright's actionability check fails when another
    // element intercepts the pointer at the target's center point).
    await page.locator(".zd-desktop-sidebar-toggle").click();

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.hasAttribute("data-sidebar-hidden")),
      )
      .toBe(true);
    const stored = await page.evaluate((key) => localStorage.getItem(key), SIDEBAR_VISIBLE_KEY);
    expect(stored).toBe("false");
  });
});
