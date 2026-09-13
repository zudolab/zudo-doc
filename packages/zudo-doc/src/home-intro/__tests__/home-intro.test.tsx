/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { describe, expect, it } from "vitest";
import { renderToString } from "preact-render-to-string";
import { CompactProse, resolveHomeIntro } from "../index.js";
import { prepareHomeIntro, prepareHomeIntros, resolveIntroUrl } from "../prepare.js";
import { DEFAULT_SETTINGS, zudoDoc } from "../../config.js";

const settings = { ...DEFAULT_SETTINGS, locales: { en: { label: "English", dir: "docs" }, ja: { label: "日本語", dir: "docs-ja" } } };
async function html(source: string, options = settings) {
  const intro = await prepareHomeIntro(source, options, "ja");
  return renderToString(<CompactProse intro={JSON.parse(JSON.stringify(intro))} />);
}

describe("home introduction contract", () => {
  it("resolves locale overrides, explicit empty and blank headings independently", () => {
    const configured = { ...settings, home: { introMarkdown: "Fallback", sitemapHeading: "Index" }, locales: { ...settings.locales, ja: { ...settings.locales.ja, introMarkdown: "", sitemapHeading: "  " } } };
    expect(resolveHomeIntro(configured, "en", "Explore")).toEqual({ introMarkdown: "Fallback", sitemapHeading: "Index" });
    expect(resolveHomeIntro(configured, "ja", "探す")).toEqual({ introMarkdown: "", sitemapHeading: "探す" });
    expect(resolveHomeIntro(settings, "en", "Explore")).toEqual({ introMarkdown: "", sitemapHeading: "Explore" });
  });

  it("roundtrips new serializable settings through the public config API", () => {
    const config = zudoDoc({ home: { introMarkdown: "# Intro\n\nHello", sitemapHeading: "Index" }, locales: { ja: { dir: "docs-ja", label: "日本語", introMarkdown: "紹介", sitemapHeading: "目次" } } });
    const routes = config.plugins?.find(plugin => typeof plugin !== "string" && plugin.name.endsWith("/routes"));
    const encoded = JSON.stringify(routes);
    expect(encoded).toContain("introMarkdown");
    expect(encoded).toContain("紹介");
    expect(encoded).toContain("目次");
  });

  it("omits whitespace and serializes all locale results including explicit suppression", async () => {
    expect(await html(" \n\t ")).toBe("");
    expect(await prepareHomeIntros(settings)).toEqual({});
    const prepared = await prepareHomeIntros({ ...settings, home: { introMarkdown: "Hello" }, locales: { ...settings.locales, ja: { ...settings.locales.ja, introMarkdown: "" } } });
    expect(prepared.en?.nodes.length).toBeGreaterThan(0);
    expect(prepared.ja).toBeNull();
  });

  it("renders the Markdown/GFM baseline with normal typography and compact headings", async () => {
    const output = await html('# Intro\n\n## Section\n\nHello **bold** *emphasis* ~~deleted~~ and `inline`.\n\n- Parent\n  - Child\n- [x] Done\n\n1. First\n2. Second\n\n> Quoted\n\n[Docs](docs/start "Go") ![Image](/images/logo.png "Logo")\n\n| A | B |\n| :- | -: |\n| 1 | 2 |\n\n---\n\n```js\nconst answer = 42;\n```');
    for (const expected of ["<h2", "<strong", "<em", "<del", "<ul", "<ol", "<blockquote", "<table", "<hr", 'class="hi-root"', "hi-kw", 'href="/ja/docs/start"', 'src="/images/logo.png"', 'alt="Image"', 'title="Logo"', 'type="checkbox"', "disabled", "checked"]) expect(output).toContain(expected);
    expect(output).not.toContain("<h1");
    expect(output).not.toContain("hash-link");
    expect(output).not.toContain("dangerouslySetInnerHTML");
    // #4194: every compact h2 carries the shared home section-heading class list.
    expect(output).toMatch(/<h2 [^>]*class="zd-home-heading text-title font-bold leading-tight"/);
    expect(output).not.toMatch(/<h[3-6] [^>]*zd-home-heading/);
  });

  it.each([
    '<script>alert(1)</script>', '<img src="x" onerror="alert(1)">', '<Widget />',
    'import Foo from "foo"', 'export const foo = 1', '{globalThis.alert(1)}',
    '[x](javascript:alert%281%29)', '[x](java&#x73;cript:alert%281%29)',
    '![x](data:image/svg+xml,bad)', '[x](vbscript:bad)', '[x](//evil.test)',
    ':::note\nText\n:::', ':::include{file="./secret.md"}', '---\ntitle: Nope\n---\nBody',
  ])("diagnoses unsafe or unsupported input: %s", async source => {
    await expect(html(source)).rejects.toThrow(/home.introMarkdown/);
  });

  it("keeps code examples inert, ruby and alerts supported, and Mermaid feature-gated", async () => {
    expect(await html('```html\n<script>alert(1)</script>\n```')).not.toContain("<script>");
    expect(await html('{漢字}^{かんじ}')).toContain("<ruby>");
    expect(await html('> [!NOTE]\n> Useful')).toContain('data-admonition="note"');
    expect(await html('```mermaid\ngraph TD; A-->B\n```')).toContain('data-mermaid');
    expect(await html('```mermaid\ngraph TD; A-->B\n```', { ...settings, mermaid: false })).not.toContain("data-mermaid");
    expect(await html('$$x^2$$')).toContain('$$x^2$$');
  });
});

describe("homepage URL context for links and images", () => {
  it.each([
    ["/", "en", "docs/start", "/docs/start"],
    ["/", "ja", "docs/start", "/ja/docs/start"],
    ["/manual/", "en", "docs/start", "/manual/docs/start"],
    ["/manual/", "ja", "docs/start", "/manual/ja/docs/start"],
    ["/manual/", "ja", "/docs/start", "/manual/docs/start"],
    ["/manual/", "ja", "/ja/docs/start", "/manual/ja/docs/start"],
    ["/manual/", "ja", "/manual/ja/docs/start", "/manual/ja/docs/start"],
    ["/manual/", "ja", "../images/logo.png", "/manual/images/logo.png"],
    ["/manual/", "ja", "#section", "#section"],
    ["/manual/", "ja", "?view=all", "/manual/ja/?view=all"],
    ["/manual/", "ja", "images/my logo.png", "/manual/ja/images/my%20logo.png"],
    ["/manual/", "ja", "https://home-intro.invalid/a", "https://home-intro.invalid/a"],
    ["/manual/", "ja", "guide.mdx", "/manual/ja/guide.mdx"],
    ["/manual/", "ja", "https://example.com/a?q=1#b", "https://example.com/a?q=1#b"],
  ])("%s %s %s -> %s", (base, locale, authored, expected) => {
    expect(resolveIntroUrl(authored, { ...settings, base }, locale)).toBe(expected);
  });
  it("retains safe external link schemes and rejects non-web image schemes", () => {
    expect(resolveIntroUrl("mailto:hello@example.com", settings, "en")).toBe("mailto:hello@example.com");
    expect(() => resolveIntroUrl("mailto:hello@example.com", settings, "en", true)).toThrow();
  });
});
