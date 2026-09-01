import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../config.js";
import { createRouteContext } from "../../route-context/index.js";
import type { AssetManifest } from "../../route-context-payload/types.js";
import type { Settings } from "../../settings.js";

const manifest: AssetManifest = {
  dir: "assets",
  routePrefix: "media/view",
  entries: [
    {
      path: "public/readme.txt",
      name: "readme.txt",
      dir: "public",
      kind: "text",
      mime: "text/plain",
      bytes: 1,
    },
    {
      path: "private/secret.txt",
      name: "secret.txt",
      dir: "private",
      kind: "text",
      mime: "text/plain",
      bytes: 1,
    },
  ],
  excerpts: {},
};

function makeContext(
  settingsOverrides: Partial<Settings> = {},
  assetManifest: AssetManifest | null = manifest,
) {
  return createRouteContext(
    {
      settings: {
        ...DEFAULT_SETTINGS,
        base: "/site/",
        trailingSlash: true,
        defaultLocale: "en",
        locales: { ja: { label: "JA", dir: "src/content/docs-ja" } },
        assetViewer: true,
        assetViewerIndex: true,
        assetViewerIndexing: { sitemap: true },
        ...settingsOverrides,
      },
      translations: {},
      tagVocabulary: [],
      colorSchemes: null,
      themePackRegistry: null,
      assetManifest,
    },
    { stableDocs: () => [] },
  );
}

describe("asset route enumeration", () => {
  it("emits base-prefixed default-locale index and asset routes", () => {
    const context = makeContext();

    expect(context.enumerateAssetRoutes("en")).toEqual([
      "/site/media/view/",
      "/site/media/view/public/readme.txt/",
      "/site/media/view/private/secret.txt/",
    ]);

    const allRoutes = context.enumerateAllRoutes();
    expect(allRoutes.has("/site/media/view/")).toBe(true);
    expect(allRoutes.has("/site/media/view/public/readme.txt/")).toBe(true);
    expect(allRoutes.has("/site/media/view/private/secret.txt/")).toBe(true);
  });

  it("emits localized index and leaves while filtering default-locale-only paths", () => {
    const context = makeContext({
      defaultLocaleOnlyPrefixes: ["/media/view/private/"],
    });

    expect(context.enumerateAssetRoutes("ja")).toEqual([
      "/site/ja/media/view/",
      "/site/ja/media/view/public/readme.txt/",
    ]);

    const allRoutes = context.enumerateAllRoutes();
    expect(allRoutes.has("/site/ja/media/view/")).toBe(true);
    expect(allRoutes.has("/site/ja/media/view/public/readme.txt/")).toBe(true);
    expect(allRoutes.has("/site/ja/media/view/private/secret.txt/")).toBe(false);
  });

  it("omits the localized index when the whole viewer prefix is default-only", () => {
    const context = makeContext({
      defaultLocaleOnlyPrefixes: ["/media/view/"],
    });

    expect(context.enumerateAssetRoutes("ja")).toEqual([]);
  });

  it.each([
    ["asset viewer disabled", { assetViewer: false }],
    ["sitemap indexing disabled", { assetViewerIndexing: { search: true } }],
  ])("emits no asset routes when %s", (_label, settingsOverrides) => {
    const context = makeContext(settingsOverrides);

    expect(context.enumerateAssetRoutes("en")).toEqual([]);
    expect(context.enumerateAssetRoutes("ja")).toEqual([]);
  });

  it("emits no asset routes without a manifest", () => {
    const context = makeContext({}, null);

    expect(context.enumerateAssetRoutes("en")).toEqual([]);
    expect(context.enumerateAssetRoutes("ja")).toEqual([]);
  });

  it("omits only the index when assetViewerIndex is disabled", () => {
    const context = makeContext({ assetViewerIndex: false });

    expect(context.enumerateAssetRoutes("en")).toEqual([
      "/site/media/view/public/readme.txt/",
      "/site/media/view/private/secret.txt/",
    ]);
  });

  it("falls back to the configured route prefix when the manifest omits it", () => {
    const context = makeContext(
      { assetViewerRoutePrefix: "files" },
      { ...manifest, routePrefix: undefined as unknown as string },
    );

    expect(context.enumerateAssetRoutes("en")).toEqual([
      "/site/files/",
      "/site/files/public/readme.txt/",
      "/site/files/private/secret.txt/",
    ]);
  });
});
