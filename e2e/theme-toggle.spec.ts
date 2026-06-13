import { test, expect } from "./fixtures";
/**
 * E2E tests for theme toggle hydration and persistence.
 *
 * The ThemeToggle is a React island that must not cause hydration
 * mismatches when the user's stored theme preference differs from
 * the SSR default. An inline script in color-scheme-provider.tsx (server-emitted, pre-paint)
 * sets data-theme from localStorage before React hydrates — the
 * React component must use the SSR default for initial state and
 * sync from the DOM in useEffect.
 */

const HOME = "/";
const STORAGE_KEY = "zudo-doc-theme";

// Selector for the desktop-visible theme toggle button (as opposed to the
// one inside the mobile header sidebar panel).
const DESKTOP_TOGGLE_SELECTOR = 'header .ml-auto button[aria-label*="Switch to"]';

test.describe("Theme toggle", () => {
  test("no hydration error when stored theme is light (differs from SSR default)", async ({
    browser,
    assertNoConsoleErrors,
  }) => {
    // Use a fresh context so we can set localStorage before navigation
    const context = await browser.newContext();
    const page = await context.newPage();

    // Pre-set light theme in localStorage (SSR default is "dark")
    await page.addInitScript((key) => {
      localStorage.setItem(key, "light");
    }, STORAGE_KEY);

    await page.goto(HOME, { waitUntil: "load" });

    // Wait for the toggle to reflect the stored light theme (offer to switch to
    // dark). This confirms the ThemeToggle island has hydrated and synced from
    // the DOM — replaces the old fixed waitForTimeout(1000) sleep.
    const toggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
    await expect(toggle).toHaveAttribute("aria-label", "Switch to dark mode", { timeout: 5000 });

    assertNoConsoleErrors();

    await context.close();
  });

  test("no hydration error when stored theme is dark (matches SSR default)", async ({
    browser,
    assertNoConsoleErrors,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, STORAGE_KEY);

    await page.goto(HOME, { waitUntil: "load" });

    // Wait for the toggle to reflect the stored dark theme (offer to switch to
    // light). Hydration is complete once the aria-label is stable.
    const toggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
    await expect(toggle).toHaveAttribute("aria-label", "Switch to light mode", { timeout: 5000 });

    assertNoConsoleErrors();

    await context.close();
  });

  test("no hydration error with no stored theme (first visit)", async ({
    browser,
    assertNoConsoleErrors,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(HOME, { waitUntil: "load" });

    // Wait for the toggle to be present — any aria-label value is acceptable
    // on a first visit (whichever is the SSR default). Hydration is implied by
    // the toggle being interactive.
    const toggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
    await expect(toggle).toBeVisible({ timeout: 5000 });

    assertNoConsoleErrors();

    await context.close();
  });

  test("toggle click switches theme and persists to localStorage", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });

    // Target the desktop-visible toggle; mobile sidebar also has one inside <header>
    const toggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
    await expect(toggle).toBeVisible({ timeout: 5000 });
    const initialLabel = await toggle.getAttribute("aria-label");

    // Click the toggle
    await toggle.click();

    // aria-label should flip
    const newLabel = await toggle.getAttribute("aria-label");
    expect(newLabel).not.toBe(initialLabel);

    // localStorage should be updated
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(["light", "dark"]).toContain(stored);
  });

  test("theme persists across View Transition navigation", async ({
    browser,
    assertNoConsoleErrors,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Pre-set light theme
    await page.addInitScript((key) => {
      localStorage.setItem(key, "light");
    }, STORAGE_KEY);

    // Visit home page
    await page.goto(HOME, { waitUntil: "load" });

    // Wait for toggle to reflect stored light theme before navigating.
    const toggle = page.locator(DESKTOP_TOGGLE_SELECTOR);
    await expect(toggle).toHaveAttribute("aria-label", "Switch to dark mode", { timeout: 5000 });

    // Navigate to a doc page via sidebar link (View Transition)
    await page.getByRole("link", { name: "Getting Started" }).first().click();
    await page.waitForURL(/getting-started/);

    // Theme should still be light after navigation.
    // Poll until the toggle settles on the expected label — confirms hydration
    // completed on the new page without resorting to a fixed waitForTimeout(1000).
    const toggleAfterNav = page.locator(DESKTOP_TOGGLE_SELECTOR);
    await expect(toggleAfterNav).toHaveAttribute("aria-label", "Switch to dark mode", { timeout: 5000 });

    assertNoConsoleErrors();

    await context.close();
  });
});
