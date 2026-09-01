/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";

import {
  HtmlPreviewWrapper,
  HtmlPreviewWrapperInner,
  type HtmlPreviewWrapperProps,
} from "../index.js";

function decodeAttributeJson(value: string): Record<string, unknown> {
  return JSON.parse(
    value
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&"),
  ) as Record<string, unknown>;
}

function readSerializedProps(html: string): Record<string, unknown> {
  const encoded = html.match(/data-props="([^"]+)"/)?.[1];
  expect(encoded).toBeDefined();
  return decodeAttributeJson(encoded ?? "{}");
}

const COMPLETE_PROPS: HtmlPreviewWrapperProps = {
  html: '<button id="inside">Hello</button>',
  css: ".inside { color: red; }",
  head: '<meta name="preview-test" content="yes">',
  js: "window.previewMounted = true;",
  title: "Lifecycle preview",
  lang: "pt-BR-x-preview",
  height: 320,
  defaultOpen: true,
  labels: {
    mobile: "Narrow",
    preview: "Rendered preview",
  },
  showSource: false,
  showViewportControls: false,
  fullHeight: true,
  sandbox: "allow-scripts",
  externalStyles: ["/preview.css"],
  externalScripts: ["/preview.js"],
  preflight: false,
  showResources: true,
  globalConfig: {
    css: ".global { color: blue; }",
    head: '<meta name="global-preview" content="yes">',
    js: "window.globalPreview = true;",
  },
};

describe("HtmlPreviewWrapper loading contract", () => {
  it("keeps omitted and explicit eager output identical", () => {
    const omitted = render(<HtmlPreviewWrapper {...COMPLETE_PROPS} />);
    const eager = render(
      <HtmlPreviewWrapper {...COMPLETE_PROPS} loading="eager" />,
    );

    expect(eager).toBe(omitted);
    expect(eager).toContain(
      'data-zfb-island="HtmlPreviewWrapperInner"',
    );
    expect(eager).not.toContain("data-zfb-island-skip-ssr");
    expect(eager).toContain("<iframe");
    expect(eager).toContain("srcdoc=");
    expect(eager).not.toMatch(/<iframe[^>]*\sloading=/);
    expect(eager).toContain('title="Lifecycle preview"');
    expect(readSerializedProps(eager)).toEqual(COMPLETE_PROPS);
  });

  it("emits serialized props and no rendered preview subtree in visible mode", () => {
    const html = render(
      <HtmlPreviewWrapper {...COMPLETE_PROPS} loading="visible" />,
    );

    expect(html).toContain(
      'data-zfb-island-skip-ssr="HtmlPreviewWrapperInner"',
    );
    expect(html).toContain('data-when="visible"');
    expect(html).not.toContain('data-zfb-island="');
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("srcdoc=");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("role=\"group\"");
    expect(html).not.toContain("aria-expanded");

    const serialized = readSerializedProps(html);
    expect(serialized).toMatchObject(COMPLETE_PROPS);
    expect(serialized).toHaveProperty("__zudoDocVisibleMount", true);
    expect(serialized).not.toHaveProperty("loading");

    const eager = readSerializedProps(
      render(<HtmlPreviewWrapper {...COMPLETE_PROPS} />),
    );
    const {
      __zudoDocVisibleMount: _visibleMount,
      ...visibleSerializable
    } = serialized;
    expect(visibleSerializable).toEqual(eager);
  });

  it("uses the explicit height for an inert, non-interactive reservation", () => {
    const html = render(
      <HtmlPreviewWrapper
        html="<p>hello</p>"
        height={480}
        loading="visible"
      />,
    );
    const reservation = html.match(
      /<div aria-hidden="true" data-zd-html-preview-reservation[^>]*>/,
    )?.[0];

    expect(reservation).toBeDefined();
    expect(reservation).toContain('style="height:480px;"');
    expect(reservation).not.toMatch(/tabindex|role=|href=|<button/i);
  });

  it.each([undefined, 0, -20])(
    "uses the 200px floor when height is %s",
    (height) => {
      const html = render(
        <HtmlPreviewWrapper
          html="<p>hello</p>"
          height={height}
          loading="visible"
        />,
      );

      expect(html).toContain('style="height:200px;"');
      expect(html).toContain('aria-hidden="true"');
    },
  );

  it("keeps the bare inner export identity and never emits a nested island", () => {
    expect(HtmlPreviewWrapperInner.name).toBe("HtmlPreviewWrapperInner");
    expect(HtmlPreviewWrapperInner.displayName).toBe(
      "HtmlPreviewWrapperInner",
    );

    const inner = render(<HtmlPreviewWrapperInner {...COMPLETE_PROPS} />);
    expect(inner).toContain("<iframe");
    expect(inner).not.toContain("data-zfb-island");

    const visible = render(
      <HtmlPreviewWrapper {...COMPLETE_PROPS} loading="visible" />,
    );
    expect(
      visible.match(/data-zfb-island(?:-skip-ssr)?=/g),
    ).toHaveLength(1);
  });
});
