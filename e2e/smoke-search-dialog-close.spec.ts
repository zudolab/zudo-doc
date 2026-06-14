import { test, expect } from "./fixtures";

/**
 * Regression spec for epic #2148 — the two linked search-dialog defects:
 *
 *   1. Clicking a search result did NOT close the <dialog>. Result links are
 *      plain <a> created in renderResult(); nothing closed the dialog, so under
 *      zfb Strategy-B SPA navigation (`zfb:after-swap`) the page body swapped
 *      while the open <dialog> lingered.
 *   2. Overlay z-index flash: an open native showModal() dialog can lose its
 *      top-layer promotion during the SPA swap and fall back to z-index:auto,
 *      flashing behind the header/sidebar.
 *
 * The fix wires a delegated click handler on the results container that calls
 * closeDialog() on any result-link activation (WITHOUT preventDefault, so SPA
 * navigation still proceeds), plus an `zfb:after-swap` backstop that closes the
 * dialog if it is somehow still open after a body swap.
 *
 * This spec asserts BOTH outcomes after a result click:
 *   (a) the dialog is closed, and
 *   (b) navigation actually occurred (URL changed to the result page).
 */

const DOCS_PAGE = "/docs/getting-started";

test.describe("Search dialog closes on result click (#2148)", () => {
  test("clicking a result closes the dialog AND navigates", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(DOCS_PAGE, { waitUntil: "domcontentloaded" });

    const startUrl = page.url();

    // Open search and type a query that yields results.
    await page.keyboard.press("Control+k");
    const dialog = page.locator("[data-search-dialog]");
    await expect(dialog).toBeVisible();

    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });
    await input.fill("Guides");

    // Wait for at least one result link (index loads async).
    const firstResultLink = page.locator("[data-search-results] article a").first();
    await expect(firstResultLink).toBeVisible({ timeout: 10000 });

    const href = await firstResultLink.getAttribute("href");
    expect(href, "result link should have a real href").toBeTruthy();

    // Click the result — must NOT preventDefault, so navigation proceeds.
    await firstResultLink.click();

    // (a) Dialog is closed. Assert via both the visibility locator and the
    // native <dialog>.open property (showModal/close drives `open`).
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    // The <dialog> element itself must still exist after the SPA swap (the
    // header persists across same-locale swaps via data-zfb-transition-persist).
    // Assert presence first so a missing element gives a clear diagnostic rather
    // than an opaque `expect(null).toBe(false)`.
    await expect(dialog).toHaveCount(1);
    const dialogOpen = await page.evaluate(() => {
      const d = document.querySelector<HTMLDialogElement>("[data-search-dialog]");
      return d ? d.open : null;
    });
    expect(dialogOpen, "native <dialog>.open should be false after result click").toBe(false);

    // (b) Navigation occurred — URL changed to the result page.
    await page.waitForURL(
      new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      { timeout: 5000 },
    );
    expect(page.url(), "URL should have changed away from the starting page").not.toBe(
      startUrl,
    );

    // The dialog stays closed after the swap settles (no flash / re-open).
    await expect(dialog).not.toBeVisible();

    // No errors thrown during close + SPA swap (e.g. inside closeDialog()).
    assertNoConsoleErrors();
  });
});
