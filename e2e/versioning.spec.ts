import { test, expect } from "@playwright/test";

/**
 * E2E tests for documentation versioning feature.
 *
 * Uses the versioning fixture which has:
 * - Latest docs at /docs/getting-started (title: "Getting Started")
 * - Version 1.0 docs at /v/1.0/docs/getting-started (title: "Getting Started (v1)")
 * - Version 1.0 configured with banner: "unmaintained"
 *
 * Note: The version switcher renders in both the header and the main content
 * area. Tests scope selectors to `main` to target the content version switcher.
 */

test.describe("Versioning: latest version pages", () => {
  test("latest version page loads correctly", async ({ page }) => {
    const response = await page.goto("/docs/getting-started", {
      waitUntil: "load",
    });
    expect(response?.status()).toBe(200);

    const title = await page.title();
    expect(title).toContain("Getting Started");
    expect(title).not.toContain("404");
  });

  test("latest version page contains expected content", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });
    const content = await page.textContent("body");
    expect(content).toContain("latest version");
    expect(content).toContain("current release");
  });

  test("version switcher is visible on latest page", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });
    const switcher = page.locator("main [data-version-switcher]");
    await expect(switcher).toBeVisible();
  });

  test("version switcher shows 'Latest' as current on latest page", async ({
    page,
  }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });
    const toggle = page.locator("main [data-version-toggle]");
    const text = await toggle.textContent();
    expect(text).toContain("Latest");
  });

  test("no version banner on latest page", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });
    const banner = page.locator("[role='note']");
    await expect(banner).toHaveCount(0);
  });
});

test.describe("Versioning: versioned pages", () => {
  test("versioned page loads correctly", async ({ page }) => {
    const response = await page.goto("/v/1.0/docs/getting-started", {
      waitUntil: "load",
    });
    expect(response?.status()).toBe(200);

    const title = await page.title();
    expect(title).toContain("Getting Started (v1)");
  });

  test("versioned page contains version-specific content", async ({
    page,
  }) => {
    await page.goto("/v/1.0/docs/getting-started", { waitUntil: "load" });
    const content = await page.textContent("body");
    expect(content).toContain("version 1.0");
    expect(content).toContain("older release");
  });

  test("version banner is visible on versioned page", async ({ page }) => {
    await page.goto("/v/1.0/docs/getting-started", { waitUntil: "load" });
    const banner = page.locator("[role='note']");
    await expect(banner).toBeVisible();
  });

  test("version banner contains link to latest", async ({ page }) => {
    await page.goto("/v/1.0/docs/getting-started", { waitUntil: "load" });
    const bannerLink = page.locator("[role='note'] a");
    await expect(bannerLink).toBeVisible();
    const href = await bannerLink.getAttribute("href");
    expect(href).toContain("/docs/getting-started");
    // Should NOT contain /v/1.0 — it links to the latest version
    expect(href).not.toContain("/v/1.0");
  });

  test("version switcher shows '1.0.0' as current on versioned page", async ({
    page,
  }) => {
    await page.goto("/v/1.0/docs/getting-started", { waitUntil: "load" });
    const toggle = page.locator("main [data-version-toggle]");
    const text = await toggle.textContent();
    expect(text).toContain("1.0.0");
  });
});

test.describe("Versioning: version switcher interaction", () => {
  test("clicking toggle opens dropdown menu", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const toggle = page.locator("main [data-version-toggle]");
    const menu = page.locator("main [data-version-menu]");

    // Menu should be hidden initially
    await expect(menu).toHaveClass(/hidden/);

    // Click to open
    await toggle.click();
    await expect(menu).not.toHaveClass(/hidden/);

    // aria-expanded should be true
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking outside closes dropdown menu", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const toggle = page.locator("main [data-version-toggle]");
    const menu = page.locator("main [data-version-menu]");

    // Open menu
    await toggle.click();
    await expect(menu).not.toHaveClass(/hidden/);

    // Click outside
    await page.locator("h1").click();
    await expect(menu).toHaveClass(/hidden/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape key closes dropdown menu", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const toggle = page.locator("main [data-version-toggle]");
    const menu = page.locator("main [data-version-menu]");

    // Open menu
    await toggle.click();
    await expect(menu).not.toHaveClass(/hidden/);

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(menu).toHaveClass(/hidden/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("dropdown contains links to all versions", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const toggle = page.locator("main [data-version-toggle]");
    await toggle.click();

    const menu = page.locator("main [data-version-menu]");
    const links = menu.locator("a");

    // Should have 3 links: Latest + 1.0.0 + "All versions"
    await expect(links).toHaveCount(3);

    // First link is "Latest" pointing to current docs
    const latestLink = links.nth(0);
    await expect(latestLink).toContainText("Latest");

    // Second link is version 1.0.0
    const versionLink = links.nth(1);
    await expect(versionLink).toContainText("1.0.0");
    const href = await versionLink.getAttribute("href");
    expect(href).toContain("/v/1.0/docs/getting-started");
  });

  test("version link navigates to versioned page", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    // Open version switcher
    const toggle = page.locator("main [data-version-toggle]");
    await toggle.click();

    // Click version 1.0.0 link
    const versionLink = page.locator("main [data-version-menu] a").nth(1);
    await versionLink.click();

    // Should navigate to versioned page
    await page.waitForURL("**/v/1.0/docs/getting-started");
    const content = await page.textContent("body");
    expect(content).toContain("version 1.0");
  });
});
