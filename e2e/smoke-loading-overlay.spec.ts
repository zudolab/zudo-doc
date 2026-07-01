/**
 * Smoke tests for the page-loading overlay (W1A + W1B, epic #1540).
 *
 * Covers:
 *   1. SSG-shape: overlay element and bootstrap script are in the built HTML.
 *   2. CSS placement: overlay CSS lives in the linked stylesheet (not an
 *      inline <style> in <body>), matching the html-validate requirement.
 *   3. Click-through: pointer-events is none on the overlay even when
 *      data-visible is set (browser assertion).
 *
 * Tests 1 and 2 are static HTML checks against the pre-built smoke fixture
 * dist — they run instantly, require no live server.
 *
 * Test 3 requires a live preview server (Playwright webServer).
 */

import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

const PAGE_LOADING_OVERLAY_ID = "page-loading-overlay";

// ---------------------------------------------------------------------------
// 1 + 2: Static HTML shape — overlay element + bootstrap script present; no
//         inline <style> block in <body> (CSS moved to global.css, #1543).
// ---------------------------------------------------------------------------

test.describe("Loading overlay: SSG shape", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/page-1/index.html");
  });

  test("overlay element is present in built HTML", () => {
    expect(html).toContain(`id="${PAGE_LOADING_OVERLAY_ID}"`);
    expect(html).toContain('class="page-loading-overlay"');
    expect(html).toContain('aria-hidden="true"');
  });

  test("bootstrap script is present with nav-event listeners", () => {
    // The bootstrap script wires zfb:before-preparation / zfb:after-swap
    // listeners so the overlay shows and hides on each SPA navigation.
    expect(html).toContain("zfb:before-preparation");
    expect(html).toContain("zfb:after-swap");
  });

  test("data-zd-nav-pending bootstrap is present in HTML", () => {
    // W1B added setPending/clearPending so the clicked nav link flashes accent.
    expect(html).toContain("data-zd-nav-pending");
  });

  test("no inline <style> block in <body> (CSS lives in global.css)", () => {
    // Moving CSS out of PageLoadingOverlay's inline <style> fixes the HTML5
    // element-permitted-content violation caught by html-validate (#1543).
    const bodyStart = html.indexOf("<body");
    expect(bodyStart).toBeGreaterThan(-1);
    const bodyContent = html.slice(bodyStart);
    // The <style> tags in <body> check: page-loading CSS must NOT be inline.
    // (ColorSchemeProvider correctly puts its <style> in <head>.)
    expect(bodyContent).not.toMatch(/<style>[^<]*\.page-loading-overlay/);
  });
});

// ---------------------------------------------------------------------------
// Package-owned route regression (zudolab/zudo-doc#2482).
//
// The smoke fixture runs `packageOwnedRoutes: true` + `dynamicPageTransition:
// true`, so package-owned routes (e.g. `404`) render their body-end via the
// package default `createBodyEndIslands` — NOT the host `_body-end-islands.tsx`.
// Before #2482 that default never mounted `<PageLoadingOverlay/>`, so `404.html`
// (and every pure package-owned page) shipped zero overlay markup while host doc
// pages had it. The `docs/guides/page-1` case above is a host-rendered page and
// did NOT catch this gap; `404.html` is the package-owned route that does.
// ---------------------------------------------------------------------------

test.describe("Loading overlay: package-owned route (404)", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("404.html");
  });

  test("overlay element is present on the package-owned 404 route", () => {
    expect(html).toContain(`id="${PAGE_LOADING_OVERLAY_ID}"`);
    expect(html).toContain('class="page-loading-overlay"');
  });

  test("nav-lifecycle bootstrap is present on the 404 route", () => {
    expect(html).toContain("zfb:before-preparation");
    expect(html).toContain("zfb:after-swap");
    expect(html).toContain("data-zd-nav-pending");
  });
});

// ---------------------------------------------------------------------------
// 3: pointer-events: none — browser assertion
// ---------------------------------------------------------------------------

test(
  "overlay has pointer-events: none even when [data-visible] is set",
  async ({ page }) => {
    await page.goto("/docs/guides/page-1/", { waitUntil: "domcontentloaded" });
    // Wait for the overlay element to be in the DOM before reading its style —
    // replaces a racy implicit load-wait with a deterministic locator state wait.
    await page
      .locator(`#${PAGE_LOADING_OVERLAY_ID}`)
      .waitFor({ state: "attached", timeout: 5000 });

    // Inject [data-visible] synchronously and read computed style.
    const pointerEvents = await page.evaluate((id) => {
      const overlay = document.getElementById(id);
      if (!overlay) return "ELEMENT_NOT_FOUND";
      overlay.setAttribute("data-visible", "");
      return window.getComputedStyle(overlay).pointerEvents;
    }, PAGE_LOADING_OVERLAY_ID);

    expect(pointerEvents).toBe("none");
  },
);

