import { test, expect, type Page } from "@playwright/test";
import { readDistFile } from "./smoke-dist-helper";

const PAGE = "/docs/guides/image-enlarge-test";

// Inject max-width CSS and trigger re-evaluation.
// The smoke fixture's Tailwind CSS is bundled into the SSR entry, not served
// as a static asset, so getComputedStyle shows no max-width on images.
// This helper applies inline CSS so clientWidth reflects the div constraints,
// and constrains the enlarge dialog so backdrop click tests work reliably.
async function applyImageConstraints(page: Page) {
  await page.addStyleTag({
    content: `
      .zd-enlargeable img { max-width: 100% !important; }
      figure.zd-enlargeable { max-width: 100% !important; }
      dialog.zd-enlarge-dialog { max-width: 50vw !important; max-height: 50vh !important; }
      dialog.zd-enlarge-dialog img { max-width: 100% !important; max-height: 100% !important; }
    `,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  // Wait for the 150ms debounce + buffer
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------
// Level 3: Static HTML assertions (no browser)
// ---------------------------------------------------------------------------

test.describe("Image Enlarge: static HTML structure", () => {
  let html: string;

  test.beforeAll(() => {
    html = readDistFile("docs/guides/image-enlarge-test/index.html");
  });

  test("oversized image is wrapped in figure.zd-enlargeable", () => {
    expect(html).toContain('class="zd-enlargeable"');
  });

  test("hidden enlarge button follows img inside figure", () => {
    expect(html).toMatch(/class="zd-enlarge-btn"[^>]*hidden|hidden[^>]*class="zd-enlarge-btn"/);
  });

  test("opt-out: figure.zd-enlargeable does NOT wrap the opt-out image", () => {
    expect(html).not.toMatch(/class="zd-enlargeable"[^<]*<img[^>]*alt="opt-out"/);
  });

  test("opt-out: no zd-enlarge-btn follows the opt-out image", () => {
    const optoutSection = html.match(/<img[^>]*alt="opt-out"[^>]*>[\s\S]{0,200}/);
    expect(optoutSection).not.toBeNull();
    expect(optoutSection![0]).not.toContain("zd-enlarge-btn");
  });

  test("opt-out: img tag for opt-out image has NO title attribute (plugin stripped it)", () => {
    const imgTag = html.match(/<img[^>]*alt="opt-out"[^>]*>/)?.[0] ?? "";
    expect(imgTag).toBeTruthy();
    expect(imgTag).not.toContain("title=");
  });

  test("inline image inside paragraph is NOT wrapped in figure", () => {
    expect(html).toMatch(/<p[^>]*>[^<]*<img[^>]*alt="inline image"[^>]*>[^<]*<\/p>/);
    expect(html).not.toMatch(/class="zd-enlargeable"[^<]*<img[^>]*alt="inline image"/);
  });

  test("page has exactly one zd-enlarge-dialog element", () => {
    const matches = html.match(/zd-enlarge-dialog/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Level 4: Browser assertions
// ---------------------------------------------------------------------------

test.describe("Image Enlarge: browser behavior @local-only", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("wide viewport: enlarge button visible for oversized (2000px) image", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await applyImageConstraints(page);

    const figure = page.locator("figure.zd-enlargeable").first();
    await expect(figure).toBeVisible();

    const btn = figure.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });
  });

  test("wide viewport: enlarge button hidden for small (300px) image", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await applyImageConstraints(page);

    const smallFigure = page.locator("figure.zd-enlargeable").filter({
      has: page.locator('img[alt="small image"]'),
    });
    await expect(smallFigure).toBeVisible();

    const btn = smallFigure.locator(".zd-enlarge-btn");
    await expect(btn).toBeHidden({ timeout: 3000 });
  });

  test("DPR=2: button stays hidden for 1200px image (naturalWidth=1200 ≤ clientWidth*2=1240)", async ({
    browser,
  }) => {
    // naturalWidth=1200, clientWidth≈620 (700px div minus ~80px browser figure margins)
    // DPR=2: 1200 > 620*2=1240 → FALSE → button stays hidden
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(PAGE, { waitUntil: "networkidle" });
      await applyImageConstraints(page);

      const mediumFigure = page.locator("figure.zd-enlargeable").filter({
        has: page.locator('img[alt="medium image"]'),
      });
      await expect(mediumFigure).toBeVisible();

      const btn = mediumFigure.locator(".zd-enlarge-btn");
      await expect(btn).toBeHidden({ timeout: 3000 });
    } finally {
      await ctx.close();
    }
  });

  test("click enlarge button opens dialog with correct src and alt", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await applyImageConstraints(page);

    const figure = page.locator("figure.zd-enlargeable").first();
    const btn = figure.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });

    await btn.click();

    const dialog = page.locator("dialog.zd-enlarge-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const dialogImg = dialog.locator("img");
    await expect(dialogImg).toBeVisible();
    const src = await dialogImg.getAttribute("src");
    expect(src).toContain("large.png");
    const alt = await dialogImg.getAttribute("alt");
    expect(alt).toBe("oversized image");
  });

  test("Escape key closes the enlarge dialog", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await applyImageConstraints(page);

    const figure = page.locator("figure.zd-enlargeable").first();
    const btn = figure.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });

    await btn.click();

    const dialog = page.locator("dialog.zd-enlarge-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test("backdrop click closes the enlarge dialog", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await applyImageConstraints(page);

    const figure = page.locator("figure.zd-enlargeable").first();
    const btn = figure.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });

    await btn.click();

    const dialog = page.locator("dialog.zd-enlarge-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Click at viewport (0, 0) — outside the centered dialog content
    // The dialog is centered via position:fixed with transform, so top-left
    // viewport corner is outside its bounding rect.
    await page.mouse.click(0, 0);
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test("client-side navigation away and back: enlarge button still works", async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await applyImageConstraints(page);

    // Simulate astro:after-swap (the event the component listens to for re-init)
    // This tests that handleAfterSwap clears old observers and re-scans content
    await page.evaluate(() => document.dispatchEvent(new Event("astro:after-swap")));
    await page.waitForTimeout(300); // let observers re-register and evaluate
    // Trigger resize so new observers re-evaluate eligibility after re-init
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(400);

    const figure = page.locator("figure.zd-enlargeable").first();
    const btn = figure.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });

    await btn.click();
    const dialog = page.locator("dialog.zd-enlarge-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Level 4: Two-layer CSS sanity (non-@local-only — runs in CI)
// ---------------------------------------------------------------------------

// The smoke fixture's CSS is not bundled as a static asset (it lives in the
// SSR entry). This helper injects the button token bridge and component CSS
// that mirrors global.css so getComputedStyle resolves correctly.
async function applyEnlargeButtonCss(page: Page) {
  await page.addStyleTag({
    content: `
      :root {
        --color-image-overlay-bg: var(--zd-image-overlay-bg);
        --color-image-overlay-fg: var(--zd-image-overlay-fg);
      }
      .zd-enlarge-btn { background: transparent; }
      .zd-enlarge-btn::before {
        content: "";
        position: absolute;
        inset: 0;
        background: color-mix(in oklch, var(--color-image-overlay-bg) 80%, transparent);
      }
      .zd-enlarge-btn > svg { color: var(--color-image-overlay-fg); }
    `,
  });
}

test.describe("Image Enlarge: two-layer button CSS", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("enlarge button ::before has non-transparent background; svg color is set; button bg is transparent", async ({
    page,
  }) => {
    await page.goto(PAGE, { waitUntil: "networkidle" });
    await applyEnlargeButtonCss(page);
    await applyImageConstraints(page);

    const figure = page.locator("figure.zd-enlargeable").first();
    const btn = figure.locator(".zd-enlarge-btn");
    await expect(btn).toBeVisible({ timeout: 3000 });

    // ::before background should be non-transparent (image-overlay-bg token via color-mix)
    const beforeBg = await btn.evaluate((el) =>
      getComputedStyle(el, "::before").backgroundColor,
    );
    expect(beforeBg).toBeTruthy();
    expect(beforeBg).not.toBe("rgba(0, 0, 0, 0)");
    expect(beforeBg).not.toBe("transparent");

    // SVG color should be the image-overlay-fg token value (not the UA-inherited black)
    const svgColor = await btn.evaluate((el) => {
      const svg = el.querySelector("svg");
      return svg ? getComputedStyle(svg).color : "";
    });
    expect(svgColor).toBeTruthy();
    expect(svgColor).not.toBe("rgb(0, 0, 0)");

    // Button's own background should be transparent (background lives on ::before)
    const btnBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(btnBg).toBe("rgba(0, 0, 0, 0)");
  });
});

// ---------------------------------------------------------------------------
// Level 4: No-JS assertions
// ---------------------------------------------------------------------------

test.describe("Image Enlarge: no-JS fallback", () => {
  test("page renders images without JS, enlarge button not visible", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      javaScriptEnabled: false,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(PAGE, { waitUntil: "load" });

      // Images should still render
      const oversizedImg = page.locator('img[alt="oversized image"]');
      await expect(oversizedImg).toBeVisible();

      // zd-enlarge-btn should not be visible (has hidden attribute in HTML)
      const buttons = page.locator(".zd-enlarge-btn");
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(buttons.nth(i)).toBeHidden();
      }

      // Dialog should not be visible (no JS to open it)
      const dialog = page.locator("dialog.zd-enlarge-dialog");
      await expect(dialog).toBeHidden();
    } finally {
      await ctx.close();
    }
  });
});
