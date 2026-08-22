import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";
import { desktopSidebar } from "./sidebar-helpers";
import type { Page } from "@playwright/test";

const NOTES_INDEX = "/docs/notes";
const JOURNAL_INDEX = "/docs/journal";

/**
 * Note-tray sidebars intentionally do not use waitForSidebarHydration: an
 * index tray has no collapse button. Waiting for the tray's own index link
 * proves that the SidebarTree island has rendered without assuming a tree
 * category control exists.
 */
async function waitForTraySidebar(page: Page, slug: string) {
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached", timeout: 5000 });
  await sidebar
    .locator(`nav a[href="/docs/${slug}"], nav a[href="/docs/${slug}/"]`)
    .first()
    .waitFor({ state: "attached", timeout: 5000 });
}

test.describe("Sidebar note trays", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("index trays render flat numbered rows without category controls", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(`${NOTES_INDEX}/second-note`, { waitUntil: "load" });
    await waitForTraySidebar(page, "notes");

    const sidebar = desktopSidebar(page);
    const trayLinks = sidebar.locator(
      'a[href$="/first-note"], a[href$="/first-note/"], a[href$="/second-note"], a[href$="/second-note/"], a[href$="/third-note"], a[href$="/third-note/"], a[href$="/fourth-note"], a[href$="/fourth-note/"], a[href$="/fifth-note"], a[href$="/fifth-note/"]',
    );

    await expect(trayLinks).toHaveCount(5);
    await expect(trayLinks.nth(0)).toContainText("01");
    await expect(trayLinks.nth(0)).toContainText("First Note");
    await expect(trayLinks.nth(1)).toContainText("02");
    await expect(trayLinks.nth(1)).toContainText("Second Note");
    await expect(trayLinks.nth(2)).toContainText("03");
    await expect(trayLinks.nth(2)).toContainText("Third Note");
    await expect(trayLinks.nth(3)).toContainText("04");
    await expect(trayLinks.nth(3)).toContainText("Fourth Note");
    await expect(trayLinks.nth(4)).toContainText("05");
    await expect(trayLinks.nth(4)).toContainText("Fifth Note");

    await expect(
      sidebar.locator('button[aria-label^="Collapse"], button[aria-label^="Expand"]'),
    ).toHaveCount(0);
    assertNoConsoleErrors();
  });

  test("month trays group chronologically, toggle groups, and retain state across SPA navigation", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/docs/journal/journal-middle", { waitUntil: "load" });
    await waitForTraySidebar(page, "journal");

    const sidebar = desktopSidebar(page);
    const august = sidebar.getByRole("button", { name: "Collapse 2026 August", exact: true });
    const july = sidebar.getByRole("button", { name: "Expand 2026 July", exact: true });
    const june = sidebar.getByRole("button", { name: "Expand 2026 June", exact: true });

    await expect(august).toBeVisible();
    await expect(july).toBeVisible();
    await expect(june).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Journal Middle/ })).toBeVisible();

    await august.click();
    await expect(
      sidebar.getByRole("button", { name: "Expand 2026 August", exact: true }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Journal Middle/ })).not.toBeVisible();

    await july.click();
    await expect(
      sidebar.getByRole("button", { name: "Collapse 2026 July", exact: true }),
    ).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Journal July/ })).toBeVisible();

    const navigated = await spaClick(page, JOURNAL_INDEX);
    expect(navigated).toBe(true);
    await expect(
      sidebar.getByRole("button", { name: "Expand 2026 August", exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("button", { name: "Collapse 2026 July", exact: true }),
    ).toBeVisible();
    assertNoConsoleErrors();
  });

  test("year trays expose grouped collapse controls and highlight the active row", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/docs/series-year/series-current", { waitUntil: "load" });
    await waitForTraySidebar(page, "series-year");

    const sidebar = desktopSidebar(page);
    await expect(
      sidebar.getByRole("button", { name: "Collapse 2026", exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("button", { name: "Expand 2025", exact: true }),
    ).toBeVisible();

    const activeRow = sidebar.locator('a[data-nav-active][aria-current="page"]');
    await expect(activeRow).toHaveCount(1);
    await expect(activeRow).toContainText("Series Current");

    await sidebar.getByRole("button", { name: "Expand 2025", exact: true }).click();
    await expect(sidebar.getByRole("link", { name: /Series Early/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Series Late/ })).toBeVisible();
    assertNoConsoleErrors();
  });

  test("dated tray pages show the header date line and a neighbour date in the pager", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto("/docs/journal/journal-middle", { waitUntil: "load" });
    await waitForTraySidebar(page, "journal");

    await expect(page.locator("[data-doc-date]")).toContainText(
      "Aug 10, 2026 · Updated Aug 21, 2026",
    );

    const pager = page.locator("[data-doc-pager]");
    await expect(pager).toContainText("Journal July");
    await expect(pager).toContainText("Jul 14, 2026");
    await expect(pager).toContainText("Journal Latest");
    await expect(pager).toContainText("Aug 22, 2026");
    assertNoConsoleErrors();
  });
});
