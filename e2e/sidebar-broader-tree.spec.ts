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
  await sidebar.getByRole("button", { name: "Show only this branch: Sub A", exact: true }).click();
  await expect(sidebar.getByRole("button", { name: "Show only this branch: Sub B", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${PAGE}/?$`));
  expect(await page.locator("h1").textContent()).toBe(article);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await sidebar.getByRole("textbox", { name: "Filter navigation" }).fill("Sub B");
  await sidebar.locator("[data-sidebar-broaden]").click();
  await expect(sidebar.getByRole("button", { name: "Show only this branch: Sub B", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("textbox")).toHaveValue("Sub B");
  await sidebar.locator("[data-sidebar-broaden]").click();
  await sidebar.locator("[data-sidebar-restore]").click();
  await expect(sidebar.getByRole("textbox")).toHaveValue("Sub B");
  await sidebar.getByRole("textbox").fill("");
  await expect(sidebar.locator('a[aria-current="page"]')).toBeVisible();
  assertNoConsoleErrors();
});

test("native same-branch navigation, refresh and Back keep a valid selected scope", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(PAGE);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);
  await sidebar.getByRole("button", { name: "Show only this branch: Sub A", exact: true }).click();
  await spaClickSelector(page, '#desktop-sidebar a[href$="/guides/sub-a/page-2/"], #desktop-sidebar a[href$="/guides/sub-a/page-2"]');
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('[data-sidebar-restore]')).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Show only this branch: Sub B", exact: true })).toHaveCount(0);
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('[data-sidebar-restore]')).toBeVisible();
  await page.goBack();
  await waitForSidebarHydration(page);
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute("href", /sub-a\/page-1\/?$/);
  assertNoConsoleErrors();
});

for (const width of [320, 390, 1023]) {
  test(`mobile scope actions stay open at ${width}px and links close the drawer`, async ({ page, assertNoConsoleErrors }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(PAGE);
    await openMobileDrawer(page);
    const drawer = page.locator("[data-zd-mobile-sidebar]");
    const scroll = await page.evaluate(() => window.scrollY);
    await drawer.getByRole("button", { name: "Show only this branch: Sub A", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
    await drawer.locator("[data-sidebar-broaden]").click();
    await drawer.locator("[data-sidebar-broaden]").click();
    await drawer.locator("[data-sidebar-restore]").click();
    await expect(drawer).not.toHaveAttribute("inert", "");
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await spaClickSelector(page, '[data-zd-mobile-sidebar] a[href$="/guides/sub-a/page-2/"], [data-zd-mobile-sidebar] a[href$="/guides/sub-a/page-2"]');
    await expect(page.getByRole("button", { name: "Open sidebar", exact: true })).toBeVisible();
    assertNoConsoleErrors();
  });
}

test("twelve-level 390px tree broadens one editorial parent at a time", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/docs/guides/deep/${Array.from({ length: 11 }, (_, i) => `level-${String(i + 2).padStart(2, "0")}`).join("/")}/page`);
  await openMobileDrawer(page);
  const drawer = page.locator("[data-zd-mobile-sidebar]");
  await drawer.getByRole("button", { name: "Show only this branch: Deep level 12 with a long wrapped editorial category label", exact: true }).click();
  for (let depth = 11; depth >= 1; depth--) {
    await drawer.locator("[data-sidebar-broaden]").click();
    await expect(drawer.getByRole("button", { name: `Show only this branch: Deep level ${depth} with a long wrapped editorial category label`, exact: true })).toHaveCount(1);
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
  await sidebar.getByRole("button", { name: "Show only this branch: Sub B", exact: true }).click();
  await expect(sidebar.getByRole("button", { name: "Show only this branch: Sub A", exact: true })).toHaveCount(0);
  await page.reload();
  await waitForSidebarHydration(page);
  await expect(sidebar.getByRole("button", { name: "Show only this branch: Sub A", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Show only this branch: Sub B", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PAGE}/?$`));
  assertNoConsoleErrors();
});
