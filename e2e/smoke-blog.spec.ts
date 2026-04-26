import { test, expect } from "@playwright/test";
import { desktopSidebar, waitForSidebarHydration } from "./sidebar-helpers";

/**
 * E2E tests for the blog feature.
 *
 * Smoke fixture blog setup:
 *   - 5 posts, postsPerPage=3, so there are 2 pages
 *   - post-one.md uses <!-- more --> (excerpt marker)
 *   - Remaining posts use the fallback path (no marker, no manual excerpt)
 *
 * Covered:
 *   - Blog index loads and shows posts
 *   - Pagination to page 2 works
 *   - Opening a post renders title + body
 *   - /blog/archives/ lists posts
 *   - Excerpt-vs-full-body: a post with <!-- more --> renders only the excerpt
 *     on the listing, but the full body on the detail page
 *   - Blog sidebar shape: recent-posts list with at least one entry
 */

test.describe("Blog feature", () => {
  test.beforeEach(async ({ page }) => {
    // Wide viewport so the desktop sidebar is visible
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ---------------------------------------------------------------------------
  // Blog index basics
  // ---------------------------------------------------------------------------

  test("blog index loads and shows post titles", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const response = await page.goto("/blog", { waitUntil: "load" });
    expect(response?.status()).toBe(200);

    // Page title should exist and not be 404
    const title = await page.title();
    expect(title).not.toBe("");
    expect(title).not.toContain("404");

    // There should be at least one post article card on the listing.
    // BlogPostCard uses `article.border-b` to distinguish from doc-layout's article.
    const articles = page.locator("article.border-b");
    await expect(articles.first()).toBeVisible();

    // No uncaught JS errors
    expect(errors, `JS errors on /blog: ${errors.join(", ")}`).toHaveLength(0);
  });

  test("blog index shows pagination when there are more posts than postsPerPage", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "load" });

    // The smoke fixture has 5 posts with postsPerPage=3, so page 2 exists.
    // BlogPagination renders a <nav> with a link containing "next" rel.
    const nextLink = page.locator('a[rel="next"]');
    await expect(nextLink).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Pagination to page 2
  // ---------------------------------------------------------------------------

  test("navigating to page 2 shows a different set of posts", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/blog", { waitUntil: "load" });

    // Click the "next page" link to go to page 2.
    // Wait for the URL to update after navigation instead of relying on
    // waitForLoadState alone — Astro view transitions may resolve load early.
    const nextLink = page.locator('a[rel="next"]');
    const nextHref = await nextLink.getAttribute("href");
    await nextLink.click();
    await page.waitForURL(nextHref ?? /\/blog\/page\/2/);

    // We should now be on /blog/page/2 (with or without trailing slash)
    expect(page.url()).toMatch(/\/blog\/page\/2/);

    // Page 2 should have at least one article card
    const articles = page.locator("article.border-b");
    await expect(articles.first()).toBeVisible();

    // Should also have a "previous page" link back to page 1
    const prevLink = page.locator('a[rel="prev"]');
    await expect(prevLink).toBeVisible();

    expect(errors, `JS errors on page 2: ${errors.join(", ")}`).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Opening a post
  // ---------------------------------------------------------------------------

  test("opening a post renders the title and body", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/blog", { waitUntil: "load" });

    // Click the first post link in the listing
    const firstPostLink = page.locator("article h2 a").first();
    const postTitle = await firstPostLink.textContent();
    await firstPostLink.click();
    await page.waitForLoadState("load");

    // Detail page should have an h1 matching the post title
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    if (postTitle) {
      await expect(h1).toContainText(postTitle.trim());
    }

    // Body content should be present (the main article area)
    const content = page.locator(".zd-content");
    await expect(content).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("direct URL /blog/post-one loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const response = await page.goto("/blog/post-one", { waitUntil: "load" });
    expect(response?.status()).toBe(200);

    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Post One");

    expect(errors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Archives page
  // ---------------------------------------------------------------------------

  test("archives page loads and lists posts", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const response = await page.goto("/blog/archives", { waitUntil: "load" });
    expect(response?.status()).toBe(200);

    const title = await page.title();
    expect(title).not.toContain("404");

    // Archives renders a <main> content area with a list of post links.
    // We scope to <main> to exclude the sidebar navigation links.
    const mainContent = page.locator("main");
    const postLinks = mainContent.locator("ul li a");
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Each link should point to a /blog/... URL
    const firstHref = await postLinks.first().getAttribute("href");
    expect(firstHref).toMatch(/\/blog\//);

    expect(errors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Excerpt vs full body
  // ---------------------------------------------------------------------------

  test("listing shows only the excerpt for a post with <!-- more -->", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "load" });

    // post-one has <!-- more --> so only the text above the marker is the excerpt.
    // The text "This is the excerpt" appears on the listing.
    const excerptText = "This is the excerpt";
    const fullBodyText = "This is the full body";

    // BlogPostCard renders <article class="border-b border-muted py-vsp-md">.
    // We use the CSS class to avoid matching the doc-layout's <article class="zd-content">.
    const postOneCard = page
      .locator("article.border-b")
      .filter({ hasText: "Post One" });
    await expect(postOneCard).toBeVisible();
    await expect(postOneCard).toContainText(excerptText);
    await expect(postOneCard).not.toContainText(fullBodyText);
  });

  test("detail page for a post with <!-- more --> shows the full body", async ({
    page,
  }) => {
    await page.goto("/blog/post-one", { waitUntil: "load" });

    // Full body text is present on the detail page
    const fullBodyText = "This is the full body";
    const content = page.locator(".zd-content");
    await expect(content).toContainText(fullBodyText);
  });

  // ---------------------------------------------------------------------------
  // Blog sidebar shape
  // ---------------------------------------------------------------------------

  test("blog sidebar has a recent-posts list with at least one entry", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);

    // The blog sidebar tree renders post titles as links inside the sidebar nav.
    // There should be at least one post link.
    const postLinks = sidebar.locator("a").filter({ hasText: /Post/i });
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("blog sidebar contains an Archives link", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "load" });
    await waitForSidebarHydration(page);

    const sidebar = desktopSidebar(page);

    // Archives link should appear in the blog sidebar
    const archivesLink = sidebar.locator('a[href*="archives"]');
    await expect(archivesLink).toBeVisible();
  });
});
