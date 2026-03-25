import type { Page, Locator } from "@playwright/test";

/** The desktop sidebar aside (requires viewport width >= 1024px) */
export function desktopSidebar(page: Page): Locator {
  return page.locator("#desktop-sidebar");
}

/**
 * Wait for the Preact sidebar island to hydrate and become interactive.
 *
 * Waits for the sidebar nav and a category toggle button to be present
 * in the DOM, indicating the island has rendered and hydrated.
 */
export async function waitForSidebarHydration(page: Page) {
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached" });
  // Wait for a category toggle button to appear in the DOM.
  // We use "attached" (not "visible") because the button may be inside
  // a collapsed section or have CSS that makes it not visually visible
  // while still being functional after hydration.
  await sidebar
    .locator(
      'button[aria-label^="Collapse"], button[aria-label^="Expand"]',
    )
    .first()
    .waitFor({ state: "attached", timeout: 5000 });
}
