import { test, expect } from "@playwright/test";

const TRIGGER = "#design-token-trigger";
const SHELL = ".tokenpanel-shell";

test.describe("Design token panel (zdtp)", () => {
  test("trigger click opens the panel; second click closes it", async ({ page }) => {
    await page.goto("/docs/getting-started/", { waitUntil: "load" });
    await page.locator(TRIGGER).click();
    await expect(page.locator(SHELL)).toBeVisible({ timeout: 5000 });
    await page.locator(TRIGGER).click();
    await expect(page.locator(SHELL)).toBeHidden({ timeout: 5000 });
  });

  // Regression guard for the stale open-state toggle-direction bug
  // (zudolab/zudo-doc#1633, palette click-once). Current contract (verified
  // 2026-06-13): the panel's open state persists across SPA navigation — after
  // a swap the panel re-mounts OPEN, the next trigger click closes it, and one
  // more click reopens it. If swap-time state handling desyncs from visual
  // reality again, this strict visible -> hidden -> visible sequence breaks.
  test("panel open state persists across SPA navigation; trigger toggles correctly after swap", async ({ page }) => {
    await page.goto("/docs/getting-started/", { waitUntil: "load" });
    await page.locator(TRIGGER).click();
    await expect(page.locator(SHELL)).toBeVisible({ timeout: 5000 });

    await page.locator('header a[href="/docs/guides"]').first().click();
    await page.waitForURL(/\/docs\/guides/, { timeout: 15000 });

    await expect(page.locator(SHELL)).toBeVisible({ timeout: 10000 });

    await page.locator(TRIGGER).click();
    await expect(page.locator(SHELL)).toBeHidden({ timeout: 5000 });
    await page.locator(TRIGGER).click();
    await expect(page.locator(SHELL)).toBeVisible({ timeout: 5000 });
  });
});
