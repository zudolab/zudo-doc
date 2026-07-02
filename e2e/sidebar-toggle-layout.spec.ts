import { test, expect } from "./fixtures";

/**
 * E2E regression for the desktop sidebar-toggle layout (#2002).
 *
 * When the sidebar is hidden via the desktop toggle, the content used to
 * keep the dead left gap where the sidebar was, instead of centering in a
 * narrower band like the `hide_sidebar: true` frontmatter variant.
 *
 * Root cause: global.css already had the
 * `html[data-sidebar-hidden] .zd-sidebar-content-wrapper { margin-left: 0 }`
 * override, but `.zd-sidebar-content-wrapper` was never applied to the
 * content wrapper in doc-layout.tsx, so the override was dormant. The fix
 * applies that hook class plus a new `.zd-doc-content-band` class and adds a
 * max-width override so the band narrows to the hide_sidebar width (80rem).
 *
 * This is a pure CSS contract: the toggle island's only layout-affecting
 * action is setting `data-sidebar-hidden` on <html> (see
 * src/components/desktop-sidebar-toggle.tsx). We set that attribute directly
 * rather than clicking the toggle button because the `sidebarToggle` feature
 * is not enabled in this fixture — but the attribute-driven CSS is
 * feature-independent and is exactly what was broken.
 */

// A sidebar-fixture doc page that renders the desktop sidebar.
const DOC_PAGE = "/docs/guides/sub-a/page-1";

// 80rem at the default 16px root font-size — the hide_sidebar content-band width.
const HIDE_SIDEBAR_BAND_MAX_WIDTH = "1280px";

test.describe("Desktop sidebar toggle layout", () => {
  test("hiding the sidebar removes the content gap and narrows the band", async ({
    page,
  }) => {
    // Wide enough that the `lg:` (>=1024px) rules are active and the sidebar
    // width margin is unambiguously non-zero.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(DOC_PAGE, { waitUntil: "load" });

    const wrapper = page.locator(".zd-sidebar-content-wrapper");
    const band = page.locator(".zd-doc-content-band");
    await expect(wrapper).toHaveCount(1);
    await expect(band).toHaveCount(1);

    // Sidebar shown: the wrapper is pushed right to clear the fixed
    // #desktop-sidebar, leaving the gap the issue is about.
    const shownMargin = await wrapper.evaluate(
      (el) => getComputedStyle(el).marginLeft,
    );
    expect(shownMargin).not.toBe("0px");
    const shownBandMaxWidth = await band.evaluate(
      (el) => getComputedStyle(el).maxWidth,
    );
    expect(shownBandMaxWidth).not.toBe(HIDE_SIDEBAR_BAND_MAX_WIDTH);

    // Simulate the toggle hiding the sidebar.
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-sidebar-hidden", "");
    });

    // No dead gap: the wrapper margin collapses to zero...
    await expect(wrapper).toHaveCSS("margin-left", "0px");
    // ...and the band narrows to the hide_sidebar width, which the flex
    // parent (justify-content: center) then centers.
    await expect(band).toHaveCSS("max-width", HIDE_SIDEBAR_BAND_MAX_WIDTH);
  });
});
