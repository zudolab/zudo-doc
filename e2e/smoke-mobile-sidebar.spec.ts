import { test, expect } from "@playwright/test";
import { openMobileDrawer } from "./mobile-drawer-helpers";

/**
 * E2E tests for the mobile sidebar (SidebarToggle React island).
 *
 * The mobile sidebar is rendered inside the <header> via SidebarToggle
 * with client:media="(max-width: 1023px)". It includes a hamburger
 * button, a backdrop overlay, body scroll locking, and sidebar
 * navigation that closes on link click (via zfb:after-swap).
 */

const DOCS_PAGE = "/docs/getting-started";

test.describe("Mobile sidebar", () => {
  test("hamburger button is visible at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    await expect(hamburger).toBeVisible();
  });

  test("hamburger button has lg:hidden class for desktop hiding", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    // The button uses lg:hidden to hide at desktop widths.
    // We verify the class is present (CSS rendering depends on Tailwind build).
    await expect(hamburger).toHaveClass(/lg:hidden/);
  });

  test("clicking hamburger opens the sidebar panel", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    await hamburger.click();

    // After opening, the button label changes to "Close sidebar"
    const closeButton = page.locator('button[aria-label="Close sidebar"]');
    await expect(closeButton).toBeVisible();

    // The sidebar aside panel should be present and have translate-x-0 (open)
    const sidebarPanel = page.locator("header aside");
    await expect(sidebarPanel).toBeVisible();
    await expect(sidebarPanel).toHaveClass(/translate-x-0/);
  });

  test("clicking backdrop closes the sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    // Open the sidebar
    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    await hamburger.click();
    await expect(page.locator('button[aria-label="Close sidebar"]')).toBeVisible();

    // Click the backdrop overlay by dispatching a click event
    // The backdrop is a div.fixed.inset-0.z-30 with an onClick handler
    const backdrop = page.locator("header div.fixed.inset-0");
    await expect(backdrop).toBeAttached();
    await backdrop.dispatchEvent("click");

    // Sidebar should close -- hamburger label reverts to "Open sidebar"
    await expect(page.locator('button[aria-label="Open sidebar"]')).toBeVisible();
  });

  test("pressing Escape closes the sidebar and restores focus to the hamburger", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    // openMobileDrawer() retries the click as a unit -- the island is
    // Island({ when: "visible" }) and a pre-hydration click is silently
    // dropped (see e2e/mobile-drawer-helpers.ts).
    await openMobileDrawer(page);

    // Keyboard dismissal is the path under test here; the pointer path is
    // covered by the click-to-close test below (zudolab/zudo-doc#4369).
    await page.keyboard.press("Escape");

    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toBeFocused();
  });

  // zudolab/zudo-doc#4369: the open drawer's toggle shows the X and is the
  // discoverable close control, so it must sit in the drawer's own tier
  // (z-modal 60) instead of under the backdrop (z-modal-backdrop 50). Asserts
  // the behaviour -- the button receives a real pointer event -- not the
  // presence of a class.
  test("a real click on the X toggle closes the drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    await openMobileDrawer(page);

    const closeButton = page.locator('button[aria-label="Close sidebar"]');

    // The reporter's probe: before the fix, elementFromPoint at the button's
    // own centre returned the backdrop DIV. Accept any descendant of the
    // button (the centre of the X icon is where its two strokes cross, so the
    // topmost element there is legitimately the <path>) -- a click on it
    // reaches the button's handler either way.
    const probe = await closeButton.evaluate((btn) => {
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        tag: hit ? hit.tagName : null,
        insideToggle: hit instanceof Element && hit.closest("button") === btn,
      };
    });
    expect(probe.insideToggle, `elementFromPoint returned <${probe.tag}>`).toBe(true);

    // A real, non-forced click -- `force: true` would bypass the actionability
    // check that this bug tripped, and prove nothing.
    await closeButton.click();

    await expect(page.locator('button[aria-label="Open sidebar"]')).toBeVisible();
    await expect(page.locator("header aside")).toHaveClass(/-translate-x-full/);
  });

  test("body scroll is locked when sidebar is open", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    // Open the sidebar
    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    await hamburger.click();
    await expect(page.locator('button[aria-label="Close sidebar"]')).toBeVisible();

    // Wait for the useEffect to set body overflow to hidden
    await page.waitForFunction(
      () => document.body.style.overflow === "hidden",
      null,
      { timeout: 5000 },
    );
  });

  test("clicking a navigation link closes sidebar and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // Start on the guides section so we have multiple pages in the sidebar
    await page.goto("/docs/guides", { waitUntil: "load" });

    // Open the sidebar
    const hamburger = page.locator('button[aria-label="Open sidebar"]');
    await hamburger.click();
    await expect(page.locator('button[aria-label="Close sidebar"]')).toBeVisible();

    // Find a navigation link inside the mobile sidebar aside panel.
    // The sidebar shows the guides section tree which includes "Writing Docs"
    const sidebarPanel = page.locator("header aside");
    const navLink = sidebarPanel.getByRole("link", { name: "Writing Docs" });
    await expect(navLink).toBeVisible({ timeout: 5000 });

    // Click the navigation link
    await navLink.click();

    // Should navigate to the page
    await page.waitForURL(/page-1/, { timeout: 5000 });

    // Sidebar should be closed after navigation (via zfb:after-swap handler)
    await expect(page.locator('button[aria-label="Open sidebar"]')).toBeVisible({ timeout: 5000 });
  });

  test("closed sidebar panel is inert and unfocusable; opening clears inert", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(DOCS_PAGE, { waitUntil: "load" });

    const sidebarPanel = page.locator("header aside");
    await expect(sidebarPanel).toBeAttached();

    // Closed by default: the panel is only visually hidden via
    // `-translate-x-full`, so it must be `inert` to keep its links/filter/
    // buttons out of the tab order and the accessibility tree
    // (zudolab/zudo-doc#2059). `inert` is present in the SSR markup, so this
    // holds even before hydration.
    const closedState = await sidebarPanel.evaluate((el) => ({
      inertProp: (el as HTMLElement).inert,
      hasAttr: el.hasAttribute("inert"),
    }));
    expect(closedState.inertProp).toBe(true);
    expect(closedState.hasAttr).toBe(true);

    // A link inside the inert panel cannot take focus (inert blocks focus).
    const closedLink = sidebarPanel.locator("a").first();
    if (await closedLink.count()) {
      const focusedWhileInert = await closedLink.evaluate((el) => {
        (el as HTMLElement).focus();
        return document.activeElement === el;
      });
      expect(focusedWhileInert).toBe(false);
    }

    // Opening the drawer clears `inert`, restoring focusability.
    await page.locator('button[aria-label="Open sidebar"]').click();
    await expect(page.locator('button[aria-label="Close sidebar"]')).toBeVisible();

    const openState = await sidebarPanel.evaluate((el) => ({
      inertProp: (el as HTMLElement).inert,
      hasAttr: el.hasAttribute("inert"),
    }));
    expect(openState.inertProp).toBe(false);
    expect(openState.hasAttr).toBe(false);
  });
});
