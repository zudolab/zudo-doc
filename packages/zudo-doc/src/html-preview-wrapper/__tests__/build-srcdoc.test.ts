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
