import { describe, expect, it } from "vitest";
import { buildSrcdoc } from "../html-preview.js";

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
