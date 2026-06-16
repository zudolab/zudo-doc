import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

// The code-blocks-test page carries a single ```mermaid fence, rendered
// client-side by the mermaid init script (esm.sh dynamic import). The
// mermaid-enlarge island injects the enlarge button into the rendered
// container, then a click opens the zoom/pan dialog.
const PAGE = "/docs/guides/code-blocks-test";

// Mermaid renders asynchronously (dynamic CDN import). Match the generous
// timeout the other mermaid smoke specs use.
const MERMAID_RENDER_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Level 3: Static HTML assertions (no browser)
// ---------------------------------------------------------------------------

test.describe("Mermaid Enlarge: static HTML structure", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/code-blocks-test/index.html");
  });

  test("page has exactly one zd-mermaid-dialog element (SSR fallback shell)", () => {
    const matches = html.match(/zd-mermaid-dialog/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  test("SSR dialog shell is a closed <dialog> (no open attribute)", () => {
    const dialogTag = html.match(/<dialog[^>]*zd-mermaid-dialog[^>]*>/)?.[0] ?? "";
    expect(dialogTag).toBeTruthy();
    expect(dialogTag).not.toMatch(/\bopen\b/);
  });
});

// ---------------------------------------------------------------------------
// Level 4: Browser assertions
// ---------------------------------------------------------------------------

test.describe("Mermaid Enlarge: browser behavior", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("enlarge button is injected onto the rendered diagram", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const enlargeable = page.locator(".zd-mermaid-enlargeable");
    await enlargeable.first().waitFor({ state: "attached", timeout: MERMAID_RENDER_TIMEOUT_MS });

    const btn = enlargeable.first().locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });
  });

  test("clicking the enlarge button opens the dialog with a cloned svg", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const enlargeable = page.locator(".zd-mermaid-enlargeable").first();
    await enlargeable.waitFor({ state: "attached", timeout: MERMAID_RENDER_TIMEOUT_MS });

    const btn = enlargeable.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });
    await btn.click();

    const dialog = page.locator("dialog.zd-mermaid-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator(".zd-mermaid-transform svg")).toBeVisible();
  });

  test("zoom controls enablement: −/pan start disabled, + enabled; after + they enable; − clamps and re-disables", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const enlargeable = page.locator(".zd-mermaid-enlargeable").first();
    await enlargeable.waitFor({ state: "attached", timeout: MERMAID_RENDER_TIMEOUT_MS });

    const btn = enlargeable.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });
    await btn.click();

    const dialog = page.locator("dialog.zd-mermaid-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const zoomIn = dialog.locator('button[aria-label="Zoom in"]');
    const zoomOut = dialog.locator('button[aria-label="Zoom out"]');
    const pan = dialog.locator('button[aria-label="Toggle pan mode"]');

    // Initial state at scale 1: zoom-out and pan disabled, zoom-in enabled.
    await expect(zoomIn).toBeEnabled();
    await expect(zoomOut).toBeDisabled();
    await expect(pan).toBeDisabled();

    // After one zoom-in: zoom-out and pan enable.
    await zoomIn.click();
    await expect(zoomOut).toBeEnabled();
    await expect(pan).toBeEnabled();

    // Zoom back out to full width: zoom-out and pan re-disable (clamped at 1).
    await zoomOut.click();
    await expect(zoomOut).toBeDisabled();
    await expect(pan).toBeDisabled();
    await expect(zoomIn).toBeEnabled();
  });

  test("Escape closes the dialog", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const enlargeable = page.locator(".zd-mermaid-enlargeable").first();
    await enlargeable.waitFor({ state: "attached", timeout: MERMAID_RENDER_TIMEOUT_MS });

    const btn = enlargeable.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });
    await btn.click();

    const dialog = page.locator("dialog.zd-mermaid-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });
});
