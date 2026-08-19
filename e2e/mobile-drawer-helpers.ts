/**
 * Shared helpers for the mobile drawer (`SidebarToggle` island).
 *
 * The drawer's selectors (`aria-label` strings, backdrop, panel hook) were
 * previously duplicated across spec files — this module is the one place they
 * live, mirroring the `sidebar-helpers.ts` convention for the desktop sidebar.
 * `smoke-mobile-sidebar.spec.ts` / `smoke-smart-break.spec.ts` predate it and
 * still carry local copies; new drawer specs should import from here.
 */

import { expect, type Page } from "@playwright/test";

/** The drawer panel — `data-zd-mobile-sidebar` is the stable theme-pack hook. */
export function mobileSidebar(page: Page) {
  return page.locator("[data-zd-mobile-sidebar]");
}

/**
 * Selector for a drawer-owned anchor, slash-tolerant like `spaClick`.
 *
 * Use with `spaClickSelector` when a spec must prove the click landed on a
 * DRAWER link: the bare-href `spaClick` uses `document.querySelector`, which
 * is visibility-agnostic and takes the first document-order match — today
 * that happens to be the drawer link (the sidebarToggle slot renders before
 * the hidden desktop nav), but any header re-composition would silently move
 * the click onto a hidden desktop nav link with the same href.
 */
export function drawerLinkSelector(href: string): string {
  return `[data-zd-mobile-sidebar] a[href="${href}"], [data-zd-mobile-sidebar] a[href="${href}/"]`;
}

/**
 * Open the mobile drawer via the hamburger, retrying the click as a unit.
 *
 * `SidebarToggle` is `Island({ when: "visible" })` — its `onClick` only
 * exists once the island has hydrated, and the zfb runtime dispatches no
 * event and mutates no DOM attribute on mount completion, so there is no
 * better signal to poll. A click issued before hydration is silently
 * dropped. Retrying the click-and-check as a unit via `toPass` (mirrors
 * `theme-pack-helpers.ts`'s `openFlyout`) makes a dropped first click
 * self-heal instead of flaking — and succeeding at all proves hydration
 * completed.
 */
export async function openMobileDrawer(page: Page): Promise<void> {
  const hamburger = page.locator('button[aria-label="Open sidebar"]');
  const closeButton = page.locator('button[aria-label="Close sidebar"]');
  await expect(async () => {
    // Idempotent retry body: a previous iteration may have already opened the
    // drawer (the click landed but the 500ms visibility check missed a slow
    // paint). The hamburger's aria-label flips to "Close sidebar" while open,
    // so re-clicking would wait on a locator that no longer resolves for
    // Playwright's full action timeout — which `toPass`'s budget cannot
    // interrupt. Skip the click when the drawer is already open.
    if (!(await closeButton.isVisible())) {
      await hamburger.click({ timeout: 2000 });
    }
    await expect(closeButton).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10000 });
}

/**
 * Close the drawer via the backdrop overlay, not the hamburger button.
 *
 * `z-modal-backdrop` (50) sits ABOVE the header's `z-toolbar` (20) by design
 * (`sidebar-toggle-island/index.tsx`'s backdrop comment) — the open drawer
 * is a modal surface that dims the whole viewport, hamburger included. A
 * real pointer click therefore cannot land on the "Close sidebar" button
 * while the drawer is open, so the close is dispatched directly on the
 * backdrop.
 */
export async function closeMobileDrawer(page: Page): Promise<void> {
  // Precondition, not a wait: the backdrop element is always in the DOM (only
  // class-hidden when closed) and `dispatchEvent` fires its handler regardless
  // of visibility, so without this check a close on a never-opened drawer
  // would "succeed" and the hamburger assertion below would pass trivially.
  await expect(page.locator('button[aria-label="Close sidebar"]')).toBeVisible();
  await page.locator("header div.fixed.inset-0").dispatchEvent("click");
  await expect(page.locator('button[aria-label="Open sidebar"]')).toBeVisible({ timeout: 5000 });
}
