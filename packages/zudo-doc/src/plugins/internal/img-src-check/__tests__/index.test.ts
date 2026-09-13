import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkImgSrcs,
  extractImgSrcs,
  formatBrokenImgSrc,
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
        element: "img[src]",
        pagePath: "index.html",
        src: "/bad%2",
        reason: "malformed percent escape",
      },
      {
        element: "img[src]",
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
        element: "img[src]",
        pagePath: "index.html",
        src: "/docs-other/assets/ok.png",
        reason: "outside configured base /docs/",
      },
      {
        element: "img[src]",
        pagePath: "index.html",
        src: "/outside.png",
        reason: "outside configured base /docs/",
      },
    ]);
  });

  it("skips protocol-relative, scheme, relative, and fragment-only sources", () => {
    const { outDir } = fixture();
    writeFileSync(join(outDir, "ok.png"), "image");
    writeFileSync(join(outDir, "relative.png"), "image");
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

    expect(scanImgSrcs({ outDir })).toEqual({ htmlFileCount: 1, imageCount: 2, broken: [] });
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
        element: "img[src]",
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
        element: "img[src]",
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
    expect(warn.mock.calls[0]?.[0]).toContain("img[src]");
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

  it("formats the originating element and individual URL", () => {
    expect(
      formatBrokenImgSrc({
        pagePath: "guide/index.html",
        element: "img[srcset]",
        src: "./missing.png",
        reason: "file does not exist",
      }),
    ).toBe(
      "[img-src-check] Broken image source in guide/index.html: img[srcset] ./missing.png (file does not exist)",
    );
  });

  it("resolves relative sources from nested index and non-index pages", () => {
    const { outDir } = fixture();
    mkdirSync(join(outDir, "guide"), { recursive: true });
    writeFileSync(join(outDir, "guide", "same.png"), "image");
    writeFileSync(join(outDir, "parent.png"), "image");
    writeFileSync(join(outDir, "guide.html"), "page");
    page(
      outDir,
      '<img src="./same.png"><img src="same.png"><img src="../parent.png"><img src="missing.png">',
      "guide/index.html",
    );
    page(outDir, '<img src="guide/same.png"><img src="missing.png">', "guide.html");

    const result = scanImgSrcs({ outDir });
    expect(result.imageCount).toBe(6);
    expect(result.broken).toEqual([
      {
        element: "img[src]",
        pagePath: "guide/index.html",
        src: "missing.png",
        reason: "file does not exist",
      },
      {
        element: "img[src]",
        pagePath: "guide.html",
        src: "missing.png",
        reason: "file does not exist",
      },
    ]);
  });

  it("parses srcset candidates with descriptors, commas, whitespace, and malformed descriptors", () => {
    const { outDir } = fixture();
    mkdirSync(join(outDir, "guide"), { recursive: true });
    writeFileSync(join(outDir, "guide", "one.png"), "image");
    writeFileSync(join(outDir, "guide", "wide.png"), "image");
    writeFileSync(join(outDir, "guide", "comma,name.png"), "image");
    page(
      outDir,
      [
        '<img srcset="  ,  ./one.png   1x,   ./wide.png 480w, ./comma,name.png 2x, ./missing.png  3x, , ,">',
        '<img srcset="./ignored-zero.png 0w, ./ignored-negative.png -1x, ./ignored-text.png nope, ./ignored-duplicate.png 1x 2x">',
      ].join(""),
      "guide/index.html",
    );

    const result = scanImgSrcs({ outDir });
    expect(result.imageCount).toBe(4);
    expect(result.broken).toEqual([
      {
        element: "img[srcset]",
        pagePath: "guide/index.html",
        src: "./missing.png",
        reason: "file does not exist",
      },
    ]);
  });

  it("checks picture sources, media, input images, and SVG image hrefs", () => {
    const { outDir } = fixture();
    mkdirSync(join(outDir, "media"), { recursive: true });
    for (const name of [
      "source.png",
      "source-direct.png",
      "video.mp4",
      "poster.png",
      "audio.mp3",
      "track.vtt",
      "input.png",
      "svg.png",
      "xlink.png",
    ]) {
      writeFileSync(join(outDir, "media", name), "asset");
    }
    page(
      outDir,
      [
        '<picture><source src="media/source-direct.png" srcset="media/source.png 1x"></picture>',
        '<video src="media/video.mp4" poster="media/poster.png"></video>',
        '<audio src="media/audio.mp3"></audio><track src="media/track.vtt">',
        '<input TYPE="IMAGE" SRC="media/input.png">',
        '<svg><image href="media/svg.png" xlink:href="media/xlink.png"></svg>',
      ].join(""),
    );

    expect(scanImgSrcs({ outDir })).toEqual({ htmlFileCount: 1, imageCount: 9, broken: [] });
  });

  it("skips external, data, protocol-relative, and fragment-only references for every source type", () => {
    const { outDir } = fixture();
    page(
      outDir,
      [
        '<img src="https://cdn.example/image.png" srcset="//cdn.example/a.png 1x, data:image/png;base64,AAAA 2x">',
        '<picture><source src="//cdn.example/source.png" srcset="#source 1x"></picture>',
        '<video src="blob:https://cdn.example/video" poster="mailto:poster@example.com"></video>',
        '<audio src="data:audio/ogg;base64,AAAA"></audio><track src="#track">',
        '<input type="image" src="ftp://cdn.example/input.png">',
        '<svg><image href="//cdn.example/svg.png" xlink:href="data:image/png;base64,AAAA"></svg>',
      ].join(""),
    );

    expect(scanImgSrcs({ outDir })).toEqual({ htmlFileCount: 1, imageCount: 0, broken: [] });
  });

  it("honors the configured base and the first valid relative or external base element", () => {
    const { outDir } = fixture();
    writeFileSync(join(outDir, "absolute.png"), "image");
    writeFileSync(join(outDir, "relative.png"), "image");
    page(
      outDir,
      [
        '<base href="http://[">',
        '<base href="../">',
        '<img src="/docs/absolute.png"><img src="relative.png">',
      ].join(""),
      "guide/index.html",
    );

    expect(scanImgSrcs({ outDir, base: "/docs/" })).toEqual({
      htmlFileCount: 1,
      imageCount: 2,
      broken: [],
    });

    page(
      outDir,
      '<base href="https://cdn.example/assets/"><img src="relative.png"><img src="/docs/absolute.png">',
      "external-base/index.html",
    );
    expect(scanImgSrcs({ outDir, base: "/docs/" })).toEqual({
      htmlFileCount: 2,
      imageCount: 2,
      broken: [],
    });
  });

  it("preserves encoded filename characters while rejecting traversal and symlink escapes", () => {
    const { root, outDir } = fixture();
    writeFileSync(join(outDir, "hash#name.png"), "image");
    writeFileSync(join(outDir, "query?name.png"), "image");
    writeFileSync(join(outDir, "comma,name.png"), "image");
    writeFileSync(join(root, "outside.png"), "image");
    symlinkSync(join(root, "outside.png"), join(outDir, "alias.png"));
    page(
      outDir,
      [
        '<img src="/hash%23name.png"><img src="/query%3Fname.png"><img src="/comma,name.png">',
        '<img src="/%2e%2e/outside.png"><img src="/..\\outside.png"><img src="/alias.png">',
      ].join(""),
    );

    const result = scanImgSrcs({ outDir });
    expect(result.imageCount).toBe(6);
    expect(result.broken).toEqual([
      {
        element: "img[src]",
        pagePath: "index.html",
        src: "/%2e%2e/outside.png",
        reason: "resolves outside the build output directory",
      },
      {
        element: "img[src]",
        pagePath: "index.html",
        src: "/..\\outside.png",
        reason: "resolves outside the build output directory",
      },
      {
        element: "img[src]",
        pagePath: "index.html",
        src: "/alias.png",
        reason: "resolves outside the build output directory",
      },
    ]);
  });

  it("parses unquoted minified attributes", () => {
    const { outDir } = fixture();
    writeFileSync(join(outDir, "image.webp"), "image");
    page(outDir, '<img alt=hero src=/image.webp>');

    expect(scanImgSrcs({ outDir })).toEqual({ htmlFileCount: 1, imageCount: 1, broken: [] });
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
