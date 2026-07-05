import { test, expect } from "./fixtures";

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

  // Regression guard for the "Color Tab Faithful" epic (zudolab/zudo-doc#2606).
  // The Color tab must render its semantic roles as GROUPED ramp-reference
  // dropdowns (`<select>` with Base/Accent/State `<optgroup>`s) — NOT as the
  // zdtp default grayscale-palette swatch grid that appeared when the color
  // cluster fell back to a bare palette (the bug this epic fixed). This shape
  // is invisible to unit tests and the static build; only the live panel shows
  // it. Selectors are class/role based (never instance-scoped `dtp-*` ids).
  test("Color tab renders grouped ramp-reference dropdowns, not a grayscale palette", async ({ page }) => {
    await page.goto("/docs/getting-started/", { waitUntil: "load" });
    await page.locator(TRIGGER).click();
    await expect(page.locator(SHELL)).toBeVisible({ timeout: 5000 });

    await page.getByRole("tab", { name: "Color", exact: true }).click();

    // ≥1 semantic row is a <select> carrying Base/Accent/State <optgroup>s (a ref
    // row). The `optgroup[label="Base"]` predicate also distinguishes color ref
    // rows from the Font tab's (ungrouped) reference dropdowns.
    const groupedRefSelect = page.locator(
      'select.tokenpanel-tier-ref-select:has(optgroup[label="Base"])',
    );
    await expect(groupedRefSelect.first()).toBeVisible({ timeout: 5000 });
    const first = groupedRefSelect.first();
    await expect(first.locator('optgroup[label="Accent"]')).toHaveCount(1);
    await expect(first.locator('optgroup[label="State"]')).toHaveCount(1);

    // The full semantic tier renders as grouped dropdowns; the grayscale-palette
    // failure shape produced ZERO grouped ref selects, so a healthy floor here
    // (well above 0) proves the failure shape is absent without pinning the
    // exact role count.
    expect(await groupedRefSelect.count()).toBeGreaterThanOrEqual(20);

    // The "Semantic Tokens" section renders and is not empty.
    await expect(
      page.locator(".tokenpanel-tab-section-heading--color"),
    ).toContainText("Semantic");
  });
});
