/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { h, type ComponentType } from "preact";
import render from "preact-render-to-string";

import { defaultTranslations } from "../../i18n-defaults/index.js";
import type { ChromeContext } from "../../factory-context/index.js";
import type { HtmlPreviewLabels } from "../../html-preview-wrapper/index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import { deriveMdxComponents } from "../derive.js";

type HtmlPreviewProps = {
  html: string;
  defaultOpen?: boolean;
  lang?: string;
  labels?: Partial<HtmlPreviewLabels>;
};

function renderBoundPreview(
  ctx: ChromeContext,
  lang: string,
  props: HtmlPreviewProps,
): string {
  const { createMdxComponentsBound } = deriveMdxComponents(ctx);
  const components = createMdxComponentsBound(lang);
  const HtmlPreview = components.HtmlPreview as ComponentType<HtmlPreviewProps>;
  return render(h(HtmlPreview, props));
}

function defaultTableT(key: string, locale = "en"): string {
  return (
    defaultTranslations[locale]?.[key] ?? defaultTranslations.en?.[key] ?? key
  );
}

function readSrcdoc(rendered: string): string {
  const encoded = rendered.match(/\ssrcdoc="([^"]*)"/)?.[1];
  expect(encoded).toBeDefined();
  return (encoded ?? "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function expectSrcdocMetadata(
  rendered: string,
  expectedLang: string,
  expectedTitle: string,
): void {
  const srcdoc = readSrcdoc(rendered);
  expect(srcdoc).toContain(`<html lang="${expectedLang}">`);
  expect(srcdoc).toContain(`<title>${expectedTitle}</title>`);
}

describe("HtmlPreview MDX binding", () => {
  it("binds all visible and ARIA labels to the active Japanese route locale", () => {
    const ctx = makeFakeChromeContext({
      overrides: { t: defaultTableT },
    });

    const html = renderBoundPreview(ctx, "ja", {
      html: "<p>hello</p>",
      defaultOpen: true,
    });

    expect(html).toContain('aria-label="ビューポートサイズ"');
    expect(html).toContain(">モバイル</button>");
    expect(html).toContain(">タブレット</button>");
    expect(html).toContain(">フル</button>");
    expect(html).toContain(">コードを非表示</button>");
    expect(html).toContain('title="プレビュー"');
    expectSrcdocMetadata(html, "ja", "プレビュー");
  });

  it("merges a partial per-call override over locale labels without erasing peers", () => {
    const ctx = makeFakeChromeContext({
      overrides: { t: defaultTableT },
    });

    const html = renderBoundPreview(ctx, "ja", {
      html: "<p>hello</p>",
      defaultOpen: true,
      labels: {
        mobile: "スマホ",
        tablet: undefined,
        preview: "カスタムプレビュー",
      },
    });

    expect(html).toContain(">スマホ</button>");
    expect(html).toContain(">タブレット</button>");
    expect(html).toContain(">フル</button>");
    expect(html).toContain('aria-label="ビューポートサイズ"');
    expect(html).toContain(">コードを非表示</button>");
    expect(html).toContain('title="カスタムプレビュー"');
    expectSrcdocMetadata(html, "ja", "カスタムプレビュー");
  });

  it("lets an explicit document language differ from the Japanese route locale", () => {
    const ctx = makeFakeChromeContext({
      overrides: { t: defaultTableT },
    });

    const html = renderBoundPreview(ctx, "ja", {
      html: "<p>hello</p>",
      lang: "  zh-Hant-x-preview  ",
      defaultOpen: true,
    });

    // The document language preserves the authored nonblank bytes, including
    // surrounding whitespace, while route controls remain Japanese.
    expect(html).toContain(
      "&lt;html lang=&quot;  zh-Hant-x-preview  &quot;>",
    );
    expect(html).toContain(">モバイル</button>");
    expect(html).toContain(">タブレット</button>");
    expect(html).toContain(">フル</button>");
    expect(html).toContain('title="プレビュー"');
    expectSrcdocMetadata(html, "  zh-Hant-x-preview  ", "プレビュー");
  });

  it("falls back from a blank document language to the active route locale", () => {
    const ctx = makeFakeChromeContext({
      overrides: { t: defaultTableT },
    });

    const html = renderBoundPreview(ctx, "ja", {
      html: "<p>hello</p>",
      lang: " \t\n",
      defaultOpen: true,
    });

    expect(html).toContain("&lt;html lang=&quot;ja&quot;>");
    expect(html).toContain(">モバイル</button>");
    expect(html).toContain('title="プレビュー"');
    expectSrcdocMetadata(html, "ja", "プレビュー");
  });

  it("passes arbitrary configured locales through requested, configured-default, and English fallbacks", () => {
    const values: Record<string, Record<string, string>> = {
      en: {
        "htmlPreview.viewport.mobile": "English mobile",
        "htmlPreview.viewport.tablet": "English tablet",
        "htmlPreview.viewport.full": "English full",
        "htmlPreview.viewport.label": "English viewport",
        "htmlPreview.source.show": "English show",
        "htmlPreview.source.hide": "English hide",
        "htmlPreview.iframe.title": "English preview",
      },
      ja: {
        "htmlPreview.viewport.tablet": "日本語タブレット",
      },
      de: {
        "htmlPreview.viewport.mobile": "Deutsch mobil",
      },
    };
    const ctx = makeFakeChromeContext({
      settings: {
        defaultLocale: "ja",
        locales: { de: { dir: "src/content/docs-de", label: "Deutsch" } },
      },
      overrides: {
        defaultLocale: "ja",
        locales: ["ja", "de"],
        i18n: {
          defaultLocale: "ja",
          locales: ["ja", "de"],
          getLocaleLabel: (locale: string) => locale,
        },
        t: (key: string, locale = "ja") =>
          values[locale]?.[key] ?? values.ja?.[key] ?? values.en?.[key] ?? key,
      },
    });

    const html = renderBoundPreview(ctx, "de", {
      html: "<p>hello</p>",
      defaultOpen: true,
    });

    expect(html).toContain(">Deutsch mobil</button>");
    expect(html).toContain(">日本語タブレット</button>");
    expect(html).toContain(">English full</button>");
    expect(html).toContain('aria-label="English viewport"');
    expect(html).toContain(">English hide</button>");
    expect(html).toContain('title="English preview"');
    expectSrcdocMetadata(html, "de", "English preview");
  });

  it("uses the English document metadata defaults for the default route locale", () => {
    const ctx = makeFakeChromeContext({
      overrides: { t: defaultTableT },
    });

    const html = renderBoundPreview(ctx, "en", {
      html: "<p>hello</p>",
    });

    expectSrcdocMetadata(html, "en", "Preview");
  });

  it("retains global iframe CSS/head/JS in the package binding", () => {
    const ctx = makeFakeChromeContext({
      settings: {
        htmlPreview: {
          css: ".global-css-marker{color:red}",
          head: '<meta name="global-head-marker">',
          js: "window.globalJsMarker = true;",
        },
      },
      overrides: { t: defaultTableT },
    });

    const html = renderBoundPreview(ctx, "en", {
      html: "<p>hello</p>",
    });

    expect(html).toContain("global-css-marker");
    expect(html).toContain("global-head-marker");
    expect(html).toContain("globalJsMarker");
  });

  it("keeps an intentional host mdxExtras.HtmlPreview override", () => {
    const HostHtmlPreview = () => "host preview";
    const ctx = makeFakeChromeContext({
      overrides: {
        hostBindings: { mdxExtras: { HtmlPreview: HostHtmlPreview } },
      } as Partial<ChromeContext>,
    });

    const { createMdxComponentsBound } = deriveMdxComponents(ctx);
    const components = createMdxComponentsBound("ja");

    expect(components.HtmlPreview).toBe(HostHtmlPreview);
  });
});
