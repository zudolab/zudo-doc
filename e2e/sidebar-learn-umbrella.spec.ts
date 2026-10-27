// The showcase's umbrella helper (src/lib/learn-chrome.tsx) on the sidebar
// fixture: Atlas is a linked root holding the complete Maps and Routes
// sections. The fixture has no Learn page, so its other sections run the
// helper's native fallback.
import { test, expect } from "./fixtures";
import type { Locator } from "@playwright/test";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";
import { openMobileDrawer } from "./mobile-drawer-helpers";
import { spaClickSelector } from "./nav-helpers";

const LANDING = "/docs/atlas";
const NORTH = "/docs/atlas-maps/regions/north";
const COASTAL = "/docs/atlas-routes/coastal";

const link = (sidebar: Locator, name: string) => sidebar.getByRole("link", { name, exact: true });
const disclosureOf = (sidebar: Locator, name: string) =>
  sidebar.getByRole("button", { name: new RegExp(`^(Expand|Collapse) ${name}$`) });
const hrefSelector = (scope: string, path: string) => `${scope} a[href$="${path}/"], ${scope} a[href$="${path}"]`;

test("fresh Atlas landing shows the linked root with collapsed linked branches", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(LANDING);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);

  await expect(link(sidebar, "Atlas")).toHaveAttribute("aria-current", "page");
  await expect(link(sidebar, "Maps")).toHaveAttribute("href", /\/docs\/atlas-maps\/?$/);
  await expect(link(sidebar, "Routes")).toHaveAttribute("href", /\/docs\/atlas-routes\/?$/);
  await expect(link(sidebar, "Legend")).toBeHidden();
  await expect(link(sidebar, "Coastal route")).toBeHidden();
  // Atlas is the ceiling of this context: nothing broader exists.
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);

  await disclosureOf(sidebar, "Maps").click();
  await expect(link(sidebar, "Legend")).toBeVisible();
  await expect(link(sidebar, "Regions")).toBeVisible();
  await expect(link(sidebar, "Coastal route")).toBeHidden();
  assertNoConsoleErrors();
});

test("a subsection starts at its own row, broadens to Atlas and restores its baseline", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(NORTH);
  await waitForSidebarHydration(page);
  const sidebar = desktopSidebar(page);

  await expect(link(sidebar, "Maps")).toBeVisible();
  await expect(link(sidebar, "North sheet")).toHaveAttribute("aria-current", "page");
  await expect(link(sidebar, "Atlas")).toBeHidden();
  await expect(link(sidebar, "Routes")).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, 80));
  const scroll = await page.evaluate(() => window.scrollY);
  // Guard against a vacuous check: the page must actually have scrolled.
  expect(scroll).toBe(80);
  await sidebar.locator("[data-sidebar-broaden]").click();
  await expect(link(sidebar, "Atlas")).toBeVisible();
  await expect(link(sidebar, "Routes")).toBeVisible();
  await expect(sidebar.locator("[data-sidebar-broaden]")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${NORTH}/?$`));
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);

  // Filtering keeps working inside the broadened forest.
  const filter = sidebar.getByRole("textbox", { name: "Filter navigation" });
  await filter.fill("Coastal");
  await expect(link(sidebar, "Coastal route")).toBeVisible();
  await expect(link(sidebar, "Legend")).toBeHidden();
  await filter.fill("");

  // The broader view survives navigation inside the shared context.
  await spaClickSelector(page, hrefSelector("#desktop-sidebar", COASTAL));
  await waitForSidebarHydration(page);
  await expect(link(sidebar, "Coastal route")).toHaveAttribute("aria-current", "page");
  await expect(link(sidebar, "Atlas")).toBeVisible();

  // At the Atlas ceiling the scope toolbar is omitted. Focus another branch,
  // then Restore returns to this page's baseline: the Routes row, not Atlas.
  await expect(sidebar.locator("[data-sidebar-scope-toolbar]")).toHaveCount(0);
  await sidebar.getByRole("button", { name: "Focus sidebar on Maps", exact: true }).click();
  await expect(link(sidebar, "Coastal route")).toBeHidden();
  await sidebar.locator("[data-sidebar-restore]").click();
  await expect(link(sidebar, "Routes")).toBeVisible();
  await expect(link(sidebar, "Atlas")).toBeHidden();
  await expect(link(sidebar, "Maps")).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${COASTAL}/?$`));

  await page.goBack();
  await waitForSidebarHydration(page);
  await expect(link(sidebar, "North sheet")).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await waitForSidebarHydration(page);
  await expect(link(sidebar, "Coastal route")).toHaveAttribute("aria-current", "page");
  await expect(link(sidebar, "Atlas")).toBeHidden();
  assertNoConsoleErrors();
});

test("the mobile drawer shares the hierarchy; scope actions keep it open and links close it", async ({ page, assertNoConsoleErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(NORTH);
  await openMobileDrawer(page);
  const drawer = page.locator("[data-zd-mobile-sidebar]");

  await expect(link(drawer, "Maps")).toBeVisible();
  await expect(link(drawer, "Atlas")).toBeHidden();
  await drawer.locator("[data-sidebar-broaden]").click();
  await expect(link(drawer, "Atlas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeVisible();
  await expect(drawer).not.toHaveAttribute("inert", "");

  // Below the landing page, branches keep their native expanded baseline.
  await expect(disclosureOf(drawer, "Routes")).toHaveAttribute("aria-expanded", "true");
  await spaClickSelector(page, hrefSelector("[data-zd-mobile-sidebar]", COASTAL));
  await expect(page.getByRole("button", { name: "Open sidebar", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${COASTAL}/?$`));
  assertNoConsoleErrors();
});
