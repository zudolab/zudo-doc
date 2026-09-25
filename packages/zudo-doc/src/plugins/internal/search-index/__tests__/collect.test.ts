import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { collectSearchEntries } from "../collect.js";
import type { AssetScanProjection } from "../../asset-viewer/asset-pages.js";
import { MAX_BODY_LENGTH, type SearchIndexConfig } from "../types.js";

let docsDir: string;

beforeEach(() => {
  docsDir = resolve(
    tmpdir(),
    `search-index-collect-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(docsDir, { recursive: true });
});

afterEach(() => {
  rmSync(docsDir, { recursive: true, force: true });
});

function writeDoc(relPath: string, frontmatter: string, body: string): void {
  const full = join(docsDir, relPath);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, `---\n${frontmatter}\n---\n\n${body}\n`);
}

function writeAsset(relPath: string, body: string | Uint8Array): void {
  const full = join(docsDir, "public", "downloads", relPath);
  mkdirSync(resolve(full, ".."), { recursive: true });
  writeFileSync(full, body);
}

function assetConfig(
  overrides: Partial<AssetScanProjection> = {},
  configOverrides: Partial<SearchIndexConfig> = {},
): SearchIndexConfig {
  return {
    docsDir,
    projectRoot: docsDir,
    base: "/site/",
    assetScan: {
      assetViewer: true,
      assetViewerIndexing: { search: true },
      assetViewerDir: "downloads",
      assetViewerRoutePrefix: "files",
      assetViewerExclude: [],
      base: "/site/",
      locales: { ja: { dir: "src/content/docs-ja" } },
      defaultLocaleOnlyPrefixes: [],
      ...overrides,
    },
    ...configOverrides,
  };
}

describe("collectSearchEntries frontmatter slug override", () => {
  it("uses the filesystem slug when no override is declared", () => {
    writeDoc("guides/intro.mdx", 'title: "Intro"', "Hello.");

    const entries = collectSearchEntries({ docsDir });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("guides/intro");
    expect(entries[0]?.url).toBe("/docs/guides/intro");
  });

  it("emits the overridden URL for a slug-overridden entry (route-layer parity)", () => {
    writeDoc(
      "guides/getting-started-quickly.mdx",
      'title: "Quickstart"\nslug: quickstart',
      "Fast start.",
    );

    const entries = collectSearchEntries({ docsDir });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("/docs/quickstart");
    expect(entries[0]?.id).toBe("quickstart");
  });

  it("applies the override to locale entries too", () => {
    const jaDir = join(docsDir, "..", `${docsDir.split("/").pop()}-ja`);
    mkdirSync(jaDir, { recursive: true });
    writeFileSync(
      join(jaDir, "getting-started-quickly.mdx"),
      '---\ntitle: "クイックスタート"\nslug: quickstart\n---\n\n速い。\n',
    );

    try {
      const entries = collectSearchEntries({
        docsDir,
        locales: { ja: { dir: jaDir } },
      });
      const ja = entries.find((e) => e.id.startsWith("ja/"));
      expect(ja?.url).toBe("/ja/docs/quickstart");
      expect(ja?.id).toBe("ja/quickstart");
    } finally {
      rmSync(jaDir, { recursive: true, force: true });
    }
  });
});

describe("collectSearchEntries asset pages", () => {
  it("indexes text and binary assets with localized route parity", () => {
    // Comfortably longer than MAX_BODY_LENGTH so the excerpt is truncated
    // regardless of the configured default.
    const text = "0123456789".repeat(Math.ceil(MAX_BODY_LENGTH / 10) + 10);
    writeAsset("nested/資料 file.txt", text);
    writeAsset("image.bin", new Uint8Array([0, 1, 2, 3]));

    const entries = collectSearchEntries(assetConfig());
    const textEntries = entries.filter((entry) => entry.title === "資料 file.txt");
    const binaryEntries = entries.filter((entry) => entry.title === "image.bin");

    expect(textEntries).toHaveLength(2);
    expect(textEntries).toEqual([
      {
        id: "asset:files/nested/資料 file.txt",
        title: "資料 file.txt",
        body: text.substring(0, MAX_BODY_LENGTH),
        url: "/site/files/nested/%E8%B3%87%E6%96%99%20file.txt/",
        description: "nested/資料 file.txt",
      },
      {
        id: "asset:ja/files/nested/資料 file.txt",
        title: "資料 file.txt",
        body: text.substring(0, MAX_BODY_LENGTH),
        url: "/site/ja/files/nested/%E8%B3%87%E6%96%99%20file.txt/",
        description: "nested/資料 file.txt",
      },
    ]);
    expect(binaryEntries).toEqual([
      {
        id: "asset:files/image.bin",
        title: "image.bin",
        body: "",
        url: "/site/files/image.bin/",
        description: "image.bin",
      },
      {
        id: "asset:ja/files/image.bin",
        title: "image.bin",
        body: "",
        url: "/site/ja/files/image.bin/",
        description: "image.bin",
      },
    ]);
  });

  it("keeps a multibyte text excerpt at the default character cap", () => {
    const unit = "資料🙂";
    const text = unit.repeat(Math.ceil(MAX_BODY_LENGTH / unit.length) + 10);
    writeAsset("unicode.txt", text);

    const entries = collectSearchEntries(assetConfig()).filter(
      (entry) => entry.title === "unicode.txt",
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]?.body).toBe(text.substring(0, MAX_BODY_LENGTH));
    expect(entries[1]?.body).toBe(text.substring(0, MAX_BODY_LENGTH));
  });

  it("applies a custom maxBodyLength to a multibyte asset excerpt", () => {
    const customCap = 50;
    const unit = "日本語資料🙂";
    const text = unit.repeat(Math.ceil(customCap / unit.length) + 10);
    writeAsset("unicode-custom.txt", text);

    const entries = collectSearchEntries(
      assetConfig(undefined, { maxBodyLength: customCap }),
    ).filter((entry) => entry.title === "unicode-custom.txt");

    expect(entries).toHaveLength(2);
    expect(text.length).toBeGreaterThan(customCap);
    expect(entries[0]?.body).toBe(text.substring(0, customCap));
    expect(entries[1]?.body).toBe(text.substring(0, customCap));
  });

  it("only emits a localized asset when its generated route exists", () => {
    writeAsset("public/secret.txt", "default only");

    const entries = collectSearchEntries(
      assetConfig({ defaultLocaleOnlyPrefixes: ["/files/public/"] }),
    );

    expect(entries).toEqual([
      {
        id: "asset:files/public/secret.txt",
        title: "secret.txt",
        body: "default only",
        url: "/site/files/public/secret.txt/",
        description: "public/secret.txt",
      },
    ]);
  });

  it.each([
    ["asset viewer disabled", { assetViewer: false }],
    ["search indexing disabled", { assetViewerIndexing: { llmsTxt: true } }],
    ["all indexing disabled", { assetViewerIndexing: false }],
  ] as const)("does not index assets when %s", (_name, overrides) => {
    writeAsset("visible.txt", "not indexed");

    expect(collectSearchEntries(assetConfig(overrides))).toEqual([]);
  });

  it("keeps the frozen search entry shape for assets", () => {
    writeAsset("visible.txt", "asset body");

    const [entry] = collectSearchEntries(assetConfig());
    expect(Object.keys(entry ?? {}).sort()).toEqual([
      "body",
      "description",
      "id",
      "title",
      "url",
    ]);
  });
});

describe("collectSearchEntries maxBodyLength", () => {
  it("matches a word after character 300 under the default cap (zudolab/zudo-doc#4398 regression)", () => {
    // The historical bug: the widget's indexOf search can only match text the
    // index actually stored, and the old default (300) cut every page well
    // before its full body. Placing the unique word past 300 chars but well
    // inside the new 3000-char default proves it survives into the index.
    const filler = "lorem ipsum dolor sit amet consectetur ".repeat(10);
    expect(filler.length).toBeGreaterThan(300);
    expect(filler.length).toBeLessThan(MAX_BODY_LENGTH);
    writeDoc(
      "guides/long-page.mdx",
      'title: "Long page"',
      `${filler}uniqueneedle follows.`,
    );

    const [entry] = collectSearchEntries({ docsDir });
    expect(entry?.body).toContain("uniqueneedle");
    expect(entry?.body.indexOf("uniqueneedle")).toBeGreaterThan(300);
  });

  it("truncates a doc body at a custom maxBodyLength", () => {
    const customCap = 40;
    const body = "a".repeat(customCap + 20);
    writeDoc("guides/custom-cap.mdx", 'title: "Custom cap"', body);

    const [entry] = collectSearchEntries({ docsDir, maxBodyLength: customCap });
    expect(entry?.body).toHaveLength(customCap);
    expect(entry?.body).toBe(body.substring(0, customCap));
  });

  it.each([
    [0, "zero"],
    [-10, "negative"],
    [3.5, "non-integer"],
  ])("throws for an invalid maxBodyLength (%s is %s)", (invalid, _label) => {
    writeDoc("guides/intro.mdx", 'title: "Intro"', "Hello.");

    expect(() => collectSearchEntries({ docsDir, maxBodyLength: invalid })).toThrow(
      /searchMaxBodyLength/,
    );
  });
});
