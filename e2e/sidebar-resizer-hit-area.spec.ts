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
    // "drag ±80px" per the epic's live-check item (#3118 item 4). Since #3121
    // the committed width is the pointer's clientX minus the grab offset
    // recorded at pointerdown, so an 80px drag moves the edge by 80px
    // regardless of where inside the handle it was grabbed. (The exact-delta
    // guarantee has its own test below; this one only needs a clear increase.)
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

  test("the handle reports the rendered sidebar width in aria-valuenow before any interaction (#3120)", async ({
    page,
  }) => {
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);
    await page.locator(HANDLE_SELECTOR).waitFor({ state: "attached" });

    // Deliberately BEFORE any drag or key press. The default width is declared
    // as `clamp(14rem, 20vw, 22rem)`, and getComputedStyle().getPropertyValue()
    // on a CUSTOM PROPERTY hands back that unresolved substitution value — so
    // the pre-#3120 `parseFloat(...) || MIN_W` read NaN and reported MIN_W
    // (192) while the sidebar was actually ~256-320px wide. It self-corrected
    // after the first interaction, which is exactly why this assertion has to
    // run first: a test that drags before reading would never have caught it.
    const { width } = await requireSidebarBox(page);
    const valuenow = await page.locator(HANDLE_SELECTOR).getAttribute("aria-valuenow");

    expect(valuenow).not.toBeNull();
    expect(Math.abs(Number(valuenow) - width)).toBeLessThanOrEqual(1);
  });

  test("an 80px drag moves the sidebar edge by exactly 80px regardless of where in the handle it was grabbed (#3121)", async ({
    page,
  }) => {
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);
    await forceSidebarOverflow(page);
    await page.locator(HANDLE_SELECTOR).waitFor({ state: "attached" });

    const { x, y, width, height } = await requireSidebarBox(page);
    const sidebarRight = x + width;
    // 6px OUTSIDE the edge — the realistic grab point once a scrollbar covers
    // the handle's 4px inside portion.
    const GRAB_OFFSET = 6;
    const DRAG_DELTA = 80;
    const startY = y + height / 2;

    await page.mouse.move(sidebarRight + GRAB_OFFSET, startY);
    await page.mouse.down();
    await page.mouse.move(sidebarRight + GRAB_OFFSET + DRAG_DELTA, startY, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(() => desktopSidebar(page).evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(width);

    const widthAfter = await desktopSidebar(page).evaluate(
      (el) => el.getBoundingClientRect().width,
    );

    // Pre-#3121 the committed width was `clientX - sidebarLeft` with no grab
    // compensation, so the edge snapped to the cursor on the first move and
    // this drag produced width + 86 (the 6px grab offset leaked in). The
    // tolerance MUST stay below that 6px error or the regression slips through.
    expect(Math.abs(widthAfter - (width + DRAG_DELTA))).toBeLessThanOrEqual(2);
  });
});
