/**
 * Permanent E2E regression spec for VT Chrome Persist (#1547) — i18n checks.
 *
 * Locked-down coverage (runs on every PR via pnpm test:e2e):
 *   4. DOM-node identity NOT preserved across EN→JA navigation via the
 *      language switcher (different persist keys → full re-render is correct).
 *   5. Header locale-toggle correctly inverted post-EN→JA swap AND the
 *      new-locale EN anchor is actually clickable — the W7A regression
 *      specifically. (The original W7A bug: the EN anchor existed in the
 *      post-swap JA header but was inert — JS click did not trigger SPA.)
 *
 * Sibling spec files cover same-locale and versioning assertions:
 *   - smoke-vt-chrome-persist.spec.ts   (smoke fixture, port 4503)
 *   - versioning-vt-chrome-persist.spec.ts (versioning fixture, port 4504)
 *
 * Root cause: zudolab/zudo-doc#1546
 * W7A retro lesson: .claude/skills/l-lessons-zfb-migration-parity/SKILL.md
 *   ("VT Strategy B port" — clickability is the load-bearing assertion)
 *
 * b4push: auto-picked up by i18n*.spec.ts glob in playwright.config.ts.
 * CI: test:e2e (pnpm test:e2e) and test:e2e:ci (excludes @flaky).
 */

import { test, expect } from "@playwright/test";
import { spaClick, waitForSidebarNav } from "./nav-helpers";

// Desktop viewport so the desktop sidebar is visible.
test.use({ viewport: { width: 1280, height: 900 } });

// i18n fixture pages.
// The i18n fixture's getting-started section has a single page, so the
// sidebar may not have category collapse/expand buttons. We use a simpler
// wait (sidebar nav attached) rather than waitForSidebarHydration().
const PAGE_EN = "/docs/getting-started/";
const PAGE_JA = "/ja/docs/getting-started/";

// ---------------------------------------------------------------------------
// Test 4: DOM-node identity NOT preserved across EN→JA
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: cross-locale DOM node identity", () => {
  test("header, aside, footer nodes are re-created on EN→JA navigation", async ({
    page,
  }) => {
    await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });
    await waitForSidebarNav(page);

    // Tag elements before cross-locale nav.
    const marker = await page.evaluate(() => {
      const ts = Date.now();
      const header = document.querySelector("header");
      const aside = document.querySelector("#desktop-sidebar");
      const footer = document.querySelector("footer");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (header) (header as any).__vtMarker__ = ts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (aside) (aside as any).__vtMarker__ = ts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (footer) (footer as any).__vtMarker__ = ts;
      return ts;
    });

    // Find the JA language switcher link.
    const jaHref = await page.evaluate(() => {
      const link =
        (document.querySelector('header a[lang="ja"]') as HTMLAnchorElement | null) ??
        (Array.from(document.querySelectorAll("header a")).find(
          (a) => a.textContent?.trim() === "JA",
        ) as HTMLAnchorElement | null);
      return link?.getAttribute("href") ?? null;
    });

    expect(jaHref, "JA language switcher link should be present in the EN header").not.toBeNull();

    const swapFired = await spaClick(page, jaHref!);
    expect(swapFired, "zfb:after-swap did not fire for EN→JA navigation").toBe(true);

    // Wait for the URL to reflect the JA locale before reading post-swap DOM.
    await page.waitForURL((url) => url.pathname.includes("/ja/"), { timeout: 5000 });

    const post = await page.evaluate(
      (expectedMarker: number) => {
        const header = document.querySelector("header");
        const aside = document.querySelector("#desktop-sidebar");
        const footer = document.querySelector("footer");
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          header: (header as any)?.__vtMarker__ as number | undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          aside: (aside as any)?.__vtMarker__ as number | undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          footer: (footer as any)?.__vtMarker__ as number | undefined,
          expected: expectedMarker,
          url: window.location.pathname,
        };
      },
      marker,
    );

    // Markers should be ABSENT (undefined) on new nodes after cross-locale swap.
    expect(
      post.url,
      "page should have navigated to the JA locale path",
    ).toContain("/ja/");
    expect(
      post.header,
      "header should be a new DOM node after EN→JA swap (marker absent)",
    ).toBeUndefined();
    expect(
      post.aside,
      "aside should be a new DOM node after EN→JA swap (marker absent)",
    ).toBeUndefined();
    expect(
      post.footer,
      "footer should be a new DOM node after EN→JA swap (marker absent)",
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test 5: Locale-toggle inverted post-EN→JA swap AND EN anchor is clickable
// (W7A regression — the load-bearing assertion)
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: locale-toggle clickability post-EN→JA (W7A)", () => {
  test("EN anchor in post-swap JA header is functional and triggers another SPA swap", async ({
    page,
  }) => {
    await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });
    await waitForSidebarNav(page);

    // Navigate to JA via language switcher.
    const jaHref = await page.evaluate(() => {
      const link =
        (document.querySelector('header a[lang="ja"]') as HTMLAnchorElement | null) ??
        (Array.from(document.querySelectorAll("header a")).find(
          (a) => a.textContent?.trim() === "JA",
        ) as HTMLAnchorElement | null);
      return link?.getAttribute("href") ?? null;
    });

    expect(jaHref, "JA language switcher link should be present").not.toBeNull();

    const firstSwap = await spaClick(page, jaHref!);
    expect(firstSwap, "EN→JA SPA swap should fire").toBe(true);

    // Wait for the URL to reflect the JA locale before querying the new header.
    await page.waitForURL((url) => url.pathname.includes("/ja/"), { timeout: 5000 });

    // After EN→JA swap: the header should show EN as an <a> (clickable)
    // and JA as the active (non-link) element.
    const langState = await page.evaluate(() => {
      const enLink = document.querySelector<HTMLAnchorElement>('header a[lang="en"]');
      const jaSpan = document.querySelector<Element>('header span[aria-current="true"]');
      return {
        enLinkExists: !!enLink,
        enLinkHref: enLink?.getAttribute("href") ?? null,
        jaSpanExists: !!jaSpan,
        url: window.location.pathname,
      };
    });

    expect(
      langState.url,
      "should be on the JA page after the first swap",
    ).toContain("/ja/");
    expect(
      langState.enLinkExists,
      "EN should appear as a clickable <a> in the post-swap JA header",
    ).toBe(true);
    expect(
      langState.jaSpanExists,
      "JA should appear as the active (non-link) element with aria-current in the post-swap JA header",
    ).toBe(true);
    expect(
      langState.enLinkHref,
      "EN anchor href should not be null",
    ).not.toBeNull();

    // W7A regression check: the EN anchor must actually trigger a SPA swap
    // when clicked (not be inert). This was the exact failure mode in the
    // original W7A bug — the anchor existed but the click handler was absent.
    const secondSwap = await spaClick(page, langState.enLinkHref!);
    expect(
      secondSwap,
      "clicking the EN anchor on the JA page should trigger a second SPA swap (W7A regression gate)",
    ).toBe(true);

    // Confirm we are back on the EN page by waiting for the URL to no longer
    // contain "/ja/".
    await page.waitForURL((url) => !url.pathname.includes("/ja/"), { timeout: 5000 });
    const finalUrl = page.url();
    expect(
      finalUrl,
      "should have navigated back to the EN locale path after clicking the EN anchor",
    ).not.toContain("/ja/");
  });
});

// ---------------------------------------------------------------------------
// Test 6: language switcher href stays correct across SAME-locale SPA nav
// (#2551 — the persisted header's switcher hrefs must not go stale)
// ---------------------------------------------------------------------------
test.describe("VT Chrome Persist: language switcher href after same-locale nav (#2551)", () => {
  test("EN switcher link tracks the current page after a same-locale JA→JA swap", async ({
    page,
  }) => {
    // Hard-load a JA page. The persisted header (persistKey header-ja) survives
    // subsequent same-locale navigations, so its switcher hrefs must be
    // re-wired on zfb:after-swap rather than left frozen at this page.
    await page.goto("/ja/docs/getting-started/", { waitUntil: "domcontentloaded" });
    await waitForSidebarNav(page);

    // Normalize trailing slash so the assertion is agnostic to the fixture's
    // trailingSlash setting — the exact-page path is what matters here.
    const norm = (s: string | null) => (s ?? "").replace(/\/$/, "");
    // Target the desktop header switcher specifically (the `[data-language-switcher]`
    // container is the #2551 re-wire surface), not the mobile sidebar-footer switcher.
    const enHref = async () =>
      norm(
        await page.evaluate(
          () =>
            document
              .querySelector<HTMLAnchorElement>(
                'header [data-language-switcher] a[lang="en"]',
              )
              ?.getAttribute("href") ?? null,
        ),
      );

    // On the JA getting-started page, EN points at the EN equivalent.
    expect(await enHref(), "initial EN switcher href on the JA getting-started page").toBe(
      "/docs/getting-started",
    );

    // Tag the header node so we can prove it is the SAME (persisted) node after
    // the same-locale swap — i.e. the fix is a re-wire, not a re-render.
    await page.evaluate(() => {
      const header = document.querySelector("header");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (header) (header as any).__sameLocaleMarker__ = 2551;
    });

    // Same-locale SPA navigation to a different JA section via the header nav.
    const swapFired = await spaClick(page, "/ja/docs/guides/");
    expect(swapFired, "same-locale JA→JA swap should fire zfb:after-swap").toBe(true);
    await page.waitForURL((url) => url.pathname.includes("/ja/docs/guides"), {
      timeout: 5000,
    });

    const post = await page.evaluate(() => {
      const header = document.querySelector("header");
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        markerPreserved: (header as any)?.__sameLocaleMarker__ === 2551,
        enHref:
          document
            .querySelector<HTMLAnchorElement>(
              'header [data-language-switcher] a[lang="en"]',
            )
            ?.getAttribute("href") ?? null,
      };
    });

    // Same-locale nav preserves the header DOM node (persist), so this really
    // exercises the stale-href path the re-wire script fixes.
    expect(
      post.markerPreserved,
      "header node should be preserved across same-locale nav (persisted header)",
    ).toBe(true);

    // The load-bearing assertion (#2551): the EN link now points at the CURRENT
    // page's EN equivalent, not the stale getting-started target.
    expect(
      norm(post.enHref),
      "EN switcher href must track the current JA page after same-locale nav",
    ).toBe("/docs/guides");

    // And clicking it actually lands on that exact EN page.
    const enSwap = await spaClick(page, "/docs/guides/");
    expect(enSwap, "clicking the re-wired EN link should fire an SPA swap").toBe(true);
    await page.waitForURL((url) => /\/docs\/guides\/?$/.test(url.pathname), {
      timeout: 5000,
    });
    expect(page.url(), "should land on the exact EN equivalent page").toContain(
      "/docs/guides/",
    );
    expect(page.url()).not.toContain("/ja/");
  });
});
