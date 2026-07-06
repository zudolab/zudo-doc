import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * Regression guard for #2617 ("Panel-open theme toggle wiped inline
 * color-scheme").
 *
 * Bug: with the design token panel OPEN, toggling light<->dark left the
 * page un-repainted. zdtp's panel-remount "clear applied inline styles"
 * pass also wiped `<html style="color-scheme">` (which ThemeToggle's
 * `applyColorScheme` had just set) — every `light-dark()` token then fell
 * back to the stylesheet's `:root { color-scheme: light dark; }` and
 * rendered its LIGHT arm regardless of `data-theme`.
 *
 * Host mitigation (packages/zudo-doc/src/design-token-panel-bootstrap.ts,
 * the `color-scheme-changed` listener around lines 146-160): after a
 * mode-scoped panel reconfigure, the inline `color-scheme` is re-asserted
 * from a TRAILING macrotask (`setTimeout(0)` nested inside the coalescing
 * `setTimeout(0)`) so it wins over zdtp's own microtask/rAF clear. The
 * re-assert is UNCONDITIONAL (not gated on the panel having been open) —
 * the still-mounted HIDDEN root's own scheme-change listener clears the
 * inline style too, so a panel that was opened-then-closed needs the same
 * fix.
 *
 * The `smoke` fixture is single-scheme (`colorMode: false`), so it has no
 * `light-dark()` token to repaint and cannot catch this class of bug — this
 * spec routes to the `theme` fixture (dual light/dark +
 * `designTokenPanel: true`) via the `theme-*` filename prefix (testMatch
 * convention, see e2e/CLAUDE.md).
 *
 * On the current tree (zdtp 0.4.4 + the host workaround above) this guard
 * is EXPECTED TO PASS — the workaround masks the bug. It exists to catch a
 * regression if the workaround is ever removed/broken, and (per the zdtp
 * 0.4.5 adoption epic) to be re-verified once the workaround itself is
 * removed in favor of an upstream fix.
 */

const HOME = "/";
const STORAGE_KEY = "zudo-doc-theme";

// Selector for the desktop-visible theme toggle button (mirrors
// theme-toggle.spec.ts).
const DESKTOP_TOGGLE_SELECTOR = 'header .ml-auto button[aria-label*="Switch to"]';

const TRIGGER = "#design-token-trigger";
const SHELL = ".tokenpanel-shell";

type Mode = "light" | "dark";

function otherMode(mode: Mode): Mode {
  return mode === "light" ? "dark" : "light";
}

/** The toggle's aria-label names the mode it would switch TO. */
function nextModeLabel(activeMode: Mode): string {
  return `Switch to ${otherMode(activeMode)} mode`;
}

/** Preseed the stored theme before navigation (SSR/pre-paint script reads it on load). */
async function preseedTheme(page: Page, startMode: Mode) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: startMode },
  );
}

/**
 * Wait for the toggle to reflect `activeMode` — confirms the ThemeToggle
 * island has hydrated and synced from the DOM (same technique as
 * theme-toggle.spec.ts), so the subsequent click actually drives the
 * component instead of landing on a not-yet-hydrated button.
 */
async function waitForToggleHydrated(page: Page, activeMode: Mode) {
  const toggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
  await expect(toggle).toHaveAttribute("aria-label", nextModeLabel(activeMode), {
    timeout: 5000,
  });
}

/** Snapshot of the repaint-relevant state, mirroring the columns from the #2617 repro table. */
async function readColorSchemeState(page: Page) {
  return page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute("data-theme"),
    inlineColorScheme: document.documentElement.style.colorScheme,
    computedColorScheme: getComputedStyle(document.documentElement).colorScheme,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }));
}

/**
 * Click the toggle and wait until the inline `color-scheme` settles on
 * `targetMode`. The host workaround re-asserts this value from a trailing
 * macrotask, so a bare post-click read would race it — poll instead of
 * sleeping a fixed duration.
 */
async function toggleAndWaitForRepaint(page: Page, targetMode: Mode) {
  await page.locator(DESKTOP_TOGGLE_SELECTOR).click();
  await page.waitForFunction(
    (mode) => document.documentElement.style.colorScheme === mode,
    targetMode,
    { timeout: 5000, polling: 50 },
  );
}

/** Open the panel via the trigger and wait for the shell to mount. */
async function openPanel(page: Page) {
  await page.locator(TRIGGER).click();
  await expect(page.locator(SHELL)).toBeVisible({ timeout: 5000 });
}

/** Close the panel via the trigger and wait for the shell to hide. */
async function closePanel(page: Page) {
  await page.locator(TRIGGER).click();
  await expect(page.locator(SHELL)).toBeHidden({ timeout: 5000 });
}

/**
 * Full before/after assertion for one toggle: the pre-toggle snapshot must
 * already match `startMode` (sane starting point), and the post-toggle
 * snapshot must match `targetMode` on all three color-scheme signals AND
 * repaint the body background to a genuinely different computed value (no
 * hardcoded oklch values — just "the two modes differ").
 */
async function assertTogglesAndRepaints(page: Page, startMode: Mode) {
  const targetMode = otherMode(startMode);

  const before = await readColorSchemeState(page);
  expect(before.dataTheme).toBe(startMode);
  expect(before.inlineColorScheme).toBe(startMode);
  expect(before.computedColorScheme).toBe(startMode);

  await toggleAndWaitForRepaint(page, targetMode);

  const after = await readColorSchemeState(page);
  expect(after.dataTheme).toBe(targetMode);
  expect(after.inlineColorScheme).toBe(targetMode);
  expect(after.computedColorScheme).toBe(targetMode);
  expect(after.bodyBg).not.toBe(before.bodyBg);
}

test.describe("Theme panel repaint (#2617 regression guard)", () => {
  test.describe("panel OPEN across the toggle", () => {
    test("light -> dark toggle repaints the page", async ({ page }) => {
      await preseedTheme(page, "light");
      await page.goto(HOME, { waitUntil: "load" });
      await waitForToggleHydrated(page, "light");

      await openPanel(page);
      await assertTogglesAndRepaints(page, "light");
    });

    test("dark -> light toggle repaints the page", async ({ page }) => {
      await preseedTheme(page, "dark");
      await page.goto(HOME, { waitUntil: "load" });
      await waitForToggleHydrated(page, "dark");

      await openPanel(page);
      await assertTogglesAndRepaints(page, "dark");
    });
  });

  test.describe("panel opened then CLOSED before the toggle", () => {
    test("light -> dark toggle still repaints the page", async ({ page }) => {
      await preseedTheme(page, "light");
      await page.goto(HOME, { waitUntil: "load" });
      await waitForToggleHydrated(page, "light");

      await openPanel(page);
      await closePanel(page);
      await assertTogglesAndRepaints(page, "light");
    });

    test("dark -> light toggle still repaints the page", async ({ page }) => {
      await preseedTheme(page, "dark");
      await page.goto(HOME, { waitUntil: "load" });
      await waitForToggleHydrated(page, "dark");

      await openPanel(page);
      await closePanel(page);
      await assertTogglesAndRepaints(page, "dark");
    });
  });
});
