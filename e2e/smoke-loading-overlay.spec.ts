/**
 * Smoke tests for the page-loading overlay (W1A + W1B, epic #1540).
 *
 * Covers:
 *   1. SSG-shape: overlay element and bootstrap script are in the built HTML.
 *   2. CSS placement: overlay CSS lives in the linked stylesheet (not an
 *      inline <style> in <body>), matching the html-validate requirement.
 *   3. Click-through: pointer-events is none on the overlay even when
 *      data-visible is set (browser assertion).
 *   4. Pending navigations (desktop, mobile, consecutive, Back/Forward,
 *      reduced motion, no View Transitions API) paint a full-viewport scrim
 *      over header and sidebar, then clear it on swap or abort.
 *
 * Tests 1 and 2 are static HTML checks against the pre-built smoke fixture
 * dist — they run instantly, require no live server.
 *
 * Test 3 requires a live preview server (Playwright webServer).
 */

import { test, expect, type Page } from "@playwright/test";
import { expectHtmlAttr, expectHtmlClass } from "./html-assertions";
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
    expectHtmlAttr(html, "id", PAGE_LOADING_OVERLAY_ID);
    expectHtmlClass(html, "page-loading-overlay");
    expectHtmlAttr(html, "aria-hidden", "true");
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
    expectHtmlAttr(html, "id", PAGE_LOADING_OVERLAY_ID);
    expectHtmlClass(html, "page-loading-overlay");
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

// The scrim is full-viewport pending feedback. Chrome stays visually stationary
// through its own native snapshots, never by clipping this element (#4580 did).
type Clip = { x: number; y: number; width: number; height: number };

async function holdNavigation(page: Page, pattern: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(pattern, async (route) => { await gate; await route.continue(); }, { times: 1 });
  return release;
}

async function clipOf(page: Page, selector: string): Promise<Clip> {
  return page.locator(selector).first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.ceil(rect.left));
    const y = Math.max(0, Math.ceil(rect.top));
    return { x, y, width: Math.floor(Math.min(innerWidth, rect.right)) - x, height: Math.floor(Math.min(innerHeight, rect.bottom)) - y };
  });
}

/** Mean sRGB luminance of real composited pixels, decoded by the browser. */
async function luminance(page: Page, clip: Clip): Promise<number> {
  const png = await page.screenshot({ clip, animations: "allow" });
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    return total / (data.length / 4);
  }, png.toString("base64"));
}

async function chromeClips(page: Page): Promise<Record<string, Clip>> {
  const clips: Record<string, Clip> = { header: await clipOf(page, "body > header") };
  if (await page.locator("#desktop-sidebar").isVisible()) clips.sidebar = await clipOf(page, "#desktop-sidebar");
  return clips;
}

async function chromeLuminance(page: Page, clips: Record<string, Clip>) {
  const out: Record<string, number> = {};
  for (const [name, clip] of Object.entries(clips)) out[name] = await luminance(page, clip);
  return out;
}

async function expectFullViewportScrim(page: Page, clips: Record<string, Clip>, baseline: Record<string, number>) {
  const overlay = page.locator(`#${PAGE_LOADING_OVERLAY_ID}`);
  await expect(overlay).toHaveAttribute("data-visible", "");
  await expect(overlay).toHaveAttribute("aria-hidden", "false");
  await expect(overlay).toHaveCSS("opacity", "1");
  expect(await overlay.getAttribute("style"), "No runtime geometry may override fixed inset: 0").toBeNull();
  const viewport = page.viewportSize()!;
  const bounds = (await overlay.boundingBox())!;
  expect(bounds).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  const spinner = (await page.locator(".page-loading-spinner").boundingBox())!;
  expect(Math.abs(spinner.x + spinner.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(spinner.y + spinner.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  const dimmed = await chromeLuminance(page, clips);
  for (const name of Object.keys(clips)) {
    expect(dimmed[name]!, `The painted scrim must dim the ${name}`).toBeLessThan(baseline[name]! * 0.75);
  }
}

async function expectSettled(page: Page) {
  const overlay = page.locator(`#${PAGE_LOADING_OVERLAY_ID}`);
  await expect(overlay).not.toHaveAttribute("data-visible");
  await expect(overlay).toHaveAttribute("aria-hidden", "true");
  await expect(overlay).toHaveCSS("opacity", "0");
  expect(await overlay.getAttribute("style")).toBeNull();
  await expect(page.locator("[data-zd-nav-pending]")).toHaveCount(0);
  // A finishing native transition paints its snapshots above the live scrim.
  await page.waitForFunction(() => !document.getAnimations().some((animation) =>
    (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition")));
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`slow navigation shows a full-viewport scrim over header and chrome (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/docs/guides/page-1/");
    await page.waitForFunction(() => Number.isFinite(history.state?.index));
    const clips = await chromeClips(page);
    if (viewport.width >= 1024) expect(Object.keys(clips)).toEqual(["header", "sidebar"]);
    const baseline = await chromeLuminance(page, clips);
    const release = await holdNavigation(page, "**/docs/guides/toc-test*");
    await page.evaluate(() => {
      document.addEventListener("zfb:before-swap", () => {
        const overlay = document.getElementById("page-loading-overlay")!;
        sessionStorage.setItem("loading-at-capture", JSON.stringify({ name: getComputedStyle(overlay).viewTransitionName, oldDisplay: getComputedStyle(document.documentElement, "::view-transition-old(zfb-loading)").display }));
      }, { once: true });
      document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/toc-test"]')!.click();
    });
    try {
      await expectFullViewportScrim(page, clips, baseline);
      await expect(page.locator("[data-zd-nav-pending]")).toHaveCount(1);
    } finally { release(); }
    await expect(page).toHaveURL(/\/docs\/guides\/toc-test\/?$/);
    await expectSettled(page);
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("loading-at-capture")!))).toEqual({ name: "zfb-loading", oldDisplay: "none" });
  });
}

test("consecutive and history navigations each show a fresh full-viewport scrim", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/guides/page-1/");
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  const clips = await chromeClips(page);
  const baseline = await chromeLuminance(page, clips);
  const steps: Array<{ pattern: string; url: RegExp; go: () => Promise<unknown> }> = [
    { pattern: "**/docs/guides/toc-test**", url: /\/docs\/guides\/toc-test\/?$/, go: () => page.evaluate(() => document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/toc-test"]')!.click()) },
    { pattern: "**/docs/guides/tables-test**", url: /\/docs\/guides\/tables-test\/?$/, go: () => page.evaluate(() => document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/tables-test"]')!.click()) },
    { pattern: "**/docs/guides/toc-test**", url: /\/docs\/guides\/toc-test\/?$/, go: () => page.evaluate(() => history.back()) },
    { pattern: "**/docs/guides/tables-test**", url: /\/docs\/guides\/tables-test\/?$/, go: () => page.evaluate(() => history.forward()) },
  ];
  for (const step of steps) {
    const release = await holdNavigation(page, step.pattern);
    await step.go();
    try {
      await expectFullViewportScrim(page, clips, baseline);
    } finally { release(); }
    await expect(page).toHaveURL(step.url);
    await expectSettled(page);
  }
});

test("reduced motion keeps the full-viewport scrim with a static centered ring", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/guides/page-1/");
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  const clips = await chromeClips(page);
  const baseline = await chromeLuminance(page, clips);
  const release = await holdNavigation(page, "**/docs/guides/toc-test*");
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/toc-test"]')!.click());
  try {
    await expectFullViewportScrim(page, clips, baseline);
    await expect(page.locator(".page-loading-spinner")).toHaveCSS("animation-name", "none");
  } finally { release(); }
  await expect(page).toHaveURL(/\/docs\/guides\/toc-test\/?$/);
  await expectSettled(page);
});

test("without View Transitions the same-document swap still shows and clears the full-viewport scrim", async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as Partial<Document>).startViewTransition;
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/guides/page-1/");
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  expect(await page.evaluate(() => "startViewTransition" in document)).toBe(false);
  const clips = await chromeClips(page);
  const baseline = await chromeLuminance(page, clips);
  const release = await holdNavigation(page, "**/docs/guides/toc-test*");
  await page.evaluate(() => {
    (window as Window & { __sameDocument?: boolean }).__sameDocument = true;
    document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/toc-test"]')!.click();
  });
  try {
    await expectFullViewportScrim(page, clips, baseline);
  } finally { release(); }
  await expect(page).toHaveURL(/\/docs\/guides\/toc-test\/?$/);
  await expectSettled(page);
  expect(await page.evaluate(() => (window as Window & { __sameDocument?: boolean }).__sameDocument), "Fallback must stay a same-document swap").toBe(true);
});

test("failed fetch clears pending feedback before the browser fallback", async ({ page }) => {
  await page.goto("/docs/guides/page-1/");
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  await page.route("**/docs/guides/toc-test*", async (route) => {
    if (route.request().resourceType() === "fetch") await route.abort("failed");
    else await route.continue();
  });
  await page.evaluate(() => {
    document.addEventListener("zfb:navigation-aborted", () => {
      sessionStorage.setItem("loading-after-abort", JSON.stringify({
        visible: document.getElementById("page-loading-overlay")!.hasAttribute("data-visible"),
        pending: document.querySelectorAll("[data-zd-nav-pending]").length,
      }));
    }, { once: true });
    document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/toc-test"]')!.click();
  });
  await page.waitForURL(/\/docs\/guides\/toc-test\/?$/);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("loading-after-abort")!))).toEqual({ visible: false, pending: 0 });
});

test("superseded slow navigation cannot leave loading or pending markers", async ({ page }) => {
  await page.goto("/docs/guides/page-1/");
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/docs/guides/toc-test*", async (route) => { await gate; await route.continue(); });
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/toc-test"]')!.click());
  await expect(page.locator("#page-loading-overlay")).toHaveAttribute("data-visible", "");
  try {
    await page.evaluate(() => document.querySelector<HTMLAnchorElement>('header a[href^="/docs/getting-started"]')!.click());
    await expect(page).toHaveURL(/\/docs\/getting-started\/?$/);
    await expect(page.locator("#page-loading-overlay")).not.toHaveAttribute("data-visible");
    await expect(page.locator("[data-zd-nav-pending]")).toHaveCount(0);
  } finally { release(); }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Getting Started");
});

test("an older preparation finishing cannot hide a newer pending navigation", async ({ page }) => {
  await page.goto("/docs/guides/page-1/");
  await page.waitForFunction(() => Number.isFinite(history.state?.index));
  await page.evaluate(() => {
    const harness = { loaded: [] as string[], releases: {} as Record<string, () => void>, prepared: 0 };
    (window as Window & { loadingOverlap?: typeof harness }).loadingOverlap = harness;
    document.addEventListener("zfb:after-preparation", () => { harness.prepared++; });
    document.addEventListener("zfb:before-preparation", (event) => {
      const navigation = event as Event & { to: URL; loader: () => Promise<void> };
      const key = navigation.to.pathname;
      const delegate = navigation.loader;
      navigation.loader = async () => {
        await delegate();
        harness.loaded.push(key);
        await new Promise<void>((resolve) => { harness.releases[key] = resolve; });
      };
    });
    document.querySelector<HTMLAnchorElement>('a[href^="/docs/guides/toc-test"]')!.click();
  });
  const loaded = (part: string) => page.waitForFunction((name) => {
    const harness = (window as Window & { loadingOverlap?: { loaded: string[] } }).loadingOverlap;
    return harness?.loaded.some((key) => key.includes(name));
  }, part);
  const release = (part: string) => page.evaluate((name) => {
    const harness = (window as Window & { loadingOverlap?: { releases: Record<string, () => void> } }).loadingOverlap!;
    const key = Object.keys(harness.releases).find((candidate) => candidate.includes(name))!;
    harness.releases[key]!();
  }, part);
  await loaded("toc-test");
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>('header a[href^="/docs/getting-started"]')!.click());
  await loaded("getting-started");
  await release("toc-test");
  await page.waitForFunction(() => (window as Window & { loadingOverlap?: { prepared: number } }).loadingOverlap!.prepared > 0);
  await expect(page.locator("#page-loading-overlay")).toHaveAttribute("data-visible", "");
  await expect(page.locator("[data-zd-nav-pending]")).toHaveCount(1);
  await release("getting-started");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Getting Started");
  await expect(page.locator("#page-loading-overlay")).not.toHaveAttribute("data-visible");
  await expect(page.locator("[data-zd-nav-pending]")).toHaveCount(0);
});
