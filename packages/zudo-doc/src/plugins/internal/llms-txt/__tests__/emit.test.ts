import { afterEach, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { emitLlmsTxt } from "../emit.js";
import { LLMS_ASSET_TEXT_CAP_BYTES } from "../types.js";
import type { AssetScanProjection } from "../../asset-viewer/asset-pages.js";
import { agentPageKey } from "../../../../agent-docs/identity.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): {
  root: string;
  docsDir: string;
  jaDir: string;
  outDir: string;
  assetScan: AssetScanProjection;
} {
  const root = mkdtempSync(join(tmpdir(), "zudo-llms-emit-"));
  roots.push(root);
  const docsDir = join(root, "src/content/docs");
  const jaDir = join(root, "src/content/docs-ja");
  const assetsDir = join(root, "public/assets");
  const outDir = join(root, "dist");
  mkdirSync(docsDir, { recursive: true });
  mkdirSync(jaDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(docsDir, "intro.mdx"), "---\ntitle: Intro\n---\n\nWelcome.\n");
  writeFileSync(join(jaDir, "intro.mdx"), "---\ntitle: はじめに\n---\n\nようこそ。\n");
  writeFileSync(join(assetsDir, "guide.txt"), "A guide.\n");
  writeFileSync(join(assetsDir, "archive.bin"), Buffer.from([0, 1, 2, 3]));
  writeFileSync(
    join(assetsDir, "large.txt"),
    "x".repeat(LLMS_ASSET_TEXT_CAP_BYTES + 1),
  );
  return {
    root,
    docsDir,
    jaDir,
    outDir,
    assetScan: {
      assetViewer: true,
      assetViewerIndexing: { llmsTxt: true },
      assetViewerDir: "assets",
      assetViewerRoutePrefix: "files",
      assetViewerExclude: [],
      base: "/site/",
      locales: { ja: { dir: "src/content/docs-ja" } },
      defaultLocaleOnlyPrefixes: [],
    },
  };
}

function options(
  fixtureData: ReturnType<typeof fixture>,
  overrides: Record<string, unknown> = {},
) {
  return {
    outDir: fixtureData.outDir,
    projectRoot: fixtureData.root,
    base: "/site/",
    siteName: "Example Docs",
    siteDescription: "Example description",
    defaultLocaleDir: fixtureData.docsDir,
    locales: [{ code: "ja", dir: fixtureData.jaDir }],
    assetScan: fixtureData.assetScan,
    ...overrides,
  };
}

describe("emitLlmsTxt asset integration", () => {
  it("keeps default and every locale byte-identical when agent features are explicitly off", () => {
    const data = fixture();
    emitLlmsTxt(options(data));
    const files = [
      "llms.txt",
      "llms-full.txt",
      "ja/llms.txt",
      "ja/llms-full.txt",
    ];
    const baseline = new Map(
      files.map((file) => [file, readFileSync(join(data.outDir, file), "utf8")]),
    );

    rmSync(data.outDir, { recursive: true, force: true });
    emitLlmsTxt(options(data, { agentExport: false, mcp: false }));

    for (const file of files) {
      expect(readFileSync(join(data.outDir, file), "utf8")).toBe(baseline.get(file));
    }
  });

  it("links opt-in index entries to locale-aware Markdown artifacts and adds the MCP endpoint", () => {
    const data = fixture();
    writeFileSync(
      join(data.docsDir, "override.mdx"),
      "---\ntitle: Override\nslug: custom-route\n---\n\nOverride body.\n",
    );
    writeFileSync(
      join(data.docsDir, "hidden.mdx"),
      "---\ntitle: Hidden\ndraft: true\n---\n\nHidden body.\n",
    );
    writeFileSync(
      join(data.docsDir, "category.mdx"),
      "---\ntitle: Category metadata\ncategory_no_page: true\n---\n\nNo page.\n",
    );
    emitLlmsTxt(options(data, {
      defaultLocale: "en",
      agentExport: true,
      mcp: true,
    }));

    const index = readFileSync(join(data.outDir, "llms.txt"), "utf8");
    const jaIndex = readFileSync(join(data.outDir, "ja/llms.txt"), "utf8");
    const full = readFileSync(join(data.outDir, "llms-full.txt"), "utf8");
    const defaultPage = agentPageKey("en", "intro");
    const jaPage = agentPageKey("ja", "intro");

    expect(index).toContain(
      `- [Intro](/site/agent/v1/pages/${defaultPage}.md): Welcome.`,
    );
    expect(index).toContain(
      `- [Override](/site/agent/v1/pages/${agentPageKey("en", "custom-route")}.md): Override body.`,
    );
    expect(index).not.toContain("Hidden");
    expect(index).not.toContain("Category metadata");
    expect(jaIndex).toContain(
      `- [はじめに](/site/agent/v1/pages/${jaPage}.md): ようこそ。`,
    );
    expect(index).toContain("## MCP\n\n- [Read-only MCP endpoint](/site/mcp)");
    expect(jaIndex).toContain("## MCP\n\n- [Read-only MCP endpoint](/site/mcp)");
    expect(full).toContain("> Source: /site/docs/intro");
    expect(full).not.toContain("agent/v1/pages/");
  });

  it("uses the actual default locale code when it is Japanese", () => {
    const data = fixture();
    emitLlmsTxt({
      outDir: data.outDir,
      projectRoot: data.root,
      base: "/site/",
      siteName: "Example Docs",
      siteDescription: "Example description",
      defaultLocale: "ja",
      defaultLocaleDir: data.jaDir,
      locales: [{ code: "en", dir: data.docsDir }],
      agentExport: true,
    });

    const defaultIndex = readFileSync(join(data.outDir, "llms.txt"), "utf8");
    const enIndex = readFileSync(join(data.outDir, "en/llms.txt"), "utf8");

    expect(defaultIndex).toContain(
      `- [はじめに](/site/agent/v1/pages/${agentPageKey("ja", "intro")}.md): ようこそ。`,
    );
    expect(defaultIndex).toContain("[はじめに](/site/agent/v1/pages/");
    expect(defaultIndex).not.toContain("/site/ja/docs/intro");
    expect(enIndex).toContain(
      `- [Intro](/site/agent/v1/pages/${agentPageKey("en", "intro")}.md): Welcome.`,
    );
  });

  it("uses absolute artifact and MCP URLs while full-text source URLs stay canonical HTML", () => {
    const data = fixture();
    emitLlmsTxt(options(data, {
      siteUrl: "https://example.com/",
      agentExport: true,
      mcp: true,
    }));

    const index = readFileSync(join(data.outDir, "llms.txt"), "utf8");
    const full = readFileSync(join(data.outDir, "llms-full.txt"), "utf8");

    expect(index).toContain(
      `https://example.com/site/agent/v1/pages/${agentPageKey("en", "intro")}.md`,
    );
    expect(index).toContain(
      "- [Read-only MCP endpoint](https://example.com/site/mcp)",
    );
    expect(full).toContain("> Source: https://example.com/site/docs/intro");
  });

  it("keeps the legacy files unchanged when asset indexing is off", () => {
    const data = fixture();
    emitLlmsTxt(options(data, { assetScan: undefined }));
    const indexWithoutAssets = readFileSync(join(data.outDir, "llms.txt"), "utf8");
    const fullWithoutAssets = readFileSync(join(data.outDir, "llms-full.txt"), "utf8");

    rmSync(data.outDir, { recursive: true, force: true });
    emitLlmsTxt(
      options(data, {
        assetScan: {
          ...data.assetScan,
          assetViewer: false,
          assetViewerIndexing: { llmsTxt: true },
        },
      }),
    );

    expect(readFileSync(join(data.outDir, "llms.txt"), "utf8")).toBe(indexWithoutAssets);
    expect(readFileSync(join(data.outDir, "llms-full.txt"), "utf8")).toBe(fullWithoutAssets);
    expect(indexWithoutAssets).not.toContain("## Files");
    expect(fullWithoutAssets).not.toContain("guide.txt");
  });

  it("keeps assets out when the llmsTxt sub-gate is disabled", () => {
    const data = fixture();
    emitLlmsTxt(
      options(data, {
        assetScan: {
          ...data.assetScan,
          assetViewerIndexing: { search: true, sitemap: true },
        },
      }),
    );

    expect(readFileSync(join(data.outDir, "llms.txt"), "utf8")).not.toContain(
      "## Files",
    );
    expect(readFileSync(join(data.outDir, "llms-full.txt"), "utf8")).not.toContain(
      "guide.txt",
    );
  });

  it("emits files in default and localized outputs with the shared URLs", () => {
    const data = fixture();
    emitLlmsTxt(options(data));

    const index = readFileSync(join(data.outDir, "llms.txt"), "utf8");
    const full = readFileSync(join(data.outDir, "llms-full.txt"), "utf8");
    const jaIndex = readFileSync(join(data.outDir, "ja/llms.txt"), "utf8");
    const jaFull = readFileSync(join(data.outDir, "ja/llms-full.txt"), "utf8");

    expect(index).toContain("## Docs\n\n- [Intro](/site/docs/intro): Welcome.\n\n## Files\n");
    expect(index).toContain("- [guide.txt](/site/files/guide.txt/)");
    expect(index).toContain("- [archive.bin](/site/files/archive.bin/)");
    expect(full).toContain("# guide.txt\n\n> Source: /site/files/guide.txt/\n\nA guide.");
    expect(full).toContain("(binary asset, not inlined)");
    expect(full).toContain("… (truncated)");
    expect(jaIndex).toContain("- [guide.txt](/site/ja/files/guide.txt/)");
    expect(jaFull).toContain("# guide.txt\n\n> Source: /site/ja/files/guide.txt/");
  });

  it("makes asset URLs absolute alongside document URLs when siteUrl is set", () => {
    const data = fixture();
    emitLlmsTxt(options(data, { siteUrl: "https://example.com/" }));

    const index = readFileSync(join(data.outDir, "llms.txt"), "utf8");
    const full = readFileSync(join(data.outDir, "llms-full.txt"), "utf8");

    expect(index).toContain("[Intro](https://example.com/site/docs/intro)");
    expect(index).toContain(
      "[guide.txt](https://example.com/site/files/guide.txt/)",
    );
    expect(full).toContain(
      "> Source: https://example.com/site/files/guide.txt/",
    );
  });

  it("truncates a UTF-8 asset at a complete code point", () => {
    const data = fixture();
    const body = `${"x".repeat(LLMS_ASSET_TEXT_CAP_BYTES - 4)}😀tail`;
    writeFileSync(join(data.root, "public/assets", "unicode.txt"), body);

    emitLlmsTxt(options(data));

    const full = readFileSync(join(data.outDir, "llms-full.txt"), "utf8");
    const marker = "\n… (truncated)";
    const start = full.indexOf("> Source: /site/files/unicode.txt/\n\n");
    expect(start).toBeGreaterThanOrEqual(0);
    const assetBody = full
      .slice(start + "> Source: /site/files/unicode.txt/\n\n".length)
      .split(marker, 1)[0] ?? "";

    expect(assetBody).toBe(`${"x".repeat(LLMS_ASSET_TEXT_CAP_BYTES - 4)}😀`);
    expect(Buffer.byteLength(assetBody, "utf8")).toBe(LLMS_ASSET_TEXT_CAP_BYTES);
    expect(assetBody).not.toContain("�");
    expect(full).toContain(`${assetBody}${marker}`);
  });
});
