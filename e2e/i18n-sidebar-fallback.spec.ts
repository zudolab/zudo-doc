import { test, expect, type Page, type Locator } from "@playwright/test";
import { getBasePath } from "./helpers";

/**
 * E2E tests for i18n sidebar fallback behavior.
 *
 * When a locale (JA, DE) doesn't have translations for certain pages,
 * the sidebar should still show those pages (falling back to EN content),
 * and a "not translated" banner should appear on fallback pages.
 *
 * Test pages: guides/sub-a and guides/sub-b exist only in EN content,
 * not in docs-ja or docs-de.
 */

const BASE = getBasePath();

// Desktop viewport so sidebar is always visible
test.use({ viewport: { width: 1280, height: 800 } });

function desktopSidebar(page: Page): Locator {
  return page.locator("#desktop-sidebar");
}

/** Wait for the React sidebar island to hydrate */
async function waitForSidebarHydration(page: Page) {
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached" });
  await page.waitForFunction(
    () => {
      const sidebar = document.querySelector("#desktop-sidebar");
      if (!sidebar) return false;
      const btn = sidebar.querySelector(
        'button[aria-label^="Collapse"], button[aria-label^="Expand"]',
      );
      if (!btn) return false;
      return Object.keys(btn).some((k) => k.startsWith("__react"));
    },
    null,
    { timeout: 5000 },
  );
}

test.describe("i18n sidebar fallback: JA locale", () => {
  test("JA sidebar shows Sub A and Sub B from EN fallback", async ({
    page,
  }) => {
    // Navigate to a JA fallback sub-page so the sidebar renders with
    // subcategory toggle buttons (index pages may not have them)
    await page.goto(`${BASE}/ja/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);

    // Sub A and Sub B should appear in the sidebar even though they
    // only exist in EN content (not in docs-ja)
    await expect(sidebar.getByText("Sub A")).toBeVisible();
    await expect(sidebar.getByText("Sub B")).toBeVisible();
  });

  test("JA sidebar shows translated pages alongside fallback entries", async ({
    page,
  }) => {
    await page.goto(`${BASE}/ja/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);

    // Translated pages should still be visible alongside fallback subcategories
    await expect(
      sidebar.getByRole("link", { name: "ドキュメントの書き方" }),
    ).toBeVisible();
    await expect(sidebar.getByText("Sub A")).toBeVisible();
  });

  test("JA fallback page shows untranslated notice banner", async ({
    page,
  }) => {
    await page.goto(`${BASE}/ja/docs/guides/sub-a/page-1`);

    // The fallback notice banner should be visible
    const banner = page.locator('[role="status"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(
      "このページはまだ翻訳されていません",
    );
  });

  test("JA translated page does NOT show fallback banner", async ({
    page,
  }) => {
    await page.goto(`${BASE}/ja/docs/guides/writing-docs`);

    // No fallback banner should exist on a translated page
    const banner = page.locator('[role="status"]');
    await expect(banner).toHaveCount(0);
  });

  test("JA fallback page renders EN content correctly", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`${BASE}/ja/docs/guides/sub-a/page-1`);

    // The page should load successfully with a title
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).not.toBeEmpty();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });

  test("navigating from JA sidebar to another fallback page works", async ({
    page,
  }) => {
    await page.goto(`${BASE}/ja/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);

    // Click a sibling page link inside Sub A in the sidebar
    await sidebar.getByRole("link", { name: "Test Page 2" }).click();
    await page.waitForURL(/\/ja\/docs\/guides\/sub-a\/page-2/);

    // Should show the fallback banner on the new page too
    const banner = page.locator('[role="status"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(
      "このページはまだ翻訳されていません",
    );
  });
});

test.describe("i18n sidebar fallback: DE locale", () => {
  test("DE sidebar shows Sub A and Sub B from EN fallback", async ({
    page,
  }) => {
    await page.goto(`${BASE}/de/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    await expect(sidebar.getByText("Sub A")).toBeVisible();
    await expect(sidebar.getByText("Sub B")).toBeVisible();
  });

  test("DE fallback page shows untranslated notice banner", async ({
    page,
  }) => {
    await page.goto(`${BASE}/de/docs/guides/sub-a/page-1`);

    const banner = page.locator('[role="status"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(
      "Diese Seite wurde noch nicht übersetzt",
    );
  });
});

test.describe("i18n sidebar fallback: EN locale (no fallback)", () => {
  test("EN pages do NOT show fallback banner", async ({ page }) => {
    await page.goto(`${BASE}/docs/guides/sub-a/page-1`);

    // EN is the default locale — no fallback banner should appear
    const banner = page.locator('[role="status"]');
    await expect(banner).toHaveCount(0);
  });

  test("EN sidebar shows Sub A and Sub B normally", async ({ page }) => {
    await page.goto(`${BASE}/docs/guides/sub-a/page-1`);
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);
    await expect(sidebar.getByText("Sub A")).toBeVisible();
    await expect(sidebar.getByText("Sub B")).toBeVisible();
  });
});
