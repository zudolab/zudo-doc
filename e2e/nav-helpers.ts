/**
 * Shared SPA-navigation helpers for vt-chrome-persist specs.
 *
 * Design rules (test-wisdom "event-keyed waits"):
 *   - The zfb:after-swap listener is registered BEFORE the click so there is
 *     no window between click and listener registration.
 *   - Timeout is controlled by Playwright (waitForFunction timeout) rather than
 *     an arbitrary in-page setTimeout, so test-runner timeouts are honoured.
 *   - No waitForLoadState("networkidle") — that API is inherently racy for SPA
 *     navigations that do not trigger new network requests.
 *   - No swallowed .catch(() => null) on fallible waits.
 */

import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// spaClick — perform a SPA navigation via href and wait for zfb:after-swap
// ---------------------------------------------------------------------------

/**
 * Click the first anchor whose `href` attribute exactly matches `href`, then
 * wait for the `zfb:after-swap` event to fire.
 *
 * Returns `true` when the swap fires, `false` when the anchor was not found.
 * Throws (via Playwright's expect timeout) when the swap does not fire within
 * the configured test timeout.
 *
 * Implementation:
 *   1. `page.evaluate` installs the event listener AND reads the anchor
 *      synchronously (no gap between listener and click).
 *   2. A boolean flag (`window.__zfbSwapFired__`) is set when the event fires.
 *   3. The click is issued inside the same evaluate call so the listener is
 *      guaranteed to be registered before the click dispatches.
 *   4. `page.waitForFunction` polls the flag with Playwright's native timeout.
 */
export async function spaClick(page: Page, href: string): Promise<boolean> {
  // Install listener and click atomically so there is no race window.
  const anchorFound = await page.evaluate((h: string) => {
    const anchor = document.querySelector<HTMLElement>(`a[href="${h}"]`);
    if (!anchor) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__zfbSwapFired__ = false;
    document.addEventListener(
      "zfb:after-swap",
      () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__zfbSwapFired__ = true;
      },
      { once: true },
    );
    anchor.click();
    return true;
  }, href);

  if (!anchorFound) return false;

  // Wait for the flag — Playwright controls the timeout (uses the test's
  // configured timeout, not an arbitrary in-page setTimeout).
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__zfbSwapFired__ === true,
    undefined,
    { timeout: 10000 },
  );
  return true;
}

// ---------------------------------------------------------------------------
// spaClickSelector — selector-based variant for cross-type nav tests
// ---------------------------------------------------------------------------

/**
 * Click the first element matching `selector` and wait for `zfb:after-swap`.
 *
 * Use when the exact anchor `href` value (trailing slash, base prefix) is
 * unknown or not worth hardcoding (e.g. `header a[href="/"]`).
 */
export async function spaClickSelector(
  page: Page,
  selector: string,
): Promise<boolean> {
  const anchorFound = await page.evaluate((sel: string) => {
    const anchor = document.querySelector<HTMLElement>(sel);
    if (!anchor) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__zfbSwapFired__ = false;
    document.addEventListener(
      "zfb:after-swap",
      () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__zfbSwapFired__ = true;
      },
      { once: true },
    );
    anchor.click();
    return true;
  }, selector);

  if (!anchorFound) return false;

  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__zfbSwapFired__ === true,
    undefined,
    { timeout: 10000 },
  );
  return true;
}

// ---------------------------------------------------------------------------
// waitForSidebarNav — hydration wait for the i18n fixture
// ---------------------------------------------------------------------------

/**
 * Wait for the desktop sidebar nav to be attached to the DOM.
 *
 * The i18n fixture's getting-started section has a single page, so the
 * sidebar may not have category collapse/expand buttons. We use an
 * attached-state locator wait rather than the full waitForSidebarHydration
 * (which requires a category toggle button that is absent in the i18n fixture).
 *
 * Modeled on sidebar-helpers.ts: attached-state locator, no waitForTimeout.
 */
export async function waitForSidebarNav(page: Page): Promise<void> {
  await page.locator("#desktop-sidebar").waitFor({ state: "attached", timeout: 10000 });
  // Wait for the nav inside the sidebar to be attached — this confirms the
  // Preact island has at least started rendering its nav tree.
  await page.locator("#desktop-sidebar nav").waitFor({ state: "attached", timeout: 10000 });
}
