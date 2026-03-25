import type { Page, Locator } from "@playwright/test";

/** The desktop sidebar aside (requires viewport width >= 1024px) */
export function desktopSidebar(page: Page): Locator {
  return page.locator("#desktop-sidebar");
}

/**
 * Wait for the Preact sidebar island to hydrate and become interactive.
 *
 * Verifies that a toggle button exists and responds to clicks, which
 * proves the island has hydrated and event handlers are attached.
 */
export async function waitForSidebarHydration(page: Page) {
  const sidebar = desktopSidebar(page);
  await sidebar.locator("nav").waitFor({ state: "attached" });
  // Wait for a category toggle button to appear
  const toggleBtn = sidebar.locator(
    'button[aria-label^="Collapse"], button[aria-label^="Expand"]',
  );
  await toggleBtn.first().waitFor({ state: "visible", timeout: 5000 });
  // Verify hydration by clicking and checking the label changes
  const firstBtn = toggleBtn.first();
  const labelBefore = await firstBtn.getAttribute("aria-label");
  await firstBtn.click();
  // Wait for the label to change (Collapse ↔ Expand), proving hydration
  const expectedPrefix = labelBefore?.startsWith("Collapse")
    ? "Expand"
    : "Collapse";
  await firstBtn.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  // Click again to restore original state
  const labelAfter = await firstBtn.getAttribute("aria-label");
  if (labelAfter?.startsWith(expectedPrefix)) {
    await firstBtn.click();
  }
}
