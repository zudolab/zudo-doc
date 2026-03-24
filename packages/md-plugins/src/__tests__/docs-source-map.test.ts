import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { buildDocsSourceMap, type DocsSourceMapOptions } from "../docs-source-map";
import { createTempProject, touch, cleanupTempProject } from "./test-helpers";

describe("buildDocsSourceMap", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = createTempProject();
  });

  afterEach(() => {
    cleanupTempProject(rootDir);
  });

  function baseOptions(overrides?: Partial<DocsSourceMapOptions>): DocsSourceMapOptions {
    return {
      rootDir,
      docsDir: "src/content/docs",
      locales: {},
      versions: false,
      base: "/",
      trailingSlash: true,
      ...overrides,
    };
  }

  it("maps a basic mdx file to a URL with trailing slash", () => {
    touch(rootDir, "src/content/docs/getting-started/installation.mdx");

    const map = buildDocsSourceMap(baseOptions());
    const absFile = resolve(rootDir, "src/content/docs/getting-started/installation.mdx");
    expect(map.get(absFile)).toBe("/docs/getting-started/installation/");
  });

  it("maps an index file to its parent path", () => {
    touch(rootDir, "src/content/docs/getting-started/index.mdx");

    const map = buildDocsSourceMap(baseOptions());
    const absFile = resolve(rootDir, "src/content/docs/getting-started/index.mdx");
    expect(map.get(absFile)).toBe("/docs/getting-started/");
  });

  it("maps a deeply nested file", () => {
    touch(rootDir, "src/content/docs/guides/advanced/config.md");

    const map = buildDocsSourceMap(baseOptions());
    const absFile = resolve(rootDir, "src/content/docs/guides/advanced/config.md");
    expect(map.get(absFile)).toBe("/docs/guides/advanced/config/");
  });

  it("applies base path", () => {
    touch(rootDir, "src/content/docs/getting-started/installation.mdx");

    const map = buildDocsSourceMap(baseOptions({ base: "/pj/docs/" }));
    const absFile = resolve(rootDir, "src/content/docs/getting-started/installation.mdx");
    expect(map.get(absFile)).toBe("/pj/docs/docs/getting-started/installation/");
  });

  it("generates URLs without trailing slash", () => {
    touch(rootDir, "src/content/docs/getting-started/installation.mdx");

    const map = buildDocsSourceMap(baseOptions({ trailingSlash: false }));
    const absFile = resolve(rootDir, "src/content/docs/getting-started/installation.mdx");
    expect(map.get(absFile)).toBe("/docs/getting-started/installation");
  });

  it("maps locale directory files", () => {
    touch(rootDir, "src/content/docs-ja/getting-started/installation.mdx");

    const map = buildDocsSourceMap(
      baseOptions({
        locales: { ja: { dir: "src/content/docs-ja" } },
      }),
    );
    const absFile = resolve(rootDir, "src/content/docs-ja/getting-started/installation.mdx");
    expect(map.get(absFile)).toBe("/ja/docs/getting-started/installation/");
  });

  it("maps versioned directory files", () => {
    touch(rootDir, "src/content/docs-v1/getting-started/installation.mdx");

    const map = buildDocsSourceMap(
      baseOptions({
        versions: [{ slug: "1.0", docsDir: "src/content/docs-v1" }],
      }),
    );
    const absFile = resolve(rootDir, "src/content/docs-v1/getting-started/installation.mdx");
    expect(map.get(absFile)).toBe("/v/1.0/docs/getting-started/installation/");
  });

  it("maps root index.mdx to the docs root URL", () => {
    touch(rootDir, "src/content/docs/index.mdx");

    const map = buildDocsSourceMap(baseOptions());
    const absFile = resolve(rootDir, "src/content/docs/index.mdx");
    expect(map.get(absFile)).toBe("/docs/");
  });

  it("handles missing directory gracefully", () => {
    const map = buildDocsSourceMap(
      baseOptions({
        docsDir: "src/content/nonexistent",
      }),
    );
    expect(map.size).toBe(0);
  });

  it("registers alternative extension for cross-referencing", () => {
    touch(rootDir, "src/content/docs/guide.mdx");

    const map = buildDocsSourceMap(baseOptions());
    const mdxFile = resolve(rootDir, "src/content/docs/guide.mdx");
    const mdFile = resolve(rootDir, "src/content/docs/guide.md");

    // Both extensions should resolve to the same URL
    expect(map.get(mdxFile)).toBe("/docs/guide/");
    expect(map.get(mdFile)).toBe("/docs/guide/");
  });
});
