import { test, expect, type Page } from "@playwright/test";
/**
 * E2E tests for theme toggle hydration and persistence.
 *
 * The ThemeToggle is a React island that must not cause hydration
 * mismatches when the user's stored theme preference differs from
 * the SSR default. An inline script in color-scheme-provider.astro
 * sets data-theme from localStorage before React hydrates — the
 * React component must use the SSR default for initial state and
 * sync from the DOM in useEffect.
 */

const HOME = "/";
const STORAGE_KEY = "zudo-doc-theme";

/** Collect React hydration errors from the console during a page visit */
async function collectHydrationErrors(page: Page, url: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().toLowerCase().includes("hydration")) {
      errors.push(msg.text());
    }
  });
  await page.goto(url, { waitUntil: "load" });
  // Give React time to hydrate and report errors
  await page.waitForTimeout(1000);
  return errors;
}

test.describe("Theme toggle @local-only", () => {
  test("no hydration error when stored theme is light (differs from SSR default)", async ({
    browser,
  }) => {
    // Use a fresh context so we can set localStorage before navigation
    const context = await browser.newContext();
    const page = await context.newPage();

    // Pre-set light theme in localStorage (SSR default is "dark")
    await page.addInitScript((key) => {
      localStorage.setItem(key, "light");
    }, STORAGE_KEY);

    const errors = await collectHydrationErrors(page, HOME);
    expect(errors, `Hydration errors: ${errors.join(", ")}`).toHaveLength(0);

    // Toggle button should reflect the stored light theme (offer to switch to dark).
    // Target the desktop-visible toggle; mobile sidebar also has one inside <header>.
    const toggle = page.locator('header .ml-auto button[aria-label*="Switch to"]');
    await expect(toggle).toHaveAttribute("aria-label", "Switch to dark mode", { timeout: 3000 });

    await context.close();
  });

  test("no hydration error when stored theme is dark (matches SSR default)", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, STORAGE_KEY);

    const errors = await collectHydrationErrors(page, HOME);
    expect(errors, `Hydration errors: ${errors.join(", ")}`).toHaveLength(0);

    // Target the desktop-visible toggle
    const toggle = page.locator('header .ml-auto button[aria-label*="Switch to"]');
    await expect(toggle).toHaveAttribute("aria-label", "Switch to light mode", { timeout: 3000 });

    await context.close();
  });

  test("no hydration error with no stored theme (first visit)", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const errors = await collectHydrationErrors(page, HOME);
    expect(errors, `Hydration errors: ${errors.join(", ")}`).toHaveLength(0);

    await context.close();
  });

  test("toggle click switches theme and persists to localStorage", async ({
    page,
  }) => {
    await page.goto(HOME, { waitUntil: "load" });

    // Target the desktop-visible toggle; mobile sidebar also has one inside <header>
    const toggle = page.locator('header .ml-auto button[aria-label*="Switch to"]');
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
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Pre-set light theme
    await page.addInitScript((key) => {
      localStorage.setItem(key, "light");
    }, STORAGE_KEY);

    // Visit home page
    await page.goto(HOME, { waitUntil: "load" });
    // Target the desktop-visible toggle; mobile sidebar also has one inside <header>
    const toggle = page.locator('header .ml-auto button[aria-label*="Switch to"]');
    await expect(toggle).toHaveAttribute("aria-label", "Switch to dark mode", { timeout: 3000 });

    // Navigate to a doc page via sidebar link (View Transition)
    await page.getByRole("link", { name: "Getting Started" }).first().click();
    await page.waitForURL(/getting-started/);

    // Theme should still be light after navigation
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().toLowerCase().includes("hydration")) {
        errors.push(msg.text());
      }
    });
    await page.waitForTimeout(1000);

    const toggleAfterNav = page.locator('header .ml-auto button[aria-label*="Switch to"]');
    await expect(toggleAfterNav).toHaveAttribute("aria-label", "Switch to dark mode", { timeout: 3000 });
    expect(errors).toHaveLength(0);

    await context.close();
  });
});
