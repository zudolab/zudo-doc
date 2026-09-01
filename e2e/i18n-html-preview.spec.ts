import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { getAttrValue } from "./html-assertions";
import { makeDistReader } from "./dist-helper";

const I18N_BASE_URL = "http://localhost:4501";
const PAGE_EN = "/docs/guides/html-preview-test/";
const PAGE_JA = "/ja/docs/guides/html-preview-test/";
const PAGE_DE = "/de/docs/guides/html-preview-test/";
const { readDistFile } = makeDistReader("i18n");
const ISLAND_SELECTOR = '[data-zfb-island="HtmlPreviewWrapperInner"]';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function htmlSection(html: string, heading: string): string {
  const articleStart = html.search(/<article\b/i);
  if (articleStart < 0) return "";
  const article = html.slice(articleStart);
  const headingMatch = [...article.matchAll(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi)].find(
    (match) =>
      decodeHtmlEntities(match[0].replace(/<[^>]*>/g, "")).trim() === heading,
  );
  if (!headingMatch || headingMatch.index == null) return "";
  const start = articleStart + headingMatch.index;
  const nextHeading = html.slice(start + headingMatch[0].length).search(/<h2\b/i);
  return html.slice(
    start,
    nextHeading < 0 ? html.length : start + headingMatch[0].length + nextHeading,
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function readIframeSrcdoc(section: string): string {
  const iframeStart = section.search(/<iframe\b/i);
  expect(iframeStart).toBeGreaterThanOrEqual(0);
  // The srcdoc value itself contains raw `>` characters (for example in its
  // doctype and tags), so do not truncate the outer iframe at the first `>`.
  // getAttrValue's quoted capture is intentionally allowed to span those
  // characters and newlines.
  const encoded = getAttrValue(section.slice(iframeStart), "srcdoc");
  expect(encoded).not.toBeNull();
  return decodeHtmlEntities(encoded ?? "");
}

function expectSrcdocMetadata(
  section: string,
  expectedLang: string,
  expectedTitle: string,
): void {
  const srcdoc = readIframeSrcdoc(section);
  expect(srcdoc).toContain(`<html lang="${expectedLang}">`);
  expect(srcdoc.match(/<title\b/gi) ?? []).toHaveLength(1);
  expect(srcdoc).toContain(`<title>${expectedTitle}</title>`);
}

function previewByTitle(page: Page, title: string): Locator {
  return page.locator(ISLAND_SELECTOR).filter({ hasText: title });
}

function previewAfterHeading(page: Page, heading: string): Locator {
  return page
    .locator("article h2")
    .filter({ hasText: new RegExp(`^${escapeRegExp(heading)}$`) })
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

type IframeDocumentMetadata = {
  lang: string;
  title: string;
  titleCount: number;
};

async function iframeDocumentMetadata(
  iframe: Locator,
): Promise<IframeDocumentMetadata> {
  const handle = await iframe.elementHandle();
  if (!handle) throw new Error("HtmlPreview iframe was not attached");
  const frame = await handle.contentFrame();
  if (!frame) throw new Error("HtmlPreview iframe frame was not available");
  await frame.locator("html").waitFor({ state: "attached", timeout: 10_000 });
  return frame.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    titleCount: document.querySelectorAll("title").length,
  }));
}

test.describe("i18n HtmlPreview: serialized document metadata", () => {
  test("binds route language and title fallbacks across EN, JA, and DE output", () => {
    const routes = [
      {
        distPath: "docs/guides/html-preview-test/index.html",
        localeHeading: "Locale defaults",
        fallbackHeading: "Fallback iframe title",
        explicitHeading: "Explicit metadata override",
        expectedLang: "en",
        fallbackTitle: "Preview",
      },
      {
        distPath: "ja/docs/guides/html-preview-test/index.html",
        localeHeading: "ロケールのデフォルト",
        fallbackHeading: "フォールバック iframe タイトル",
        explicitHeading: "明示的なメタデータ上書き",
        expectedLang: "ja",
        fallbackTitle: "プレビュー",
      },
      {
        distPath: "de/docs/guides/html-preview-test/index.html",
        localeHeading: "Locale defaults",
        fallbackHeading: "Fallback iframe title",
        explicitHeading: "Explicit metadata override",
        expectedLang: "de",
        fallbackTitle: "Preview",
      },
    ] as const;

    for (const {
      distPath,
      localeHeading,
      fallbackHeading,
      explicitHeading,
      expectedLang,
      fallbackTitle,
    } of routes) {
      const html = readDistFile(distPath);
      expectSrcdocMetadata(
        htmlSection(html, localeHeading),
        expectedLang,
        "Locale defaults",
      );
      expectSrcdocMetadata(
        htmlSection(html, fallbackHeading),
        expectedLang,
        fallbackTitle,
      );
      expectSrcdocMetadata(
        htmlSection(html, explicitHeading),
        "zh-Hant-x-preview",
        "Explicit preview label",
      );
    }
  });
});

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
    await expect(preview.locator("iframe")).toHaveAttribute(
      "title",
      "Locale defaults",
    );
    expect(await iframeDocumentMetadata(preview.locator("iframe"))).toEqual({
      lang: "en",
      title: "Locale defaults",
      titleCount: 1,
    });

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
    expect(await iframeDocumentMetadata(preview.locator("iframe"))).toEqual({
      lang: "ja",
      title: "Locale defaults",
      titleCount: 1,
    });

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
    await expectIframeMarker(
      fallback,
      "fallback-title-frame",
      "Fallback title iframe",
    );
    expect(await iframeDocumentMetadata(fallback.locator("iframe"))).toEqual({
      lang: "ja",
      title: "プレビュー",
      titleCount: 1,
    });
    assertNoConsoleErrors();
  });

  test("configured DE route keeps its route language while using English metadata fallbacks", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE_DE, { waitUntil: "domcontentloaded" });

    const preview = previewByTitle(page, "Locale defaults");
    await expect(preview).toHaveCount(1);
    await preview.scrollIntoViewIfNeeded();
    await waitForHydration(preview, "Mobile");
    await expectIframeMarker(
      preview,
      "locale-default-frame",
      "Locale default iframe",
    );
    expect(await iframeDocumentMetadata(preview.locator("iframe"))).toEqual({
      lang: "de",
      title: "Locale defaults",
      titleCount: 1,
    });

    const fallback = previewAfterHeading(page, "Fallback iframe title");
    await expect(fallback).toHaveCount(1);
    await fallback.scrollIntoViewIfNeeded();
    await waitForHydration(fallback, "Mobile");
    await expectIframeMarker(
      fallback,
      "fallback-title-frame",
      "Fallback title iframe",
    );
    expect(await iframeDocumentMetadata(fallback.locator("iframe"))).toEqual({
      lang: "de",
      title: "Preview",
      titleCount: 1,
    });
    assertNoConsoleErrors();
  });

  test("explicit language and preview-label overrides win on a Japanese route", async ({
    page,
    assertNoConsoleErrors,
  }) => {
    await page.goto(PAGE_JA, { waitUntil: "domcontentloaded" });

    const explicit = previewAfterHeading(
      page,
      "明示的なメタデータ上書き",
    );
    await expect(explicit).toHaveCount(1);
    await explicit.scrollIntoViewIfNeeded();
    await waitForHydration(explicit, "モバイル");
    await expect(explicit.locator("iframe")).toHaveAttribute(
      "title",
      "Explicit preview label",
    );
    await expectIframeMarker(
      explicit,
      "explicit-metadata-frame",
      "Explicit metadata iframe",
    );
    expect(await iframeDocumentMetadata(explicit.locator("iframe"))).toEqual({
      lang: "zh-Hant-x-preview",
      title: "Explicit preview label",
      titleCount: 1,
    });
    await expect(
      explicit.getByRole("button", { name: "タブレット", exact: true }),
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
