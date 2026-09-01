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
      },
    });

    expect(html).toContain(">スマホ</button>");
    expect(html).toContain(">タブレット</button>");
    expect(html).toContain(">フル</button>");
    expect(html).toContain('aria-label="ビューポートサイズ"');
    expect(html).toContain(">コードを非表示</button>");
    expect(html).toContain('title="プレビュー"');
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
