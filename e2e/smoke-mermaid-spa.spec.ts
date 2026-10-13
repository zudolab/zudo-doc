/**
 * Regression test for #2181: Mermaid SVG stripped after SPA soft-navigation.
 *
 * Pre-fix behaviour: the mermaid reinit code ran a debounced cleanup at ~360ms
 * after every `zfb:after-swap`, blanking the SVG container even when the
 * diagram had already rendered correctly. The fix (#2184) prevents the stale
 * debounce from firing on a page that is no longer "mid-swap".
 *
 * Test strategy:
 *   1. Direct-load the mermaid page to warm the esm.sh module and confirm
 *      baseline rendering.
 *   2. SPA-navigate away (to a non-mermaid page) and back to the mermaid page.
 *   3. Assert the SVG is present shortly after the swap AND still present and
 *      non-empty after the ~300ms debounce window elapses.  Pre-fix code blanks
 *      the SVG at ~360ms, so the late assertion fails against the old code and
 *      passes against the committed fix.
 */

import { test, expect } from "./fixtures";
import { spaClick } from "./nav-helpers";

const MERMAID_PAGE = "/docs/guides/code-blocks-test";
// Non-mermaid guides page used as the "away" destination.
const AWAY_PAGE = "/docs/guides/page-1";

// How long to wait after the first SVG-presence assertion before the
// debounce-survival re-check. Must exceed the reinit debounce window (~300ms);
// pre-fix code blanked the SVG at ~360ms after the swap, so 700ms is the
// minimum that catches the regression while staying well inside the test timeout.
const POST_DEBOUNCE_WAIT_MS = 700;

// The smoke fixture enables the mermaid-enlarge feature, which injects an
// "Enlarge diagram" <button> containing its OWN <svg> icon into the rendered
// [data-mermaid-rendered] element. A bare `svg` descendant selector therefore
// matches two svgs (the flowchart + the icon) and trips Playwright strict mode.
// Target the mermaid flowchart svg specifically (mermaid emits class="flowchart").
const DIAGRAM_SVG = "svg.flowchart";

test.describe("Mermaid: SPA soft-navigation regression (#2181)", () => {
  test("does not request Mermaid on a diagram-free page (#4573)", async ({ page, assertNoConsoleErrors }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (/esm\.sh\/mermaid@/.test(request.url())) requests.push(request.url());
    });
    await page.goto(AWAY_PAGE, { waitUntil: "load" });
    await expect(page.locator("main")).toContainText("Writing Docs");
    await expect(page.locator("[data-mermaid]")).toHaveCount(0);
    expect(requests).toEqual([]);
    assertNoConsoleErrors();
  });

  test("repeated theme and token changes regenerate genuine diagrams (#4573)", async ({ page, assertNoConsoleErrors }, testInfo) => {
    const responses: Array<{ url: string; status: number }> = [];
    const failures: Array<{ url: string; error: string | null }> = [];
    page.on("response", (response) => {
      if (new URL(response.url()).hostname === "esm.sh") {
        responses.push({ url: response.url(), status: response.status() });
      }
    });
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).hostname === "esm.sh") {
        failures.push({ url: request.url(), error: request.failure()?.errorText ?? null });
      }
    });
    try {
      const moduleResponse = page.waitForResponse("https://esm.sh/mermaid@11.17.2");
      await page.goto(MERMAID_PAGE, { waitUntil: "load" });
      expect((await moduleResponse).ok()).toBe(true);
      const svg = page.locator("[data-mermaid-rendered] svg.flowchart");
      await expect(svg).toBeVisible({ timeout: 30_000 });
      for (const [theme, color, fill] of [["light", "#123456", "rgb(18, 52, 86)"], ["dark", "#abcdef", "rgb(171, 205, 239)"], ["light", "#654321", "rgb(101, 67, 33)"]] as const) {
        const previousId = await svg.getAttribute("id");
        await page.evaluate(({ theme, color }) => {
          document.documentElement.setAttribute("data-theme", theme);
          document.documentElement.style.setProperty("--zd-mermaid-node-bg", color);
        }, { theme, color });
        await expect(svg).toHaveCount(1);
        await expect(svg).not.toHaveAttribute("id", previousId!);
        await expect(svg.locator(".node")).not.toHaveCount(0);
        await expect(svg).toContainText("Start");
        await expect(svg.locator(".node rect").first()).toHaveCSS("fill", fill);
        await expect(page.locator("[data-mermaid-rendered] .zd-enlarge-btn")).toHaveCount(1);
      }
      assertNoConsoleErrors();
    } finally {
      const katexResponses = responses.filter(({ url }) => /\/katex@/.test(url));
      // Observed module responses are delivery evidence, not a complete audit.
      // No KaTeX response means only that this flowchart did not request one.
      console.log("Mermaid CDN KaTeX responses:", JSON.stringify(katexResponses));
      await testInfo.attach("mermaid-cdn-delivery", {
        body: JSON.stringify({ responses, failures, katexResponses }, null, 2),
        contentType: "application/json",
      });
    }
  });
  test("mermaid diagram stays rendered after SPA nav away-and-back", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    // ── Step 1: direct-load to warm the esm.sh mermaid module ────────────────
    await page.goto(MERMAID_PAGE, { waitUntil: "load" });

    const renderedLocator = page.locator("[data-mermaid-rendered]");
    await renderedLocator.waitFor({ state: "attached", timeout: 30_000 });

    // Confirm baseline SVG present on direct load.
    await expect(renderedLocator.locator(DIAGRAM_SVG)).toBeAttached();

    // ── Step 2: SPA-navigate away, then back ─────────────────────────────────
    const awayFired = await spaClick(page, AWAY_PAGE);
    expect(awayFired, `zfb:after-swap did not fire navigating to ${AWAY_PAGE}`).toBe(true);

    const backFired = await spaClick(page, MERMAID_PAGE);
    expect(backFired, `zfb:after-swap did not fire navigating back to ${MERMAID_PAGE}`).toBe(true);

    // ── Step 3a: SVG present shortly after the swap (~350ms check) ───────────
    // The mermaid init fires asynchronously after zfb:after-swap; give it a
    // generous window to render before the 300ms debounce deadline.
    await expect(
      page.locator(`[data-mermaid-rendered] ${DIAGRAM_SVG}`),
      "SVG should appear inside [data-mermaid-rendered] after SPA nav back",
    ).toBeAttached({ timeout: 10_000 });

    // ── Step 3b: SVG still present and non-empty AFTER the 300ms debounce ────
    // Wait beyond the debounce window and re-assert.
    // Pre-fix code blanks the SVG at ~360ms; this assertion catches that.
    await page.waitForTimeout(POST_DEBOUNCE_WAIT_MS); // wait-ok: sample state past the ~300ms debounce deadline to catch the pre-fix SVG-blanking regression (see comment above)

    const svgContent = await page.evaluate(() => {
      const svg = document.querySelector("[data-mermaid-rendered] svg.flowchart");
      return svg ? svg.innerHTML.trim() : null;
    });

    expect(
      svgContent,
      "SVG inside [data-mermaid-rendered] should still exist after the 300ms reinit debounce",
    ).not.toBeNull();

    expect(
      svgContent,
      "SVG should be non-empty after the 300ms reinit debounce (pre-fix stripped it to blank)",
    ).not.toBe("");

    // ── Optional: no console errors ───────────────────────────────────────────
    assertNoConsoleErrors();
  });
});
