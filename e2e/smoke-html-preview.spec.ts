import { test, expect } from "./fixtures";
import { readDistFile } from "./smoke-dist-helper";

/**
 * Tests for the HtmlPreview component.
 *
 * SSG-shape checks are static dist reads (no browser): global CSS from
 * settings.htmlPreview must land in the iframe srcdoc, and the sandbox
 * attributes must follow the resolveSandbox contract. The per-component JS
 * check needs a real browser (script execution inside the iframe).
 */

const PAGE = "/docs/guides/html-preview-test";
const DIST_PAGE = "docs/guides/html-preview-test/index.html";

test.describe("HtmlPreview: SSG shape", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile(DIST_PAGE);
  });

  test("global CSS from settings.htmlPreview is injected into iframe srcdoc", () => {
    // The smoke fixture sets settings.htmlPreview.css to exactly this rule.
    // It must appear inside the preview iframe srcdoc <style> (wiring:
    // settings.htmlPreview -> globalConfig -> buildSrcdoc; regression #2105).
    expect(html).toContain(".global-test { border: 3px solid rgb(255, 0, 0); }");
  });

  test("iframes carry the resolveSandbox contract sandbox attributes", () => {
    // No-script preview: allow-same-origin (kept for auto-height measurement).
    expect(html).toContain('sandbox="allow-same-origin"');
    // Script-bearing preview: allow-scripts allow-same-origin.
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
  });
});

test.describe("HtmlPreview: per-component JS", () => {
  test("per-component JS executes inside iframe", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const iframes = page.locator("iframe");
    // The JS test is the second HtmlPreview on the page
    const jsIframe = iframes.nth(1);
    await jsIframe.waitFor({ state: "attached", timeout: 10_000 });

    const frame = page.frameLocator("iframe").nth(1);
    const target = frame.locator("#js-target");
    await expect(target).toHaveText("after", { timeout: 10_000 });
  });
});

test.describe("HtmlPreview: post-hydration structure", () => {
  /**
   * Deterministic regression coverage for the hydration double-wrap bug
   * class (commits 4a0788af, 96d54603; zudolab/zudo-doc#1925): the
   * `HtmlPreview` island's bare hydration target must own its OWN
   * `data-zfb-island="HtmlPreviewWrapperInner"` marker and must NOT
   * re-wrap itself in another `<Island>` on the client — otherwise Preact
   * reuses the SSR'd children one level off and re-parents the preview +
   * code sections inside the flex title bar (title bar/buttons squished
   * left, iframe floating right). The raw SSR DOM is always correct even
   * when this regresses (see
   * .claude/skills/test-flow-html-preview-hydration/SKILL.md), so this test
   * must observe genuine post-hydration state, not just the initial markup.
   *
   * Each island's "Show code" toggle button (`aria-expanded`) has no click
   * handler until the island actually hydrates — the SSR markup renders it
   * inert. Polling a click against it until `aria-expanded` flips is a
   * deterministic, event-based proxy for "this island has hydrated" (no
   * bare sleep): before hydration the click is a no-op, so the poll simply
   * retries until the `when="visible"` IntersectionObserver (triggered by
   * scrolling the island into view) fires and Preact attaches its handler.
   */
  test("every island renders a vertical stack (title bar, then preview, then code) after hydration", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const islands = page.locator(
      '[data-zfb-island="HtmlPreviewWrapperInner"]',
    );
    const islandCount = await islands.count();
    // Count dynamically — do not hardcode the fixture's current island
    // count, so this test keeps working as the fixture page grows.
    expect(islandCount).toBeGreaterThan(0);

    for (let i = 0; i < islandCount; i++) {
      const island = islands.nth(i);
      await island.scrollIntoViewIfNeeded();

      const codeToggle = island.locator("button[aria-expanded]");
      await expect
        .poll(
          async () => {
            await codeToggle.click();
            return codeToggle.getAttribute("aria-expanded");
          },
          { timeout: 10_000 },
        )
        .toBe("true");

      const structure = await island.evaluate((islandEl) => {
        const container = islandEl.querySelector(":scope > div");
        if (!container) return null;
        const children = Array.from(container.children) as HTMLElement[];
        const child0 = children[0] as HTMLElement | undefined;
        const child1 = children[1] as HTMLElement | undefined;
        const child0Rect = child0?.getBoundingClientRect();
        const child1Rect = child1?.getBoundingClientRect();
        return {
          childCount: children.length,
          child0Display: child0 ? getComputedStyle(child0).display : null,
          child0Height: child0Rect?.height ?? null,
          child1Display: child1 ? getComputedStyle(child1).display : null,
          child1Y: child1Rect?.y ?? null,
          titleBarBottom: child0Rect
            ? child0Rect.y + child0Rect.height
            : null,
        };
      });

      expect(structure, `island ${i} outer container`).not.toBeNull();
      const s = structure!;
      // The three siblings (title bar, preview area, code section) are not
      // collapsed or re-parented.
      expect(s.childCount, `island ${i} childCount`).toBe(3);
      // The title bar is just a bar — in the bug it absorbs the whole
      // component and grows to 200px+.
      expect(s.child0Display, `island ${i} title bar display`).toBe("flex");
      expect(s.child0Height, `island ${i} title bar height`).not.toBeNull();
      expect(s.child0Height as number).toBeLessThanOrEqual(80);
      // The preview area sits BELOW the title bar (vertical stack), not
      // beside it (the broken side-by-side layout).
      expect(s.child1Display, `island ${i} preview area display`).toBe(
        "block",
      );
      expect(s.child1Y, `island ${i} preview area y`).not.toBeNull();
      expect(s.titleBarBottom, `island ${i} title bar bottom`).not.toBeNull();
      expect(s.child1Y as number).toBeGreaterThanOrEqual(
        (s.titleBarBottom as number) - 2,
      );
    }
  });
});
