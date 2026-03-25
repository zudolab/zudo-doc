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
  // Wait until framework hydration is complete by checking that a toggle
  // button has framework-internal properties attached to the DOM element.
  // Both React and Preact add underscore-prefixed properties (__reactFiber,
  // __k, __c, etc.) that don't exist on vanilla DOM elements.
  await page.waitForFunction(
    () => {
      const sidebar = document.querySelector("#desktop-sidebar");
      if (!sidebar) return false;
      const btn = sidebar.querySelector(
        'button[aria-label^="Collapse"], button[aria-label^="Expand"]',
      );
      if (!btn) return false;
      return Object.keys(btn).some((k) => k.startsWith("__"));
    },
    null,
    { timeout: 5000 },
  );
}
