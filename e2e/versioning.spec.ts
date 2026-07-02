import { test, expect } from "@playwright/test";
import { makeDistReader } from "./dist-helper";

/**
 * E2E tests for documentation versioning feature.
 *
 * Uses the versioning fixture which has:
 * - Latest docs at /docs/getting-started (title: "Getting Started")
 * - Version 1.0 docs at /v/1.0/docs/getting-started (title: "Getting Started (v1)")
 * - Version 1.0 configured with banner: "unmaintained"
 *
 * Note: The version switcher renders in BOTH the header right rail and an
 * inline `afterBreadcrumb` banner inside `<main>` on doc pages (the inline
 * one was added in the Wave 2 fix for epic #1478 to match the production
 * reference). Browser-test selectors are scoped to `getByRole("banner")`
 * (matched below by `extractHeaderRegion`) so they target the header
 * instance — most of these tests were written before the inline banner
 * existed.
 *
 * Static-markup assertions below (content text, switcher label, banner
 * presence/link) were demoted to L3 dist reads (zudolab/zudo-doc#2537) —
 * they were asserting SSR output a browser load added nothing to. Loads,
 * visibility (CSS-dependent), and the dropdown interaction tests stay
 * browser-driven.
 */

const { readDistFile } = makeDistReader("versioning");

/** Same scoping the demoted tests used to get via `getByRole("banner")` —
 * `<header>` is the only implicit ARIA "banner" landmark on the page,
 * and the switcher also renders a second, non-header inline instance
 * (see file-level comment). */
function extractHeaderRegion(html: string): string {
  const start = html.indexOf("<header");
  const end = html.indexOf("</header>", start);
  return html.slice(start, end);
}

function extractVersionToggleHtml(headerHtml: string): string {
  const start = headerHtml.indexOf("data-version-toggle");
  const end = headerHtml.indexOf("</button>", start);
  return headerHtml.slice(start, end);
}

function extractVersionBanner(html: string): string | null {
  const attrStart = html.indexOf("data-version-banner");
  if (attrStart === -1) return null;
  const divStart = html.lastIndexOf("<div", attrStart);
  const divEnd = html.indexOf("</div>", attrStart);
  return html.slice(divStart, divEnd);
}

test.describe("Versioning: latest version pages", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/getting-started/index.html");
  });

  test("latest version page loads correctly", async ({ page }) => {
    const response = await page.goto("/docs/getting-started", {
      waitUntil: "load",
    });
    expect(response?.status()).toBe(200);

    const title = await page.title();
    expect(title).toContain("Getting Started");
    expect(title).not.toContain("404");
  });

  test("latest version page contains expected content", () => {
    expect(html).toContain("latest version");
    expect(html).toContain("current release");
  });

  test("version switcher is visible on latest page", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });
    const switcher = page.getByRole("banner").locator("[data-version-switcher]");
    await expect(switcher).toBeVisible();
  });

  test("version switcher shows 'Latest' as current on latest page", () => {
    const toggle = extractVersionToggleHtml(extractHeaderRegion(html));
    expect(toggle).toContain("Latest");
  });

  test("no version banner on latest page", () => {
    expect(html).not.toContain("data-version-banner");
  });
});

test.describe("Versioning: versioned pages", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("v/1.0/docs/getting-started/index.html");
  });

  test("versioned page loads correctly", async ({ page }) => {
    const response = await page.goto("/v/1.0/docs/getting-started", {
      waitUntil: "load",
    });
    expect(response?.status()).toBe(200);

    const title = await page.title();
    expect(title).toContain("Getting Started (v1)");
  });

  test("versioned page contains version-specific content", () => {
    expect(html).toContain("version 1.0");
    expect(html).toContain("older release");
  });

  test("version banner is visible on versioned page", () => {
    expect(html).toContain("data-version-banner");
  });

  test("version banner contains link to latest", () => {
    const banner = extractVersionBanner(html);
    expect(banner).not.toBeNull();
    expect(banner).toContain('href="/docs/getting-started"');
    // Should NOT contain /v/1.0 — it links to the latest version
    expect(banner).not.toContain("/v/1.0");
  });

  test("version switcher shows '1.0.0' as current on versioned page", () => {
    const toggle = extractVersionToggleHtml(extractHeaderRegion(html));
    expect(toggle).toContain("1.0.0");
  });
});

test.describe("Versioning: version switcher interaction", () => {
  test("clicking toggle opens dropdown menu", async ({ page }) => {
    await page.goto("/docs/getting-started", { waitUntil: "load" });

    const toggle = page.getByRole("banner").locator("[data-version-toggle]");
    const menu = page.getByRole("banner").locator("[data-version-menu]");

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

    const toggle = page.getByRole("banner").locator("[data-version-toggle]");
    const menu = page.getByRole("banner").locator("[data-version-menu]");

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

    const toggle = page.getByRole("banner").locator("[data-version-toggle]");
    const menu = page.getByRole("banner").locator("[data-version-menu]");

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

    const toggle = page.getByRole("banner").locator("[data-version-toggle]");
    await toggle.click();

    const menu = page.getByRole("banner").locator("[data-version-menu]");
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
    const toggle = page.getByRole("banner").locator("[data-version-toggle]");
    await toggle.click();

    // Click version 1.0.0 link
    const versionLink = page.getByRole("banner").locator("[data-version-menu] a").nth(1);
    await versionLink.click();

    // Should navigate to versioned page. The asset pipeline normalises
    // pretty-URL routes to the trailing-slash form (e.g. zfb's CF
    // adapter `worker-wrapper.mjs` 308-redirects no-slash URLs onto the
    // `<slug>/` form, which is what the static asset server serves), so
    // the matcher accepts either shape.
    await page.waitForURL(/\/v\/1\.0\/docs\/getting-started\/?$/);
    // zfb's client-router (>= zfb 0.1.0-next.50) commits the SPA history entry
    // BEFORE the View Transition content swap, so waitForURL can resolve before
    // the destination page's body is in the DOM. Use a web-first auto-retrying
    // assertion to wait for the swapped content instead of reading textContent
    // once (which races the swap and reads the stale source page).
    await expect(page.locator("body")).toContainText("version 1.0");
  });
});
