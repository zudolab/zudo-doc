import { test, expect } from "@playwright/test";
import {
  expectHtmlClass,
  expectHtmlTagWithAttr,
  expectHtmlTagWithClass,
  tagWithClassPattern,
} from "./html-assertions";
import { readDistFile } from "./smoke-dist-helper";

/**
 * E2E tests for the code block enhancer component.
 *
 * Verifies copy-to-clipboard and word wrap toggle buttons that are
 * dynamically injected by code-block-enhancer.tsx (client-side script) after page load.
 */

const PAGE = "/docs/guides/code-blocks-test";
const DIST_PAGE = "docs/guides/code-blocks-test/index.html";

test.describe("Code blocks: native class-mode output", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile(DIST_PAGE);
  });

  test("retains title, line-highlight, and diff structure on real fences", () => {
    expectHtmlClass(html, "code-block-container");
    expectHtmlClass(html, "code-block-title");
    expect(html).toContain("class-mode-native.js");
    expectHtmlTagWithClass(html, "pre", "hi-root");
    expectHtmlTagWithClass(html, "span", "line");
    expectHtmlTagWithAttr(html, "span", "data-line-highlight", "true");
    expectHtmlTagWithAttr(html, "span", "data-line-diff", "removed");
    expectHtmlTagWithAttr(html, "span", "data-line-diff", "added");
    expect(html).not.toContain("[!code --]");
    expect(html).not.toContain("[!code ++]");
  });

  test("uses native semantic roles without inline or legacy palette colors", () => {
    for (const tokenClass of ["hi-kw", "hi-var", "hi-num"]) {
      const tokenTag = html.match(
        tagWithClassPattern("span", tokenClass),
      )?.[0];
      expect(tokenTag, `expected a native ${tokenClass} token`).toBeDefined();
    }

    const tokenTags = (html.match(/<span\b[^>]*>/gi) ?? []).filter((tag) =>
      /\bhi-[a-z]+\b/i.test(tag),
    );
    expect(tokenTags.length).toBeGreaterThan(0);
    for (const tokenTag of tokenTags) {
      expect(tokenTag).not.toMatch(/\bstyle\s*=/i);
    }

    const preTags = html.match(/<pre\b[^>]*>/gi) ?? [];
    const nativePreTags = preTags.filter((tag) => /\bhi-root\b/i.test(tag));
    expect(nativePreTags.length).toBeGreaterThan(0);
    for (const nativePreTag of nativePreTags) {
      expect(nativePreTag).not.toMatch(/\bstyle\s*=/i);
    }
    expect(preTags.some((tag) => tag.includes("syntect-"))).toBe(false);
    expect(html).not.toContain("--shiki-light");
    expect(html).not.toContain("--shiki-dark");
  });

  test("keeps tabs and an unrelated plain pre fixture distinguishable", () => {
    expectHtmlClass(html, "tab-panel");
    expectHtmlTagWithAttr(html, "div", "data-tab-value", "js");
    expectHtmlTagWithAttr(html, "div", "data-tab-value", "py");
    expectHtmlTagWithAttr(html, "div", "data-tab-value", "rust");
    expectHtmlTagWithAttr(html, "pre", "data-code-compat-fixture", "plain");
  });
});

test.describe("Code blocks: copy and wrap buttons", () => {
  test("Default Dark resolves native keywords through the syntax semantic", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const colors = await page
      .locator("main pre.hi-root span.hi-kw")
      .first()
      .evaluate((token) => {
        const resolveColor = (value: string) => {
          const probe = document.createElement("span");
          probe.style.position = "fixed";
          probe.style.visibility = "hidden";
          probe.style.color = value;
          document.body.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        };

        return {
          theme: document.documentElement.dataset.theme,
          colorScheme: getComputedStyle(document.documentElement).colorScheme,
          token: getComputedStyle(token).color,
          syntaxSemantic: resolveColor("var(--zd-syntax-keyword)"),
          defaultDarkAccent: resolveColor("var(--palette-accent-1)"),
        };
      });

    expect(colors.theme).toBeUndefined();
    expect(colors.colorScheme).toBe("normal");
    expect(colors.token).toBe(colors.syntaxSemantic);
    expect(colors.token).toBe(colors.defaultDarkAccent);
  });

  test("enhances native and tab blocks but leaves unrelated pre untouched", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const native = page.locator("main pre.hi-root").first();
    const titledNative = page
      .locator("main .code-block-container", { hasText: "class-mode-native.js" })
      .locator("pre.hi-root");
    const tabBlock = page.locator("main .tab-panel pre").first();
    const plain = page.locator('main pre[data-code-compat-fixture="plain"]');

    await expect(
      titledNative.locator('span[data-line-diff="removed"]'),
    ).toHaveCount(1);
    await expect(
      titledNative.locator('span[data-line-diff="added"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('main pre.hi-root span[data-line-highlight="true"]'),
    ).toHaveCount(1);

    for (const enhanceable of [native, titledNative, tabBlock]) {
      await expect(enhanceable).toHaveAttribute("data-enhanced", "true");
      const wrapper = enhanceable.locator("xpath=..");
      await expect(wrapper).toHaveClass(/\bcode-block-wrapper\b/);
      await expect(
        wrapper.getByRole("button", { name: "Copy code" }),
      ).toHaveCount(1);
      await expect(
        wrapper.locator('button[aria-label="Toggle word wrap"]'),
      ).toHaveCount(1);
    }

    await expect(plain).not.toHaveAttribute("data-enhanced", "true");
    await expect(plain.locator("xpath=..")).not.toHaveClass(
      /\bcode-block-wrapper\b/,
    );
  });

  test("copy button is present on code blocks", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // Buttons are created dynamically after zfb:after-swap
    const copyBtn = page.locator('[aria-label="Copy code"]').first();
    await copyBtn.waitFor({ state: "attached", timeout: 10_000 });

    const count = await page.locator('[aria-label="Copy code"]').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("clicking copy button adds .copied class then removes it", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const copyBtn = page.locator('[aria-label="Copy code"]').first();
    await copyBtn.waitFor({ state: "attached", timeout: 10_000 });

    // Grant clipboard permission so the click handler succeeds
    await page.context().grantPermissions(["clipboard-write"]);

    // The .code-buttons container is opacity:0 until the parent
    // .code-block-wrapper enters :hover / :focus-within (see global.css
    // "Code block buttons" section). Playwright's actionability check
    // resolves visibility BEFORE moving the mouse, so the auto-hover
    // built into .click() does not unmask the button on its own — the
    // first toBeVisible() must observe a non-zero opacity already.
    //
    // Move the mouse over the wrapper first so the :hover rule lifts
    // the opacity, then perform the actual click. This mirrors how a
    // real user reaches the button (cursor lands on the code block,
    // controls fade in, click follows).
    //
    // Wave 13 (zudolab/zudo-doc#1355): the upstream zfb input-CSS path
    // probe fix from topic-wave13-zfb-css-path-probe restored these
    // .code-buttons / .code-btn rules in the fixture bundle, so the
    // opacity gate now applies in CI. Before the path-probe fix the
    // rules were missing and Playwright saw an unstyled (always
    // visible) button.
    await copyBtn.scrollIntoViewIfNeeded();
    await copyBtn.hover();
    await expect(copyBtn).toBeVisible({ timeout: 3000 });

    await copyBtn.click();

    // .copied class should appear immediately after click
    await expect(copyBtn).toHaveClass(/copied/, { timeout: 3000 });

    // .copied class should be removed after 1500ms
    await expect(copyBtn).not.toHaveClass(/copied/, { timeout: 5000 });
  });

  test("wrap button exists on code blocks", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const wrapBtn = page.locator('[aria-label="Toggle word wrap"]').first();
    await wrapBtn.waitFor({ state: "attached", timeout: 10_000 });

    const count = await page.locator('[aria-label="Toggle word wrap"]').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("wrap button aria-pressed starts as false", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const wrapBtn = page.locator('[aria-label="Toggle word wrap"]').first();
    await wrapBtn.waitFor({ state: "attached", timeout: 10_000 });

    await expect(wrapBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("wrap preference survives a reload and applies page-wide", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    // The "Long Code Block" fixture is the only one wide enough to overflow,
    // so it is the only one that offers the toggle (see updateWrapVisibility).
    const longPre = page
      .locator("main pre.hi-root", { hasText: "longVariable" })
      .first();
    const shortPre = page
      .locator("main pre.hi-root", { hasText: "const x = 1;" })
      .first();

    const wrapBtn = longPre
      .locator("xpath=..")
      .locator('button[aria-label="Toggle word wrap"]');
    await wrapBtn.waitFor({ state: "attached", timeout: 10_000 });

    // .code-buttons is opacity:0 until the wrapper is hovered — same gate the
    // copy-button test documents above.
    await wrapBtn.scrollIntoViewIfNeeded();
    await wrapBtn.hover();
    await expect(wrapBtn).toBeVisible({ timeout: 3000 });
    await wrapBtn.click();

    // Wrap is page-wide: the short block wraps too, even though it never
    // offers a button of its own.
    await expect(longPre).toHaveClass(/\bword-wrap\b/);
    await expect(shortPre).toHaveClass(/\bword-wrap\b/);
    await expect(wrapBtn).toHaveAttribute("aria-pressed", "true");

    await page.reload({ waitUntil: "load" });

    const restoredBtn = longPre
      .locator("xpath=..")
      .locator('button[aria-label="Toggle word wrap"]');
    await restoredBtn.waitFor({ state: "attached", timeout: 10_000 });

    await expect(longPre).toHaveClass(/\bword-wrap\b/);
    await expect(shortPre).toHaveClass(/\bword-wrap\b/);
    await expect(restoredBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("a tab opened after wrap was restored still offers its toggle", async ({
    page,
  }) => {
    // A <pre> in a closed tab panel is `hidden`, so it has no layout box when
    // the enhancer first measures it. Treating that as "fits" while wrap is on
    // would hide its toggle for good — leaving no way to turn wrapping off on
    // a page whose only overflowing block lives in a tab.
    await page.goto(PAGE, { waitUntil: "load" });

    const wrapBtn = page
      .locator("main pre.hi-root", { hasText: "longVariable" })
      .first()
      .locator("xpath=..")
      .locator('button[aria-label="Toggle word wrap"]');
    await wrapBtn.waitFor({ state: "attached", timeout: 10_000 });
    await wrapBtn.scrollIntoViewIfNeeded();
    await wrapBtn.hover();
    await wrapBtn.click();

    await page.reload({ waitUntil: "load" });

    const rustPanel = page.locator('.tab-panel[data-tab-value="rust"]');
    const rustPre = rustPanel.locator("pre");
    await rustPre.waitFor({ state: "attached", timeout: 10_000 });

    // Still closed: nothing is known about it yet, so it is left alone.
    expect(await rustPanel.getAttribute("hidden")).not.toBeNull();

    await page.locator('[data-tab-btn="rust"]').click();
    expect(await rustPanel.getAttribute("hidden")).toBeNull();

    // Revealed: the block is measured, wrapped, and its toggle is offered.
    await expect(rustPre).toHaveClass(/\bword-wrap\b/);
    await expect(
      rustPanel.locator('button[aria-label="Toggle word wrap"]'),
    ).toBeVisible();
  });

  test("wrap toggle stays hidden on a block that never overflows", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "load" });

    const longPre = page
      .locator("main pre.hi-root", { hasText: "longVariable" })
      .first();
    const shortWrapBtn = page
      .locator("main pre.hi-root", { hasText: "const x = 1;" })
      .first()
      .locator("xpath=..")
      .locator('button[aria-label="Toggle word wrap"]');

    await shortWrapBtn.waitFor({ state: "attached", timeout: 10_000 });
    await expect(shortWrapBtn).toBeHidden();

    // Turning wrap on stops every block from overflowing. Without the cached
    // unwrapped measurement, that would reveal a wrap button on short blocks
    // that never needed one.
    const wrapBtn = longPre
      .locator("xpath=..")
      .locator('button[aria-label="Toggle word wrap"]');
    await wrapBtn.scrollIntoViewIfNeeded();
    await wrapBtn.hover();
    await wrapBtn.click();

    await expect(longPre).toHaveClass(/\bword-wrap\b/);
    await expect(shortWrapBtn).toBeHidden();
  });
});
