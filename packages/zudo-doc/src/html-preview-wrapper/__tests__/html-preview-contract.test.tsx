/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import type { Child } from "@takazudo/zfb/zudo-react";

import {
  renderIsland,
  renderSsr,
} from "../../__tests__/helpers/zudo-react.js";
import {
  HtmlPreview,
  HtmlPreviewWrapper,
  HtmlPreviewWrapperInner,
  PreviewBase,
  type HtmlPreviewLabels,
} from "../index.js";

const codeBlocks = [
  { language: "html", title: "HTML", code: "<p>hello</p>" },
];

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
    zudoReactBuild: "html-preview-contract",
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

function renderBase(
  props: Partial<Parameters<typeof PreviewBase>[0]> = {},
): string {
  return renderSsr(
    <PreviewBase
      srcdoc="<!doctype html><html><body>hello</body></html>"
      syncDelay={0}
      codeBlocks={codeBlocks}
      {...props}
    />,
  );
}

function readIslandProps(html: string): Record<string, unknown> {
  const host = document.createElement("div");
  host.innerHTML = html;
  const marker = host.querySelector<HTMLElement>(
    "[data-zfb-island], [data-zfb-island-skip-ssr]",
  );
  const encoded = marker?.getAttribute("data-props");
  expect(encoded).toBeDefined();
  return JSON.parse(encoded ?? "{}") as Record<string, unknown>;
}

async function mountPreview(props: Parameters<typeof HtmlPreview>[0]) {
  const view = await renderIsland(HtmlPreview, props, {
    identity: { component: "HtmlPreview", build: "html-preview-contract" },
  });
  expect(view.diagnostics).toEqual([]);
  return view;
}

async function mountWrapperInner(
  props: Parameters<typeof HtmlPreviewWrapperInner>[0],
) {
  const view = await renderIsland(HtmlPreviewWrapperInner, props, {
    identity: {
      component: "HtmlPreviewWrapperInner",
      build: "html-preview-contract",
    },
  });
  expect(view.diagnostics).toEqual([]);
  return view;
}

describe("HtmlPreview localized labels and control contract", () => {
  it("SSR-renders all English labels and both control regions by default", () => {
    const html = renderSsr(<HtmlPreview html="<p>hello</p>" defaultOpen />);

    expect(html).toContain('aria-label="Viewport size"');
    expect(html).toContain(">Mobile</button>");
    expect(html).toContain(">Tablet</button>");
    expect(html).toContain(">Full</button>");
    expect(html).toContain(">Hide code</button>");
    expect(html).toContain(">HTML</span>");
    expect(html).toContain("data-zd-html-preview-frame-host");
    expect(html).not.toContain("<iframe");
  });

  it("overrides only supplied labels and treats undefined as omitted", () => {
    const labels: Partial<HtmlPreviewLabels> = {
      mobile: "Mobil",
      tablet: undefined,
    };
    const html = renderSsr(
      <HtmlPreview html="<p>hello</p>" labels={labels} defaultOpen />,
    );

    expect(html).toContain(">Mobil</button>");
    expect(html).toContain(">Tablet</button>");
    expect(html).toContain(">Full</button>");
    expect(html).toContain('aria-label="Viewport size"');
    expect(html).toContain(">Hide code</button>");
  });

  it("uses labels.preview for the created iframe unless an author title is set", async () => {
    const fallback = await mountPreview({
      html: "<p>hello</p>",
      labels: { preview: "Aperçu" },
    });
    const authored = await mountPreview({
      html: "<p>hello</p>",
      title: "Author title",
      labels: { preview: "Aperçu" },
    });

    try {
      expect(fallback.root.querySelector("iframe")?.getAttribute("title")).toBe(
        "Aperçu",
      );
      expect(authored.root.querySelector("iframe")?.getAttribute("title")).toBe(
        "Author title",
      );
    } finally {
      fallback.dispose();
      authored.dispose();
    }
  });

  it("serializes direct document metadata with low-level English fallback", async () => {
    const localized = await mountPreview({
      html: "<p>hello</p>",
      lang: "pt-BR-x-demo",
      title: "Olá & preview",
    });
    const fallback = await mountPreview({ html: "<p>hello</p>", lang: "  " });

    try {
      expect(localized.root.querySelector("iframe")?.srcdoc).toContain(
        '<html lang="pt-BR-x-demo">',
      );
      expect(localized.root.querySelector("iframe")?.srcdoc).toContain(
        "<title>Olá &amp; preview</title>",
      );
      expect(fallback.root.querySelector("iframe")?.srcdoc).toContain(
        '<html lang="en">',
      );
      expect(fallback.root.querySelector("iframe")?.srcdoc).toContain(
        "<title>Preview</title>",
      );
    } finally {
      localized.dispose();
      fallback.dispose();
    }
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
    const host = document.createElement("div");
    host.innerHTML = html;

    expect(html).toContain(">Preview title</span>");
    expect(html).not.toContain('role="group"');
    expect(html).not.toContain(">Mobile</button>");
    expect(html).not.toContain(">Tablet</button>");
    expect(html).not.toContain(">Full</button>");
    expect(html).toContain('style="width:100%"');
    expect(host.querySelector<HTMLElement>(".resize-x")?.style.width).toBe(
      "100%",
    );
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
    expect(html).toContain("data-zd-html-preview-frame-host");
    expect(html).not.toContain("<iframe");
  });

  it("keeps one visible island marker and forwards the public props through the wrapper", () => {
    const html = renderWrapperSsr(
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
    expect(html).not.toContain('data-zfb-island="HtmlPreviewWrapper"');
    expect(readIslandProps(html)).toMatchObject({
      html: "<p>hello</p>",
      labels: { mobile: "Mobil", preview: "Aperçu" },
      showSource: false,
      showViewportControls: false,
    });
  });

  it("forwards language and localized document-title fallback through the wrapper", async () => {
    const view = await mountWrapperInner({
      html: "<p>hello</p>",
      lang: "de-CH-1996",
      labels: { preview: "Vorschau" },
    });

    try {
      const iframe = view.root.querySelector("iframe");
      expect(iframe?.getAttribute("title")).toBe("Vorschau");
      expect(iframe?.srcdoc).toContain('<html lang="de-CH-1996">');
      expect(iframe?.srcdoc).toContain("<title>Vorschau</title>");
    } finally {
      view.dispose();
    }
  });
});
