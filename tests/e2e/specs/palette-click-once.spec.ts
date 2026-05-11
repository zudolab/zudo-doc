// Gated regression spec — NOT wired into b4push or pr-checks (E2E parity is parked under E9b).
// Manual run: pnpm exec playwright test tests/e2e/specs/palette-click-once.spec.ts --config playwright.palette.config.ts --reporter=list
// Requires `pnpm dev:zfb` running first (port 3000), or set PLAYWRIGHT_BASE_URL.

/**
 * Regression spec for the palette-click-once bug (epic #1633).
 *
 * Causal proof: R1b (`__inbox/palette-repro/r1b-causal.md`, now deleted).
 * The bug: after opening the design token panel on page A and SPA-navigating
 * to page B, the first click on the palette button does NOT open the panel.
 * `handleExternalToggleEvent` reads the stale `OPEN_KEY='1'` left by
 * `unmountForSwap` and incorrectly decides the user wants to CLOSE, mounts
 * the panel in the closed state, and returns. The user perceives nothing
 * happened. A second click is needed.
 *
 * Scenario G1 (primary / user-reported):
 *   Open panel on page A → SPA-navigate to page B via sidebar click → click
 *   palette button → panel must be visible after ONE click.
 *
 * Target server: `pnpm dev:zfb` (port 3000).
 * The zfb dev server serves at the configured base path `/pj/zudo-doc/`.
 * Doc pages (not the root) include the islands bundle so the
 * DesignTokenPanelBootstrap island hydrates correctly.
 */

import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

// zfb dev server base (port 3000) with site base path.
// Override via PLAYWRIGHT_BASE_URL for a different server.
const BASE_URL =
  (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// PAGE_A must be a doc page (not root) so the islands bundle loads and
// DesignTokenPanelBootstrap hydrates — the home page omits the islands script.
const PAGE_A_PATH = "/pj/zudo-doc/docs/getting-started/";
const PAGE_B_PATTERN = /\/docs\//;
const PALETTE_BTN_SEL = '[aria-label="Toggle design token panel"]';
const PANEL_SHELL_SEL = `#zudo-doc-tweak-root .tokenpanel-shell`;

/** Return true when the panel shell is visually present and has non-zero size. */
async function isPanelOpen(page: Page): Promise<boolean> {
  const shell = page.locator(PANEL_SHELL_SEL);
  const count = await shell.count();
  if (count === 0) return false;
  const bbox = await shell.boundingBox();
  return bbox !== null && bbox.width > 0 && bbox.height > 0;
}

test.describe("Palette click-once regression @local-only", () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser: b }) => {
    browser = b;
    // Fresh context (clean localStorage) for each scenario.
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context.close();
  });

  // ---------------------------------------------------------------------------
  // G1 — SPA-nav-from-open-panel (primary user-reported bug)
  // ---------------------------------------------------------------------------

  test("G1: one click opens panel after SPA-nav from page with open panel", async () => {
    // Step 1 — Navigate to page A (home / any doc page).
    await page.goto(`${BASE_URL}${PAGE_A_PATH}`, {
      waitUntil: "load",
      timeout: 30_000,
    });
    // Allow island hydration to settle before interacting.
    await page.waitForTimeout(1_500);

    // Step 2 — Open the design token panel on page A.
    const paletteOnA = page.locator(PALETTE_BTN_SEL).first();
    await paletteOnA.scrollIntoViewIfNeeded({ timeout: 10_000 });
    await paletteOnA.click();
    await expect(page.locator(PANEL_SHELL_SEL)).toBeVisible({ timeout: 5_000 });

    // Step 3 — SPA-navigate to page B by clicking an internal doc anchor.
    // Dispatch a synthetic click so the router handles it (same as the R1b
    // CJS runner). This replicates the real user flow of clicking a sidebar
    // link without leaving the SPA context.
    // We look for a doc link that is NOT the current page so we actually navigate.
    const navResult = await page.evaluate(() => {
      const currentHref = location.pathname;
      const a = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).find(
        (el) => {
          const href = el.getAttribute("href") ?? "";
          return href.includes("/docs/") && !href.endsWith(currentHref) && href !== currentHref;
        },
      );
      if (!a) return { ok: false as const, reason: "no-anchor" };
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      return { ok: true as const, href: a.getAttribute("href") ?? "" };
    });

    expect(navResult.ok, `SPA nav failed: ${(navResult as { reason?: string }).reason ?? ""}`).toBe(true);
    await page.waitForURL(PAGE_B_PATTERN, { timeout: 15_000 });
    // Allow the SPA swap + island re-hydration to settle.
    await page.waitForTimeout(2_500);

    // Step 4 — Click the palette button on page B. Must open after ONE click.
    const paletteOnB = page.locator(PALETTE_BTN_SEL).first();
    await paletteOnB.scrollIntoViewIfNeeded({ timeout: 5_000 });
    await paletteOnB.click();

    // The regression: without the fix, the panel mounts closed and this
    // assertion fails — the shell never becomes visible after 1 click.
    await expect(page.locator(PANEL_SHELL_SEL)).toBeVisible({ timeout: 5_000 });
    expect(await isPanelOpen(page), "Panel must be visually open after 1 click on page B").toBe(true);
  });

  // ---------------------------------------------------------------------------
  // B1 — Pre-seeded OPEN_KEY + hard reload (secondary hardening scenario).
  //
  // When OPEN_KEY='1' is present in localStorage and the user does a hard
  // reload, the panel should open after exactly one click. This scenario
  // is less critical than G1 (it cannot be reached through normal user flow
  // without manually setting localStorage), but it is a useful guard against
  // regressions of the toggle-direction logic.
  // ---------------------------------------------------------------------------

  test("B1: one click opens panel when OPEN_KEY pre-seeded before hard reload @local-only", async () => {
    const OPEN_KEY = "zudo-doc-tweak-open";

    // Pre-seed OPEN_KEY before first navigation (simulates a "stale open" state).
    await page.addInitScript((key: string) => {
      localStorage.setItem(key, "1");
    }, OPEN_KEY);

    await page.goto(`${BASE_URL}${PAGE_A_PATH}`, {
      waitUntil: "load",
      timeout: 30_000,
    });
    // Allow island hydration to settle before interacting.
    await page.waitForTimeout(1_500);

    // One click must open the panel.
    const paletteBtn = page.locator(PALETTE_BTN_SEL).first();
    await paletteBtn.scrollIntoViewIfNeeded({ timeout: 10_000 });
    await paletteBtn.click();

    await expect(page.locator(PANEL_SHELL_SEL)).toBeVisible({ timeout: 5_000 });
    expect(await isPanelOpen(page), "Panel must be visually open after 1 click when OPEN_KEY is pre-seeded").toBe(true);
  });
});
