/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";

import {
  HtmlPreview,
  HtmlPreviewWrapper,
  PreviewBase,
  type HtmlPreviewLabels,
} from "../index.js";

const codeBlocks = [
  { language: "html", title: "HTML", code: "<p>hello</p>" },
];

function renderBase(
  props: Partial<Parameters<typeof PreviewBase>[0]> = {},
): string {
  return render(
    <PreviewBase
      srcdoc="<!doctype html><html><body>hello</body></html>"
      syncDelay={0}
      codeBlocks={codeBlocks}
      {...props}
    />,
  );
}

describe("HtmlPreview localized labels and control contract", () => {
  it("SSR-renders all English labels and both control regions by default", () => {
    const html = render(
      <HtmlPreview html="<p>hello</p>" defaultOpen />,
    );

    expect(html).toContain('aria-label="Viewport size"');
    expect(html).toContain(">Mobile</button>");
    expect(html).toContain(">Tablet</button>");
    expect(html).toContain(">Full</button>");
    expect(html).toContain(">Hide code</button>");
    expect(html).toContain(">HTML</span>");
    expect(html).toContain('title="Preview"');
  });

  it("overrides only supplied labels and treats undefined as omitted", () => {
    const labels: Partial<HtmlPreviewLabels> = {
      mobile: "Mobil",
      tablet: undefined,
    };
    const html = render(
      <HtmlPreview html="<p>hello</p>" labels={labels} defaultOpen />,
    );

    expect(html).toContain(">Mobil</button>");
    expect(html).toContain(">Tablet</button>");
    expect(html).toContain(">Full</button>");
    expect(html).toContain('aria-label="Viewport size"');
    expect(html).toContain(">Hide code</button>");
    expect(html).toContain('title="Preview"');
  });

  it("uses labels.preview only for an iframe without an author title", () => {
    const fallback = render(
      <HtmlPreview html="<p>hello</p>" labels={{ preview: "Aperçu" }} />,
    );
    const authored = render(
      <HtmlPreview
        html="<p>hello</p>"
        title="Author title"
        labels={{ preview: "Aperçu" }}
      />,
    );

    expect(fallback).toContain('title="Aperçu"');
    expect(authored).toContain('title="Author title"');
    expect(authored).not.toContain('title="Aperçu"');
  });

  it("serializes direct document metadata with low-level English fallback", () => {
    const localized = render(
      <HtmlPreview
        html="<p>hello</p>"
        lang="pt-BR-x-demo"
        title="Olá & preview"
      />,
    );
    const fallback = render(<HtmlPreview html="<p>hello</p>" lang="  " />);

    expect(localized).toContain(
      "&lt;html lang=&quot;pt-BR-x-demo&quot;>",
    );
    expect(localized).toContain(
      "&lt;title>Olá &amp;amp; preview&lt;/title>",
    );
    expect(fallback).toContain("&lt;html lang=&quot;en&quot;>");
    expect(fallback).toContain("&lt;title>Preview&lt;/title>");
  });

  it("removes the source region structurally even when defaultOpen is true", () => {
    const html = renderBase({ showSource: false, defaultOpen: true });

    expect(html).toContain('aria-label="Viewport size"');
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain(">HTML</span>");
    expect(html).not.toContain("<pre");
  });

  it("removes viewport presets but keeps a titled bar and full-width resize area", () => {
    const html = renderBase({
      title: "Preview title",
      showViewportControls: false,
    });

    expect(html).toContain(">Preview title</span>");
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain(">Mobile</button>");
    expect(html).not.toContain(">Tablet</button>");
    expect(html).not.toContain(">Full</button>");
    expect(html).toContain('style="width:100%;"');
    expect(html).toContain("resize-x");
  });

  it("omits an otherwise-empty title bar when both optional regions are disabled", () => {
    const html = renderBase({
      showSource: false,
      showViewportControls: false,
    });

    expect(html).not.toContain("border-b");
    expect(html).not.toContain("border-t");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain('role="group"');
    expect(html).toContain('style="width:100%;"');
    expect(html).toContain("<iframe");
  });

  it("keeps one visible island marker while forwarding the contract through the wrapper", () => {
    const html = render(
      <HtmlPreviewWrapper
        html="<p>hello</p>"
        labels={{ mobile: "Mobil", preview: "Aperçu" }}
        showSource={false}
        showViewportControls={false}
      />,
    );

    expect(
      html.match(/data-zfb-island="HtmlPreviewWrapperInner"/g),
    ).toHaveLength(1);
    expect(html).toContain('title="Aperçu"');
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("data-zfb-island=\"HtmlPreviewWrapper\"");
  });

  it("forwards language and localized document-title fallback through the wrapper", () => {
    const html = render(
      <HtmlPreviewWrapper
        html="<p>hello</p>"
        lang="de-CH-1996"
        labels={{ preview: "Vorschau" }}
      />,
    );

    expect(html).toContain("&lt;html lang=&quot;de-CH-1996&quot;>");
    expect(html).toContain("&lt;title>Vorschau&lt;/title>");
  });
});
