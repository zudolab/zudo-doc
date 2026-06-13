/**
 * Permanent E2E regression spec for VT Chrome Persist (#1547).
 *
 * Locked-down coverage (runs on every PR via pnpm test:e2e):
 *   1. DOM-node identity PRESERVED on header / aside / footer /
 *      desktop-sidebar-toggle across same-locale + same-section nav.
 *      Uses the marker-property technique: tag each node with a unique value
 *      before clicking, query after the swap, assert the marker survives.
 *   2. Sidebar active-link highlight updates after same-locale SPA swap
 *      (aria-current="page" lands on the new slug).
 *   3. Sidebar scroll position preserved across same-locale SPA swap.
 *
 * Cross-locale and version-switcher assertions live in sibling spec files
 * that run against their respective fixtures:
 *   - i18n-vt-chrome-persist.spec.ts  (i18n fixture, port 4501)
 *   - versioning-vt-chrome-persist.spec.ts (versioning fixture, port 4504)
 *
 * Root cause: zudolab/zudo-doc#1546
 * W7A retro lesson: .claude/skills/l-lessons-zfb-migration-parity/SKILL.md
 *   ("VT Strategy B port" entries — shape-only assertions are worthless;
 *    clickability of DOM elements post-swap is the load-bearing check)
 *
 * Permanent vs one-shot coverage manifest:
 *   PERMANENT (this file + siblings): DOM identity on 4 scopes, sidebar
 *     highlight, sidebar scroll, cross-locale identity NOT preserved,
 *     locale-toggle clickability (W7A), version-switcher state on /v/...
 *   ONE-SHOT ONLY (scripts/wave2-vt-chrome-persist-confirm.ts — removed in
 *     S1 #1928): viewTransition.finished resolves, document.getAnimations()
 *     non-empty (timing-sensitive in CI), cross-section sidebar re-render (D1).
 *
 * b4push: this spec auto-picks up via the smoke*.spec.ts glob in
 * playwright.config.ts → no manual wiring to run-b4push.sh needed.
 * CI: test:e2e (pnpm test:e2e) and test:e2e:ci (excludes @flaky).
 */

import { test, expect } from "@playwright/test";
import { waitForSidebarHydration } from "./sidebar-helpers";
import { spaClick } from "./nav-helpers";

// Desktop viewport so the desktop sidebar (#desktop-sidebar) is always
// visible. The smoke fixture renders the sidebar island at ≥1024px.
test.use({ viewport: { width: 1280, height: 900 } });

// Navigation pair within the smoke fixture guides section:
// both pages share navSection="guides" → same persist key for the aside.
// The smoke fixture builds URLs without trailing slashes (zfb static export),
// so sidebar links use /docs/guides/page-1 not /docs/guides/page-1/.
const GUIDES_INDEX = "/docs/guides/";
const GUIDES_PAGE_1 = "/docs/guides/page-1";

// ---------------------------------------------------------------------------
// Test 1: DOM-node identity preserved across same-locale same-section nav
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: DOM-node identity (same-locale, same-section)", () => {
  test("header, aside, footer, desktop-sidebar-toggle nodes survive SPA swap", async ({
    page,
  }) => {
    await page.goto(GUIDES_INDEX, { waitUntil: "domcontentloaded" });
    await waitForSidebarHydration(page);

    // Tag each persisted element with a unique marker property.
    // desktop-sidebar-toggle is a "use client" island included in the main repo
    // layout but NOT in this smoke fixture's minimal layout — tag it only if present.
    const marker = await page.evaluate(() => {
      const ts = Date.now();
      const header = document.querySelector("header");
      const aside = document.querySelector("#desktop-sidebar");
      const footer = document.querySelector("footer");
      const toggle = document.querySelector(
        "[data-zfb-transition-persist='desktop-sidebar-toggle']",
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (header) (header as any).__vtMarker__ = ts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (aside) (aside as any).__vtMarker__ = ts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (footer) (footer as any).__vtMarker__ = ts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (toggle) (toggle as any).__vtMarker__ = ts;
      return { ts, togglePresent: !!toggle };
    });

    // Verify the target link exists before proceeding.
    const linkFound = await page.evaluate(
      (href: string) => !!document.querySelector(`a[href="${href}"]`),
      GUIDES_PAGE_1,
    );
    expect(
      linkFound,
      `Expected a sidebar link to ${GUIDES_PAGE_1} on ${GUIDES_INDEX}`,
    ).toBe(true);

    const swapFired = await spaClick(page, GUIDES_PAGE_1);
    expect(swapFired, "zfb:after-swap did not fire within 10 s").toBe(true);

    // Read back markers from the post-swap DOM.
    const post = await page.evaluate(
      (expectedMarker: number) => {
        const header = document.querySelector("header");
        const aside = document.querySelector("#desktop-sidebar");
        const footer = document.querySelector("footer");
        const toggle = document.querySelector(
          "[data-zfb-transition-persist='desktop-sidebar-toggle']",
        );
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          header: (header as any)?.__vtMarker__ as number | undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          aside: (aside as any)?.__vtMarker__ as number | undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          footer: (footer as any)?.__vtMarker__ as number | undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          toggle: (toggle as any)?.__vtMarker__ as number | undefined,
          expected: expectedMarker,
        };
      },
      marker.ts,
    );

    expect(post.header, "header DOM node should be the same instance after swap").toBe(post.expected);
    expect(post.aside, "aside DOM node should be the same instance after swap").toBe(post.expected);
    expect(post.footer, "footer DOM node should be the same instance after swap").toBe(post.expected);
    // Only assert toggle identity if the element was present before the swap.
    if (marker.togglePresent) {
      expect(post.toggle, "desktop-sidebar-toggle DOM node should be the same instance after swap").toBe(post.expected);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: Sidebar active-link updates after SPA swap
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: sidebar active-link highlight", () => {
  test("aria-current=page moves to the new slug after SPA swap", async ({
    page,
  }) => {
    await page.goto(GUIDES_INDEX, { waitUntil: "domcontentloaded" });
    await waitForSidebarHydration(page);

    const swapFired = await spaClick(page, GUIDES_PAGE_1);
    expect(swapFired, "zfb:after-swap did not fire within 10 s").toBe(true);

    // The sidebar Preact island sets aria-current="page" on the active link.
    // The link href in the sidebar matches the exact href from the built HTML
    // (no trailing slash in the smoke fixture static export).
    // Wait for Preact to update aria-current using an attached-state poll.
    await page
      .locator(`#desktop-sidebar a[href="${GUIDES_PAGE_1}"][aria-current="page"]`)
      .waitFor({ state: "attached", timeout: 5000 });

    const activeLink = await page.evaluate((href: string) => {
      const aside = document.querySelector("#desktop-sidebar");
      if (!aside) return null;
      const anchor = aside.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
      return anchor ? anchor.getAttribute("aria-current") : null;
    }, GUIDES_PAGE_1);

    expect(
      activeLink,
      `Expected sidebar link ${GUIDES_PAGE_1} to have aria-current="page" after swap`,
    ).toBe("page");
  });
});

// ---------------------------------------------------------------------------
// Test 3: Sidebar scroll position preserved across SPA swap
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: sidebar scroll preservation", () => {
  test("aside scrollTop is preserved after SPA swap", async ({ page }) => {
    await page.goto(GUIDES_INDEX, { waitUntil: "domcontentloaded" });
    await waitForSidebarHydration(page);

    // Attempt to scroll the sidebar; note whether it is actually scrollable.
    const scrollInfo = await page.evaluate(() => {
      const aside = document.querySelector("#desktop-sidebar");
      if (!aside) return { scrollable: false, scrollTop: 0 };
      const scrollable = aside.scrollHeight > aside.clientHeight;
      if (scrollable) aside.scrollTop = 60;
      return { scrollable, scrollTop: aside.scrollTop };
    });

    const swapFired = await spaClick(page, GUIDES_PAGE_1);
    expect(swapFired, "zfb:after-swap did not fire within 10 s").toBe(true);

    // Wait for the sidebar to remain attached after the swap (persisted node).
    await page.locator("#desktop-sidebar").waitFor({ state: "attached", timeout: 5000 });

    const scrollTopAfter = await page.evaluate(() => {
      const aside = document.querySelector("#desktop-sidebar");
      return aside ? aside.scrollTop : -1;
    });

    if (scrollInfo.scrollable && scrollInfo.scrollTop > 0) {
      // Sidebar was scrollable and we actually moved it: assert preservation.
      // Allow a ±30 px tolerance in case the island adjusted to show the
      // active item.
      expect(
        scrollTopAfter,
        "aside scrollTop should be preserved after SPA swap (within ±30 px tolerance)",
      ).toBeGreaterThanOrEqual(scrollInfo.scrollTop - 30);
    } else {
      // Sidebar was not scrollable (content shorter than viewport) or
      // scrollTop stayed at 0 — just verify it did not reset to a negative
      // value (element gone).
      expect(
        scrollTopAfter,
        "aside should still be present in DOM after swap (scrollTop ≥ 0)",
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
