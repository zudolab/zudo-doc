import { test, expect } from "./fixtures";
import { desktopSidebar } from "./sidebar-helpers";
import { makeDistReader } from "./dist-helper";

const { readDistFile } = makeDistReader("versioning");

/** CategoryNav's `<nav>` wrapper is the only nav-card grid with this exact
 * class prefix — NavCardGrid/DocCardGrid (the auto-index siblings) carry an
 * `aria-label` and a different class list instead (see
 * packages/zudo-doc/src/nav-indexing/category-nav.tsx). */
function extractCategoryNavHtml(html: string): string {
  const marker = '<nav class="mt-vsp-lg mb-vsp-md grid';
  const navStart = html.indexOf(marker);
  const navEnd = html.indexOf("</nav>", navStart);
  return html.slice(navStart, navEnd);
}

/** All `href` values within a fragment, tolerating both quoted and unquoted
 * attribute forms — this fixture builds with `minifyHtml: true`, which drops
 * quotes from simple attribute values (`href=/v/1.0/docs/guides/setup`
 * rather than `href="/v/1.0/docs/guides/setup"`). Mirrors the quoted/
 * unquoted handling in `getAttrValue` (./html-assertions.ts), generalized to
 * return every match instead of the first. */
function extractHrefs(html: string): string[] {
  const pattern = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  return [...html.matchAll(pattern)].map((m) => m[1] ?? m[2] ?? m[3]);
}

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
    // Doc pages render TWO version switchers (header + inline afterBreadcrumb,
    // matching the production reference per epic #1478 Wave 2). Scope to the
    // header instance to preserve the original test intent.
    const switcher = page.getByRole("banner").locator("[data-version-switcher]");
    await expect(switcher).toBeVisible();
  });

  test("version switcher is visible on landing page", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    // On the landing page, the version switcher appears in the header
    const headerSwitcher = page.getByRole("banner").locator("[data-version-switcher]");
    await expect(headerSwitcher).toBeVisible();
  });
});

test.describe("Versioned navigation: CategoryNav card links", () => {
  test("every CategoryNav card href carries the version prefix on the versioned category index (#3194 regression guard)", () => {
    // This bug class is invisible to link checkers: an un-threaded
    // currentVersion produces hrefs that point at pages which genuinely
    // exist — just in the wrong version's collection.
    const html = readDistFile("v/1.0/docs/guides/index.html");
    const navHtml = extractCategoryNavHtml(html);
    const hrefs = extractHrefs(navHtml);

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toContain("/v/1.0/");
    }
  });
});
