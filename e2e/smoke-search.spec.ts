import { test, expect } from "@playwright/test";

/**
 * E2E tests for the search dialog (<site-search> custom element).
 *
 * The search component uses MiniSearch with an async-loaded index
 * from /search-index.json. Tests verify keyboard shortcuts, input focus,
 * result rendering, navigation, and close behavior.
 */

const DOCS_PAGE = "/docs/getting-started";

test.describe("Search dialog", () => {
  test("Ctrl+K opens the search dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    const dialog = page.locator("[data-search-dialog]");
    await expect(dialog).not.toBeVisible();

    await page.keyboard.press("Control+k");

    await expect(dialog).toBeVisible();
  });

  test("search input is focused when dialog opens", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    await page.keyboard.press("Control+k");

    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });
  });

  test("typing a query shows results", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    await input.fill("Getting Started");

    // Wait for results to appear (index loads async)
    const results = page.locator("[data-search-results] article");
    await expect(results.first()).toBeVisible({ timeout: 10000 });

    // Should have at least one result
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking a result navigates to that page", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    await input.fill("Guides");

    // Wait for results
    const firstResultLink = page.locator("[data-search-results] article a").first();
    await expect(firstResultLink).toBeVisible({ timeout: 10000 });

    // Get the href of the result
    const href = await firstResultLink.getAttribute("href");
    expect(href).toBeTruthy();

    // Click the result
    await firstResultLink.click();

    // Should navigate to the result page
    await page.waitForURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
      timeout: 5000,
    });
  });

  test("Escape closes the dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    await page.keyboard.press("Control+k");
    const dialog = page.locator("[data-search-dialog]");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).not.toBeVisible();
  });

  test("clicking backdrop closes the dialog", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    await page.keyboard.press("Control+k");
    const dialog = page.locator("[data-search-dialog]");
    await expect(dialog).toBeVisible();

    // Click on the dialog element itself (the backdrop area)
    // The dialog uses click-on-self to detect backdrop clicks
    await dialog.click({ position: { x: 1, y: 1 } });

    await expect(dialog).not.toBeVisible();
  });

  test("nonsense query shows 'No results found.'", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    await input.fill("xyznonexistent123");

    // Wait for "No results found." text to appear
    const noResults = page.locator("[data-search-results]").getByText("No results found.");
    await expect(noResults).toBeVisible({ timeout: 10000 });
  });

  test("matched keywords are highlighted with mark elements", async ({ page }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    const searchQuery = "Getting Started";
    await input.fill(searchQuery);

    // Wait for results
    const results = page.locator("[data-search-results] article");
    await expect(results.first()).toBeVisible({ timeout: 10000 });

    // Verify mark elements exist in results
    const marks = page.locator("[data-search-results] article mark");
    await expect(marks.first()).toBeVisible({ timeout: 5000 });

    // Verify highlighted text matches query terms (case-insensitive)
    const markTexts = await marks.allTextContents();
    expect(markTexts.length).toBeGreaterThan(0);
    const queryTerms = searchQuery.toLowerCase().split(/\s+/);
    for (const text of markTexts) {
      const lower = text.toLowerCase();
      expect(
        queryTerms.some((term) => lower.includes(term)),
        `Expected "${text}" to contain one of: ${queryTerms.join(", ")}`,
      ).toBeTruthy();
    }

    // Regression guard (#364): the search <mark> highlight must run through
    // dedicated matchedKeyword tokens at the scheme-provider layer, not piggyback
    // on --color-warning via color-mix.
    //
    // The fixture build does NOT bundle Tailwind's @theme :root emission, so we
    // cannot assert --color-matched-keyword-bg on :root here. Instead we verify
    // the scheme provider layer: the ColorSchemeProvider inlines
    // --zd-matched-keyword-bg / --zd-matched-keyword-fg into <style>:root {...},
    // and those exist only if schemeToCssPairs + semantic defaults still emit
    // them. If someone removes the matchedKeyword plumbing from
    // color-scheme-utils.ts, these properties disappear and this test fails.
    const zdTokens = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        zdBg: style.getPropertyValue("--zd-matched-keyword-bg").trim(),
        zdFg: style.getPropertyValue("--zd-matched-keyword-fg").trim(),
      };
    });
    expect(zdTokens.zdBg.length, "expected --zd-matched-keyword-bg to be emitted on :root by ColorSchemeProvider").toBeGreaterThan(0);
    expect(zdTokens.zdFg.length, "expected --zd-matched-keyword-fg to be emitted on :root by ColorSchemeProvider").toBeGreaterThan(0);
  });

  // Regression guard (#2062): when search-index.json fails to load, the widget
  // must show a terminal "Search unavailable" state and STOP refetching on every
  // keystroke. The _indexUnavailable flag used to be write-only, so search()
  // would replace the message with "Loading search index…" and refetch the index
  // on each debounce tick (flicker + a request per keystroke). The fix
  // short-circuits search() while the flag is set; only the open() reload path
  // retries. The fetch-count assertion is the deterministic discriminator.
  test("search index load failure shows persistent 'Search unavailable' without a refetch loop", async ({
    page,
  }) => {
    // Force every search-index.json request to fail, and count how many fire.
    let indexFetches = 0;
    await page.route("**/search-index.json", (route) => {
      indexFetches += 1;
      return route.abort();
    });

    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    // Open search — openDialog() triggers the (now failing) index load. This is
    // the intended retry trigger and is allowed exactly one fetch.
    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    const results = page.locator("[data-search-results]");
    await expect(results.getByText("Search unavailable")).toBeVisible({ timeout: 10000 });
    expect(indexFetches, "open() reload path should fire exactly one index fetch").toBe(1);

    // The search widget debounces input at 150ms before calling search(); each
    // fill() + poll below waits until the debounce tick has fired and the DOM
    // has updated, replacing the old fixed waitForTimeout(300) sleeps.

    // Type a query (first debounce tick > 150ms). With the bug this replaces the
    // message with "Loading search index…" and refetches.
    await input.fill("alpha");
    // Poll until the debounce has fired — "Search unavailable" must remain
    // visible (not replaced by "Loading search index…").
    await expect
      .poll(
        () => results.getByText("Search unavailable").isVisible(),
        {
          // 150ms debounce + margin; polls at short intervals so the test is
          // fast on CI while still waiting for the debounce to complete.
          intervals: [50, 100, 100, 200],
          timeout: 2000,
          message: "Search unavailable should remain visible after first keystroke",
        },
      )
      .toBe(true);

    // Type again (second debounce tick) — another chance for the buggy refetch.
    await input.fill("alpha beta");
    // Same poll for the second debounce cycle.
    await expect
      .poll(
        () => results.getByText("Search unavailable").isVisible(),
        {
          intervals: [50, 100, 100, 200],
          timeout: 2000,
          message: "Search unavailable should remain visible after second keystroke",
        },
      )
      .toBe(true);

    // "Search unavailable" stays put; "Loading search index…" must never linger.
    await expect(results.getByText("Search unavailable")).toBeVisible();
    await expect(results.getByText("Loading search index")).toHaveCount(0);

    // Keystrokes fired no extra fetches — still just the single open() load.
    expect(indexFetches, "keystrokes while unavailable must not refetch the index").toBe(1);
  });
});
