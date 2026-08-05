import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * Persisted-state PROBE path (zudolab/zudo-doc#3282, epic #3261): zdtp is
 * lazy-loaded — `bootstrapDesignTokenPanel` carries no top-level
 * `@takazudo/zdtp` import, so on an ordinary page load with no saved state
 * the panel trigger stays inert until the FIRST toggle click. A returning
 * visitor with a saved token override must not lose it while waiting for
 * that click: `hasPersistedPanelState` (design-token-panel-bootstrap.tsx)
 * probes the active storage prefix at mount and, on a hit, eager-loads zdtp
 * and reapplies the override immediately — with no trigger click involved.
 *
 * Every other DTP spec in this repo is a single full page load (the panel
 * is opened via a click, which itself triggers the non-probe lazy load) or
 * an SPA transition (`theme-pack-zdtp-interplay.spec.ts`, which keeps the
 * same JS module instance alive across navigations). This spec is the only
 * one that forces a genuinely fresh page load — a hard reload, not zfb's
 * SPA transition — so the module scope resets and the PROBE, not a click
 * and not an already-running instance, is what has to do the loading.
 *
 * State is seeded through the real UI (open panel, set an override, close
 * panel) rather than a hand-seeded localStorage envelope: the persisted
 * `zudo-doc-tweak-state-v4` shape is zdtp-private and schema-brittle, so
 * driving it through the actual panel keeps this spec agnostic to that
 * shape and exercises the exact same write path a real user hits.
 */

const TRIGGER = "#design-token-trigger";
const SHELL = ".tokenpanel-shell";

const SPACING_CSS_VAR = "--spacing-hsp-lg";
const SPACING_OVERRIDE_VALUE = "3rem";
const SPACING_OVERRIDE_INPUT = "3";

async function openPanel(page: Page): Promise<void> {
  await page.locator(TRIGGER).click();
  await expect(page.locator(SHELL)).toBeVisible({ timeout: 5000 });
}

async function closePanel(page: Page): Promise<void> {
  await page.locator(TRIGGER).click();
  await expect(page.locator(SHELL)).toBeHidden({ timeout: 5000 });
}

async function openSpacingTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Spacing", exact: true }).click();
}

function spacingInput(page: Page) {
  return page
    .getByTestId("tier-item-hsp-lg")
    .getByLabel(`${SPACING_CSS_VAR} value`, { exact: true });
}

async function readCssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (cssVar) => getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim(),
    name,
  );
}

/** Set the Spacing tab's `hsp-lg` row to `magnitude` (a bare number — the
 *  token's unit is fixed to `rem`) and wait for the commit to land on
 *  `<html style>` before proceeding. */
async function setSpacingOverride(page: Page, magnitude: string): Promise<void> {
  await spacingInput(page).fill(magnitude);
  await expect
    .poll(() => readCssVar(page, SPACING_CSS_VAR), { timeout: 5000 })
    .toBe(`${magnitude}rem`);
}

test.describe("Design token panel (zdtp) persisted-state probe", () => {
  test("a saved override re-applies on a fresh page load with the panel closed and no trigger click", async ({
    page,
  }) => {
    await page.goto("/docs/getting-started/", { waitUntil: "load" });

    await openPanel(page);
    await openSpacingTab(page);
    await setSpacingOverride(page, SPACING_OVERRIDE_INPUT);
    expect(await readCssVar(page, SPACING_CSS_VAR)).toBe(SPACING_OVERRIDE_VALUE);

    // Close the panel before reloading: the `${prefix}-open` mirror reads
    // "0", so any eager load observed after reload can only be explained by
    // the OTHER branch hasPersistedPanelState checks — the `${prefix}-state*`
    // key — not by a previously-open panel being restored.
    await closePanel(page);

    // A genuine full reload, not zfb's SPA transition: this resets the JS
    // module scope, so `bootstrapDesignTokenPanel` runs its mount-time probe
    // from a cold `configurePhase: "pending"` state — exactly like a
    // returning visitor's first request of the session.
    await page.reload({ waitUntil: "load" });

    // No trigger click happens before this assertion. If the probe did not
    // fire, the CSS var would sit at its un-overridden cascade default until
    // a click loaded zdtp.
    await expect
      .poll(() => readCssVar(page, SPACING_CSS_VAR), { timeout: 5000 })
      .toBe(SPACING_OVERRIDE_VALUE);

    // The probe reapplies silently and must NOT also auto-open the panel —
    // it was closed (wasOpen === false) at reload time.
    await expect(page.locator(SHELL)).toBeHidden();

    // Prove zdtp is genuinely already active post-probe, not still cold: the
    // FIRST click after reload opens the panel outright, and the row shows
    // the same override value — re-seeded from the storage prefix the probe
    // already read.
    await openPanel(page);
    await openSpacingTab(page);
    await expect(spacingInput(page)).toHaveValue(SPACING_OVERRIDE_INPUT);
  });
});
