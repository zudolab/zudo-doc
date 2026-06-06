/**
 * Permanent E2E regression spec for VT Chrome Static (#1556) — visual checks.
 *
 * Locked-down coverage (runs on every PR via pnpm test:e2e):
 *   1. Computed view-transition-name on each chrome element (header, aside, footer,
 *      desktop-sidebar-toggle) equals the expected zfb-* value after T2 CSS.
 *      Mirrors T3's V1-V4 shape assertions as a permanent CI gate.
 *   2. On same-locale + same-section navigation, document.getAnimations() filtered
 *      by the exact-match Set of 12 named-chrome pseudo names returns count === 0.
 *      (animation: none applied by T2 CSS suppresses the named-chrome cross-fades.)
 *   3. On the same transition, document.getAnimations() total count >= 1 (regression
 *      sanity: content cross-fade still runs — named-chrome suppression has not
 *      eliminated all view-transition activity).
 *
 * Sibling spec files cover DOM-node identity and sidebar assertions:
 *   - smoke-vt-chrome-persist.spec.ts   (DOM identity, sidebar highlight/scroll)
 *   - i18n-vt-chrome-persist.spec.ts    (cross-locale identity, locale toggle)
 *   - versioning-vt-chrome-persist.spec.ts (version-switcher state)
 *
 * Root cause: zudolab/zudo-doc#1556 (VT Chrome Static epic)
 * Shaped by T3 confirm-gate V1-V8b: scripts/wave2-vt-chrome-persist-confirm.ts (removed S1 #1928)
 * Lesson: .claude/skills/l-lessons-zfb-migration-parity/SKILL.md W7A entries
 *   ("permanent regression coverage locks the contract")
 *
 * Permanent vs one-shot coverage manifest:
 *   PERMANENT (this file): computed viewTransitionName on all 4 chrome elements,
 *     named-chrome animation count === 0, total animation count >= 1 during nav.
 *   ONE-SHOT ONLY (scripts/wave2-vt-chrome-persist-confirm.ts V5/V6 — removed S1 #1928):
 *     V7 cross-locale named-chrome suppression, V8a/V8b cross-section edge cases
 *     (timing-sensitive; covered by T3 confirm-gate, not in permanent CI).
 *
 * b4push: this spec auto-picks up via the smoke*.spec.ts glob in
 * playwright.config.ts → no manual wiring to run-b4push.sh needed.
 * CI: test:e2e (pnpm test:e2e) and test:e2e:ci (skips @local-only).
 */

import { test, expect } from "@playwright/test";
import { waitForSidebarHydration } from "./sidebar-helpers";

// Desktop viewport so the desktop sidebar (#desktop-sidebar) is always
// visible. The smoke fixture renders the sidebar island at ≥1024px.
test.use({ viewport: { width: 1280, height: 900 } });

// Navigation pair within the smoke fixture guides section:
// both pages share navSection="guides" → same persist key for the aside.
// The smoke fixture builds URLs without trailing slashes (zfb static export),
// so sidebar links use /docs/guides/page-1 not /docs/guides/page-1/.
const GUIDES_INDEX = "/docs/guides/";
const GUIDES_PAGE_1 = "/docs/guides/page-1";

// The 12 named-chrome pseudo-element strings we expect to be animation-free.
// Exact-match set — NEVER use .includes("zfb-") substring matching, which is
// too loose and would catch unknown nesting levels or future pseudo variants.
// Mirrors the namedChromePseudos Set from scripts/wave2-vt-chrome-persist-confirm.ts V5 (removed S1 #1928).
const NAMED_CHROME_PSEUDOS = new Set([
  "::view-transition-old(zfb-header)",
  "::view-transition-new(zfb-header)",
  "::view-transition-group(zfb-header)",
  "::view-transition-old(zfb-sidebar)",
  "::view-transition-new(zfb-sidebar)",
  "::view-transition-group(zfb-sidebar)",
  "::view-transition-old(zfb-footer)",
  "::view-transition-new(zfb-footer)",
  "::view-transition-group(zfb-footer)",
  "::view-transition-old(zfb-sidebar-toggle)",
  "::view-transition-new(zfb-sidebar-toggle)",
  "::view-transition-group(zfb-sidebar-toggle)",
]);

// ---------------------------------------------------------------------------
// Helper: perform a SPA navigation by JS-clicking an anchor and waiting for
// the zfb:after-swap event. Returns true if swap fired within 8 s.
// ---------------------------------------------------------------------------
async function spaClick(
  page: import("@playwright/test").Page,
  href: string,
): Promise<boolean> {
  const swapFired = await page.evaluate((h: string) => {
    return new Promise<boolean>((resolve) => {
      let tid: ReturnType<typeof setTimeout> | null = null;
      document.addEventListener(
        "zfb:after-swap",
        () => {
          if (tid !== null) clearTimeout(tid);
          resolve(true);
        },
        { once: true },
      );
      const anchor = document.querySelector<HTMLElement>(`a[href="${h}"]`);
      if (anchor) {
        tid = setTimeout(() => resolve(false), 8000);
        anchor.click();
      } else {
        resolve(false);
      }
    });
  }, href);
  // Let the page settle before assertions.
  await page.waitForLoadState("networkidle").catch(() => null);
  await page.waitForTimeout(200);
  return swapFired;
}

// ---------------------------------------------------------------------------
// Test 1: Computed view-transition-name on chrome elements
// Mirrors T3 V1-V4: verifies T2 CSS (host global.css) correctly assigns
// zfb-* view-transition-name to each chrome element.
// ---------------------------------------------------------------------------
test.describe("VT Chrome Static: computed view-transition-name on chrome elements", () => {
  test("header, aside#desktop-sidebar, footer, desktop-sidebar-toggle each have the expected zfb-* viewTransitionName", async ({
    page,
  }) => {
    await page.goto(GUIDES_INDEX, { waitUntil: "domcontentloaded" });
    await waitForSidebarHydration(page);

    const vtNames = await page.evaluate(() => {
      const header = document.querySelector("header");
      const aside = document.querySelector("aside#desktop-sidebar");
      const footer = document.querySelector("footer");
      const toggle = document.querySelector(
        "[data-zfb-transition-persist='desktop-sidebar-toggle']",
      );
      return {
        header: header ? getComputedStyle(header).viewTransitionName : null,
        aside: aside ? getComputedStyle(aside).viewTransitionName : null,
        footer: footer ? getComputedStyle(footer).viewTransitionName : null,
        toggle: toggle ? getComputedStyle(toggle).viewTransitionName : null,
        togglePresent: !!toggle,
      };
    });

    expect(
      vtNames.header,
      'header computed viewTransitionName should be "zfb-header" (set by T2 host CSS)',
    ).toBe("zfb-header");

    expect(
      vtNames.aside,
      'aside#desktop-sidebar computed viewTransitionName should be "zfb-sidebar" (set by T2 host CSS)',
    ).toBe("zfb-sidebar");

    expect(
      vtNames.footer,
      'footer computed viewTransitionName should be "zfb-footer" (set by T2 host CSS)',
    ).toBe("zfb-footer");

    // desktop-sidebar-toggle may not be present in all fixture builds (it's a client
    // island not always present in the minimal smoke layout). Only assert if present.
    if (vtNames.togglePresent) {
      expect(
        vtNames.toggle,
        'desktop-sidebar-toggle computed viewTransitionName should be "zfb-sidebar-toggle" (set by T2 host CSS)',
      ).toBe("zfb-sidebar-toggle");
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2 + Test 3: getAnimations() during same-locale + same-section navigation
// Both tests share the same startViewTransition hook and 50ms snapshot window.
// Test 2 (T3 V5 mirror): exact-match Set filter → named-chrome count === 0
// Test 3 (T3 V6 mirror): total animation count >= 1 (root cross-fade still running)
// ---------------------------------------------------------------------------
test.describe("VT Chrome Static: getAnimations() during same-locale + same-section nav", () => {
  test("named-chrome pseudo animations count === 0 (animation: none suppresses all 12 pseudos)", async ({
    page,
  }) => {
    await page.goto(GUIDES_INDEX, { waitUntil: "domcontentloaded" });
    await waitForSidebarHydration(page);

    // Verify the target link exists before attempting navigation.
    const linkFound = await page.evaluate(
      (href: string) => !!document.querySelector(`a[href="${href}"]`),
      GUIDES_PAGE_1,
    );
    expect(
      linkFound,
      `Expected a sidebar link to ${GUIDES_PAGE_1} on ${GUIDES_INDEX}`,
    ).toBe(true);

    // Install startViewTransition hook to capture named-chrome animation count.
    // The hook runs inside the browser context, so the namedChromePseudos Set is
    // serialized inline (closure capture of Set is not possible across evaluate).
    await page.evaluate(() => {
      const origSVT = document.startViewTransition?.bind(document);
      if (!origSVT) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).__v5ChromeCount__ = null;
      document.startViewTransition = (cb) => {
        const vt = origSVT(cb);
        // Exact-match Set of the 12 named-chrome pseudo strings.
        // Mirrors namedChromePseudos in scripts/wave2-vt-chrome-persist-confirm.ts V5 (removed S1 #1928).
        // NEVER use .includes("zfb-") — too loose.
        const namedSet = new Set([
          "::view-transition-old(zfb-header)",
          "::view-transition-new(zfb-header)",
          "::view-transition-group(zfb-header)",
          "::view-transition-old(zfb-sidebar)",
          "::view-transition-new(zfb-sidebar)",
          "::view-transition-group(zfb-sidebar)",
          "::view-transition-old(zfb-footer)",
          "::view-transition-new(zfb-footer)",
          "::view-transition-group(zfb-footer)",
          "::view-transition-old(zfb-sidebar-toggle)",
          "::view-transition-new(zfb-sidebar-toggle)",
          "::view-transition-group(zfb-sidebar-toggle)",
        ]);
        // Sample at ~50ms: transition has started but typically has not yet
        // finished. This mirrors the 50ms window used by T3's V5 assertion.
        setTimeout(() => {
          const anims = document.getAnimations();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (document as any).__v5ChromeCount__ =
            anims.filter(
              (a: Animation) =>
                namedSet.has(
                  (a.effect as KeyframeEffect | null)?.pseudoElement ?? "",
                ),
            ).length;
        }, 50);
        return vt;
      };
    });

    const swapFired = await spaClick(page, GUIDES_PAGE_1);
    expect(swapFired, "zfb:after-swap did not fire within 8 s").toBe(true);

    // Allow the 50ms setTimeout to fire and settle.
    await page.waitForTimeout(200);

    const chromeCount = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (document as any).__v5ChromeCount__ as number | null,
    );

    expect(
      chromeCount,
      "startViewTransition hook was not active — animation snapshot not captured (hook may not have installed before nav)",
    ).not.toBeNull();

    expect(
      chromeCount,
      `Named-chrome animation count should be 0 (expected T2 CSS animation: none to suppress all 12 pseudos); got ${chromeCount}`,
    ).toBe(0);
  });

  test("total getAnimations() count >= 1 during transition (root content cross-fade still running)", async ({
    page,
  }) => {
    await page.goto(GUIDES_INDEX, { waitUntil: "domcontentloaded" });
    await waitForSidebarHydration(page);

    // Verify the target link exists before attempting navigation.
    const linkFound = await page.evaluate(
      (href: string) => !!document.querySelector(`a[href="${href}"]`),
      GUIDES_PAGE_1,
    );
    expect(
      linkFound,
      `Expected a sidebar link to ${GUIDES_PAGE_1} on ${GUIDES_INDEX}`,
    ).toBe(true);

    // Install startViewTransition hook to capture total animation count.
    // V6 adaptation note: headless Chromium does not always expose
    // pseudo-element strings on view-transition Animation objects via
    // getAnimations().pseudoElement — the pseudoElement property may be
    // null or empty even for ::view-transition-old(root) animations.
    // Therefore we use total animation count >= 1 (same metric as T3 V6 and
    // the pre-existing B6 assertion) as a reliable proxy that the
    // view-transition is still running. We do NOT filter by pseudoElement
    // for the root pseudo because headless Chromium may suppress it.
    // See: scripts/wave2-vt-chrome-persist-confirm.ts V6 for the upstream pattern (removed S1 #1928).
    await page.evaluate(() => {
      const origSVT = document.startViewTransition?.bind(document);
      if (!origSVT) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).__v6TotalCount__ = null;
      document.startViewTransition = (cb) => {
        const vt = origSVT(cb);
        // Sample at ~50ms: mirrors T3 V6 / B6 timing window.
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (document as any).__v6TotalCount__ =
            document.getAnimations().length;
        }, 50);
        return vt;
      };
    });

    const swapFired = await spaClick(page, GUIDES_PAGE_1);
    expect(swapFired, "zfb:after-swap did not fire within 8 s").toBe(true);

    // Allow the 50ms setTimeout to fire and settle.
    await page.waitForTimeout(200);

    const totalCount = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (document as any).__v6TotalCount__ as number | null,
    );

    expect(
      totalCount,
      "startViewTransition hook was not active — animation snapshot not captured",
    ).not.toBeNull();

    expect(
      totalCount,
      `Total animation count should be >= 1 at 50ms into transition (root content cross-fade should still be running); got ${totalCount}. Named-chrome suppression may have accidentally eliminated all view-transition activity.`,
    ).toBeGreaterThanOrEqual(1);
  });
});
