import type { Page, Locator } from "@playwright/test";

/** The desktop sidebar aside (requires viewport width >= 1024px) */
export function desktopSidebar(page: Page): Locator {
  return page.locator("#desktop-sidebar");
}

/**
 * Wait for the React sidebar island to hydrate and become interactive.
 *
 * Checks that a toggle button (Collapse/Expand) has React internal
 * properties, indicating hydration is complete.
 */
export async function waitForSidebarHydration(page: Page) {
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached" });
  // Wait until React hydration is complete by checking that a toggle button
  // has a click handler attached (we test this by checking that React's
  // internal properties exist on the DOM element)
  await page.waitForFunction(
    () => {
      const sidebar = document.querySelector("#desktop-sidebar");
      if (!sidebar) return false;
      const btn = sidebar.querySelector(
        'button[aria-label^="Collapse"], button[aria-label^="Expand"]',
      );
      if (!btn) return false;
      // React 19 attaches __reactFiber or __reactProps on hydrated elements
      return Object.keys(btn).some((k) => k.startsWith("__react"));
    },
    null,
    { timeout: 5000 },
  );
}
