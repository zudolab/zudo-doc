import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const I18N_BASE_URL = "http://localhost:4501";
const PAGE_EN = "/docs/guides/html-preview-test/";
const PAGE_JA = "/ja/docs/guides/html-preview-test/";
const ISLAND_SELECTOR = '[data-zfb-island="HtmlPreviewWrapperInner"]';

function previewByTitle(page: Page, title: string): Locator {
  return page.locator(ISLAND_SELECTOR).filter({ hasText: title });
}

function previewAfterHeading(page: Page, heading: string): Locator {
  return page
    .locator("article h2")
    .filter({ hasText: heading })
    .locator(
      'xpath=following-sibling::*[@data-zfb-island="HtmlPreviewWrapperInner"][1]',
    );
}

async function waitForHydration(
  preview: Locator,
  mobileLabel: string,
): Promise<void> {
  const mobile = preview.getByRole("button", {
    name: mobileLabel,
    exact: true,
  });
  await expect
    .poll(
      async () => {
        await mobile.click();
        return mobile.getAttribute("aria-pressed");
      },
      { timeout: 10_000 },
    )
    .toBe("true");
}

async function expectIframeMarker(
  preview: Locator,
  markerId: string,
  text: string,
): Promise<void> {
  await expect(preview.locator("iframe")).toHaveCount(1);
  await expect(
    preview.frameLocator("iframe").locator(`#${markerId}`),
  ).toHaveText(text);
}

test.describe("i18n HtmlPreview: SSR locale chrome", () => {
  test("English SSR keeps the current labels and both control regions", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: I18N_BASE_URL,
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });

      const preview = previewByTitle(page, "Locale defaults");
      await expect(preview).toHaveCount(1);
      await expect(
        preview.getByRole("button", { name: "Mobile", exact: true }),
      ).toBeVisible();
      await expect(
        preview.getByRole("button", { name: "Tablet", exact: true }),
      ).toBeVisible();
      await expect(
        preview.getByRole("button", { name: "Full", exact: true }),
      ).toBeVisible();
      await expect(
        preview.locator('[aria-label="Viewport size"]'),
      ).toHaveCount(1);
      await expect(
        preview.getByRole("button", { name: "Show code", exact: true }),
      ).toBeVisible();
      await expect(preview.locator("iframe")).toHaveAttribute(
        "title",
        "Locale defaults",
      );
      const fallback = previewAfterHeading(page, "Fallback iframe title");
      await expect(fallback).toHaveCount(1);
      await expect(fallback.locator("iframe")).toHaveAttribute(
        "title",
        "Preview",
      );
    } finally {
      await context.close();
    }
  });

  test("Japanese SSR keeps localized labels and the fallback iframe title", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: I18N_BASE_URL,
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto(PAGE_JA, { waitUntil: "domcontentloaded" });

      const preview = previewByTitle(page, "Locale defaults");
      await expect(preview).toHaveCount(1);
      for (const label of ["モバイル", "タブレット", "フル"]) {
        await expect(
          preview.getByRole("button", { name: label, exact: true }),
        ).toBeVisible();
      }
      await expect(
        preview.locator('[aria-label="ビューポートサイズ"]'),
      ).toHaveCount(1);
      await expect(
        preview.getByRole("button", { name: "コードを表示", exact: true }),
      ).toBeVisible();

      const fallback = previewAfterHeading(
        page,
        "フォールバック iframe タイトル",
      );
      await expect(fallback).toHaveCount(1);
      await expect(fallback.locator("iframe")).toHaveAttribute(
        "title",
        "プレビュー",
      );
    } finally {
      await context.close();
    }
  });

  test("a configured DE route falls back to the English preview labels", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: I18N_BASE_URL,
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.goto("/de/docs/guides/html-preview-test/", {
        waitUntil: "domcontentloaded",
      });

      const preview = previewByTitle(page, "Locale defaults");
      await expect(preview).toHaveCount(1);
      for (const label of ["Mobile", "Tablet", "Full"]) {
        await expect(
          preview.getByRole("button", { name: label, exact: true }),
        ).toBeVisible();
      }
      await expect(
        preview.locator('[aria-label="Viewport size"]'),
      ).toHaveCount(1);
      await expect(
        preview.getByRole("button", { name: "Show code", exact: true }),
      ).toBeVisible();

      const fallback = previewAfterHeading(page, "Fallback iframe title");
      await expect(fallback).toHaveCount(1);
      await expect(fallback.locator("iframe")).toHaveAttribute(
        "title",
        "Preview",
      );
    } finally {
      await context.close();
    }
  });
});

test.describe("i18n HtmlPreview: hydrated locale chrome", () => {
  test("English labels and iframe content survive hydration", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE_EN, { waitUntil: "domcontentloaded" });

    const preview = previewByTitle(page, "Locale defaults");
    await expect(preview).toHaveCount(1);
    await preview.scrollIntoViewIfNeeded();
    await waitForHydration(preview, "Mobile");

    await expect(
      preview.getByRole("button", { name: "Mobile", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      preview.getByRole("button", { name: "Tablet", exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByRole("button", { name: "Full", exact: true }),
    ).toBeVisible();
    await expect(
      preview.locator('[aria-label="Viewport size"]'),
    ).toHaveCount(1);

    const sourceToggle = preview.getByRole("button", {
      name: "Show code",
      exact: true,
    });
    await sourceToggle.click();
    await expect(
      preview.getByRole("button", { name: "Hide code", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await expectIframeMarker(
      preview,
      "locale-default-frame",
      "Locale default iframe",
    );

    assertNoConsoleErrors();
  });

  test("Japanese labels keep their SSR values through hydration and Show-to-Hide", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE_JA, { waitUntil: "domcontentloaded" });

    const preview = previewByTitle(page, "Locale defaults");
    await expect(preview).toHaveCount(1);
    await preview.scrollIntoViewIfNeeded();
    await waitForHydration(preview, "モバイル");

    for (const label of ["モバイル", "タブレット", "フル"]) {
      await expect(
        preview.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
    await expect(
      preview.locator('[aria-label="ビューポートサイズ"]'),
    ).toHaveCount(1);

    const showCode = preview.getByRole("button", {
      name: "コードを表示",
      exact: true,
    });
    await expect(showCode).toHaveAttribute("aria-expanded", "false");
    await showCode.click();
    await expect(
      preview.getByRole("button", { name: "コードを非表示", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      preview.getByRole("button", { name: "コードを表示", exact: true }),
    ).toHaveCount(0);
    await expect(preview.locator("iframe")).toHaveAttribute(
      "title",
      "Locale defaults",
    );
    await expectIframeMarker(
      preview,
      "locale-default-frame",
      "Locale default iframe",
    );

    const fallback = previewAfterHeading(
      page,
      "フォールバック iframe タイトル",
    );
    await expect(fallback).toHaveCount(1);
    await fallback.scrollIntoViewIfNeeded();
    await waitForHydration(fallback, "モバイル");
    await expect(fallback.locator("iframe")).toHaveAttribute(
      "title",
      "プレビュー",
    );
    await expect(
      fallback.getByRole("button", { name: "タブレット", exact: true }),
    ).toBeVisible();
    assertNoConsoleErrors();
  });
});

test.describe("i18n HtmlPreview: partial labels and hidden regions", () => {
  test("keeps locale peers for partial overrides and retains iframes when regions are hidden", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE_JA, { waitUntil: "domcontentloaded" });

    const partial = previewByTitle(page, "Partial labels");
    await expect(partial).toHaveCount(1);
    await expect(
      partial.getByRole("button", { name: "Phone", exact: true }),
    ).toBeVisible();
    await expect(
      partial.getByRole("button", { name: "タブレット", exact: true }),
    ).toBeVisible();
    await expect(
      partial.getByRole("button", { name: "フル", exact: true }),
    ).toBeVisible();
    await expect(
      partial.locator('[aria-label="ビューポートサイズ"]'),
    ).toHaveCount(1);
    await expect(
      partial.getByRole("button", { name: "コードを表示", exact: true }),
    ).toBeVisible();
    await expect(partial.locator("iframe")).toHaveAttribute(
      "title",
      "Partial labels",
    );
    await partial.scrollIntoViewIfNeeded();
    await waitForHydration(partial, "Phone");
    await expect(
      partial.getByRole("button", { name: "タブレット", exact: true }),
    ).toBeVisible();
    await expect(
      partial.getByRole("button", { name: "フル", exact: true }),
    ).toBeVisible();
    await expect(
      partial.locator('[aria-label="ビューポートサイズ"]'),
    ).toHaveCount(1);
    await expect(
      partial.getByRole("button", { name: "コードを表示", exact: true }),
    ).toBeVisible();

    const sourceHidden = previewByTitle(page, "Source hidden");
    await expect(sourceHidden).toHaveCount(1);
    await expect(sourceHidden.getByRole("button")).toHaveCount(3);
    await expect(sourceHidden.locator("button[aria-expanded]")).toHaveCount(0);
    await expect(sourceHidden.locator(".zd-html-preview-code")).toHaveCount(0);
    await expect(sourceHidden.locator("pre.hi-root")).toHaveCount(0);
    await expectIframeMarker(
      sourceHidden,
      "source-hidden-frame",
      "Source hidden iframe",
    );

    const viewportHidden = previewByTitle(page, "Viewport hidden");
    await expect(viewportHidden).toHaveCount(1);
    await expect(viewportHidden.locator('[role="group"]')).toHaveCount(0);
    await expect(viewportHidden.locator("[aria-pressed]")).toHaveCount(0);
    await expect(
      viewportHidden.getByRole("button", { name: "コードを表示", exact: true }),
    ).toBeVisible();
    await expect(viewportHidden.locator(".resize-x")).toHaveAttribute(
      "style",
      /width:\s*100%;/,
    );
    await expectIframeMarker(
      viewportHidden,
      "viewport-hidden-frame",
      "Viewport hidden iframe",
    );

    const allHidden = previewByTitle(page, "All controls hidden");
    await expect(allHidden).toHaveCount(1);
    await expect(allHidden.getByRole("button")).toHaveCount(0);
    await expect(allHidden.locator('[role="group"]')).toHaveCount(0);
    await expect(allHidden.locator("[aria-pressed]")).toHaveCount(0);
    await expect(allHidden.locator("button[aria-expanded]")).toHaveCount(0);
    await expect(
      allHidden.getByText("All controls hidden", { exact: true }),
    ).toBeVisible();
    await expectIframeMarker(
      allHidden,
      "all-controls-hidden-frame",
      "All controls hidden iframe",
    );
    assertNoConsoleErrors();
  });
});

test.describe("i18n HtmlPreview: narrow Japanese controls", () => {
  test.use({ viewport: { width: 360, height: 900 } });

  test("keeps Japanese labels visible, reachable, and inside the narrow viewport", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE_JA, { waitUntil: "domcontentloaded" });

    const preview = previewByTitle(page, "Locale defaults");
    await expect(preview).toHaveCount(1);
    await preview.scrollIntoViewIfNeeded();
    await waitForHydration(preview, "モバイル");
    const controls = preview.locator(
      '[aria-label="ビューポートサイズ"] button, button[aria-expanded]',
    );
    await expect(controls).toHaveCount(4);
    for (const label of ["モバイル", "タブレット", "フル", "コードを表示"]) {
      await expect(
        preview.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }

    const rects = await controls.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      }),
    );
    const pageWidths = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));

    for (const [index, rect] of rects.entries()) {
      expect(rect.width, `control ${index} width`).toBeGreaterThanOrEqual(44);
      expect(rect.height, `control ${index} height`).toBeGreaterThanOrEqual(44);
      expect(rect.left, `control ${index} left edge`).toBeGreaterThanOrEqual(0);
      expect(rect.right, `control ${index} right edge`).toBeLessThanOrEqual(
        pageWidths.viewportWidth,
      );
      for (let otherIndex = index + 1; otherIndex < rects.length; otherIndex++) {
        const other = rects[otherIndex]!;
        const overlaps =
          rect.left < other.right &&
          other.left < rect.right &&
          rect.top < other.bottom &&
          other.top < rect.bottom;
        expect(overlaps, `controls ${index} and ${otherIndex} overlap`).toBe(
          false,
        );
      }
    }
    expect(pageWidths.bodyScrollWidth).toBeLessThanOrEqual(
      pageWidths.clientWidth + 1,
    );
    expect(pageWidths.documentScrollWidth).toBeLessThanOrEqual(
      pageWidths.clientWidth + 1,
    );
    expect(pageWidths.clientWidth).toBeLessThanOrEqual(
      pageWidths.viewportWidth,
    );
    assertNoConsoleErrors();
  });
});
