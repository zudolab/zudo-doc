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

describe("sitemap entries (#4784)", () => {
  function doc(slug: string, data: Record<string, unknown> = {}) {
    return { slug, data: { title: slug, ...data } };
  }

  const collections: Record<string, ReturnType<typeof doc>[]> = {
    docs: [doc("index"), doc("guides/intro"), doc("guides/fallback-only"), doc("guides/undated")],
    "docs-ja": [doc("guides/intro")],
    "docs-v-1.0": [doc("guides/intro")],
  };

  function makeDocsContext(settingsOverrides: Partial<Settings> = {}) {
    return createRouteContext(
      {
        settings: {
          ...DEFAULT_SETTINGS,
          base: "/",
          trailingSlash: true,
          defaultLocale: "en",
          locales: { ja: { label: "JA", dir: "src/content/docs-ja" } },
          docTags: false,
          ...settingsOverrides,
        },
        translations: {},
        tagVocabulary: [],
        colorSchemes: null,
        themePackRegistry: null,
        assetManifest: null,
      },
      {
        stableDocs: (name: string) => (collections[name] ?? []) as never,
      },
    );
  }

  const meta = {
    index: { updatedDate: "2026-01-02T10:00:00Z" },
    "guides/intro": { updatedDate: "2026-03-04T23:30:00-05:00" },
    "guides/fallback-only": { updatedDate: "2025-12-31" },
    "ja/guides/intro": { updatedDate: "2026-05-06T08:00:00+09:00" },
    "guides/undated": { updatedDate: "not a date" },
  };

  function lastmods(entries: Array<{ url: string; lastmod?: string }>) {
    return Object.fromEntries(entries.map((e) => [e.url, e.lastmod ?? null]));
  }

  it("dates latest doc pages from the manifest the visible Updated label reads", () => {
    const byUrl = lastmods(makeDocsContext().enumerateSitemapEntries({ docHistoryMeta: meta }));

    expect(byUrl["/docs/"]).toBe("2026-01-02");
    // Non-UTC offsets resolve to the UTC calendar day, as formatDate shows it.
    expect(byUrl["/docs/guides/intro/"]).toBe("2026-03-05");
    expect(byUrl["/docs/guides/fallback-only/"]).toBe("2025-12-31");
    // A translated page uses its own locale file's history ...
    expect(byUrl["/ja/docs/guides/intro/"]).toBe("2026-05-05");
    // ... and an EN-fallback page uses the default-locale source it renders.
    expect(byUrl["/ja/docs/guides/fallback-only/"]).toBe("2025-12-31");
  });

  it("omits lastmod when no date is known", () => {
    const byUrl = lastmods(makeDocsContext().enumerateSitemapEntries({ docHistoryMeta: meta }));

    // Unparseable manifest date.
    expect(byUrl["/docs/guides/undated/"]).toBeNull();
    // Non-document routes.
    expect(byUrl["/"]).toBeNull();
    expect(byUrl["/ja/"]).toBeNull();
  });

  it("never dates versioned pages from the latest-content manifest", () => {
    const context = makeDocsContext({
      versions: [{ slug: "1.0", label: "1.0", docsDir: "src/content/docs-v1" }],
    } as Partial<Settings>);
    const entries = context.enumerateSitemapEntries({ docHistoryMeta: meta });
    const versioned = entries.filter((e) => e.url.includes("/v/1.0/"));

    expect(versioned.length).toBeGreaterThan(0);
    for (const entry of versioned) expect(entry.lastmod).toBeUndefined();
  });

  it.each([
    ["no options", undefined],
    ["a null manifest", { docHistoryMeta: null }],
    ["an empty manifest (SKIP_DOC_HISTORY=1)", { docHistoryMeta: {} }],
  ])("omits every lastmod with %s", (_label, options) => {
    const entries = makeDocsContext().enumerateSitemapEntries(options);

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry).not.toHaveProperty("lastmod");
  });

  it("lists exactly the enumerateAllRoutes URLs in the same order", () => {
    const context = makeDocsContext();

    expect(context.enumerateSitemapEntries({ docHistoryMeta: meta }).map((e) => e.url)).toEqual([
      ...context.enumerateAllRoutes().keys(),
    ]);
  });
});
