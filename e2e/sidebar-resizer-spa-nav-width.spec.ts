import { test, expect } from "@playwright/test";
import { spaClick } from "./nav-helpers";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E regression for the sidebar-resizer width loss on SPA navigation (#2227).
 *
 * Bug: after the user dragged the sidebar wider, the chosen width
 * (`--zd-sidebar-w`, written to the live `<html>` element's inline `style`)
 * was lost on every same-document SPA navigation. zfb's `swapRootAttributes`
 * copies the incoming server-rendered document's `<html>` attributes over the
 * live root during the body swap; since this layout never server-renders an
 * `htmlStyle`, the incoming root carries no `style` attribute, so the live
 * `--zd-sidebar-w` was wiped and the sidebar snapped back to the CSS default
 * (`clamp(14rem, 20vw, 22rem)`). A subsequent reload restored the width from
 * localStorage (SidebarResizerRestore runs pre-paint), which is exactly why the
 * bug only manifested on soft navigations.
 *
 * Fix (#2227): doc-layout now mounts
 * `<ClientRouter preserveHtmlAttrs={["data-sidebar-hidden", "data-theme", "style"]} />`.
 * Adding `style` makes the router re-apply the live root's whole inline `style`
 * (carrying `--zd-sidebar-w`) within the same synchronous swap, before paint —
 * the same mechanism that keeps `data-sidebar-hidden` / `data-theme` across
 * swaps (#2200).
 *
 * Test technique: this mirrors sidebar-toggle-layout.spec.ts — it sets the
 * runtime root state directly via `page.evaluate` rather than enabling the full
 * resizer island in the fixture. The bug lives entirely in the attribute-swap
 * path, which is feature-independent: any inline root `style` set at runtime is
 * what `swapRootAttributes` either drops or preserves. Setting `--zd-sidebar-w`
 * by hand reproduces precisely the post-drag runtime state, and the sidebar's
 * `w-[var(--zd-sidebar-w)]` class consumes it whether or not the resizer is on.
 */

const START_PAGE = "/docs/guides/sub-a/page-1";
// Same getting-started/guides section, reachable via the sidebar nav tree —
// a genuine same-section SPA hop.
const NEXT_PAGE = "/docs/guides/sub-a/page-2";

const WIDE = 400;

test.describe("Sidebar-resizer width across SPA nav (#2227)", () => {
  test("a runtime --zd-sidebar-w survives an SPA navigation (sidebar stays wide)", async ({
    page,
  }) => {
    // >=1024px so the `lg:` desktop-sidebar rules are active.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(START_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    await expect(sidebar).toHaveCount(1);

    // The fix is wired via the SSR meta the ClientRouter emits — assert it lists
    // `style`, so a regression that drops it from preserveHtmlAttrs fails loudly
    // here rather than only as a flaky width difference below.
    const preserved = await page.evaluate(() => {
      const meta = document.querySelector(
        'meta[name="zfb-preserve-html-attrs"]',
      );
      return meta?.getAttribute("content") ?? null;
    });
    expect(preserved).not.toBeNull();
    expect(preserved!.toLowerCase().split(/\s+/)).toContain("style");

    // Simulate a drag: write the chosen width to the live root inline style,
    // exactly as the resizer's applyWidth() does.
    await page.evaluate((w) => {
      document.documentElement.style.setProperty("--zd-sidebar-w", `${w}px`);
    }, WIDE);

    // Sanity: the widened value is actually applied before we navigate. (The
    // CSS default at this viewport resolves to ~320px, so 400px is a clear,
    // discriminating widening.)
    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
      .toBeCloseTo(WIDE, 0);

    // Perform the genuine SPA navigation.
    const navigated = await spaClick(page, NEXT_PAGE);
    expect(navigated).toBe(true);

    // The inline custom property must still be present on <html> after the swap
    // — i.e. zfb-runtime preserved the root `style` across the wipe.
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style
            .getPropertyValue("--zd-sidebar-w")
            .trim(),
        ),
      )
      .toBe(`${WIDE}px`);

    // And the rendered sidebar is still at the widened width, not the default.
    await expect
      .poll(() => desktopSidebar(page).evaluate((el) =>
        el.getBoundingClientRect().width,
      ))
      .toBeCloseTo(WIDE, 0);
  });
});
