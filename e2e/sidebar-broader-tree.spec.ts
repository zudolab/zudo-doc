import { test, expect } from "./fixtures";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";
import { openMobileDrawer } from "./mobile-drawer-helpers";
import { spaClickSelector } from "./nav-helpers";

const PAGE = "/docs/guides/sub-a/page-1";

test("scope controls retain the article/filter and restore the configured tree", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  const article = await page.locator("h1").textContent();
  await page.evaluate(() => window.scrollTo(0, 120));
  const scroll = await page.evaluate(() => window.scrollY);
  await sidebar.getByRole("button", { name: "Focus sidebar on Sub A", exact: true }).click();
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Sub B"]')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${PAGE}/?$`));
  expect(await page.locator("h1").textContent()).toBe(article);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await sidebar.getByRole("textbox", { name: "Filter navigation" }).fill("Sub B");
  await sidebar.locator("[data-sidebar-broaden]").click();
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Sub B"]')).toBeVisible();
  await expect(sidebar.getByRole("textbox")).toHaveValue("Sub B");
  await sidebar.locator("[data-sidebar-broaden]").click();
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
  await sidebar.getByRole("button", { name: "Focus sidebar on Sub B", exact: true }).click();
  await sidebar.locator("[data-sidebar-restore]").click();
  await expect(sidebar.getByRole("textbox")).toHaveValue("Sub B");
  await sidebar.getByRole("textbox").fill("");
  await expect(sidebar.locator('a[aria-current="page"]')).toBeVisible();
  assertNoConsoleErrors();
});

test("native same-branch navigation, refresh and Back/Forward keep a valid selected scope", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  await sidebar.getByRole("button", { name: "Focus sidebar on Sub A", exact: true }).click();
  await spaClickSelector(page, '#desktop-sidebar a[href$="/guides/sub-a/page-2/"], #desktop-sidebar a[href$="/guides/sub-a/page-2"]');
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('[data-sidebar-restore]')).toBeVisible();
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Sub B"]')).toHaveCount(0);
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('[data-sidebar-restore]')).toBeVisible();
  await page.goBack();
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /sub-a\/page-1\/?$/);
  await page.goForward();
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /sub-a\/page-2\/?$/);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Sub B"]')).toHaveCount(0);
  assertNoConsoleErrors();
});

for (const width of [320, 390, 1023]) {
  test(`mobile scope actions stay open at ${width}px and links close the drawer`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(PAGE);
    await openMobileDrawer(page);
    const drawer = page.locator("[data-zd-mobile-sidebar]");
    const scroll = await page.evaluate(() => window.scrollY);
    await drawer.getByRole("button", { name: "Focus sidebar on Sub A", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
    await drawer.locator("[data-sidebar-broaden]").click();
    await drawer.locator("[data-sidebar-broaden]").click();
    await expect(drawer.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
    await drawer.getByRole("button", { name: "Focus sidebar on Sub A", exact: true }).click();
    await drawer.locator("[data-sidebar-restore]").click();
    await expect(drawer).not.toHaveAttribute("inert", "");
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await spaClickSelector(page, '[data-zd-mobile-sidebar] a[href$="/guides/sub-a/page-2/"], [data-zd-mobile-sidebar] a[href$="/guides/sub-a/page-2"]');
    await expect(page.getByRole("button", { name: "Open sidebar", exact: true })).toBeVisible();
    assertNoConsoleErrors();
  });
}

const DEEP_PAGE = `/docs/guides/deep/${Array.from({ length: 11 }, (_, i) => `level-${String(i + 2).padStart(2, "0")}`).join("/")}/page`;

test("twelve-level 390px tree broadens one editorial parent at a time", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(DEEP_PAGE);
  await openMobileDrawer(page);
  const drawer = page.locator("[data-zd-mobile-sidebar]");
  await drawer.getByRole("button", { name: "Focus sidebar on Deep level 12 with a long wrapped editorial category label", exact: true }).click();
  for (let depth = 11; depth >= 1; depth--) {
    await drawer.locator("[data-sidebar-broaden]").click();
    await expect(drawer.locator(`[data-sidebar-focus][data-sidebar-tip-detail="Deep level ${depth} with a long wrapped editorial category label"]`)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
  }
  await drawer.locator("[data-sidebar-restore]").click();
  await expect(drawer.locator('a[aria-current="page"]')).toBeVisible();
  assertNoConsoleErrors();
});

test("refresh preserves a branch focused away from the article", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  await sidebar.getByRole("button", { name: "Focus sidebar on Sub B", exact: true }).click();
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Sub A"]')).toHaveCount(0);
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Sub A"]')).toHaveCount(0);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Sub B"]')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PAGE}/?$`));
  assertNoConsoleErrors();
});

const EDITORIAL_PAGE = "/docs/editorial/background";

async function configuredRootLabels(sidebar: import("@playwright/test").Locator) {
  return sidebar.locator("[data-sidebar-tree-root] > div").evaluateAll((roots) =>
    roots.map((root) => root.querySelector("[data-sidebar-focus]")?.getAttribute("aria-label")),
  );
}

test("serialized editorial parents broaden one level and Restore reinstates the authored multi-root forest", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(EDITORIAL_PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  const expectedRoots = ["Focus sidebar on Color recipes", "Focus sidebar on Outline recipes"];
  expect(await configuredRootLabels(sidebar)).toEqual(expectedRoots);
  await expect(sidebar.getByRole("button", { name: "Expand Outline recipes", exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "Expand Outline recipes", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "Outline color", exact: true })).toBeVisible();
  await sidebar.locator("[data-sidebar-broaden]").click();
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces & borders"]')).toHaveCount(1);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Utility reference"]')).toHaveCount(0);
  await expect(sidebar.locator("[data-sidebar-broaden]")).toHaveText("↑Broaden tree");
  await expect(sidebar.locator("[data-sidebar-scope-hint]")).toHaveCount(0);
  await sidebar.locator("[data-sidebar-broaden]").click();
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Utility reference"]')).toHaveCount(1);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces & borders"]')).toHaveCount(1);
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
  await sidebar.getByRole("button", { name: "Focus sidebar on Surfaces & borders", exact: true }).click();
  await sidebar.locator("[data-sidebar-restore]").click();
  expect(await configuredRootLabels(sidebar)).toEqual(expectedRoots);
  await expect(sidebar.getByRole("button", { name: "Expand Outline recipes", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Outline color", exact: true })).toHaveCount(0);
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /editorial\/background\/?$/);
  await expect(page).toHaveURL(new RegExp(`${EDITORIAL_PAGE}/?$`));
  assertNoConsoleErrors();
});

test("keyboard scope actions preserve URL hash, article position and desktop TOC", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${EDITORIAL_PAGE}#paint-surface`);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  const toc = page.locator("[data-zd-toc]");
  await expect(toc).toBeVisible();
  await expect(toc.locator('a[href="#paint-surface"]')).toHaveAttribute("aria-current", "true");
  const tocLinks = await toc.locator("a").evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), text: link.textContent })));
  const readingY = await page.evaluate(() => window.scrollY);
  expect(readingY).toBeGreaterThan(0);
  const url = page.url();
  const article = await page.locator("h1").textContent();
  const focus = sidebar.getByRole("button", { name: "Focus sidebar on Color recipes", exact: true });
  await focus.focus();
  await expect(focus).toBeFocused();
  await focus.press("Enter");
  await expect(sidebar.locator("[data-sidebar-tree-root] a").first()).toBeFocused();
  await sidebar.locator("[data-sidebar-broaden]").focus();
  await page.keyboard.press("Space");
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces & borders"]')).toHaveCount(1);
  await expect(sidebar.locator("[data-sidebar-tree-root] a").first()).toBeFocused();
  await sidebar.locator("[data-sidebar-broaden]").focus();
  await page.keyboard.press("Space");
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Utility reference"]')).toHaveCount(1);
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
  await expect(focus).toBeFocused();
  await page.keyboard.press("Space");
  await expect(sidebar.locator("[data-sidebar-tree-root] a").first()).toBeFocused();
  await sidebar.locator("[data-sidebar-restore]").focus();
  await expect(sidebar.locator("[data-sidebar-restore]")).toBeFocused();
  await page.keyboard.press("Enter");
  expect(page.url()).toBe(url);
  expect(await page.locator("h1").textContent()).toBe(article);
  expect(await page.evaluate(() => window.scrollY)).toBe(readingY);
  expect(await toc.locator("a").evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), text: link.textContent })))).toEqual(tocLinks);
  await expect(toc.locator('a[href="#paint-surface"]')).toHaveAttribute("aria-current", "true");
  assertNoConsoleErrors();
});

test.describe("touch scope controls", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("touch focus, Broaden and Restore retain the mobile drawer and article", async ({ page, assertNoConsoleErrors }) => {
    await page.goto(`${EDITORIAL_PAGE}#paint-surface`);
    await openMobileDrawer(page);
    const drawer = page.locator("[data-zd-mobile-sidebar]");
    const url = page.url();
    const readingY = await page.evaluate(() => window.scrollY);
    await drawer.getByRole("button", { name: "Focus sidebar on Color recipes", exact: true }).tap();
    await expect(drawer.locator('[data-sidebar-focus][data-sidebar-tip-detail="Outline recipes"]')).toHaveCount(0);
    await drawer.locator("[data-sidebar-broaden]").tap();
    await expect(drawer.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces & borders"]')).toHaveCount(1);
    await drawer.locator("[data-sidebar-restore]").tap();
    await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
    await expect(drawer).not.toHaveAttribute("inert", "");
    expect(await configuredRootLabels(drawer)).toEqual(["Focus sidebar on Color recipes", "Focus sidebar on Outline recipes"]);
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => window.scrollY)).toBe(readingY);
    assertNoConsoleErrors();
  });
});

test("native article links widen only to the nearest common editorial ancestor", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(EDITORIAL_PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  await sidebar.getByRole("button", { name: "Focus sidebar on Color recipes", exact: true }).click();
  expect(await spaClickSelector(page, 'main a[href$="/editorial/outline/"], main a[href$="/editorial/outline"]')).toBe(true);
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces & borders"]')).toHaveCount(1);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Utility reference"]')).toHaveCount(0);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Motion recipes"]')).toHaveCount(0);
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /editorial\/outline\/?$/);
  expect(await spaClickSelector(page, 'main a[href$="/editorial/motion/"], main a[href$="/editorial/motion"]')).toBe(true);
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Utility reference"]')).toHaveCount(1);
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /editorial\/motion\/?$/);
  assertNoConsoleErrors();
});

test("modified sidebar links open a native new tab without changing the selected page or tree", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(EDITORIAL_PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  await sidebar.getByRole("button", { name: "Focus sidebar on Color recipes", exact: true }).click();
  const url = page.url();
  const popupPromise = page.context().waitForEvent("page");
  await sidebar.getByRole("link", { name: "Border color", exact: true }).click({ modifiers: ["ControlOrMeta"] });
  const popup = await popupPromise;
  try {
    await expect(popup).toHaveURL(/\/docs\/editorial\/border\/?$/);
    await expect(popup.locator("h1")).toHaveText("Border color");
    expect(page.url()).toBe(url);
    await expect(sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Outline recipes"]')).toHaveCount(0);
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /editorial\/background\/?$/);
  } finally {
    await popup.close();
  }
  assertNoConsoleErrors();
});

/** Per focus-frame control: whether its row's label text paints under it, and its box relative to the nav (#4507). */
async function focusControlLayout(container: import("@playwright/test").Locator) {
  return container.locator("nav").evaluate((nav) => {
    const navRight = nav.getBoundingClientRect().right;
    return [...nav.querySelectorAll<HTMLElement>("[data-sidebar-focus]")].map((focus) => {
      const row = focus.parentElement!.querySelector<HTMLElement>(":scope > a, :scope > button[aria-expanded]")!;
      const f = focus.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(row);
      const overlaps = [...range.getClientRects()].some(
        (r) => r.width > 0 && r.right > f.left + 0.5 && r.left < f.right - 0.5 && r.bottom > f.top && r.top < f.bottom,
      );
      return { label: focus.getAttribute("aria-label"), overlaps, width: f.width, height: f.height, right: f.right, navRight };
    });
  });
}

for (const { width, drawer } of [
  { width: 1024, drawer: false },
  { width: 1280, drawer: false },
  { width: 390, drawer: true },
]) {
  test(`twelve-level tree keeps branch focus clear of category labels at ${width}px`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(DEEP_PAGE);
    let container;
    if (drawer) {
      await openMobileDrawer(page);
      container = page.locator("[data-zd-mobile-sidebar]");
    } else {
      await waitForSidebarHydration(page);
      container = desktopSidebar(page);
    }
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Deep level 12 with a long wrapped editorial category label"]')).toBeVisible();
    const controls = await focusControlLayout(container);
    expect(controls.length).toBeGreaterThanOrEqual(12);
    for (const control of controls) {
      expect(control.overlaps, `${control.label} overlaps its label`).toBe(false);
      expect(control.width, `${control.label} width`).toBeGreaterThanOrEqual(24);
      expect(control.right, `${control.label} stays inside the nav`).toBeLessThanOrEqual(control.navRight + 0.5);
    }
    const deepest = container.getByRole("button", { name: "Focus sidebar on Deep level 12 with a long wrapped editorial category label", exact: true });
    const url = page.url();
    await deepest.focus();
    await page.keyboard.press("Enter");
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Deep level 11 with a long wrapped editorial category label"]')).toHaveCount(0);
    expect(page.url()).toBe(url);
    assertNoConsoleErrors();
  });
}

// Page-backed node-mode baseline (#4549) and explicit-only disclosure persistence (#4550).
const WIND_PAGE = "/docs/wind/utility/surfaces/background";
const WIND_SLUG = "wind/utility/surfaces/background";
const linkTo = (container: string, path: string) => `${container} a[href$="${path}/"], ${container} a[href$="${path}"]`;

type StoredScope = { version?: number; context: string; page: string; selected: string | null; query: string; expansion: Record<string, boolean> } | null;
const storedScope = (page: import("@playwright/test").Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("zd-sidebar-scope") ?? "null") as StoredScope);
async function expectStoredPage(page: import("@playwright/test").Page, slug: string) {
  await expect.poll(async () => (await storedScope(page))?.page).toBe(slug);
}

for (const { width, mobile } of [{ width: 1440, mobile: false }, { width: 390, mobile: true }]) {
  test(`node baseline keeps the linked section root once and broadens through real ancestors at ${width}px`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${WIND_PAGE}#paint-surface`);
    let container;
    if (mobile) {
      await openMobileDrawer(page);
      container = page.locator("[data-zd-mobile-sidebar]");
    } else {
      await waitForSidebarHydration(page);
      container = desktopSidebar(page);
    }
    const url = page.url();
    const readingY = await page.evaluate(() => window.scrollY);
    const surfaces = ["Sidebar is already focused on Surfaces & borders"];
    expect(await configuredRootLabels(container)).toEqual(surfaces);
    await expect(container.locator("[data-sidebar-tree-root] a").first()).toHaveAttribute("href", /\/docs\/wind\/utility\/surfaces\/?$/);
    await expect(container.getByRole("link", { name: "Surfaces & borders", exact: true })).toHaveCount(1);
    await expect(container.getByRole("link", { name: "Background color", exact: true })).toBeVisible();
    await expect(container.getByRole("link", { name: "Border color", exact: true })).toBeVisible();
    await expect(container.getByRole("link", { name: "Utility reference", exact: true })).toHaveCount(0);
    await expect(container.locator("[data-sidebar-restore]")).toHaveCount(0);
    await container.locator("[data-sidebar-broaden]").click();
    expect(await configuredRootLabels(container)).toEqual(["Sidebar is already focused on Utility reference"]);
    await expect(container.getByRole("link", { name: "Surfaces & borders", exact: true })).toHaveCount(1);
    await expect(container.getByRole("link", { name: "Wind", exact: true })).toHaveCount(0);
    await container.locator("[data-sidebar-broaden]").click();
    expect(await configuredRootLabels(container)).toEqual(["Sidebar is already focused on Wind"]);
    await expect(container.getByRole("link", { name: "Utility reference", exact: true })).toHaveCount(1);
    await expect(container.getByRole("link", { name: "Surfaces & borders", exact: true })).toHaveCount(1);
    // Wind is one root of the automatic multi-root forest, so one more step widens to it.
    await container.locator("[data-sidebar-broaden]").click();
    await expect(container.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
    await expect(container.locator('[data-sidebar-focus][data-sidebar-tip-detail="Guides"]')).toHaveCount(1);
    await container.getByRole("button", { name: "Focus sidebar on Wind", exact: true }).click();
    await container.locator("[data-sidebar-restore]").click();
    expect(await configuredRootLabels(container)).toEqual(surfaces);
    await expect(container.locator('a[aria-current="page"]')).toHaveAttribute("href", /surfaces\/background\/?$/);
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => window.scrollY)).toBe(readingY);
    if (mobile) await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
    expect(await configuredRootLabels(mobile ? desktopSidebar(page) : page.locator("[data-zd-mobile-sidebar]"))).toEqual(surfaces);
    assertNoConsoleErrors();
  });

  test(`automatic route reveal is never persisted at ${width}px with the drawer unopened`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(WIND_PAGE);
    await waitForSidebarHydration(page);
    await expectStoredPage(page, WIND_SLUG);
    expect((await storedScope(page))?.expansion).toEqual({});
    const steps: Array<[string, string]> = [
      ["/docs/wind/utility/surfaces/border", "wind/utility/surfaces/border"],
      ["/docs/wind/utility/layout/spacing", "wind/utility/layout/spacing"],
      ["/docs/wind/utility/surfaces/background", WIND_SLUG],
    ];
    for (const [path, slug] of steps) {
      expect(await spaClickSelector(page, linkTo("main", path))).toBe(true);
      await expectStoredPage(page, slug);
      expect((await storedScope(page))?.expansion).toEqual({});
    }
    for (const [move, slug] of [["back", "wind/utility/layout/spacing"], ["back", "wind/utility/surfaces/border"], ["forward", "wind/utility/layout/spacing"]] as const) {
      await (move === "back" ? page.goBack() : page.goForward());
      await expectStoredPage(page, slug);
      expect((await storedScope(page))?.expansion).toEqual({});
    }
    await page.reload();
    await waitForSidebarHydration(page);
    await expectStoredPage(page, "wind/utility/layout/spacing");
    expect((await storedScope(page))?.expansion).toEqual({});
    await page.goto("/docs/guides/sub-a/page-1");
    await waitForSidebarHydration(page);
    await expectStoredPage(page, "guides/sub-a/page-1");
    expect((await storedScope(page))?.expansion).toEqual({});
    await page.goto(WIND_PAGE);
    await waitForSidebarHydration(page);
    const sidebar = mobile ? page.locator("[data-zd-mobile-sidebar]") : desktopSidebar(page);
    expect(await configuredRootLabels(sidebar)).toEqual(["Sidebar is already focused on Surfaces & borders"]);
    if (mobile) await expect(page.getByRole("button", { name: "Open sidebar", exact: true })).toHaveAttribute("aria-expanded", "false");
    assertNoConsoleErrors();
  });
}

test("explicit choices persist, an active branch stays closed for its page, and the next destination reveals", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(WIND_PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  const drawer = page.locator("[data-zd-mobile-sidebar]");
  await sidebar.locator("[data-sidebar-broaden]").click();
  await sidebar.locator("[data-sidebar-broaden]").click();
  expect(await configuredRootLabels(sidebar)).toEqual(["Sidebar is already focused on Wind"]);
  await sidebar.getByRole("button", { name: "Collapse Surfaces & borders", exact: true }).click();
  await sidebar.getByRole("button", { name: "Expand Layout", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "Background color", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Spacing", exact: true })).toBeVisible();
  await expect.poll(async () => Object.values((await storedScope(page))?.expansion ?? {}).sort()).toEqual([false, true]);
  // Same-page hash and filter changes are not destinations.
  await page.locator('[data-zd-toc] a[href="#related"]').click();
  await expect(page).toHaveURL(/#related$/);
  await sidebar.getByRole("textbox", { name: "Filter navigation" }).fill("Border");
  await sidebar.getByRole("textbox", { name: "Filter navigation" }).fill("");
  await expect(sidebar.getByRole("button", { name: "Expand Surfaces & borders", exact: true })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Expand Surfaces & borders", exact: true, includeHidden: true })).toHaveCount(1);
  expect(await spaClickSelector(page, linkTo("main", "/docs/wind/utility/surfaces/border"))).toBe(true);
  await expectStoredPage(page, "wind/utility/surfaces/border");
  await expect(sidebar.getByRole("button", { name: "Collapse Surfaces & borders", exact: true })).toBeVisible();
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /surfaces\/border\/?$/);
  expect(Object.values((await storedScope(page))?.expansion ?? {})).toEqual([true]);
  expect(await spaClickSelector(page, linkTo("main", "/docs/wind/utility/layout/spacing"))).toBe(true);
  await expectStoredPage(page, "wind/utility/layout/spacing");
  await expect(sidebar.getByRole("button", { name: "Collapse Layout", exact: true })).toBeVisible();
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.getByRole("button", { name: "Collapse Layout", exact: true })).toBeVisible();
  await sidebar.getByRole("textbox", { name: "Filter navigation" }).fill("o");
  await sidebar.locator("[data-sidebar-restore]").click();
  await expect.poll(async () => await storedScope(page)).toMatchObject({ selected: null, query: "o", expansion: {} });
  await expect(sidebar.getByRole("textbox", { name: "Filter navigation" })).toHaveValue("o");
  for (const container of [sidebar, drawer]) {
    await expect(container.getByRole("textbox", { name: "Filter navigation", includeHidden: true })).toHaveValue("o");
    expect(await configuredRootLabels(container)).toEqual(["Sidebar is already focused on Surfaces & borders"]);
  }
  assertNoConsoleErrors();
});

test("legacy expansion resets once; scope, query and context boundaries survive", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(WIND_PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  await expectStoredPage(page, WIND_SLUG);
  const context = (await storedScope(page))!.context;
  const surfacesId = await sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Surfaces & borders"]').getAttribute("data-sidebar-focus-scope");
  await sidebar.locator("[data-sidebar-broaden]").click();
  const utilityId = await sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Utility reference"]').getAttribute("data-sidebar-focus-scope");
  const layoutId = await sidebar.locator('[data-sidebar-focus][data-sidebar-tip-detail="Layout"]').getAttribute("data-sidebar-focus-scope");
  const write = (value: unknown) => page.evaluate((record) => sessionStorage.setItem("zd-sidebar-scope", JSON.stringify(record)), value);
  // Legacy records have no version and mix automatic reveal with user toggles.
  await write({ context, page: WIND_SLUG, selected: utilityId, query: "Color", expansion: { [layoutId!]: true, [surfacesId!]: true } });
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.getByRole("textbox", { name: "Filter navigation" })).toHaveValue("Color");
  await expect.poll(async () => await storedScope(page)).toMatchObject({ version: 2, selected: utilityId, query: "Color", expansion: {} });
  await sidebar.getByRole("textbox", { name: "Filter navigation" }).fill("");
  expect(await configuredRootLabels(sidebar)).toEqual(["Sidebar is already focused on Utility reference"]);
  await sidebar.getByRole("button", { name: "Expand Layout", exact: true }).click();
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.getByRole("button", { name: "Collapse Layout", exact: true })).toBeVisible();
  expect((await storedScope(page))?.expansion).toEqual({ [layoutId!]: true });
  // A stored scope equal to the destination baseline is the baseline.
  await write({ version: 2, context, page: "wind/utility/surfaces/border", selected: surfacesId, query: "", expansion: {} });
  await page.reload();
  await waitForSidebarHydration(page);
  await expect.poll(async () => (await storedScope(page))?.selected).toBeNull();
  await expect(sidebar.locator("[data-sidebar-restore]")).toHaveCount(0);
  // Another context (locale/version/topology) never applies.
  await write({ version: 2, context: `other:${context}`, page: WIND_SLUG, selected: utilityId, query: "stale", expansion: { [layoutId!]: true } });
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.getByRole("textbox", { name: "Filter navigation" })).toHaveValue("");
  expect(await configuredRootLabels(sidebar)).toEqual(["Sidebar is already focused on Surfaces & borders"]);
  assertNoConsoleErrors();
});
