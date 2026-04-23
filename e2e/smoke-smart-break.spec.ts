import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for smart-break (<wbr>) injection across all surfaces.
 *
 * Covers epic #370 sub-issues #372-#377: smart-break must visually wrap
 * path-like text at narrow widths, must be invisible to copy-paste
 * (byte-identical clipboard content), and must not pollute the
 * accessibility tree (no phantom word boundaries).
 *
 * Narrow viewport (375×900) is used for the visual wrap and overflow
 * assertions so the mobile sidebar panel is reachable via hamburger.
 */

const NARROW = { width: 375, height: 900 } as const;
const TEST_PAGE = "/docs/guides/smart-break-test";
const SIDEBAR_LABEL =
  "src/components/very/long/path/to/some/module/file-name.ts";
const INLINE_CODE =
  "https://example.com/very/long/path/to/some/resource/that-should-wrap-on-narrow.html";
const LINK_URL =
  "https://example.com/very/long/path/to/some/documentation/page-about-everything.html";

/**
 * Assign a data-test-id to a DOM element chosen by a predicate and
 * return the id. Keeps subsequent locator queries stable across the
 * Preact islands that re-render after hydration.
 */
async function tagFirst(
  page: Page,
  rootSelector: string,
  predicateSrc: string,
  id: string,
): Promise<void> {
  await page.evaluate(
    ({ rootSelector, predicateSrc, id }) => {
      const predicate = new Function("el", predicateSrc) as (
        el: Element,
      ) => boolean;
      const nodes = Array.from(document.querySelectorAll(rootSelector));
      const match = nodes.find((n) => predicate(n));
      if (!match) throw new Error(`No element matched: ${rootSelector}`);
      (match as HTMLElement).setAttribute("data-test-id", id);
    },
    { rootSelector, predicateSrc, id },
  );
}

/**
 * Select all text inside the element (via Range) and return what the
 * browser would put on the clipboard. <wbr> is a void element and must
 * not contribute any characters to selection.toString().
 */
async function selectionTextOf(page: Page, selector: string): Promise<string> {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element not found: ${sel}`);
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel_ = window.getSelection();
    if (!sel_) throw new Error("getSelection() returned null");
    sel_.removeAllRanges();
    sel_.addRange(range);
    const text = sel_.toString();
    sel_.removeAllRanges();
    return text;
  }, selector);
}

async function wbrCount(page: Page, selector: string): Promise<number> {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.querySelectorAll("wbr").length : 0;
  }, selector);
}

// --------------------------------------------------------------------------
// Visual wrap: sidebar / inline code / table / link
// --------------------------------------------------------------------------

test.describe("smart-break: visual wrapping on narrow viewports", () => {
  test("sidebar label with long path wraps across multiple lines (#372)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    // Open mobile sidebar (desktop sidebar is hidden at lg:hidden/<1024px).
    await page.locator('button[aria-label="Open sidebar"]').click();
    await expect(
      page.locator('button[aria-label="Close sidebar"]'),
    ).toBeVisible();

    const link = page.locator(
      `header aside a[href$="/docs/guides/smart-break-test"]`,
    );
    await expect(link).toBeVisible();

    // <wbr> must actually have been injected into the label span.
    const count = await link.evaluate(
      (a) => a.querySelectorAll("wbr").length,
    );
    expect(count, "expected <wbr> injected into sidebar label").toBeGreaterThan(
      0,
    );

    // Height check: label wraps beyond a single line.
    const { height, lineHeight } = await link.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        height: rect.height,
        lineHeight: parseFloat(cs.lineHeight) || 20,
      };
    });
    expect(height).toBeGreaterThan(lineHeight * 1.5);
  });

  test("inline code with long URL wraps and contains <wbr> (#373)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await tagFirst(
      page,
      "main code",
      `return !!el.textContent && el.textContent.includes("wrap-on-narrow");`,
      "sb-inline-code",
    );
    const sel = '[data-test-id="sb-inline-code"]';
    expect(await wbrCount(page, sel)).toBeGreaterThan(0);

    const { width, scrollWidth } = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement;
      return {
        width: el.getBoundingClientRect().width,
        scrollWidth: el.scrollWidth,
      };
    }, sel);
    // No horizontal overflow inside the inline code box.
    expect(scrollWidth).toBeLessThanOrEqual(Math.ceil(width) + 1);
  });

  test("table cell with long URL wraps within its cell (#375)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await tagFirst(
      page,
      "main table td",
      `return !!el.textContent && el.textContent.includes("wrap-in-table-cell");`,
      "sb-table-cell",
    );
    const sel = '[data-test-id="sb-table-cell"]';

    // Primary assertion: the document itself does not scroll horizontally
    // (the table may be inside an overflow-x-auto wrapper, which is fine).
    const bodyScroll = await page.evaluate(() => ({
      bodyScrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(bodyScroll.bodyScrollWidth).toBeLessThanOrEqual(
      bodyScroll.clientWidth + 1,
    );

    // Secondary assertion: the cell's content fits its own width — smart
    // break / overflow-wrap kicks in so there is no horizontal overflow
    // inside the cell itself.
    const { width, scrollWidth } = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement;
      return {
        width: el.getBoundingClientRect().width,
        scrollWidth: el.scrollWidth,
      };
    }, sel);
    expect(scrollWidth).toBeLessThanOrEqual(Math.ceil(width) + 1);
  });

  test("link text with long URL wraps across multiple lines (#374)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await tagFirst(
      page,
      "main a",
      `return !!el.textContent && el.textContent.includes("page-about-everything");`,
      "sb-link",
    );
    const sel = '[data-test-id="sb-link"]';

    expect(await wbrCount(page, sel)).toBeGreaterThan(0);

    const { height, lineHeight } = await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement;
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        height: rect.height,
        lineHeight: parseFloat(cs.lineHeight) || 20,
      };
    }, sel);
    expect(height).toBeGreaterThan(lineHeight * 1.5);
  });
});

// --------------------------------------------------------------------------
// Regression: fenced code blocks must still render unwrapped
// --------------------------------------------------------------------------

test.describe("smart-break: regression guards", () => {
  test("fenced code blocks render unwrapped (smart-break skips Shiki output)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    const pre = page.locator("main pre.astro-code").first();
    await expect(pre).toBeVisible();

    // The pre may show a horizontal scrollbar (overflow-x: auto) — the
    // content is wider than the visible box but stays on one physical line.
    // If smart-break had polluted Shiki spans with <wbr>, the long line
    // would wrap instead of overflowing, and scrollWidth would equal
    // clientWidth.
    const { scrollWidth, clientWidth, wbrInsideCode } = await pre.evaluate(
      (el) => {
        const code = el.querySelector("code");
        return {
          scrollWidth: (el as HTMLElement).scrollWidth,
          clientWidth: (el as HTMLElement).clientWidth,
          wbrInsideCode: code ? code.querySelectorAll("wbr").length : -1,
        };
      },
    );
    expect(wbrInsideCode).toBe(0);
    expect(scrollWidth).toBeGreaterThan(clientWidth);
  });
});

// --------------------------------------------------------------------------
// Copy-paste byte-identity (critical acceptance criterion)
// --------------------------------------------------------------------------

test.describe("smart-break: copy-paste byte-identity", () => {
  test("sidebar label copies as original string without <wbr> artifacts (#372)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await page.locator('button[aria-label="Open sidebar"]').click();
    await expect(
      page.locator('button[aria-label="Close sidebar"]'),
    ).toBeVisible();

    // Select the smart-broken label span inside the test-page link.
    await tagFirst(
      page,
      `header aside a[href$="/docs/guides/smart-break-test"] span`,
      `return el.querySelectorAll("wbr").length > 0;`,
      "sb-sidebar-label",
    );
    const sel = '[data-test-id="sb-sidebar-label"]';
    expect(await wbrCount(page, sel)).toBeGreaterThan(0);

    const text = await selectionTextOf(page, sel);
    expect(text).toBe(SIDEBAR_LABEL);
    expect(text).not.toContain("<wbr>");
    expect(text).not.toMatch(/​/); // no zero-width space either
  });

  test("inline code copies as original string without <wbr> artifacts (#373)", async ({
    page,
  }) => {
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await tagFirst(
      page,
      "main code",
      `return !!el.textContent && el.textContent.includes("wrap-on-narrow");`,
      "sb-inline-code-copy",
    );
    const sel = '[data-test-id="sb-inline-code-copy"]';
    expect(await wbrCount(page, sel)).toBeGreaterThan(0);

    const text = await selectionTextOf(page, sel);
    expect(text).toBe(INLINE_CODE);
    expect(text).not.toContain("<wbr>");
  });

  test("link text copies as original URL without <wbr> artifacts (#374)", async ({
    page,
  }) => {
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await tagFirst(
      page,
      "main a",
      `return !!el.textContent && el.textContent.includes("page-about-everything");`,
      "sb-link-copy",
    );
    const sel = '[data-test-id="sb-link-copy"]';
    expect(await wbrCount(page, sel)).toBeGreaterThan(0);

    const text = await selectionTextOf(page, sel);
    expect(text).toBe(LINK_URL);
    expect(text).not.toContain("<wbr>");
  });

  test("search result row (path-like hit) has no <wbr> artifacts in selection (#375)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await page.keyboard.press("Control+k");
    const input = page.locator("[data-search-input]");
    await expect(input).toBeFocused({ timeout: 3000 });

    // Query text that definitely appears in the fixture body.
    await input.fill("Smart Break");
    const results = page.locator("[data-search-results] article");
    await expect(results.first()).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const first = document.querySelector(
        "[data-search-results] article",
      ) as HTMLElement | null;
      if (first) first.setAttribute("data-test-id", "sb-search-result");
    });
    const sel = '[data-test-id="sb-search-result"]';

    // The article may include wbr injections on path-like tokens inside
    // excerpt/title. Either way, selection.toString() must not expose them.
    const text = await selectionTextOf(page, sel);
    expect(text).not.toContain("<wbr>");
    expect(text).not.toContain("&lt;wbr&gt;");

    // Dialog overflow guard: first result's width does not exceed its
    // own bounding box (smart-break should have wrapped any long token).
    const { articleScrollWidth, articleWidth } = await page.evaluate((s) => {
      const a = document.querySelector(s) as HTMLElement;
      return {
        articleScrollWidth: a.scrollWidth,
        articleWidth: a.getBoundingClientRect().width,
      };
    }, sel);
    expect(articleScrollWidth).toBeLessThanOrEqual(Math.ceil(articleWidth) + 1);
  });
});

// --------------------------------------------------------------------------
// Accessibility: <wbr> must not pollute accessible names / textContent
// --------------------------------------------------------------------------

test.describe("smart-break: accessibility", () => {
  test("link accessible name matches raw URL (no <wbr> text leakage)", async ({
    page,
  }) => {
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await tagFirst(
      page,
      "main a",
      `return !!el.textContent && el.textContent.includes("page-about-everything");`,
      "sb-link-a11y",
    );
    const link = page.locator('[data-test-id="sb-link-a11y"]');

    // 1. textContent across wbr injections must equal the raw URL.
    //    (<wbr> is a void element; it contributes no characters to the
    //    text layer, so this is effectively the string a screen reader
    //    would announce.)
    const textContent = await link.evaluate((el) => el.textContent ?? "");
    expect(textContent).toBe(LINK_URL);
    expect(textContent).not.toContain("<wbr>");

    // 2. Computed accessible name (same path ATs use) must also be the
    //    raw URL — proving <wbr> is not injected into the accessible
    //    name tree.
    await expect(link).toHaveAccessibleName(LINK_URL);
  });

  test("inline code textContent equals raw path (no phantom characters)", async ({
    page,
  }) => {
    await page.goto(TEST_PAGE, { waitUntil: "load" });

    await tagFirst(
      page,
      "main code",
      `return !!el.textContent && el.textContent.includes("wrap-on-narrow");`,
      "sb-inline-code-a11y",
    );
    const code = page.locator('[data-test-id="sb-inline-code-a11y"]');
    const textContent = await code.evaluate((el) => el.textContent ?? "");
    expect(textContent).toBe(INLINE_CODE);
    expect(textContent).not.toContain("<wbr>");
    expect(textContent).not.toMatch(/​/); // no zero-width space
  });
});
