/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";
import type { AssetRecord } from "../../plugins/internal/asset-viewer/types.js";
import { createAssetPageView } from "../index.js";

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

function page(entry: AssetRecord, settings: Record<string, unknown> = {}): string {
  const ctx = makeFakeChromeContext({
    settings: {
      assetViewerDir: "assets",
      assetViewerRoutePrefix: "files",
      bodyFootUtilArea: { viewSourceLink: true },
      githubUrl: "https://github.com/example/docs",
      ...settings,
    },
    overrides: {
      assetManifest: { dir: "assets", routePrefix: "files", entries: [], excerpts: {} },
      t: (key: string) => ({
        "asset.badge": "Asset", "asset.crumb": "Assets", "asset.download": "Download",
        "asset.openRaw": "Open raw", "asset.copy": "Copy", "asset.wrap": "Wrap",
        "asset.linkedFrom": "Linked from", "asset.noPreview": "No preview available.",
        "asset.truncated": "Preview truncated.", "doc.updated": "Updated",
        "doc.viewSource": "View source on GitHub",
      }[key] ?? key),
      absoluteUrl: (path: string) => `https://docs.example${path}`,
    },
  });
  const View = createAssetPageView(ctx);
  return render(<View entry={entry} />);
}

describe("asset page SSG", () => {
  it("renders the wide chrome, naming, header, actions, backlink, metadata and body foot", () => {
    const html = page(asset());
    expect(html).toContain("data-zd-wide");
    expect(html).toContain("data-zd-nosidebar");
    expect(html).not.toContain('aria-label="Table of contents"');
    expect(html).toContain(">Asset</span>");
    expect(html).toContain(">Assets</a>");
    expect(html).toContain("← Back to Brand");
    expect(html).toContain("data-doc-description");
    expect(html).toContain("data-doc-metainfo");
    expect(html).toContain('download href="/assets/img/logo.svg"');
    expect(html).toContain('data-zfb-reload');
    expect(html).toContain("The current logo.");
    expect(html).toContain("Guide › Brand");
    expect(html).toContain("/blob/HEAD/public/assets/img/logo.svg");
    expect(html.match(/>Download<\/a>/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it.each([false, true])("renders SVG through img and exactly one ImageEnlarge marker when imageEnlarge=%s", (imageEnlarge) => {
    const html = page(asset(), { imageEnlarge });
    expect(html).toContain('<figure class="zd-enlargeable zd-asset-stage');
    expect(html).toContain('<img src="/assets/img/logo.svg"');
    expect(html).not.toContain("<svg xmlns=\"http://www.w3.org/2000/svg\"><svg");
    expect(html.match(/data-zfb-island-skip-ssr="ImageEnlarge"/g)).toHaveLength(1);
    expect(html).toContain("zd-asset-media-grid");
  });

  it("applies a configured base exactly once to viewer and raw URLs", () => {
    const html = page(asset(), { base: "/project" });
    expect(html).toContain('src="/project/assets/img/logo.svg"');
    expect(html).toContain('href="https://docs.example/project/files/img/logo.svg/"');
    expect(html).not.toContain("/project/project/");
  });

  it("renders code with a sticky bar, line ids, counter-safe markup, truncation and no media grid", () => {
    const html = page(asset({ path: "src/demo.html", name: "demo.html", dir: "src", kind: "code", mime: "text/html", language: "html", lines: 2, width: undefined, height: undefined, truncated: true, html: '<pre class="hi-root"><code><span class="line" id="L1">one</span><span class="line" id="L2">two</span></code></pre>' }));
    expect(html).toContain("zd-asset-filebar");
    expect(html).toContain('id="L1"');
    expect(html).toContain('id="L2"');
    expect(html).not.toContain('<pre class="hi-root zd-asset-code" data-lang="html"><pre');
    expect(html).toContain("Preview truncated.");
    expect(html).toContain("code-btn-copy");
    expect(html).not.toContain("zd-asset-media-grid");
    expect(html).not.toContain("<iframe");
  });

  it("renders video and sniff-approved PDF in the media grid", () => {
    const video = page(asset({ path: "movie.mp4", name: "movie.mp4", dir: "", kind: "video", mime: "video/mp4", durationSec: 2.5, width: 1280, height: 720 }));
    expect(video).toContain('<video controls preload="metadata" src="/assets/movie.mp4"');
    expect(video).toContain("zd-asset-media-grid");
    const pdf = page(asset({ path: "guide.pdf", name: "guide.pdf", dir: "", kind: "pdf", mime: "application/pdf", width: undefined, height: undefined }));
    expect(pdf).toContain('<iframe title="guide.pdf" src="/assets/guide.pdf#view=FitH"');
    expect(pdf).not.toContain("sandbox=");
    expect(pdf).toContain("zd-asset-media-grid");
  });

  it.each([
    asset({ path: "unsafe.pdf", name: "unsafe.pdf", dir: "", kind: "pdf", mime: "application/pdf", sniffOk: false }),
    asset({ path: "archive.zip", name: "archive.zip", dir: "", kind: "other", mime: "application/zip", previewable: false, linkedFrom: [] }),
  ])("uses the safe fallback for $path", (entry) => {
    const html = page(entry);
    expect(html).toContain("No preview available.");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("zd-asset-media-grid");
  });
});
