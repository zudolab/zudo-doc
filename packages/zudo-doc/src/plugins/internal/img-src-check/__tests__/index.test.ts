import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkImgSrcs,
  extractImgSrcs,
  normalizeImgSrcBase,
  scanImgSrcs,
} from "../index.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function fixture(): { root: string; outDir: string } {
  const root = mkdtempSync(join(tmpdir(), "zudo-img-src-check-"));
  roots.push(root);
  const outDir = join(root, "dist");
  mkdirSync(outDir, { recursive: true });
  return { root, outDir };
}

function page(outDir: string, html: string, name = "index.html"): void {
  const path = join(outDir, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, html);
}

describe("extractImgSrcs", () => {
  it("parses real image elements and decodes HTML entities", () => {
    expect(
      extractImgSrcs(`
        <!-- <img src="/comment-missing.png"> -->
        <script>const example = '<img src="/script-missing.png">';</script>
        <p>&lt;img src="/escaped-missing.png"&gt;</p>
        <img src="/images/a&amp;b.png">
      `),
    ).toEqual(["/images/a&b.png"]);
  });

  it("also sees an image in template content", () => {
    expect(extractImgSrcs("<template><img src='/template.png'></template>")).toEqual([
      "/template.png",
    ]);
  });
});

describe("scanImgSrcs", () => {
  it("strips query and fragment, URL-decodes paths, and accepts entity-decoded srcs", () => {
    const { outDir } = fixture();
    writeFileSync(join(outDir, "space file.png"), "image");
    writeFileSync(join(outDir, "a&b.png"), "image");
    page(outDir, '<img src="/space%20file.png?cache=1#preview"><img src="/a&amp;b.png#x">');

    expect(scanImgSrcs({ outDir, base: "/" })).toEqual({
      htmlFileCount: 1,
      imageCount: 2,
      broken: [],
    });
  });

  it("reports malformed escapes and paths that resolve outside outDir", () => {
    const { root, outDir } = fixture();
    writeFileSync(join(root, "outside.png"), "image");
    page(outDir, '<img src="/bad%2"><img src="/../outside.png">');

    const result = scanImgSrcs({ outDir });
    expect(result.imageCount).toBe(2);
    expect(result.broken).toEqual([
      {
        pagePath: "index.html",
        src: "/bad%2",
        reason: "malformed percent escape",
      },
      {
        pagePath: "index.html",
        src: "/../outside.png",
        reason: "resolves outside the build output directory",
      },
    ]);
  });

  it("requires a non-root base with segment boundaries", () => {
    const { outDir } = fixture();
    mkdirSync(join(outDir, "assets"));
    writeFileSync(join(outDir, "assets", "ok.png"), "image");
    writeFileSync(join(outDir, "outside.png"), "image");
    page(
      outDir,
      [
        '<img src="/docs/assets/ok.png">',
        '<img src="/docs-other/assets/ok.png">',
        '<img src="/outside.png">',
      ].join(""),
    );

    const result = scanImgSrcs({ outDir, base: "/docs/" });
    expect(result.imageCount).toBe(3);
    expect(result.broken).toEqual([
      {
        pagePath: "index.html",
        src: "/docs-other/assets/ok.png",
        reason: "outside configured base /docs/",
      },
      {
        pagePath: "index.html",
        src: "/outside.png",
        reason: "outside configured base /docs/",
      },
    ]);
  });

  it("skips protocol-relative, scheme, relative, and fragment-only sources", () => {
    const { outDir } = fixture();
    writeFileSync(join(outDir, "ok.png"), "image");
    page(
      outDir,
      [
        '<img src="/ok.png">',
        '<img src="//cdn.example/ok.png">',
        '<img src="https://example.com/ok.png">',
        '<img src="data:image/png;base64,AAAA">',
        '<img src="relative.png">',
        '<img src="#fragment">',
      ].join(""),
    );

    expect(scanImgSrcs({ outDir })).toEqual({ htmlFileCount: 1, imageCount: 1, broken: [] });
  });

  it("uses a case-insensitive prefilter without missing uppercase HTML tags", () => {
    const { outDir } = fixture();
    writeFileSync(join(outDir, "ok.png"), "image");
    page(outDir, '<IMG SRC="/ok.png">');

    expect(scanImgSrcs({ outDir })).toEqual({ htmlFileCount: 1, imageCount: 1, broken: [] });
  });

  it("requires an existing file and does not fall back from directories to index.html", () => {
    const { outDir } = fixture();
    mkdirSync(join(outDir, "folder"));
    writeFileSync(join(outDir, "folder", "index.html"), "page");
    page(outDir, '<img src="/folder/"><img src="/folder/index.html">');

    const result = scanImgSrcs({ outDir });
    expect(result.imageCount).toBe(2);
    expect(result.broken).toEqual([
      {
        pagePath: "index.html",
        src: "/folder/",
        reason: "path is not a file",
      },
    ]);
  });

  it("rejects an in-output symlink whose target is outside outDir", () => {
    const { root, outDir } = fixture();
    writeFileSync(join(root, "outside.png"), "image");
    symlinkSync(join(root, "outside.png"), join(outDir, "alias.png"));
    page(outDir, '<img src="/alias.png">');

    expect(scanImgSrcs({ outDir }).broken).toEqual([
      {
        pagePath: "index.html",
        src: "/alias.png",
        reason: "resolves outside the build output directory",
      },
    ]);
  });

  it("walks nested HTML files and reports one warning per broken occurrence plus a summary", () => {
    const { outDir } = fixture();
    page(outDir, '<img src="/missing.png"><img src="/missing.png">', "docs/index.html");
    const warn = vi.fn();

    const result = checkImgSrcs({ outDir, onBroken: "warn", logger: { warn } });

    expect(result.broken).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0]?.[0]).toContain("docs/index.html");
    expect(warn.mock.calls[0]?.[0]).toContain("/missing.png");
    expect(warn.mock.calls[2]?.[0]).toContain("Found 2 broken image sources");
  });

  it("reports before throwing in error mode and skips the scan in ignore mode", () => {
    const { outDir } = fixture();
    page(outDir, '<img src="/missing.png">');
    const warn = vi.fn();

    expect(() => checkImgSrcs({ outDir, onBroken: "error", logger: { warn } })).toThrow(
      "Build contains 1 broken image source",
    );
    expect(warn).toHaveBeenCalledTimes(2);

    warn.mockClear();
    expect(checkImgSrcs({ outDir, onBroken: "ignore", logger: { warn } })).toEqual({
      htmlFileCount: 0,
      imageCount: 0,
      broken: [],
    });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("normalizeImgSrcBase", () => {
  it("normalizes root, relative, and slash-padded bases", () => {
    expect(normalizeImgSrcBase(undefined)).toBe("/");
    expect(normalizeImgSrcBase("/")).toBe("/");
    expect(normalizeImgSrcBase("docs")).toBe("/docs/");
    expect(normalizeImgSrcBase("/docs///")).toBe("/docs/");
  });
});
