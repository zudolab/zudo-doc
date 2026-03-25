import type { Page, Locator } from "@playwright/test";

/** The desktop sidebar aside (requires viewport width >= 1024px) */
export function desktopSidebar(page: Page): Locator {
  return page.locator("#desktop-sidebar");
}

/**
 * Wait for the Preact sidebar island to hydrate and become interactive.
 *
 * Checks that a toggle button (Collapse/Expand) has framework internal
 * properties, indicating hydration is complete.
 */
export async function waitForSidebarHydration(page: Page) {
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached" });
  // Wait until Preact hydration is complete by checking that a toggle button
  // has framework internal properties on the DOM element
  await page.waitForFunction(
    () => {
      const sidebar = document.querySelector("#desktop-sidebar");
      if (!sidebar) return false;
      const btn = sidebar.querySelector(
        'button[aria-label^="Collapse"], button[aria-label^="Expand"]',
      );
      if (!btn) return false;
      // Preact (compat) attaches __preactattr_ or __reactFiber/__reactProps
      const keys = Object.keys(btn);
      return keys.some(
        (k) => k.startsWith("__preact") || k.startsWith("__react"),
      );
    },
    null,
    { timeout: 5000 },
  );
}
