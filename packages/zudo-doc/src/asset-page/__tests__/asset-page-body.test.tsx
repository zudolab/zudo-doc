/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import type { AssetRecord } from "../../plugins/internal/asset-viewer/types.js";
import { AssetPageBody, resolveAssetPageLabels } from "../body.js";

// Proves `AssetPageBody` renders from plain props alone — no `ChromeContext`,
// no `@takazudo/zfb*` import anywhere in its module graph (zudolab/zudo-doc#4221).

const TRANSLATIONS: Record<string, string> = {
  "asset.badge": "Asset",
  "asset.crumb": "Assets",
  "asset.download": "Download",
  "asset.openRaw": "Open raw",
  "asset.copy": "Copy",
  "asset.wrap": "Wrap",
  "asset.lines": "{count} lines",
  "asset.linkedFrom": "Linked from",
  "asset.noPreview": "No preview available.",
  "asset.truncated": "Preview truncated.",
  "doc.updated": "Updated",
  "asset.details": "Details",
  "asset.type": "Type",
  "asset.size": "Size",
  "asset.path": "Path",
  "asset.dimensions": "Dimensions",
  "asset.backTo": "Back to",
  "asset.fit": "Fit",
  "asset.actualSize": "1:1",
  "asset.checker": "Checker",
  "asset.dark": "Dark",
  "asset.enlarge": "Enlarge image",
  "asset.detailsCollapse": "Hide details",
  "asset.detailsExpand": "Show details",
  "doc.viewSource": "View source on GitHub",
};

function t(key: string): string {
  return TRANSLATIONS[key] ?? key;
}

function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    path: "img/logo.svg",
    name: "logo.svg",
    dir: "img",
    kind: "image",
    mime: "image/svg+xml",
    bytes: 2048,
    sniffOk: true,
    width: 320,
    height: 160,
    description: "Brand mark",
    updatedDate: "2026-08-30",
    author: "Takazudo",
    linkedFrom: [{ href: "/docs/brand/", title: "Brand", crumb: "Guide › Brand", context: "The current logo." }],
    truncated: false,
    previewable: true,
    ...overrides,
  };
}

describe("AssetPageBody (plain props, no ChromeContext)", () => {
  const labels = resolveAssetPageLabels(t, "en");

  it("renders an image entry with the enlargeable stage and details rail", () => {
    const html = render(
      <AssetPageBody
        entry={asset()}
        locale="en"
        rawUrl="/assets/img/logo.svg"
        labels={labels}
        backLink={asset().linkedFrom[0]}
        viewSourceUrl="https://github.com/example/docs/blob/HEAD/public/assets/img/logo.svg"
        showViewSource
      />,
    );

    expect(html).toContain("data-zd-asset-page");
    expect(html).toContain('<figure class="zd-enlargeable zd-asset-stage');
    expect(html).toContain('<img src="/assets/img/logo.svg"');
    expect(html).toContain("zd-asset-media-grid");
    expect(html).toContain("← Back to Brand");
    expect(html).toContain(">2.0 KB</span>");
    expect(html).toContain("View source on GitHub");
  });

  it("renders a code entry with the highlighted body and line-count facet", () => {
    const html = render(
      <AssetPageBody
        entry={asset({
          path: "src/demo.html",
          name: "demo.html",
          dir: "src",
          kind: "code",
          mime: "text/html",
          language: "html",
          lines: 2,
          width: undefined,
          height: undefined,
          truncated: true,
          html: '<pre class="hi-root"><code><span class="line" id="L1">one</span><span class="line" id="L2">two</span></code></pre>',
        })}
        locale="en"
        rawUrl="/assets/src/demo.html"
        labels={labels}
        showViewSource={false}
      />,
    );

    expect(html).toContain("zd-asset-filebar");
    expect(html).toContain('id="L1"');
    expect(html).toContain('id="L2"');
    expect(html).toContain("Preview truncated.");
    expect(html.match(/2 lines/g)).toHaveLength(2);
    expect(html).not.toContain("View source on GitHub");
  });

  it("renders a PDF entry in an iframe alongside the download fallback", () => {
    const html = render(
      <AssetPageBody
        entry={asset({ path: "guide.pdf", name: "guide.pdf", dir: "", kind: "pdf", mime: "application/pdf", width: undefined, height: undefined })}
        locale="en"
        rawUrl="/assets/guide.pdf"
        labels={labels}
        viewSourceUrl={null}
        showViewSource
      />,
    );

    expect(html).toContain('<iframe title="guide.pdf" src="/assets/guide.pdf#view=FitH"');
    expect(html).not.toContain("sandbox=");
    expect(html).toContain("zd-asset-media-grid");
    // `viewSourceUrl` is null, so `BodyFootUtilArea` self-suppresses even though `showViewSource` is true.
    expect(html).not.toContain("View source on GitHub");
  });
});
