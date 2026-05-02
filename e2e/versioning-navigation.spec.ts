import { test, expect } from "@playwright/test";
import { desktopSidebar } from "./sidebar-helpers";

/**
 * E2E tests for versioned navigation links.
 *
 * Verifies that header nav and sidebar links include the version prefix
 * on versioned pages (e.g. /v/1.0/docs/...) and omit it on latest pages.
 *
 * Uses the versioning fixture which has:
 * - Latest docs at /docs/getting-started
 * - Version 1.0 docs at /v/1.0/docs/getting-started
 * - headerNav with a single "Getting Started" entry at /docs/getting-started
 */

test.describe("Versioned navigation: header nav links", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("header nav links include version prefix on versioned page", async ({
    page,
  }) => {
    await page.goto("/v/1.0/docs/getting-started", { waitUntil: "load" });

    const navLinks = page.locator("[data-header-nav] [data-nav-item]");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      expect(href).toContain("/v/1.0/");
    }
  });

  test("header nav links do NOT include version prefix on latest page", async ({
    page,
  }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const navLinks = page.locator("[data-header-nav] [data-nav-item]");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      expect(href).not.toContain("/v/");
    }
  });
});

test.describe("Versioned navigation: sidebar links", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("sidebar links include version prefix on versioned page", async ({
    page,
  }) => {
    await page.goto("/v/1.0/docs/getting-started", { waitUntil: "load" });

    const sidebar = desktopSidebar(page);
    const sidebarLinks = sidebar.locator("a[href*='/docs/']");
    const count = await sidebarLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await sidebarLinks.nth(i).getAttribute("href");
      expect(href).toContain("/v/1.0/");
    }
  });

  test("sidebar links do NOT include version prefix on latest page", async ({
    page,
  }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const sidebar = desktopSidebar(page);
    const sidebarLinks = sidebar.locator("a[href*='/docs/']");
    const count = await sidebarLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await sidebarLinks.nth(i).getAttribute("href");
      expect(href).not.toContain("/v/");
    }
  });
});

test.describe("Versioned navigation: version switcher visibility", () => {
  test("version switcher is visible on versioned page", async ({ page }) => {
    await page.goto("/v/1.0/docs/getting-started", { waitUntil: "load" });
    const switcher = page.locator("[data-version-switcher]");
    await expect(switcher).toBeVisible();
  });

  test("version switcher is visible on landing page", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    // On the landing page, the version switcher appears in the header
    const headerSwitcher = page.locator("[data-version-switcher]");
    await expect(headerSwitcher).toBeVisible();
  });
});
