import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  collectAssetPageDescriptors,
  type AssetScanProjection,
} from "../asset-pages.js";
import { scanAssets, scanAssetsSync } from "../scan.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(): { root: string; assetRoot: string } {
  const root = mkdtempSync(join(tmpdir(), "zudo-asset-pages-"));
  roots.push(root);
  const assetRoot = join(root, "public", "downloads");
  mkdirSync(join(assetRoot, "nested"), { recursive: true });
  writeFileSync(join(assetRoot, "read me.txt"), "plain text");
  writeFileSync(join(assetRoot, "nested", "資料.json"), '{"ok":true}\n');
  writeFileSync(join(assetRoot, "nested", "photo.bin"), Buffer.from([0, 1, 2, 3]));
  writeFileSync(join(assetRoot, "nested", "corrupt.txt"), Buffer.from([0, 1, 2, 3]));
  return { root, assetRoot };
}

function projection(
  overrides: Partial<AssetScanProjection> = {},
): AssetScanProjection {
  return {
    assetViewer: true,
    assetViewerIndexing: { search: true, llmsTxt: true, sitemap: true },
    assetViewerDir: "downloads",
    assetViewerRoutePrefix: "files",
    assetViewerExclude: [],
    base: "/site/",
    locales: { ja: { dir: "src/content/docs-ja" } },
    defaultLocaleOnlyPrefixes: [],
    ...overrides,
  };
}

describe("scanAssetsSync", () => {
  it("shares the async scan contract's results", async () => {
    const { root } = fixture();
    expect(scanAssetsSync(root, "downloads")).toEqual(await scanAssets(root, "downloads"));
  });
});

describe("collectAssetPageDescriptors", () => {
  it("normalizes nested Unicode/space paths, sizes, text classification, URLs, and locales", () => {
    const { root } = fixture();
    const descriptors = collectAssetPageDescriptors({
      projectRoot: root,
      assetScan: projection(),
      consumer: "search",
    });

    expect(descriptors).toHaveLength(8);
    expect(descriptors.filter((entry) => entry.locale === undefined)).toHaveLength(4);
    expect(descriptors.filter((entry) => entry.locale === "ja")).toHaveLength(4);
    expect(descriptors.find((entry) => entry.path === "read me.txt")).toEqual({
      path: "read me.txt",
      url: "/site/files/read%20me.txt/",
      isText: true,
      size: 10,
    });
    expect(descriptors.find((entry) => entry.path === "nested/資料.json" && entry.locale === "ja")).toEqual({
      path: "nested/資料.json",
      url: "/site/ja/files/nested/%E8%B3%87%E6%96%99.json/",
      locale: "ja",
      isText: true,
      size: 12,
    });
    expect(descriptors.find((entry) => entry.path === "nested/photo.bin")).toMatchObject({
      isText: false,
      size: 4,
    });
    expect(descriptors.find((entry) => entry.path === "nested/corrupt.txt")).toMatchObject({
      isText: false,
      size: 4,
    });
  });

  it("filters non-default locale pages under defaultLocaleOnlyPrefixes", () => {
    const { root } = fixture();
    const descriptors = collectAssetPageDescriptors({
      projectRoot: root,
      assetScan: projection({ defaultLocaleOnlyPrefixes: ["/files/nested/"] }),
      consumer: "llmsTxt",
    });

    expect(descriptors.filter((entry) => entry.locale === undefined)).toHaveLength(4);
    expect(descriptors.filter((entry) => entry.locale === "ja")).toEqual([
      expect.objectContaining({ path: "read me.txt", locale: "ja" }),
    ]);
  });

  it.each([
    ["assetViewer off", projection({ assetViewer: false }), "search"],
    ["all indexing off", projection({ assetViewerIndexing: false }), "search"],
    ["consumer subflag off", projection({ assetViewerIndexing: { llmsTxt: true } }), "search"],
  ] as const)("returns no descriptors when %s", (_name, assetScan, consumer) => {
    const { root } = fixture();
    expect(collectAssetPageDescriptors({ projectRoot: root, assetScan, consumer })).toEqual([]);
  });
});
