/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import type { Child } from "@takazudo/zfb/zudo-react";

import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import {
  HtmlPreviewWrapper,
  HtmlPreviewWrapperInner,
  type HtmlPreviewWrapperProps,
} from "../index.js";

function renderWrapperSsr(node: Child): string {
  type ZfbTestMetadata = {
    zudoReactBuild?: string;
    zudoReactIslands?: readonly string[];
  };
  const runtime = globalThis as typeof globalThis & {
    __zfb?: ZfbTestMetadata;
  };
  const previous = runtime.__zfb;
  runtime.__zfb = {
    ...previous,
    zudoReactBuild: "html-preview-loading-tests",
    zudoReactIslands: [
      ...new Set([...(previous?.zudoReactIslands ?? []), "HtmlPreviewWrapperInner"]),
    ],
  };
  try {
    return renderSsr(node);
  } finally {
    if (previous === undefined) delete runtime.__zfb;
    else runtime.__zfb = previous;
  }
}

function parseHtml(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

function readSerializedProps(html: string): Record<string, unknown> {
  const marker = parseHtml(html).querySelector<HTMLElement>(
    "[data-zfb-island], [data-zfb-island-skip-ssr]",
  );
  const encoded = marker?.getAttribute("data-props");
  expect(encoded).toBeDefined();
  return JSON.parse(encoded ?? "{}") as Record<string, unknown>;
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
    const omitted = renderWrapperSsr(<HtmlPreviewWrapper {...COMPLETE_PROPS} />);
    const eager = renderWrapperSsr(
      <HtmlPreviewWrapper {...COMPLETE_PROPS} loading="eager" />,
    );
    const host = parseHtml(eager);

    expect(eager).toBe(omitted);
    expect(eager).toContain('data-zfb-island="HtmlPreviewWrapperInner"');
    expect(eager).not.toContain("data-zfb-island-skip-ssr");
    expect(eager).toContain("data-zd-html-preview-frame-host");
    // zfb 3.1.0 rejects iframe children in islands (#3361); activation creates it.
    expect(eager).not.toContain("<iframe");
    expect(eager).not.toMatch(/\sloading=/);
    expect(host.textContent).toContain("Lifecycle preview");
    expect(readSerializedProps(eager)).toEqual(COMPLETE_PROPS);
  });

  it("uses native visible skip-SSR scheduling with the full public props", () => {
    const html = renderWrapperSsr(
      <HtmlPreviewWrapper {...COMPLETE_PROPS} loading="visible" />,
    );
    const host = parseHtml(html);
    const marker = host.querySelector<HTMLElement>(
      '[data-zfb-island-skip-ssr="HtmlPreviewWrapperInner"]',
    );

    expect(marker).not.toBeNull();
    expect(marker?.getAttribute("data-when")).toBe("visible");
    expect(html).not.toContain('data-zfb-island="');
    expect(html).not.toContain("data-zd-html-preview-frame-host");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("<button");
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain("aria-expanded");

    const serialized = readSerializedProps(html);
    expect(serialized).toEqual(COMPLETE_PROPS);
    expect(serialized).not.toHaveProperty("loading");
    expect(serialized).not.toHaveProperty("__zudoDocVisibleMount");
  });

  it("uses the explicit height for an inert, non-interactive reservation", () => {
    const html = renderWrapperSsr(
      <HtmlPreviewWrapper
        html="<p>hello</p>"
        height={480}
        loading="visible"
      />,
    );
    const reservation = parseHtml(html).querySelector<HTMLElement>(
      "[data-zd-html-preview-reservation]",
    );

    expect(reservation).not.toBeNull();
    expect(html).toContain('style="height:480px;"');
    expect(reservation?.getAttribute("aria-hidden")).toBe("true");
    expect(reservation?.style.height).toBe("480px");
    expect(reservation?.hasAttribute("tabindex")).toBe(false);
    expect(reservation?.hasAttribute("role")).toBe(false);
    expect(reservation?.hasAttribute("href")).toBe(false);
    expect(reservation?.querySelector("button")).toBeNull();
  });

  it.each([undefined, 0, -20])(
    "uses the 200px floor when height is %s",
    (height) => {
      const props: HtmlPreviewWrapperProps = {
        html: "<p>hello</p>",
        loading: "visible",
        ...(height === undefined ? {} : { height }),
      };
      const html = renderWrapperSsr(
        <HtmlPreviewWrapper {...props} />,
      );
      const reservation = parseHtml(html).querySelector<HTMLElement>(
        "[data-zd-html-preview-reservation]",
      );

      expect(reservation?.style.height).toBe("200px");
      expect(reservation?.getAttribute("aria-hidden")).toBe("true");
    },
  );

  it("keeps the bare inner export identity and never emits a nested island", () => {
    expect(HtmlPreviewWrapperInner.name).toBe("HtmlPreviewWrapperInner");
    expect(HtmlPreviewWrapperInner.displayName).toBe(
      "HtmlPreviewWrapperInner",
    );

    const inner = renderSsr(
      <HtmlPreviewWrapperInner {...COMPLETE_PROPS} />,
    );
    expect(inner).toContain("data-zd-html-preview-frame-host");
    expect(inner).not.toContain("<iframe");
    expect(inner).not.toContain("data-zfb-island");

    const visible = renderWrapperSsr(
      <HtmlPreviewWrapper {...COMPLETE_PROPS} loading="visible" />,
    );
    expect(
      parseHtml(visible).querySelectorAll(
        "[data-zfb-island], [data-zfb-island-skip-ssr]",
      ),
    ).toHaveLength(1);
  });
});
