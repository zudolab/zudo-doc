import { test, expect } from "@playwright/test";

/**
 * E2E tests for HtmlPreview component.
 *
 * Verifies that global CSS from settings.htmlPreview is injected into the
 * iframe, per-component JS executes, and sandbox attributes are correct.
 */

const PAGE = "/docs/guides/html-preview-test";

test.describe("HtmlPreview: global CSS and per-component JS", () => {
  test("global CSS is injected into iframe srcdoc", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const iframe = page.locator("iframe").first();
    await iframe.waitFor({ state: "attached", timeout: 10_000 });

    const srcdoc = await iframe.getAttribute("srcdoc");
    expect(srcdoc).toContain(".global-test");
    expect(srcdoc).toContain("border: 3px solid rgb(255, 0, 0)");
  });

  test("global CSS is visually applied inside iframe", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const iframe = page.locator("iframe").first();
    await iframe.waitFor({ state: "attached", timeout: 10_000 });

    const frame = page.frameLocator("iframe").first();
    const target = frame.locator(".global-test");
    await expect(target).toBeVisible({ timeout: 10_000 });

    const borderColor = await target.evaluate(
      (el) => getComputedStyle(el).borderColor,
    );
    expect(borderColor).toBe("rgb(255, 0, 0)");
  });

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

  test("iframes have correct sandbox attributes", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const iframes = page.locator("iframe");
    const first = iframes.first();
    await first.waitFor({ state: "attached", timeout: 10_000 });

    // First iframe (no scripts): maximally restrictive sandbox
    const firstSandbox = await iframes.nth(0).getAttribute("sandbox");
    expect(firstSandbox).toBe("");

    // Second iframe (has JS): needs scripts + same-origin for height sync
    const secondSandbox = await iframes.nth(1).getAttribute("sandbox");
    expect(secondSandbox).toBe("allow-scripts allow-same-origin");
  });
});
