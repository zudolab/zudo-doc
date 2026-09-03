import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseBasePath,
  parseTrailingSlash,
  parseContentDirs,
  extractHtmlLinks,
  extractProtocolRelativeHtmlLinks,
  extractHtmlIds,
  resolveLinkDetail,
  resolveLink,
  extractMdxAbsoluteLinks,
  extractMdxFragmentLinks,
  checkHtmlLinksAndTrailing,
  checkMdxLinks,
  checkMdxAnchors,
  formatReport,
  collectFiles,
  readAllowlist,
} from "../check-links.js";

const CHECK_LINKS_SCRIPT = fileURLToPath(new URL("../check-links.js", import.meta.url));

describe("check-links", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "check-links-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  describe("CLI arguments", () => {
    it("shows current help through the package-manager separator", () => {
      const result = spawnSync(process.execPath, [
        CHECK_LINKS_SCRIPT,
        "--",
        "--strict-broken",
        "--strict-absolute",
        "--strict-anchors",
        "--strict-trailing",
        "--allowlist=.check-links-allowlist",
        "-h",
      ], {
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("--strict-broken");
      expect(result.stdout).toContain("--strict-absolute");
      expect(result.stdout).toContain("--strict-anchors");
      expect(result.stdout).toContain("--strict-trailing");
      expect(result.stdout).not.toMatch(/^\s*--strict\s/m);
    });

    it("rejects the removed aggregate --strict option", () => {
      const result = spawnSync(process.execPath, [CHECK_LINKS_SCRIPT, "--strict"], {
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unknown option: --strict");
    });
  });

  // --- parseBasePath ---

  describe("parseBasePath", () => {
    it("extracts base path from settings file", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(
        file,
        `export const settings = {\n  base: "/pj/zudo-doc/",\n};`,
      );
      expect(await parseBasePath(file)).toBe("/pj/zudo-doc/");
    });

    it("handles single-quoted base", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(file, `export const settings = { base: '/app/' };`);
      expect(await parseBasePath(file)).toBe("/app/");
    });

    it("returns / when no base is found", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(file, `export const settings = {};`);
      expect(await parseBasePath(file)).toBe("/");
    });
  });

  // --- parseTrailingSlash ---

  describe("parseTrailingSlash", () => {
    it("returns true when trailingSlash is true", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(file, `export const settings = { trailingSlash: true as boolean };`);
      expect(await parseTrailingSlash(file)).toBe(true);
    });

    it("returns false when trailingSlash is false", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(file, `export const settings = { trailingSlash: false as boolean };`);
      expect(await parseTrailingSlash(file)).toBe(false);
    });

    it("returns false when trailingSlash is not present", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(file, `export const settings = {};`);
      expect(await parseTrailingSlash(file)).toBe(false);
    });
  });

  // --- parseContentDirs ---

  describe("parseContentDirs", () => {
    it("extracts docsDir and locale dirs from settings", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(
        file,
        `export const settings = {\n  docsDir: "src/content/docs",\n  locales: {\n    ja: { label: "JA", dir: "src/content/docs-ja" },\n  },\n};`,
      );
      const result = await parseContentDirs(file);
      expect(result.docsDir).toBe("src/content/docs");
      expect(result.localeDirs).toEqual(["src/content/docs-ja"]);
    });

    it("returns defaults when no docsDir is specified", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(file, `export const settings = {};`);
      const result = await parseContentDirs(file);
      expect(result.docsDir).toBe("src/content/docs");
      expect(result.localeDirs).toEqual([]);
    });

    it("extracts multiple locale dirs", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(
        file,
        `export const settings = {\n  docsDir: "src/content/docs",\n  locales: {\n    ja: { label: "JA", dir: "src/content/docs-ja" },\n    zh: { label: "ZH", dir: "src/content/docs-zh" },\n  },\n};`,
      );
      const result = await parseContentDirs(file);
      expect(result.localeDirs).toEqual([
        "src/content/docs-ja",
        "src/content/docs-zh",
      ]);
    });

    it("extracts per-version locale dirs and dedupes repeats", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(
        file,
        `export const settings = {\n  docsDir: "src/content/docs",\n  locales: {\n    ja: { label: "JA", dir: "src/content/docs-ja" },\n  },\n  versions: [\n    {\n      slug: "1.0",\n      docsDir: "src/content/docs-v1",\n      locales: { ja: { dir: "src/content/docs-v1-ja" } },\n    },\n  ],\n};`,
      );
      const result = await parseContentDirs(file);
      expect(result.docsDir).toBe("src/content/docs");
      expect(result.localeDirs).toEqual([
        "src/content/docs-ja",
        "src/content/docs-v1-ja",
      ]);
    });

    it("returns localeKeys matching the locale block keys", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(
        file,
        `export const settings = {\n  docsDir: "src/content/docs",\n  locales: {\n    ja: { label: "JA", dir: "src/content/docs-ja" },\n    de: { label: "DE", dir: "src/content/docs-de" },\n  },\n};`,
      );
      const result = await parseContentDirs(file);
      expect(result.localeKeys).toEqual(["ja", "de"]);
    });

    it("returns empty localeKeys when no locales are declared", async () => {
      const file = join(tmpDir, "settings.ts");
      writeFileSync(file, `export const settings = {};`);
      const result = await parseContentDirs(file);
      expect(result.localeKeys).toEqual([]);
    });
  });

  // --- collectFiles ---

  describe("collectFiles", () => {
    it("finds files with matching extensions recursively", async () => {
      mkdirSync(join(tmpDir, "sub"), { recursive: true });
      writeFileSync(join(tmpDir, "a.html"), "");
      writeFileSync(join(tmpDir, "b.txt"), "");
      writeFileSync(join(tmpDir, "sub", "c.html"), "");

      const files = await collectFiles(tmpDir, [".html"]);
      const relative = files.map((f: string) => f.replace(tmpDir + "/", ""));
      expect(relative).toEqual(["a.html", "sub/c.html"]);
    });

    it("returns empty array for non-existent directory", async () => {
      const files = await collectFiles(join(tmpDir, "nope"), [".html"]);
      expect(files).toEqual([]);
    });
  });

  // --- extractHtmlLinks ---

  describe("extractHtmlLinks", () => {
    it("extracts internal links", () => {
      const html = `<a href="/pj/zudo-doc/docs/foo">Foo</a>`;
      expect(extractHtmlLinks(html)).toEqual([
        { href: "/pj/zudo-doc/docs/foo", line: 1 },
      ]);
    });

    it("skips external https links", () => {
      expect(extractHtmlLinks(`<a href="https://example.com">E</a>`)).toEqual(
        [],
      );
    });

    it("skips external http links", () => {
      expect(extractHtmlLinks(`<a href="http://example.com">E</a>`)).toEqual(
        [],
      );
    });

    it("extracts anchor-only links for local-fragment validation", () => {
      expect(extractHtmlLinks(`<a href="#section">A</a>`)).toEqual([
        { href: "#section", line: 1 },
      ]);
    });

    it("skips mailto links", () => {
      expect(extractHtmlLinks(`<a href="mailto:a@b.com">M</a>`)).toEqual([]);
    });

    it("skips javascript: links", () => {
      expect(
        extractHtmlLinks(`<a href="javascript:void(0)">J</a>`),
      ).toEqual([]);
    });

    it("reports correct line numbers", () => {
      const html = [
        "<html>",
        "<body>",
        '<a href="/page1">P1</a>',
        '<a href="/page2">P2</a>',
        "</body>",
      ].join("\n");
      expect(extractHtmlLinks(html)).toEqual([
        { href: "/page1", line: 3 },
        { href: "/page2", line: 4 },
      ]);
    });

    it("handles links with other attributes", () => {
      const html = `<a class="link" href="/foo" data-x="1">F</a>`;
      expect(extractHtmlLinks(html)).toEqual([{ href: "/foo", line: 1 }]);
    });

    it("finds multiple links in same line", () => {
      const html = `<a href="/a">A</a><a href="/b">B</a>`;
      expect(extractHtmlLinks(html)).toEqual([
        { href: "/a", line: 1 },
        { href: "/b", line: 1 },
      ]);
    });

    it("skips data: URIs", () => {
      expect(
        extractHtmlLinks(`<a href="data:text/html,<h1>Hi</h1>">D</a>`),
      ).toEqual([]);
    });

    it("skips tel: URIs", () => {
      expect(extractHtmlLinks(`<a href="tel:+1234567890">Call</a>`)).toEqual(
        [],
      );
    });

    it("skips protocol-relative URLs", () => {
      expect(
        extractHtmlLinks(`<a href="//example.com/path">External</a>`),
      ).toEqual([]);
    });

    it("still treats a genuine site-root path as internal", () => {
      expect(extractHtmlLinks(`<a href="/docs/x/">Root</a>`)).toEqual([
        { href: "/docs/x/", line: 1 },
      ]);
    });

    it("extracts single-quoted href attributes", () => {
      const html = `<a href='/foo'>F</a>`;
      expect(extractHtmlLinks(html)).toEqual([{ href: "/foo", line: 1 }]);
    });

    it("handles mixed single and double quoted hrefs", () => {
      const html = `<a href="/a">A</a>\n<a href='/b'>B</a>`;
      expect(extractHtmlLinks(html)).toEqual([
        { href: "/a", line: 1 },
        { href: "/b", line: 2 },
      ]);
    });

    it("extracts unquoted hrefs and decodes HTML character references", () => {
      const html = `<a href=/docs/target?first&amp;second#section&#38;details>Target</a>`;
      expect(extractHtmlLinks(html)).toEqual([
        {
          href: "/docs/target?first&second#section&details",
          line: 1,
        },
      ]);
    });

    it("does not extract escaped serialized demo markup", () => {
      const html = `<div data-props='{"html":"<a href=\\\"#\\\">example</a>"}'></div>`;
      expect(extractHtmlLinks(html)).toEqual([]);
    });

    it("does not treat data-href as a link target", () => {
      expect(extractHtmlLinks(`<a data-href=/docs/missing>Label</a>`)).toEqual([]);
    });

    it("does not treat a custom element beginning with a- as an anchor", () => {
      expect(extractHtmlLinks(`<a-card href=/docs/missing>Card</a-card>`)).toEqual([]);
    });
  });

  // --- extractProtocolRelativeHtmlLinks ---

  describe("extractProtocolRelativeHtmlLinks", () => {
    it("extracts protocol-relative hrefs with correct line numbers", () => {
      const html = [
        "<html>",
        '<a href="//example.com/path">External</a>',
        '<a href="//docs/guide">Typo?</a>',
      ].join("\n");
      expect(extractProtocolRelativeHtmlLinks(html)).toEqual([
        { href: "//example.com/path", line: 2 },
        { href: "//docs/guide", line: 3 },
      ]);
    });

    it("returns [] for https: links", () => {
      expect(
        extractProtocolRelativeHtmlLinks(`<a href="https://example.com">E</a>`),
      ).toEqual([]);
    });

    it("returns [] for mailto: links", () => {
      expect(
        extractProtocolRelativeHtmlLinks(`<a href="mailto:a@b.com">M</a>`),
      ).toEqual([]);
    });

    it("returns [] for a genuine site-root path", () => {
      expect(
        extractProtocolRelativeHtmlLinks(`<a href="/docs/x/">Root</a>`),
      ).toEqual([]);
    });

    it("returns [] for relative hrefs", () => {
      expect(
        extractProtocolRelativeHtmlLinks(`<a href="./sibling">S</a>`),
      ).toEqual([]);
    });
  });

  describe("extractHtmlIds", () => {
    it("extracts quoted and unquoted ids with decoded character references", () => {
      const html = `<h2 id=section&amp;details></h2><div id="quoted&#x26;id"></div>`;
      expect(extractHtmlIds(html)).toEqual(["section&details", "quoted&id"]);
    });

    it("does not extract ids from escaped serialized demo markup", () => {
      const html = `<div data-props='{"html":"<div id=\\\"ghost\\\"></div>"}'></div>`;
      expect(extractHtmlIds(html)).toEqual([]);
    });

    it("does not treat data-id as an element id", () => {
      expect(extractHtmlIds(`<div data-id=ghost></div>`)).toEqual([]);
    });
  });

  // --- resolveLink ---

  describe("resolveLink", () => {
    const BASE = "/pj/zudo-doc/";

    it("strips base path and resolves directory with index.html", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(await resolveLink("/pj/zudo-doc/docs/foo", tmpDir, BASE)).toBe(
        true,
      );
    });

    it("resolves path with trailing slash", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(await resolveLink("/pj/zudo-doc/docs/foo/", tmpDir, BASE)).toBe(
        true,
      );
    });

    it("resolves path to .html file", async () => {
      mkdirSync(join(tmpDir, "docs"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo.html"), "");
      expect(await resolveLink("/pj/zudo-doc/docs/foo", tmpDir, BASE)).toBe(
        true,
      );
    });

    it("resolves file link with extension", async () => {
      mkdirSync(join(tmpDir, "_astro"), { recursive: true });
      writeFileSync(join(tmpDir, "_astro", "style.css"), "");
      expect(
        await resolveLink("/pj/zudo-doc/_astro/style.css", tmpDir, BASE),
      ).toBe(true);
    });

    it("returns false for missing target", async () => {
      expect(
        await resolveLink("/pj/zudo-doc/docs/nope", tmpDir, BASE),
      ).toBe(false);
    });

    it("strips query string before checking", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(
        await resolveLink("/pj/zudo-doc/docs/foo?q=1", tmpDir, BASE),
      ).toBe(true);
    });

    it("strips both query string and fragment before checking", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(
        await resolveLink("/pj/zudo-doc/docs/foo?q=1#section", tmpDir, BASE),
      ).toBe(true);
    });

    it("strips fragment before checking", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(
        await resolveLink("/pj/zudo-doc/docs/foo#section", tmpDir, BASE),
      ).toBe(true);
    });

    it("returns true for empty href after fragment strip", async () => {
      expect(await resolveLink("", tmpDir, BASE)).toBe(true);
    });

    it("returns true for base path root", async () => {
      // /pj/zudo-doc/ → stripped to / → relPath is empty → true
      expect(await resolveLink("/pj/zudo-doc/", tmpDir, BASE)).toBe(true);
    });

    it("works without base path (default /)", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(await resolveLink("/docs/foo", tmpDir)).toBe(true);
    });

    it("resolves relative links against file directory", async () => {
      const fileDir = join(tmpDir, "docs", "skills", "example");
      mkdirSync(fileDir, { recursive: true });
      mkdirSync(join(tmpDir, "docs", "skills", "example", "sub"), {
        recursive: true,
      });
      writeFileSync(
        join(tmpDir, "docs", "skills", "example", "sub", "index.html"),
        "",
      );
      expect(
        await resolveLink("./sub", tmpDir, "/", fileDir),
      ).toBe(true);
    });

    it("returns false for missing relative link target", async () => {
      const fileDir = join(tmpDir, "docs", "skills");
      mkdirSync(fileDir, { recursive: true });
      expect(
        await resolveLink("./nope", tmpDir, "/", fileDir),
      ).toBe(false);
    });
  });

  // --- resolveLinkDetail ---

  describe("resolveLinkDetail", () => {
    const BASE = "/pj/zudo-doc/";

    it("returns 'root' for empty href", async () => {
      expect(await resolveLinkDetail("", tmpDir, BASE)).toBe("root");
    });

    it("returns 'root' when path resolves to empty after stripping base path", async () => {
      expect(await resolveLinkDetail("/pj/zudo-doc/", tmpDir, BASE)).toBe("root");
    });

    it("returns 'directoryIndex' when resolved via dir/index.html (no trailing slash)", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(await resolveLinkDetail("/pj/zudo-doc/docs/foo", tmpDir, BASE)).toBe("directoryIndex");
    });

    it("returns 'directoryIndex' when resolved via dir/index.html (with trailing slash)", async () => {
      mkdirSync(join(tmpDir, "docs", "foo"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo", "index.html"), "");
      expect(await resolveLinkDetail("/pj/zudo-doc/docs/foo/", tmpDir, BASE)).toBe("directoryIndex");
    });

    it("treats a slashed extension-bearing directory as a directory index", async () => {
      mkdirSync(join(tmpDir, "files", "demo", "x.js"), { recursive: true });
      writeFileSync(join(tmpDir, "files", "demo", "x.js", "index.html"), "");
      expect(await resolveLinkDetail("/pj/zudo-doc/files/demo/x.js/", tmpDir, BASE)).toBe("directoryIndex");
    });

    it("returns 'file' when resolved via .html extension", async () => {
      mkdirSync(join(tmpDir, "docs"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "foo.html"), "");
      expect(await resolveLinkDetail("/pj/zudo-doc/docs/foo", tmpDir, BASE)).toBe("file");
    });

    it("returns 'file' for asset links with extension", async () => {
      mkdirSync(join(tmpDir, "_astro"), { recursive: true });
      writeFileSync(join(tmpDir, "_astro", "style.css"), "");
      expect(await resolveLinkDetail("/pj/zudo-doc/_astro/style.css", tmpDir, BASE)).toBe("file");
    });

    it("keeps an unslashed extension-bearing asset as a file", async () => {
      mkdirSync(join(tmpDir, "assets", "demo"), { recursive: true });
      writeFileSync(join(tmpDir, "assets", "demo", "x.js"), "");
      expect(await resolveLinkDetail("/pj/zudo-doc/assets/demo/x.js", tmpDir, BASE)).toBe("file");
    });

    it("returns 'missing' for non-existent paths", async () => {
      expect(await resolveLinkDetail("/pj/zudo-doc/docs/nope", tmpDir, BASE)).toBe("missing");
    });

    it("returns 'missing' for non-existent asset", async () => {
      expect(await resolveLinkDetail("/pj/zudo-doc/_astro/nope.css", tmpDir, BASE)).toBe("missing");
    });

    // Tag hrefs are emitted percent-encoded (e.g. /docs/tags/type%3Aguide/)
    // while the built output dir keeps the raw tag name — the checker must
    // decode like a static server before the filesystem lookup.
    it("decodes percent-encoded path segments before resolving (with trailing slash)", async () => {
      mkdirSync(join(tmpDir, "docs", "tags", "type:guide"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "tags", "type:guide", "index.html"), "");
      expect(
        await resolveLinkDetail("/pj/zudo-doc/docs/tags/type%3Aguide/", tmpDir, BASE),
      ).toBe("directoryIndex");
    });

    it("resolves build outputs that preserve encoded path segments", async () => {
      mkdirSync(join(tmpDir, "docs", "tags", "type%3Aguide"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "tags", "type%3Aguide", "index.html"), "");
      expect(
        await resolveLinkDetail("/pj/zudo-doc/docs/tags/type%3Aguide/", tmpDir, BASE),
      ).toBe("directoryIndex");
    });

    it("decodes percent-encoded path segments before resolving (no trailing slash)", async () => {
      mkdirSync(join(tmpDir, "docs", "tags", "type:guide"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "tags", "type:guide", "index.html"), "");
      expect(
        await resolveLinkDetail("/pj/zudo-doc/docs/tags/type%3Aguide", tmpDir, BASE),
      ).toBe("directoryIndex");
    });

    it("decodes non-ASCII percent-encoded segments", async () => {
      mkdirSync(join(tmpDir, "docs", "tags", "ガイド"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "tags", "ガイド", "index.html"), "");
      expect(
        await resolveLinkDetail(
          `/pj/zudo-doc/docs/tags/${encodeURIComponent("ガイド")}/`,
          tmpDir,
          BASE,
        ),
      ).toBe("directoryIndex");
    });

    it("returns 'missing' for an encoded href whose decoded target does not exist", async () => {
      expect(
        await resolveLinkDetail("/pj/zudo-doc/docs/tags/type%3Anope/", tmpDir, BASE),
      ).toBe("missing");
    });

    it("treats a malformed percent sequence as a literal path (no crash)", async () => {
      expect(
        await resolveLinkDetail("/pj/zudo-doc/docs/100%-done", tmpDir, BASE),
      ).toBe("missing");
    });
  });

  // --- extractMdxAbsoluteLinks ---

  describe("extractMdxAbsoluteLinks", () => {
    it("finds markdown links starting with /docs/", () => {
      const content = `See [guide](/docs/guides/foo) for details.`;
      expect(extractMdxAbsoluteLinks(content, [])).toEqual([
        { href: "/docs/guides/foo", line: 1 },
      ]);
    });

    it("finds markdown links starting with /ja/docs/", () => {
      const content = `See [guide](/ja/docs/guides/foo) for details.`;
      expect(extractMdxAbsoluteLinks(content, ["ja"])).toEqual([
        { href: "/ja/docs/guides/foo", line: 1 },
      ]);
    });

    it("finds JSX href with /docs/", () => {
      const content = `<a href="/docs/guides/foo">link</a>`;
      expect(extractMdxAbsoluteLinks(content, [])).toEqual([
        { href: "/docs/guides/foo", line: 1 },
      ]);
    });

    it("finds JSX href with /ja/docs/", () => {
      const content = `<a href="/ja/docs/guides/foo">link</a>`;
      expect(extractMdxAbsoluteLinks(content, ["ja"])).toEqual([
        { href: "/ja/docs/guides/foo", line: 1 },
      ]);
    });

    it("ignores links that include base path", () => {
      const content = `[link](/pj/zudo-doc/docs/guides/foo)`;
      expect(extractMdxAbsoluteLinks(content, [])).toEqual([]);
    });

    it("reports correct line numbers", () => {
      const content = [
        "line 1",
        "line 2",
        "[link](/docs/foo)",
        "line 4",
        "[link2](/docs/bar)",
      ].join("\n");
      expect(extractMdxAbsoluteLinks(content, [])).toEqual([
        { href: "/docs/foo", line: 3 },
        { href: "/docs/bar", line: 5 },
      ]);
    });

    it("finds multiple links on same line", () => {
      const content = `[a](/docs/foo) and [b](/docs/bar)`;
      expect(extractMdxAbsoluteLinks(content, [])).toEqual([
        { href: "/docs/foo", line: 1 },
        { href: "/docs/bar", line: 1 },
      ]);
    });

    it("does not match partial paths like /documentary/", () => {
      const content = `[link](/documentary/something)`;
      expect(extractMdxAbsoluteLinks(content, [])).toEqual([]);
    });

    it("finds /de/docs/... link when 'de' locale is in the locales list", () => {
      const content = `See [guide](/de/docs/guides/foo) for details.`;
      expect(extractMdxAbsoluteLinks(content, ["de"])).toEqual([
        { href: "/de/docs/guides/foo", line: 1 },
      ]);
    });

    it("rejects a missing locale list instead of assuming a locale", () => {
      const content = `See [guide](/ja/docs/guides/foo) for details.`;
      expect(() => extractMdxAbsoluteLinks(content)).toThrow(
        "locales must be passed explicitly",
      );
    });

    it("finds links for all declared locales when multiple locales are provided", () => {
      const content = [
        "[a](/ja/docs/a)",
        "[b](/de/docs/b)",
        "[c](/zh/docs/c)",
      ].join("\n");
      const result = extractMdxAbsoluteLinks(content, ["ja", "de", "zh"]);
      expect(result).toEqual([
        { href: "/ja/docs/a", line: 1 },
        { href: "/de/docs/b", line: 2 },
        { href: "/zh/docs/c", line: 3 },
      ]);
    });

    it("finds JSX href with declared locale", () => {
      const content = `<a href="/de/docs/guides/foo">link</a>`;
      expect(extractMdxAbsoluteLinks(content, ["de"])).toEqual([
        { href: "/de/docs/guides/foo", line: 1 },
      ]);
    });

    it("skips links inside fenced code blocks", () => {
      const content = [
        "[before](/docs/visible)",
        "```js",
        "[inside](/docs/hidden)",
        "```",
        "[after](/docs/also-visible)",
      ].join("\n");
      const result = extractMdxAbsoluteLinks(content, []);
      expect(result).toEqual([
        { href: "/docs/visible", line: 1 },
        { href: "/docs/also-visible", line: 5 },
      ]);
    });

    it("skips links inside multiple code blocks", () => {
      const content = [
        "```",
        "[a](/docs/hidden1)",
        "```",
        "[b](/docs/visible)",
        "```tsx",
        '[c](/docs/hidden2)',
        "```",
      ].join("\n");
      const result = extractMdxAbsoluteLinks(content, []);
      expect(result).toEqual([{ href: "/docs/visible", line: 4 }]);
    });
  });

  describe("extractMdxFragmentLinks", () => {
    it("finds relative, local, query-plus-fragment, and empty fragments", () => {
      const content = [
        "[relative](./other.mdx#target)",
        "[local](#local)",
        "[query](./other.mdx?view=all#target)",
        "[empty](#)",
      ].join("\n");
      expect(extractMdxFragmentLinks(content)).toEqual([
        { href: "./other.mdx#target", line: 1 },
        { href: "#local", line: 2 },
        { href: "./other.mdx?view=all#target", line: 3 },
        { href: "#", line: 4 },
      ]);
    });

    it("preserves fenced-code and inline-code exclusions", () => {
      const content = [
        "`[inline](./other.mdx#hidden)`",
        "~~~md",
        "[fenced](./other.mdx#hidden)",
        "~~~",
        "[visible](./other.mdx#shown)",
      ].join("\n");
      expect(extractMdxFragmentLinks(content)).toEqual([
        { href: "./other.mdx#shown", line: 5 },
      ]);
    });

    it("skips protocol-relative URLs in markdown links", () => {
      expect(
        extractMdxFragmentLinks("[external](//example.com/p#frag)"),
      ).toEqual([]);
    });

    it("skips protocol-relative URLs in JSX href attributes", () => {
      expect(
        extractMdxFragmentLinks(`<a href="//example.com/p#frag">External</a>`),
      ).toEqual([]);
    });

    it("still treats a genuine site-root path as internal in markdown links", () => {
      expect(
        extractMdxFragmentLinks("[root](/docs/x/#frag)"),
      ).toEqual([{ href: "/docs/x/#frag", line: 1 }]);
    });

    it("still treats a genuine site-root path as internal in JSX href attributes", () => {
      expect(
        extractMdxFragmentLinks(`<a href="/docs/x/#frag">Root</a>`),
      ).toEqual([{ href: "/docs/x/#frag", line: 1 }]);
    });
  });

  // --- checkHtmlLinksAndTrailing (integration) ---

  describe("checkHtmlLinksAndTrailing", () => {
    const BASE = "/pj/zudo-doc/";

    it("detects broken internal links with base path stripping", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/pj/zudo-doc/docs/missing">Missing</a>`,
      );

      const { broken, trailingSlash } = await checkHtmlLinksAndTrailing(
        distDir,
        tmpDir,
        BASE,
      );
      expect(broken).toEqual([
        {
          file: "dist/docs/page1/index.html",
          line: 1,
          href: "/pj/zudo-doc/docs/missing",
        },
      ]);
      expect(trailingSlash).toEqual([]);
    });

    it("passes when all links resolve", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "a"), { recursive: true });
      mkdirSync(join(distDir, "docs", "b"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "a", "index.html"),
        `<a href="/pj/zudo-doc/docs/b">B</a>`,
      );
      writeFileSync(join(distDir, "docs", "b", "index.html"), "<p>B</p>");

      const { broken } = await checkHtmlLinksAndTrailing(distDir, tmpDir, BASE);
      expect(broken).toEqual([]);
    });

    it("reports how many built HTML links and ids were inspected", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "target"), { recursive: true });
      writeFileSync(
        join(distDir, "index.html"),
        `<a href=/docs/target#section&amp;details>Target</a>`,
      );
      writeFileSync(
        join(distDir, "docs", "target", "index.html"),
        `<h2 id=section&#x26;details>Target</h2>`,
      );

      const { broken, anchors, scanned } = await checkHtmlLinksAndTrailing(
        distDir,
        tmpDir,
      );
      expect(broken).toEqual([]);
      expect(anchors).toEqual([]);
      expect(scanned).toEqual({ links: 1, ids: 1 });
    });

    it("collects protocol-relative hrefs as informational notices without affecting broken/anchors", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(distDir, { recursive: true });
      writeFileSync(
        join(distDir, "index.html"),
        [
          "<html>",
          '<a href="//docs/guide">Typo?</a>',
          '<a href="//example.com/path">External</a>',
        ].join("\n"),
      );

      const { broken, anchors, trailingSlash, protocolRelative } =
        await checkHtmlLinksAndTrailing(distDir, tmpDir);
      expect(broken).toEqual([]);
      expect(anchors).toEqual([]);
      expect(trailingSlash).toEqual([]);
      expect(protocolRelative).toEqual([
        { file: "dist/index.html", line: 2, href: "//docs/guide" },
        { file: "dist/index.html", line: 3, href: "//example.com/path" },
      ]);
    });

    it("validates hierarchical, h5/h6, and non-heading target ids", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "source"), { recursive: true });
      mkdirSync(join(distDir, "docs", "target"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "source", "index.html"),
        [
          '<a href="../target/#parent-child">hierarchical</a>',
          '<a href="../target/#parent-child-deep">h5</a>',
          '<a href="../target/#static-target">static</a>',
        ].join("\n"),
      );
      writeFileSync(
        join(distDir, "docs", "target", "index.html"),
        '<h3 id="parent-child"></h3><h5 id="parent-child-deep"></h5><div id="static-target"></div>',
      );

      const { anchors } = await checkHtmlLinksAndTrailing(distDir, tmpDir);
      expect(anchors).toEqual([]);
    });

    it("validates anchors on slashed extension-bearing viewer directories", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "files", "demo", "x.js"), { recursive: true });
      writeFileSync(
        join(distDir, "index.html"),
        '<a href="/files/demo/x.js/#L12">Source</a>',
      );
      writeFileSync(
        join(distDir, "files", "demo", "x.js", "index.html"),
        '<span id="L12">line 12</span>',
      );

      const { broken, anchors } = await checkHtmlLinksAndTrailing(distDir, tmpDir);
      expect(broken).toEqual([]);
      expect(anchors).toEqual([]);
    });

    it("reports a missing anchor on a slashed extension-bearing viewer directory", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "files", "demo", "x.js"), { recursive: true });
      writeFileSync(
        join(distDir, "index.html"),
        '<a href="/files/demo/x.js/#L999">Source</a>',
      );
      writeFileSync(
        join(distDir, "files", "demo", "x.js", "index.html"),
        '<span id="L12">line 12</span>',
      );

      const { broken, anchors } = await checkHtmlLinksAndTrailing(distDir, tmpDir);
      expect(broken).toEqual([]);
      expect(anchors).toEqual([
        {
          file: "dist/index.html",
          line: 1,
          href: "/files/demo/x.js/#L999",
          fragment: "L999",
          reason: "missing target id",
        },
      ]);
    });

    it("reports leaf-only and missing anchors with source details", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "source"), { recursive: true });
      mkdirSync(join(distDir, "docs", "target"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "source", "index.html"),
        '<a href="../target/#child">leaf only</a>\n<a href="../target/#absent">missing</a>',
      );
      writeFileSync(
        join(distDir, "docs", "target", "index.html"),
        '<h3 id="parent-child"></h3>',
      );

      const { anchors } = await checkHtmlLinksAndTrailing(distDir, tmpDir);
      expect(anchors).toEqual([
        {
          file: "dist/docs/source/index.html", line: 1,
          href: "../target/#child", fragment: "child", reason: "missing target id",
        },
        {
          file: "dist/docs/source/index.html", line: 2,
          href: "../target/#absent", fragment: "absent", reason: "missing target id",
        },
      ]);
    });

    it("handles local, query, encoded, empty, and malformed fragments", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "source"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "source", "index.html"),
        [
          '<div id="local"></div><div id="foo bar"></div>',
          '<a href="#local">local</a>',
          '<a href="?view=all#local">query</a>',
          '<a href="#foo%20bar">encoded</a>',
          '<a href="#">empty</a>',
          '<a href="#bad%ZZ">malformed</a>',
        ].join("\n"),
      );

      const { anchors } = await checkHtmlLinksAndTrailing(distDir, tmpDir);
      expect(anchors).toEqual([
        {
          file: "dist/docs/source/index.html", line: 5,
          href: "#", fragment: "", reason: "empty fragment",
        },
        {
          file: "dist/docs/source/index.html", line: 6,
          href: "#bad%ZZ", fragment: "bad%ZZ", reason: "malformed percent-encoding",
        },
      ]);
    });

    it("keeps anchor checks behind version exclude patterns", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "source"), { recursive: true });
      mkdirSync(join(distDir, "v", "1.0", "target"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "source", "index.html"),
        '<a href="/v/1.0/target/#missing">versioned</a>',
      );
      writeFileSync(join(distDir, "v", "1.0", "target", "index.html"), "<p>target</p>");

      const { anchors } = await checkHtmlLinksAndTrailing(
        distDir, tmpDir, "/", [/\/v\/[^/]+\//],
      );
      expect(anchors).toEqual([]);
    });
  });

  // --- checkMdxLinks (integration) ---

  describe("checkMdxLinks", () => {
    it("detects absolute /docs/ links in MDX files", async () => {
      const docsDir = join(tmpDir, "src", "content", "docs");
      mkdirSync(join(docsDir, "guides"), { recursive: true });
      writeFileSync(
        join(docsDir, "guides", "test.mdx"),
        "---\ntitle: Test\n---\n\nSee [foo](/docs/guides/foo) for details.",
      );

      const warnings = await checkMdxLinks([docsDir], tmpDir, null, "/", []);
      expect(warnings).toEqual([
        {
          file: "src/content/docs/guides/test.mdx",
          line: 5,
          href: "/docs/guides/foo",
        },
      ]);
    });

    it("handles .md files too", async () => {
      const docsDir = join(tmpDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(docsDir, "readme.md"),
        "[link](/docs/ref)",
      );

      const warnings = await checkMdxLinks([docsDir], tmpDir, null, "/", []);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.href).toBe("/docs/ref");
    });

    it("scans links for every explicitly provided locale", async () => {
      const docsDir = join(tmpDir, "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(docsDir, "locales.mdx"),
        "[ja](/ja/docs/a)\n[de](/de/docs/b)\n[unknown](/zh/docs/c)",
      );

      const warnings = await checkMdxLinks(
        [docsDir],
        tmpDir,
        null,
        "/",
        ["ja", "de"],
      );
      expect(warnings.map(({ href }) => href)).toEqual([
        "/ja/docs/a",
        "/de/docs/b",
      ]);
    });

    it("rejects a missing locale list", async () => {
      await expect(checkMdxLinks([], tmpDir)).rejects.toThrow(
        "locales must be passed explicitly",
      );
    });

    it("skips non-existent directories", async () => {
      const warnings = await checkMdxLinks(
        [join(tmpDir, "nonexistent")],
        tmpDir,
        null,
        "/",
        [],
      );
      expect(warnings).toEqual([]);
    });
  });

  describe("checkMdxAnchors", () => {
    it("validates hierarchical h5/h6 and explicit static ids in relative targets", async () => {
      const docsDir = join(tmpDir, "src", "content", "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(docsDir, "source.mdx"),
        [
          "[child](./target.mdx#parent-child)",
          "[deep](./target.mdx#parent-child-deep)",
          "[static](./target.mdx#static-target)",
        ].join("\n"),
      );
      writeFileSync(
        join(docsDir, "target.mdx"),
        "## Parent\n### Child\n##### Deep\n<div id=\"static-target\" />",
      );

      expect(await checkMdxAnchors([docsDir], tmpDir, "/", [])).toEqual([]);
    });

    it("does not mistake prose containing id syntax for a static element id", async () => {
      const docsDir = join(tmpDir, "src", "content", "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(join(docsDir, "source.mdx"), "[x](./target.mdx#not-an-id)");
      writeFileSync(join(docsDir, "target.mdx"), 'The syntax is `id="not-an-id"`.');

      const anchors = await checkMdxAnchors([docsDir], tmpDir, "/", []);
      expect(anchors).toHaveLength(1);
      expect(anchors[0]?.reason).toBe("missing target id");
    });

    it("reports the leaf-only mistake and a nonexistent anchor", async () => {
      const docsDir = join(tmpDir, "src", "content", "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(docsDir, "source.mdx"),
        "[leaf](./target.mdx#child)\n[missing](./target.mdx#nonexistent-anchor)",
      );
      writeFileSync(join(docsDir, "target.mdx"), "## Parent\n### Child");

      const anchors = await checkMdxAnchors([docsDir], tmpDir, "/", []);
      expect(anchors).toEqual([
        {
          file: "src/content/docs/source.mdx", line: 1,
          href: "./target.mdx#child", fragment: "child", reason: "missing target id",
        },
        {
          file: "src/content/docs/source.mdx", line: 2,
          href: "./target.mdx#nonexistent-anchor", fragment: "nonexistent-anchor", reason: "missing target id",
        },
      ]);
    });

    it("handles local, query, percent-encoded, empty, and malformed fragments", async () => {
      const docsDir = join(tmpDir, "src", "content", "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(docsDir, "source.mdx"),
        [
          "## Local",
          '<div id="foo bar" />',
          "[local](#local)",
          "[query](./target.mdx?view=all#target)",
          "[encoded](#foo%20bar)",
          "[empty](#)",
          "[malformed](#bad%ZZ)",
        ].join("\n"),
      );
      writeFileSync(join(docsDir, "target.mdx"), "## Target");

      const anchors = await checkMdxAnchors([docsDir], tmpDir, "/", []);
      expect(anchors).toEqual([
        {
          file: "src/content/docs/source.mdx", line: 6,
          href: "#", fragment: "", reason: "empty fragment",
        },
        {
          file: "src/content/docs/source.mdx", line: 7,
          href: "#bad%ZZ", fragment: "bad%ZZ", reason: "malformed percent-encoding",
        },
      ]);
    });

    it("resolves a JA-to-EN anchor in the actual EN target", async () => {
      const docsDir = join(tmpDir, "src", "content", "docs");
      const jaDir = join(tmpDir, "src", "content", "docs-ja");
      mkdirSync(docsDir, { recursive: true });
      mkdirSync(jaDir, { recursive: true });
      writeFileSync(join(docsDir, "target.mdx"), "## English Target");
      writeFileSync(join(jaDir, "target.mdx"), "## Japanese Target");
      writeFileSync(jaDir + "/source.mdx", "[EN](/docs/target#english-target)");

      expect(
        await checkMdxAnchors([docsDir, jaDir], tmpDir, "/", ["ja"]),
      ).toEqual([]);
    });

    it("keeps source anchor checks behind version exclude patterns", async () => {
      const docsDir = join(tmpDir, "src", "content", "docs");
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(
        join(docsDir, "source.mdx"),
        "[versioned](/v/1.0/docs/target#missing)",
      );
      expect(
        await checkMdxAnchors([docsDir], tmpDir, "/", [], [/\/v\/[^/]+\//]),
      ).toEqual([]);
    });
  });

  describe("readAllowlist", () => {
    it("preserves href fragments while ignoring comment-only lines", async () => {
      const file = join(tmpDir, ".check-links-allowlist");
      writeFileSync(
        file,
        "# comment\nsrc/content/docs/a.mdx:3:./b.mdx#target\n",
      );
      expect(await readAllowlist(file)).toEqual(
        new Set(["src/content/docs/a.mdx:3:./b.mdx#target"]),
      );
    });
  });

  // --- checkHtmlLinksAndTrailing trailing-slash output ---

  describe("checkHtmlLinksAndTrailing trailing-slash output", () => {
    const BASE = "/pj/zudo-doc/";

    async function collectTrailingSlashWarnings(
      distDir: string,
      excludePatterns: RegExp[] = [],
    ) {
      const { trailingSlash } = await checkHtmlLinksAndTrailing(
        distDir,
        tmpDir,
        BASE,
        excludePatterns,
        true,
      );
      return trailingSlash;
    }

    it("warns when a page link resolves via directory index but has no trailing slash", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      mkdirSync(join(distDir, "docs", "page2"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/pj/zudo-doc/docs/page2">Page2</a>`,
      );
      writeFileSync(join(distDir, "docs", "page2", "index.html"), "<p>Page2</p>");

      const warnings = await collectTrailingSlashWarnings(distDir);
      expect(warnings).toEqual([
        {
          file: "dist/docs/page1/index.html",
          line: 1,
          href: "/pj/zudo-doc/docs/page2",
        },
      ]);
    });

    it("does not warn when link already has trailing slash", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      mkdirSync(join(distDir, "docs", "page2"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/pj/zudo-doc/docs/page2/">Page2</a>`,
      );
      writeFileSync(join(distDir, "docs", "page2", "index.html"), "<p>Page2</p>");

      const warnings = await collectTrailingSlashWarnings(distDir);
      expect(warnings).toEqual([]);
    });

    it("does not warn for asset links with file extensions", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      mkdirSync(join(distDir, "_astro"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/pj/zudo-doc/_astro/style.css">CSS</a>`,
      );
      writeFileSync(join(distDir, "_astro", "style.css"), "body {}");

      const warnings = await collectTrailingSlashWarnings(distDir);
      expect(warnings).toEqual([]);
    });

    it("does not warn for root link /", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/">Home</a>`,
      );

      const warnings = await collectTrailingSlashWarnings(distDir);
      expect(warnings).toEqual([]);
    });

    it("does not warn for . and ./ links", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href=".">Dot</a><a href="./">DotSlash</a>`,
      );

      const warnings = await collectTrailingSlashWarnings(distDir);
      expect(warnings).toEqual([]);
    });

    it("warns for link with query string where path is missing trailing slash", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      mkdirSync(join(distDir, "docs", "page2"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/pj/zudo-doc/docs/page2?x=1">Page2</a>`,
      );
      writeFileSync(join(distDir, "docs", "page2", "index.html"), "<p>Page2</p>");

      const warnings = await collectTrailingSlashWarnings(distDir);
      expect(warnings).toEqual([
        {
          file: "dist/docs/page1/index.html",
          line: 1,
          href: "/pj/zudo-doc/docs/page2?x=1",
        },
      ]);
    });

    it("does not warn for links to .html files (resolved as 'file' type)", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      mkdirSync(join(distDir, "docs"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/pj/zudo-doc/docs/foo">Foo</a>`,
      );
      writeFileSync(join(distDir, "docs", "foo.html"), "<p>Foo</p>");

      const warnings = await collectTrailingSlashWarnings(distDir);
      expect(warnings).toEqual([]);
    });

    it("respects excludePatterns", async () => {
      const distDir = join(tmpDir, "dist");
      mkdirSync(join(distDir, "docs", "page1"), { recursive: true });
      mkdirSync(join(distDir, "v", "1.0", "page2"), { recursive: true });
      writeFileSync(
        join(distDir, "docs", "page1", "index.html"),
        `<a href="/pj/zudo-doc/v/1.0/page2">Versioned</a>`,
      );
      writeFileSync(join(distDir, "v", "1.0", "page2", "index.html"), "<p>V</p>");

      const excludePatterns = [/\/v\/[^/]+\//];
      const warnings = await collectTrailingSlashWarnings(
        distDir,
        excludePatterns,
      );
      expect(warnings).toEqual([]);
    });

  });

  // --- formatReport ---

  describe("formatReport", () => {
    it("formats report with both broken links and warnings", () => {
      const report = formatReport(
        [{ file: "dist/page.html", line: 10, href: "/broken" }],
        [{ file: "src/content/docs/test.mdx", line: 5, href: "/docs/foo" }],
      );
      expect(report).toContain("=== Broken Links in Built HTML ===");
      expect(report).toContain("dist/page.html:10  /broken");
      expect(report).toContain(
        "=== Absolute Links Bypassing Base Path (MDX Source) ===",
      );
      expect(report).toContain("src/content/docs/test.mdx:5  /docs/foo");
      expect(report).toContain(
        "✗ Found 1 broken link and 1 absolute path warning",
      );
    });

    it("shows success message when no issues", () => {
      const report = formatReport([], []);
      expect(report).toContain(
        "✓ No broken links, invalid anchors, or absolute path issues found",
      );
    });

    it("pluralizes broken links correctly", () => {
      const report = formatReport(
        [
          { file: "a.html", line: 1, href: "/a" },
          { file: "b.html", line: 2, href: "/b" },
        ],
        [],
      );
      expect(report).toContain("✗ Found 2 broken links");
    });

    it("formats only warnings when no broken links", () => {
      const report = formatReport(
        [],
        [{ file: "test.mdx", line: 1, href: "/docs/x" }],
      );
      expect(report).not.toContain("=== Broken Links");
      expect(report).toContain("=== Absolute Links");
      expect(report).toContain("✗ Found 1 absolute path warning");
    });

    it("formats only broken links when no warnings", () => {
      const report = formatReport(
        [{ file: "a.html", line: 1, href: "/a" }],
        [],
      );
      expect(report).toContain("=== Broken Links");
      expect(report).not.toContain("=== Absolute Links");
      expect(report).toContain("✗ Found 1 broken link");
    });

    it("formats invalid anchors as their own category with the fragment", () => {
      const report = formatReport([], [], [], [
        {
          file: "src/content/docs/a.mdx",
          line: 3,
          href: "./b.mdx#missing",
          fragment: "missing",
          reason: "missing target id",
        },
      ]);
      expect(report).toContain("=== Invalid Anchors ===");
      expect(report).toContain(
        "./b.mdx#missing  (fragment: #missing; missing target id)",
      );
      expect(report).toContain("✗ Found 1 invalid anchor");
    });

    it("lists protocol-relative links informationally without affecting the ✓ summary", () => {
      const report = formatReport([], [], [], [], [
        { file: "dist/index.html", line: 2, href: "//docs/guide" },
      ]);
      expect(report).toContain("=== Protocol-Relative Links (informational) ===");
      expect(report).toContain("dist/index.html:2  //docs/guide");
      expect(report).toContain(
        "✓ No broken links, invalid anchors, or absolute path issues found",
      );
      expect(report).not.toContain("✗ Found");
    });

    it("marks a dotless, colonless authority as a likely internal-path typo", () => {
      const report = formatReport([], [], [], [], [
        { file: "a.html", line: 1, href: "//docs/guide" },
      ]);
      expect(report).toContain(
        "//docs/guide  ← authority has no dot or colon; may be an internal-path typo (e.g. //docs/guide → /docs/guide)",
      );
    });

    it("does not mark an authority with a dot", () => {
      const report = formatReport([], [], [], [], [
        { file: "a.html", line: 1, href: "//example.com/path" },
      ]);
      expect(report).toContain("a.html:1  //example.com/path");
      expect(report).not.toContain("←");
    });

    it("does not mark an authority with a colon (host:port)", () => {
      const report = formatReport([], [], [], [], [
        { file: "a.html", line: 1, href: "//localhost:8080/x" },
      ]);
      expect(report).toContain("a.html:1  //localhost:8080/x");
      expect(report).not.toContain("←");
    });

    it("marks when the authority ends at a query string", () => {
      const report = formatReport([], [], [], [], [
        { file: "a.html", line: 1, href: "//docs?a=1" },
      ]);
      expect(report).toContain("←");
    });

    it("marks when the authority ends at a fragment", () => {
      const report = formatReport([], [], [], [], [
        { file: "a.html", line: 1, href: "//docs#frag" },
      ]);
      expect(report).toContain("←");
    });
  });
});
