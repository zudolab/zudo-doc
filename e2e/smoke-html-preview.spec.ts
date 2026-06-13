import { test, expect } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

/**
 * Tests for the HtmlPreview component.
 *
 * SSG-shape checks are static dist reads (no browser): global CSS from
 * settings.htmlPreview must land in the iframe srcdoc, and the sandbox
 * attributes must follow the resolveSandbox contract. The per-component JS
 * check needs a real browser (script execution inside the iframe).
 */

const PAGE = "/docs/guides/html-preview-test";
const DIST_PAGE = "docs/guides/html-preview-test/index.html";

test.describe("HtmlPreview: SSG shape", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile(DIST_PAGE);
  });

  test("global CSS from settings.htmlPreview is injected into iframe srcdoc", () => {
    // The smoke fixture sets settings.htmlPreview.css to exactly this rule.
    // It must appear inside the preview iframe srcdoc <style> (wiring:
    // settings.htmlPreview -> globalConfig -> buildSrcdoc; regression #2105).
    expect(html).toContain(".global-test { border: 3px solid rgb(255, 0, 0); }");
  });

  test("iframes carry the resolveSandbox contract sandbox attributes", () => {
    // No-script preview: allow-same-origin (kept for auto-height measurement).
    expect(html).toContain('sandbox="allow-same-origin"');
    // Script-bearing preview: allow-scripts allow-same-origin.
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
  });
});

test.describe("HtmlPreview: per-component JS", () => {
  test("per-component JS executes inside iframe", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const iframes = page.locator("iframe");
    // The JS test is the second HtmlPreview on the page
    const jsIframe = iframes.nth(1);
    await jsIframe.waitFor({ state: "attached", timeout: 10_000 });

    const frame = page.frameLocator("iframe").nth(1);
    const target = frame.locator("#js-target");
    await expect(target).toHaveText("after", { timeout: 10_000 });
  });
});
