import { describe, expect, it } from "vitest";
import { buildSrcdoc } from "../html-preview.js";

const fullHeightMarker = "<style>html,body{height:100%}</style>";

describe("buildSrcdoc — document metadata", () => {
  it("emits accessible English metadata for the positional default call", () => {
    const srcdoc = buildSrcdoc("<div>hi</div>");

    expect(srcdoc).toContain('<html lang="en">');
    expect(srcdoc).toContain("<title>Preview</title>");
  });

  it("accepts arbitrary language tags and applies title precedence", () => {
    const authored = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        lang: "zh-Hant-x-preview",
        title: "Visible title",
        previewLabel: "Localized preview",
      },
    );
    const localizedFallback = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { title: "  ", previewLabel: "Aperçu" },
    );
    const literalFallback = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { lang: "\t", title: " ", previewLabel: "\n" },
    );

    expect(authored).toContain('<html lang="zh-Hant-x-preview">');
    expect(authored).toContain("<title>Visible title</title>");
    expect(authored).not.toContain("<title>Localized preview</title>");
    expect(localizedFallback).toContain("<title>Aperçu</title>");
    expect(literalFallback).toContain('<html lang="en">');
    expect(literalFallback).toContain("<title>Preview</title>");
  });

  it("escapes generated language and title in their distinct HTML contexts", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        lang: 'x&"<script>',
        title: "Safe & </title><script>alert(1)</script>",
      },
    );

    expect(srcdoc).toContain('lang="x&amp;&quot;&lt;script&gt;"');
    expect(srcdoc).toContain(
      "<title>Safe &amp; &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>",
    );
    expect(srcdoc).not.toContain("</title><script>alert(1)</script>");
  });

  it.each([
    "<title>Author title</title>",
    '<TITLE data-owner="author">Mixed case</TITLE>',
    "<title\n  data-owner='author'>Whitespace</title>",
    "<title >Spaced</title>",
  ])("defers to a trusted author opening title without duplication: %s", (head) => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      head,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { title: "Generated title", previewLabel: "Fallback" },
    );

    expect(srcdoc).toContain(head);
    expect(srcdoc).not.toContain("<title>Generated title</title>");
    expect(srcdoc).not.toContain("<title>Fallback</title>");
  });

  it("ignores title-like markup inside HTML comments for detection", () => {
    const head = "<!-- <TiTlE data-x='1'>Commented</TiTlE> -->\n<meta name='x'>";
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      head,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { title: "Generated title" },
    );

    expect(srcdoc).toContain("<title>Generated title</title>");
    expect(srcdoc).toContain(head);
  });

  it("does not rewrite malformed or multiple caller-owned title markup", () => {
    const malformedHeads = [
      "<title data-owner='author'",
      '<title data-owner="unterminated > attribute"',
    ];
    const malformedSrcdocs = malformedHeads.map((head) =>
      buildSrcdoc(
        "<div>hi</div>",
        undefined,
        head,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { title: "Generated title" },
      ),
    );
    const multiple = "<title>First</title>\n<TITLE>Second</TITLE>";
    const multipleSrcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      multiple,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { title: "Generated title" },
    );

    malformedSrcdocs.forEach((srcdoc, index) => {
      expect(srcdoc).toContain("<title>Generated title</title>");
      expect(srcdoc).toContain(malformedHeads[index]);
    });
    expect(multipleSrcdoc).toContain(multiple);
    expect(multipleSrcdoc).not.toContain("<title>Generated title</title>");
  });

  it("preserves trusted head bytes and the established injection order", () => {
    const head = "  <meta name='trusted' content='a > b'>\n<!-- exact bytes -->  ";
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      "body{color:red}",
      head,
      undefined,
      true,
      ["https://example.com/a.css"],
      ["https://example.com/a.js"],
      true,
      { lang: "ja", title: "Metadata" },
    );

    const titleIndex = srcdoc.indexOf("<title>Metadata</title>");
    const preflightIndex = srcdoc.indexOf("*,\n::after");
    const fullHeightIndex = srcdoc.indexOf(fullHeightMarker);
    const styleIndex = srcdoc.indexOf(
      '<link rel="stylesheet" href="https://example.com/a.css">',
    );
    const scriptIndex = srcdoc.indexOf(
      '<script src="https://example.com/a.js"></script>',
    );
    const headIndex = srcdoc.indexOf(head);
    const cssIndex = srcdoc.indexOf("<style>body{color:red}</style>");

    expect(titleIndex).toBeGreaterThan(-1);
    expect(preflightIndex).toBeGreaterThan(titleIndex);
    expect(fullHeightIndex).toBeGreaterThan(preflightIndex);
    expect(styleIndex).toBeGreaterThan(fullHeightIndex);
    expect(scriptIndex).toBeGreaterThan(styleIndex);
    expect(headIndex).toBeGreaterThan(scriptIndex);
    expect(cssIndex).toBeGreaterThan(headIndex);
    expect(srcdoc.slice(headIndex, headIndex + head.length)).toBe(head);
  });
});

describe("buildSrcdoc — fullHeight", () => {
  it("omits the fullHeight style when fullHeight is unset", () => {
    const srcdoc = buildSrcdoc("<div>hi</div>");
    expect(srcdoc).not.toContain("html,body{height:100%}");
  });

  it("omits the fullHeight style when fullHeight is false", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      false,
    );
    expect(srcdoc).not.toContain("html,body{height:100%}");
  });

  it("injects the fullHeight style after preflight, before head/css", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      "body{color:red}",
      "<link rel='stylesheet' href='x.css'>",
      undefined,
      true,
    );

    const preflightIdx = srcdoc.indexOf("*,\n::after");
    const fullHeightIdx = srcdoc.indexOf(
      "<style>html,body{height:100%}</style>",
    );
    const headIdx = srcdoc.indexOf("<link rel='stylesheet' href='x.css'>");
    const cssIdx = srcdoc.indexOf("<style>body{color:red}</style>");

    expect(preflightIdx).toBeGreaterThan(-1);
    expect(fullHeightIdx).toBeGreaterThan(-1);
    expect(headIdx).toBeGreaterThan(-1);
    expect(cssIdx).toBeGreaterThan(-1);

    // Injection order contract: preflight -> fullHeight style -> head -> css
    expect(fullHeightIdx).toBeGreaterThan(preflightIdx);
    expect(headIdx).toBeGreaterThan(fullHeightIdx);
    expect(cssIdx).toBeGreaterThan(headIdx);
  });
});

describe("buildSrcdoc — externalStyles / externalScripts / preflight", () => {
  it("emits externalStyles as <link> tags, in order, AFTER preflight/fullHeight and BEFORE head/css", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      "body{color:red}",
      "<meta name='x' content='y'>",
      undefined,
      true,
      ["https://example.com/a.css", "https://example.com/b.css"],
    );

    const preflightIdx = srcdoc.indexOf("*,\n::after");
    const fullHeightIdx = srcdoc.indexOf(
      "<style>html,body{height:100%}</style>",
    );
    const styleAIdx = srcdoc.indexOf(
      '<link rel="stylesheet" href="https://example.com/a.css">',
    );
    const styleBIdx = srcdoc.indexOf(
      '<link rel="stylesheet" href="https://example.com/b.css">',
    );
    const headIdx = srcdoc.indexOf("<meta name='x' content='y'>");
    const cssIdx = srcdoc.indexOf("<style>body{color:red}</style>");

    expect(preflightIdx).toBeGreaterThan(-1);
    expect(fullHeightIdx).toBeGreaterThan(-1);
    expect(styleAIdx).toBeGreaterThan(-1);
    expect(styleBIdx).toBeGreaterThan(-1);
    expect(headIdx).toBeGreaterThan(-1);
    expect(cssIdx).toBeGreaterThan(-1);

    // Full epic-wide order: preflight -> fullHeight -> externalStyles -> head -> css
    expect(fullHeightIdx).toBeGreaterThan(preflightIdx);
    expect(styleAIdx).toBeGreaterThan(fullHeightIdx);
    expect(styleBIdx).toBeGreaterThan(styleAIdx);
    expect(headIdx).toBeGreaterThan(styleBIdx);
    expect(cssIdx).toBeGreaterThan(headIdx);
  });

  it("emits externalScripts as <script src> tags", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      ["https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"],
    );
    expect(srcdoc).toContain(
      '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>',
    );
  });

  it("includes the preflight reset by default (preflight omitted)", () => {
    const srcdoc = buildSrcdoc("<div>hi</div>");
    expect(srcdoc).toContain("*,\n::after");
  });

  it("includes the preflight reset when preflight is explicitly true", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
    expect(srcdoc).toContain("*,\n::after");
  });

  it("omits the preflight reset entirely when preflight is false", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
    expect(srcdoc).not.toContain("*,\n::after");
    expect(srcdoc).not.toContain("<style>" + "\n*,\n::after");
  });

  it("preflight: false does not affect fullHeight/externalStyles/head/css emission", () => {
    const srcdoc = buildSrcdoc(
      "<div>hi</div>",
      "body{color:red}",
      "<meta name='x'>",
      undefined,
      true,
      ["https://example.com/a.css"],
      undefined,
      false,
    );
    expect(srcdoc).not.toContain("*,\n::after");
    expect(srcdoc).toContain("<style>html,body{height:100%}</style>");
    expect(srcdoc).toContain(
      '<link rel="stylesheet" href="https://example.com/a.css">',
    );
    expect(srcdoc).toContain("<meta name='x'>");
    expect(srcdoc).toContain("<style>body{color:red}</style>");
  });
});
