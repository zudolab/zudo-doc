import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";
import { openMobileDrawer, mobileSidebar } from "./mobile-drawer-helpers";

const EDITORIAL_PAGE = "/docs/editorial/background";
const PAGE = "/docs/guides/sub-a/page-1";
const DEEP_PAGE = `/docs/guides/deep/${Array.from({ length: 11 }, (_, i) => `level-${String(i + 2).padStart(2, "0")}`).join("/")}/page`;
const FRAME_PATH = "M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3";

const frame = (container: Locator, label: string) =>
  container.getByRole("button", { name: `Focus sidebar on ${label}`, exact: true });
const focusedFrame = (container: Locator, label: string) =>
  container.getByRole("button", { name: `Sidebar is already focused on ${label}`, exact: true });
const tooltip = (page: Page) => page.locator("[data-sidebar-tooltip]:visible");

/** Every row's box, so a preview can be proven paint-only. */
function rowBoxes(container: Locator) {
  return container.locator("[data-sidebar-row]").evaluateAll((rows) =>
    rows.map((row) => {
      const r = row.getBoundingClientRect();
      return [r.top, r.left, r.width, r.height].map((n) => Math.round(n * 10) / 10);
    }),
  );
}

/** The branch wrappers currently previewed. */
function previewedBranches(container: Locator) {
  return container.locator("[data-sidebar-preview]").evaluateAll((branches) =>
    branches.map((branch) => branch.querySelector(":scope > [data-sidebar-row] [data-sidebar-focus]")?.getAttribute("aria-label")),
  );
}

test.describe("desktop focus frame preview", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("frames are visible at rest and hover previews exactly one branch without moving anything", async ({ page, assertNoConsoleErrors }) => {
    await page.goto(`${EDITORIAL_PAGE}#paint-surface`);
    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    const color = frame(sidebar, "Color recipes");
    const outline = frame(sidebar, "Outline recipes");
    await expect(color).toBeVisible();
    await expect(outline).toBeVisible();
    await expect(color.locator("svg path")).toHaveAttribute("d", FRAME_PATH);
    expect(await sidebar.locator("[data-sidebar-focus]").evaluateAll((els) => els.some((el) => el.textContent?.includes("◎")))).toBe(false);
    const url = page.url();
    const readingY = await page.evaluate(() => window.scrollY);
    const before = await rowBoxes(sidebar);
    await expect(sidebar.getByRole("button", { name: "Expand Outline recipes", exact: true })).toBeVisible();

    await outline.hover();
    await expect.poll(() => previewedBranches(sidebar)).toEqual(["Focus sidebar on Outline recipes"]);
    // A collapsed branch previews its own row without expanding children.
    await expect(sidebar.getByRole("link", { name: "Outline color", exact: true })).toHaveCount(0);
    await expect(tooltip(page)).toHaveText("Focus sidebar hereOutline recipes");
    await expect(outline).toHaveAttribute("aria-describedby", /zd-sidebar-tip-/);
    // The hoverable tooltip must not cover the row's disclosure beside the frame.
    const tipBox = (await tooltip(page).boundingBox())!;
    const disclosureBox = (await sidebar.getByRole("button", { name: "Expand Outline recipes", exact: true }).boundingBox())!;
    expect(tipBox.x).toBeGreaterThanOrEqual(disclosureBox.x + disclosureBox.width);
    expect(await rowBoxes(sidebar)).toEqual(before);

    await color.hover();
    await expect.poll(() => previewedBranches(sidebar)).toEqual(["Focus sidebar on Color recipes"]);
    expect(await rowBoxes(sidebar)).toEqual(before);
    // Wash on the previewed wrapper; siblings and the current-page row keep their own paint.
    const paint = await sidebar.evaluate((nav) => {
      const previewed = nav.querySelector<HTMLElement>("[data-sidebar-preview]")!;
      const sibling = [...nav.querySelectorAll<HTMLElement>("[data-sidebar-branch]")].find((b) => !b.contains(previewed) && !previewed.contains(b))!;
      return {
        wash: getComputedStyle(previewed).backgroundColor,
        rule: getComputedStyle(previewed).boxShadow,
        sibling: getComputedStyle(sibling).backgroundColor,
      };
    });
    expect(paint.wash).not.toBe("rgba(0, 0, 0, 0)");
    expect(paint.rule).toContain("inset");
    expect(paint.sibling).toBe("rgba(0, 0, 0, 0)");

    // Hovering the disclosure (Color recipes has no page link) is not a preview trigger.
    await sidebar.getByRole("button", { name: "Collapse Color recipes", exact: true }).hover();
    await expect.poll(() => previewedBranches(sidebar)).toEqual([]);
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => window.scrollY)).toBe(readingY);
    assertNoConsoleErrors();
  });

  test("keyboard Tab previews the focused frame and pointer hover takes precedence", async ({ page, assertNoConsoleErrors }) => {
    await page.goto(EDITORIAL_PAGE);
    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    await sidebar.locator('input[aria-label="Filter navigation"]').focus();
    const color = frame(sidebar, "Color recipes");
    for (let i = 0; i < 12 && !(await color.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(color).toBeFocused();
    await expect.poll(() => previewedBranches(sidebar)).toEqual(["Focus sidebar on Color recipes"]);
    await expect(tooltip(page)).toHaveText("Focus sidebar hereColor recipes");
    await frame(sidebar, "Outline recipes").hover();
    await expect.poll(() => previewedBranches(sidebar)).toEqual(["Focus sidebar on Outline recipes"]);
    await page.mouse.move(900, 400);
    await expect.poll(() => previewedBranches(sidebar)).toEqual(["Focus sidebar on Color recipes"]);
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => previewedBranches(sidebar)).toEqual([]);
    assertNoConsoleErrors();
  });

  test("filtering and no-results clear the preview and tooltip; the filter is untouched by previews", async ({ page, assertNoConsoleErrors }) => {
    await page.goto(EDITORIAL_PAGE);
    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    const input = sidebar.locator('input[aria-label="Filter navigation"]');
    await frame(sidebar, "Color recipes").hover();
    await expect(tooltip(page)).toBeVisible();
    await page.mouse.move(900, 400);
    await expect.poll(() => previewedBranches(sidebar)).toEqual([]);
    await input.fill("outline");
    await expect.poll(() => previewedBranches(sidebar)).toEqual([]);
    await expect(tooltip(page)).toHaveCount(0);
    // The filtered view still previews its rendered branch, and keeps the query.
    await frame(sidebar, "Outline recipes").hover();
    await expect.poll(() => previewedBranches(sidebar)).toEqual(["Focus sidebar on Outline recipes"]);
    await expect(input).toHaveValue("outline");
    // A filtered multi-root forest must not disable its one remaining category.
    await expect(frame(sidebar, "Outline recipes")).not.toHaveAttribute("aria-disabled", "true");
    // The hovered frame disappears with the results; nothing may stay previewed.
    await input.fill("zz no such page zz");
    await expect.poll(() => previewedBranches(sidebar)).toEqual([]);
    await expect(sidebar.locator("[data-sidebar-focus]")).toHaveCount(0);
    await expect(tooltip(page)).toHaveCount(0);
    assertNoConsoleErrors();
  });

  test("the focused root's frame is inactive, its disclosure works and focus lands on the root row", async ({ page, assertNoConsoleErrors }) => {
    await page.goto(`${EDITORIAL_PAGE}#paint-surface`);
    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    const url = page.url();
    const readingY = await page.evaluate(() => window.scrollY);
    const currentBefore = await sidebar.locator('a[aria-current="page"]').evaluate((a) => getComputedStyle(a).color);
    await frame(sidebar, "Color recipes").focus();
    await page.keyboard.press("Enter");
    const inactive = focusedFrame(sidebar, "Color recipes");
    await expect(inactive).toHaveAttribute("aria-disabled", "true");
    await expect(inactive).toHaveAttribute("tabindex", "-1");
    await expect(sidebar.locator("[data-sidebar-tree-root] a").first()).toBeFocused();
    await expect(sidebar.locator("[data-sidebar-restore]")).toHaveAttribute("aria-label", "Restore current page’s sidebar");
    await expect(sidebar.locator("[data-sidebar-restore] svg path")).toHaveAttribute("d", "M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6");
    // Inactive: clicking changes nothing and it is not a preview trigger.
    const scope = await sidebar.locator("nav").getAttribute("data-sidebar-scope");
    // force: Playwright would otherwise wait for an aria-disabled control to enable.
    await inactive.click({ force: true });
    await expect(sidebar.locator("nav")).toHaveAttribute("data-sidebar-scope", scope ?? "");
    await expect(tooltip(page)).toHaveText("Already focused hereColor recipes");
    await expect.poll(() => previewedBranches(sidebar)).toEqual([]);
    // Tab from the root row's disclosure skips the inactive frame beside it.
    await sidebar.getByRole("button", { name: "Collapse Color recipes", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(inactive).not.toBeFocused();
    // The disclosure keeps working.
    await sidebar.getByRole("button", { name: "Collapse Color recipes", exact: true }).click();
    await expect(sidebar.getByRole("button", { name: "Expand Color recipes", exact: true })).toBeVisible();
    await sidebar.getByRole("button", { name: "Expand Color recipes", exact: true }).click();
    await expect(sidebar.locator('a[aria-current="page"]')).toBeVisible();
    expect(await sidebar.locator('a[aria-current="page"]').evaluate((a) => getComputedStyle(a).color)).toBe(currentBefore);
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => window.scrollY)).toBe(readingY);
    assertNoConsoleErrors();
  });

  test("twelve-level labels keep one previewed occurrence and no frame overlap", async ({ page, assertNoConsoleErrors }) => {
    await page.goto(DEEP_PAGE);
    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    const deepest = frame(sidebar, "Deep level 12 with a long wrapped editorial category label");
    await deepest.hover();
    await expect.poll(() => previewedBranches(sidebar)).toEqual(["Focus sidebar on Deep level 12 with a long wrapped editorial category label"]);
    const box = await deepest.boundingBox();
    const nav = await sidebar.locator("nav").boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(nav!.x + nav!.width + 0.5);
    assertNoConsoleErrors();
  });
});

test.describe("reduced motion", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("scope arrival marks the root without animating", async ({ page, assertNoConsoleErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(EDITORIAL_PAGE);
    await waitForSidebarHydration(page);
    const sidebar = desktopSidebar(page);
    await frame(sidebar, "Outline recipes").click();
    const arrived = sidebar.locator("[data-sidebar-arrived] > [data-sidebar-row]");
    await expect(arrived).toHaveCount(1);
    expect(await arrived.evaluate((row) => getComputedStyle(row).animationName)).toBe("none");
    await expect(arrived).toHaveCount(0);
    assertNoConsoleErrors();
  });
});

for (const width of [1023, 1024, 1440]) {
  test(`frames never overlap the link or disclosure and stay inside the sidebar at ${width}px`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(PAGE);
    let container: Locator;
    if (width < 1024) {
      await openMobileDrawer(page);
      container = mobileSidebar(page);
    } else {
      await waitForSidebarHydration(page);
      container = desktopSidebar(page);
    }
    const report = await container.locator("nav").evaluate((nav) => {
      const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
      return {
        // The fixture's level 10–12 labels already cross the edge (pre-existing); frames must not.
        outside: [...nav.querySelectorAll<HTMLElement>("[data-sidebar-focus]")].filter((focus) => {
          const f = focus.getBoundingClientRect();
          return f.width > 0 && f.right > nav.getBoundingClientRect().right + 0.5;
        }).length,
        overlaps: [...nav.querySelectorAll<HTMLElement>("[data-sidebar-focus]")].filter((focus) => {
          const row = focus.closest("[data-sidebar-row]")!;
          const f = focus.getBoundingClientRect();
          return [...row.querySelectorAll<HTMLElement>("a[href], button[aria-expanded]")].some((el) => overlap(f, el.getBoundingClientRect()));
        }).length,
        frames: nav.querySelectorAll("[data-sidebar-focus]").length,
      };
    });
    expect(report.frames).toBeGreaterThan(0);
    expect(report.overlaps).toBe(0);
    expect(report.outside).toBe(0);
    assertNoConsoleErrors();
  });
}

test.describe("mobile drawer, keyboard", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("an open tooltip consumes the first Escape; the second closes the drawer", async ({ page, assertNoConsoleErrors }) => {
    await page.goto(PAGE);
    await openMobileDrawer(page);
    const drawer = mobileSidebar(page);
    const subB = frame(drawer, "Sub B");
    await drawer.locator('input[aria-label="Filter navigation"]').focus();
    for (let i = 0; i < 80 && !(await subB.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(subB).toBeFocused();
    const tip = tooltip(page);
    await expect(tip).toBeVisible();
    const box = (await tip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    // Not hidden under the drawer: the tooltip is the topmost element at its centre.
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("[data-sidebar-tooltip]"), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
    await page.keyboard.press("Escape");
    await expect(tip).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open sidebar", exact: true })).toBeVisible();
    await expect.poll(() => previewedBranches(drawer)).toEqual([]);
    assertNoConsoleErrors();
  });
});

for (const width of [320, 390]) {
  test.describe(`touch drawer at ${width}px`, () => {
    test.use({ hasTouch: true, viewport: { width, height: 844 } });

    test("one tap focuses, keeps the drawer open and leaves no preview or tooltip", async ({ page, assertNoConsoleErrors }) => {
      await page.goto(PAGE);
      await openMobileDrawer(page);
      const drawer = mobileSidebar(page);
      const url = page.url();
      const target = frame(drawer, "Sub B");
      const size = (await target.boundingBox())!;
      expect(size.width).toBeGreaterThanOrEqual(40);
      expect(size.height).toBeGreaterThanOrEqual(44);
      await target.tap();
      await expect(focusedFrame(drawer, "Sub B")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
      await expect.poll(() => previewedBranches(drawer)).toEqual([]);
      await expect(tooltip(page)).toHaveCount(0);
      expect(page.url()).toBe(url);
      assertNoConsoleErrors();
    });
  });
}
