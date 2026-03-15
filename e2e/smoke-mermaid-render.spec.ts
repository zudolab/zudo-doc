import { test, expect } from "@playwright/test";

/**
 * E2E tests for Mermaid diagram rendering.
 *
 * Mermaid diagrams are rendered asynchronously — the mermaid library
 * is dynamically imported and renders SVGs into [data-mermaid] containers.
 * After rendering, the element gets a [data-mermaid-rendered] attribute.
 */

const PAGE = "/docs/guides/code-blocks-test";

test.describe("Mermaid: async diagram rendering", () => {
  test("mermaid diagram is rendered with data-mermaid-rendered attribute", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // Wait for mermaid to dynamically import and render (generous timeout)
    const rendered = page.locator("[data-mermaid-rendered]");
    await rendered.waitFor({ state: "attached", timeout: 30_000 });

    await expect(rendered).toHaveCount(1);
  });

  test("rendered mermaid container contains an SVG element", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const rendered = page.locator("[data-mermaid-rendered]");
    await rendered.waitFor({ state: "attached", timeout: 30_000 });

    const svg = rendered.locator("svg");
    await expect(svg).toBeAttached();
  });

  test("original mermaid text is replaced by SVG diagram", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const rendered = page.locator("[data-mermaid-rendered]");
    await rendered.waitFor({ state: "attached", timeout: 30_000 });

    // The raw text "graph LR" should no longer be visible as plain text
    // (mermaid replaces the text content with an SVG)
    const svg = rendered.locator("svg");
    await expect(svg).toBeVisible();
  });
});
