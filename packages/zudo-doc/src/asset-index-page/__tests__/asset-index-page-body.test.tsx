/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import type { AssetIndexEntry } from "../../route-context-payload/types.js";
import { AssetIndexPageBody, resolveAssetIndexPageLabels } from "../body.js";

// Proves `AssetIndexPageBody` renders from plain props alone — no
// `ChromeContext`, no `@takazudo/zfb*` import anywhere in its module graph
// (zudolab/zudo-doc#4223).

const TRANSLATIONS: Record<string, string> = {
  "asset.crumb": "Assets",
  "asset.indexBadge": "Index",
  "asset.indexDescription": "Every managed file.",
  "asset.fileCount": "{count} files",
  "asset.fileCountSingle": "{count} file",
  "asset.folderCount": "{count} folders",
  "asset.folderCountSingle": "{count} folder",
  "asset.expandAll": "Expand all",
  "asset.collapseAll": "Collapse all",
  "asset.indexEmpty": "No assets found.",
  "asset.lines": "{count} lines",
};

function t(key: string): string {
  return TRANSLATIONS[key] ?? key;
}

function asset(overrides: Partial<AssetIndexEntry> = {}): AssetIndexEntry {
  return {
    path: "demo/readme.txt",
    name: "readme.txt",
    dir: "demo",
    kind: "text",
    mime: "text/plain",
    bytes: 1200,
    lines: 12,
    ...overrides,
  };
}

describe("AssetIndexPageBody (plain props, no ChromeContext)", () => {
  const labels = resolveAssetIndexPageLabels(t, "en");

  it("renders the tree, counts, and file links for a populated index", () => {
    const html = render(
      <AssetIndexPageBody
        entries={[
          asset(),
          asset({ path: "demo/deep/logo.png", name: "logo.png", dir: "demo/deep", kind: "image", mime: "image/png", lines: undefined, width: 320, height: 180, bytes: 2048 }),
        ]}
        labels={labels}
        base="/"
        routePrefix="files"
        dir="assets"
      />,
    );

    expect(html).toContain("data-zd-asset-index-page");
    expect(html.match(/<details open>/g)).toHaveLength(2);
    expect(html).toContain('href="/files/demo/readme.txt/"');
    expect(html).toContain('href="/files/demo/deep/logo.png/"');
    expect(html).toContain("2 files");
    expect(html).toContain("2 folders");
    expect(html).toContain("320 × 180");
    expect(html).toContain("public/assets/");
    expect(html).not.toContain("data-zd-asset-index-empty");
  });

  it("forwards the locale segment into file link hrefs", () => {
    const html = render(
      <AssetIndexPageBody entries={[asset()]} labels={labels} base="/" routePrefix="files" dir="assets" locale="ja" />,
    );

    expect(html).toContain('href="/ja/files/demo/readme.txt/"');
  });

  it("renders the empty state while still showing `public/${dir}/` and the page shell", () => {
    const html = render(
      <AssetIndexPageBody entries={[]} labels={labels} base="/" routePrefix="files" dir="assets" />,
    );

    expect(html).toContain("data-zd-asset-index-page");
    expect(html).toContain("data-zd-asset-index-empty");
    expect(html).toContain("No assets found.");
    expect(html).toContain("public/assets/");
    expect(html).not.toContain("<ul data-zd-asset-tree");
  });
});
