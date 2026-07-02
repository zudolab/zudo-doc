import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { waitForSidebarHydration } from "./sidebar-helpers";

/**
 * Deterministic regression coverage for the sidebar-resizer pre-paint
 * width-restore script (`SIDEBAR_RESIZER_RESTORE_SCRIPT`, packages/zudo-doc/
 * src/sidebar-resizer/sidebar-resizer-init.tsx). It reads
 * `localStorage["zudo-doc-sidebar-width"]`, clamps it to `[192, 448]`, and
 * sets `--zd-sidebar-w` on `:root` before first paint — without it, a reload
 * after a drag flashes back to the CSS-default width
 * (`clamp(14rem, 20vw, 22rem)`, src/styles/global.css).
 *
 * Scenarios and tolerances transcribe directly from
 * .claude/skills/test-flow-sidebar-width-restore/SKILL.md:79-108 (the L6
 * AI-judged flow this replaces with mechanical assertions). This fixture
 * enables `sidebarResizer: true` (e2e/fixtures/sidebar/src/config/settings.ts)
 * so the restore `<script>` is actually emitted in `<head>`.
 */

const GUIDES_PAGE = "/docs/guides/sub-a/page-1";
const LS_KEY = "zudo-doc-sidebar-width";
// Mirrors --zd-sidebar-w's CSS-default value (src/styles/global.css).
const CSS_DEFAULT_WIDTH = "clamp(14rem, 20vw, 22rem)";
// Resolved band for the CSS default at any reasonable desktop viewport
// (14rem = 224px .. 22rem = 352px) — locked by the SKILL.md verdict criteria.
const CSS_DEFAULT_MIN_PX = 224;
const CSS_DEFAULT_MAX_PX = 352;

async function measureSidebarWidth(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      inline: root.style.getPropertyValue("--zd-sidebar-w"),
      computed: getComputedStyle(root)
        .getPropertyValue("--zd-sidebar-w")
        .trim(),
      rectWidth:
        document.getElementById("desktop-sidebar")?.getBoundingClientRect()
          .width ?? null,
    };
  });
}

test.describe("Sidebar resizer: pre-paint width restore", () => {
  test.beforeEach(async ({ page }) => {
    // >=1024px so the `lg:` desktop-sidebar rules are active.
    await page.setViewportSize({ width: 1600, height: 900 });
  });

  test("restores a persisted valid width (400px) on reload", async ({
    page,
  }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    await page.evaluate((key) => localStorage.setItem(key, "400"), LS_KEY);
    await page.reload({ waitUntil: "load" });
    await waitForSidebarHydration(page);

    const { inline, computed, rectWidth } = await measureSidebarWidth(page);
    expect(inline).toBe("400px");
    expect(computed).toBe("400px");
    expect(rectWidth).not.toBeNull();
    expect(Math.abs((rectWidth as number) - 400)).toBeLessThanOrEqual(1);
  });

  test("clamps an out-of-range persisted width (99999) to the 448px max", async ({
    page,
  }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    await page.evaluate((key) => localStorage.setItem(key, "99999"), LS_KEY);
    await page.reload({ waitUntil: "load" });
    await waitForSidebarHydration(page);

    const { inline, computed, rectWidth } = await measureSidebarWidth(page);
    expect(inline).toBe("448px");
    expect(computed).toBe("448px");
    expect(rectWidth).not.toBeNull();
    expect(Math.abs((rectWidth as number) - 448)).toBeLessThanOrEqual(1);
  });

  test("a garbage persisted value (NaN-garbage) falls through to the CSS default", async ({
    page,
  }) => {
    await page.goto(GUIDES_PAGE, { waitUntil: "load" });
    await waitForSidebarHydration(page);

    await page.evaluate(
      (key) => localStorage.setItem(key, "NaN-garbage"),
      LS_KEY,
    );
    await page.reload({ waitUntil: "load" });
    await waitForSidebarHydration(page);

    const { inline, computed, rectWidth } = await measureSidebarWidth(page);
    // parseFloat("NaN-garbage") is NaN — the restore script's isFinite guard
    // no-ops, leaving no inline property and the CSS default in effect.
    expect(inline).toBe("");
    expect(computed).toBe(CSS_DEFAULT_WIDTH);
    expect(rectWidth).not.toBeNull();
    expect(rectWidth as number).toBeGreaterThanOrEqual(CSS_DEFAULT_MIN_PX);
    expect(rectWidth as number).toBeLessThanOrEqual(CSS_DEFAULT_MAX_PX);
  });
});
