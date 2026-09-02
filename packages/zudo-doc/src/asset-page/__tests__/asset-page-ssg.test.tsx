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

function page(
  entry: AssetRecord,
  settings: Record<string, unknown> = {},
  translationOverrides: Record<string, string> = {},
  locale?: string,
): string {
  const base = String(settings.base ?? "/");
  const routePrefix = String(settings.assetViewerRoutePrefix ?? "files");
  const dir = String(settings.assetViewerDir ?? "assets");
  const withBase = (path: string) =>
    `${base === "/" ? "" : `/${base.replace(/^\/+|\/+$/g, "")}`}${path}`;
  const ctx = makeFakeChromeContext({
    settings: {
      assetViewerDir: "assets",
      assetViewerRoutePrefix: "files",
      bodyFootUtilArea: { viewSourceLink: true },
      githubUrl: "https://github.com/example/docs",
      ...settings,
    },
    overrides: {
      assetManifest: { dir, routePrefix, entries: [], excerpts: {} },
      withBase,
      t: (key: string) => ({
        "asset.badge": "Asset", "asset.crumb": "Assets", "asset.download": "Download",
        "asset.openRaw": "Open raw", "asset.copy": "Copy", "asset.wrap": "Wrap",
        "asset.lines": "{count} lines",
        "asset.linkedFrom": "Linked from", "asset.noPreview": "No preview available.",
        "asset.truncated": "Preview truncated.", "doc.updated": "Updated",
        "asset.details": "Details", "asset.type": "Type", "asset.size": "Size",
        "asset.path": "Path", "asset.dimensions": "Dimensions",
        "asset.backTo": "Back to", "asset.fit": "Fit", "asset.actualSize": "1:1",
        "asset.checker": "Checker", "asset.dark": "Dark", "asset.enlarge": "Enlarge image",
        "doc.viewSource": "View source on GitHub",
        ...translationOverrides,
      }[key] ?? key),
      absoluteUrl: (path: string) => `https://docs.example${path}`,
    },
  });
  const View = createAssetPageView(ctx);
  return render(<View entry={entry} locale={locale} />);
}

describe("asset page SSG", () => {
  it("renders the wide chrome, naming, header, actions, backlink, metadata and body foot", () => {
    const html = page(asset());
    expect(html).toContain("data-zd-wide");
    expect(html).toContain("data-zd-nosidebar");
    expect(html).not.toContain('aria-label="Table of contents"');
    expect(html).not.toContain("<aside");
    expect(html).toContain(">Asset</span>");
    expect(html).toContain(">Assets</span>");
    expect(html).toContain('<span class="text-fg">Assets</span>');
    expect(html).not.toMatch(/<a href="\/files\/"[^>]*>Assets<\/a>/);
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

  it("links the Assets crumb only when the index is enabled", () => {
    const disabled = page(asset(), { assetViewerIndex: false });
    expect(disabled).toContain('<span class="text-fg">Assets</span>');
    expect(disabled).not.toMatch(/<a href="\/files\/"[^>]*>Assets<\/a>/);

    const enabled = page(asset(), { assetViewerIndex: true });
    expect(enabled).toMatch(/<a href="\/files\/"[^>]*>Assets<\/a>/);

    const custom = page(asset(), {
      assetViewerIndex: true,
      base: "/pj/x/",
      assetViewerRoutePrefix: "media/view",
    });
    expect(custom).toMatch(/<a href="\/pj\/x\/media\/view\/"[^>]*>Assets<\/a>/);
    expect(custom).not.toContain("/pj/x/pj/x/");
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

  it("localizes page labels and uses its own locale URL as canonical", () => {
    const html = page(asset(), {}, {
      "asset.badge": "アセット",
      "asset.crumb": "アセット一覧",
      "asset.details": "詳細",
      "asset.type": "種類",
      "asset.size": "サイズ",
      "asset.path": "パス",
      "asset.dimensions": "寸法",
      "asset.backTo": "戻る",
      "asset.fit": "全体表示",
      "asset.actualSize": "1:1",
      "asset.checker": "チェッカー",
      "asset.dark": "ダーク",
      "asset.enlarge": "画像を拡大",
      "doc.updated": "更新日",
    }, "ja");
    expect(html).toContain('lang="ja"');
    expect(html).toContain('href="https://docs.example/ja/files/img/logo.svg/"');
    expect(html).toContain("← 戻る Brand");
    expect(html).toContain(">詳細</h2>");
    expect(html).toContain(">種類</dt>");
    expect(html).toContain(">全体表示</button>");
    expect(html).toContain(">チェッカー</button>");
    expect(html).toContain('aria-label="画像を拡大"');
    expect(html).not.toContain('href="https://docs.example/files/img/logo.svg/"');
  });

  it("prefers the latest same-locale reference for a localized Back to link", () => {
    const html = page(asset({
      linkedFrom: [
        { href: "/docs/brand/", title: "Brand", crumb: "Guide › Brand", context: "Default locale." },
        { href: "/ja/docs/brand/", title: "ブランド", crumb: "ガイド › ブランド", context: "Latest Japanese reference.", locale: "ja" },
        { href: "/ja/v/v1/docs/brand/", title: "旧ブランド", crumb: "ガイド › 旧ブランド", context: "Versioned Japanese reference.", locale: "ja", version: "v1" },
      ],
    }), {}, { "asset.backTo": "戻る" }, "ja");

    expect(html).toContain('<a href="/ja/docs/brand/" class="text-muted hover:text-accent focus-visible:text-accent hover:underline focus-visible:underline">← 戻る ブランド</a>');
    expect(html).not.toContain('← 戻る Brand');
    const linkedFromHtml = html.slice(html.indexOf(">Linked from</h2>"));
    expect(linkedFromHtml.indexOf('href="/docs/brand/"')).toBeLessThan(linkedFromHtml.indexOf('href="/ja/docs/brand/"'));
    expect(linkedFromHtml.indexOf('href="/ja/docs/brand/"')).toBeLessThan(linkedFromHtml.indexOf('href="/ja/v/v1/docs/brand/"'));
  });

  it("falls back to the first reference when a localized page has no same-locale reference", () => {
    const html = page(asset({
      linkedFrom: [
        { href: "/docs/brand/", title: "Brand", crumb: "Guide › Brand", context: "Default locale." },
        { href: "/fr/docs/marque/", title: "Marque", crumb: "Guide › Marque", context: "French reference.", locale: "fr" },
      ],
    }), {}, { "asset.backTo": "戻る" }, "ja");

    expect(html).toContain('<a href="/docs/brand/" class="text-muted hover:text-accent focus-visible:text-accent hover:underline focus-visible:underline">← 戻る Brand</a>');
    expect(html).not.toContain('← 戻る Marque');
  });

  it("uses the shared asset size formatter in page metadata", () => {
    const html = page(asset({ bytes: 2_900 }));
    expect(html).toContain(">2.9 KB</span>");
    expect(html).not.toContain("2.8 KB");
  });

  it("uses the locale line-count template in header and code metadata", () => {
    const html = page(
      asset({
        path: "src/demo.js",
        name: "demo.js",
        dir: "src",
        kind: "code",
        mime: "text/javascript",
        language: "javascript",
        lines: 2,
        width: undefined,
        height: undefined,
        html: '<pre class="hi-root"><code><span class="line" id="L1">one</span></code></pre>',
      }),
      {},
      { "asset.lines": "{count} source rows" },
    );
    expect(html.match(/2 source rows/g)).toHaveLength(2);
    expect(html).not.toContain("2 lines");
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
    const gridStart = html.indexOf('<div class="zd-asset-media-grid">');
    const mainStart = html.indexOf('<div class="min-w-0">', gridStart);
    const railStart = html.indexOf('<div class="zd-asset-media-rail">', gridStart);
    const detailsBoxStart = html.indexOf('<div class="rounded border border-muted p-hsp-lg">', railStart);
    const detailsHeadingStart = html.indexOf(">Details</h2>", detailsBoxStart);
    const linkedHeadingStart = html.indexOf(">Linked from</h2>", railStart);
    const firstActionsStart = html.indexOf("data-zd-asset-actions");
    const bottomActionsStart = html.indexOf("data-zd-asset-actions", firstActionsStart + 1);
    const sourceStart = html.indexOf("View source on GitHub");
    const mediaGrid = html.slice(gridStart, bottomActionsStart);

    expect(html).toContain("No preview available.");
    expect(gridStart).toBeGreaterThan(-1);
    expect(mainStart).toBe(gridStart + '<div class="zd-asset-media-grid">'.length);
    expect(railStart).toBeGreaterThan(mainStart);
    expect(html.slice(gridStart, railStart)).toMatch(/^<div class="zd-asset-media-grid"><div class="min-w-0">[\s\S]*<\/div>$/);
    expect(html.slice(railStart)).toMatch(/^<div class="zd-asset-media-rail"><div class="rounded border border-muted p-hsp-lg">/);
    const downloadPanelStart = html.indexOf('<section class="rounded border border-dashed border-muted p-hsp-xl text-center">', gridStart);
    expect(firstActionsStart).toBeGreaterThan(-1);
    expect(firstActionsStart).toBeLessThan(gridStart);
    expect(downloadPanelStart).toBeGreaterThan(mainStart);
    expect(downloadPanelStart).toBeLessThan(railStart);
    expect(mediaGrid).toContain('data-zd-asset-action="copy-url"');
    expect(detailsBoxStart).toBeGreaterThan(railStart);
    expect(detailsHeadingStart).toBeGreaterThan(detailsBoxStart);
    expect(bottomActionsStart).toBeGreaterThan(detailsBoxStart);
    expect(sourceStart).toBeGreaterThan(bottomActionsStart);
    expect(html).not.toContain("<iframe");
    expect(mediaGrid).not.toContain("zd-asset-code");
    expect(mediaGrid).not.toContain("zd-asset-filebar");
    if (entry.linkedFrom.length > 0) {
      expect(linkedHeadingStart).toBeGreaterThan(detailsBoxStart);
      expect(linkedHeadingStart).toBeLessThan(bottomActionsStart);
      expect(mediaGrid).toContain("Guide › Brand");
      expect(mediaGrid).toContain("The current logo.");
    } else {
      expect(linkedHeadingStart).toBe(-1);
    }
  });
});
