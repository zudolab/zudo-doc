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

import { createLlmsTxtDevMiddleware } from "../dev-middleware.js";
import { emitLlmsTxt } from "../emit.js";
import type { AssetScanProjection } from "../../asset-viewer/asset-pages.js";

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
  const root = mkdtempSync(join(tmpdir(), "zudo-llms-dev-"));
  roots.push(root);
  const docsDir = join(root, "docs");
  const jaDir = join(root, "docs-ja");
  const assetsDir = join(root, "public/assets");
  const outDir = join(root, "dist");
  mkdirSync(docsDir, { recursive: true });
  mkdirSync(jaDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(docsDir, "intro.md"), "---\ntitle: Intro\n---\n\nWelcome.\n");
  writeFileSync(join(jaDir, "intro.md"), "---\ntitle: はじめに\n---\n\nようこそ。\n");
  writeFileSync(join(assetsDir, "read me.txt"), "Asset body.\n");
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
      locales: { ja: { dir: jaDir } },
      defaultLocaleOnlyPrefixes: [],
    },
  };
}

interface DevResponse {
  statusCode: number;
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

function request(
  handler: ReturnType<typeof createLlmsTxtDevMiddleware>,
  url: string,
): Promise<string> {
  return new Promise((resolve) => {
    const response: DevResponse = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(body) {
        resolve(body);
      },
    };
    handler(
      { method: "GET", url } as never,
      response as never,
      () => resolve("NEXT"),
    );
  });
}

describe("llms dev middleware asset parity", () => {
  it("serves the same indexed output as emitLlmsTxt", async () => {
    const data = fixture();
    emitLlmsTxt({
      outDir: data.outDir,
      projectRoot: data.root,
      base: "/site/",
      siteName: "Example Docs",
      siteDescription: "Example description",
      defaultLocaleDir: data.docsDir,
      siteUrl: "https://example.com/",
      locales: [{ code: "ja", dir: data.jaDir }],
      assetScan: data.assetScan,
    });

    const middleware = createLlmsTxtDevMiddleware({
      projectRoot: data.root,
      base: "/site/",
      siteName: "Example Docs",
      siteDescription: "Example description",
      defaultLocaleDir: data.docsDir,
      siteUrl: "https://example.com/",
      locales: [{ code: "ja", dir: data.jaDir }],
      assetScan: data.assetScan,
    });

    expect(await request(middleware, "/site/llms.txt")).toBe(
      readFileSync(join(data.outDir, "llms.txt"), "utf8"),
    );
    expect(await request(middleware, "/site/llms-full.txt?cache-bust=1")).toBe(
      readFileSync(join(data.outDir, "llms-full.txt"), "utf8"),
    );
    expect(await request(middleware, "/site/ja/llms-full.txt")).toBe(
      readFileSync(join(data.outDir, "ja/llms-full.txt"), "utf8"),
    );
    expect(await request(middleware, "/site/llms.txt")).toContain(
      "[read me.txt](https://example.com/site/files/read%20me.txt/)",
    );
  });
});
