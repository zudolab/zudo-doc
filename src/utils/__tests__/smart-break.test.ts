import { describe, it, expect } from "vitest";
import { isDescription } from "@takazudo/zfb/zudo-react";
import {
  isPathLike,
  smartBreak,
  smartBreakToHtml,
  SmartBreak,
} from "@takazudo/zudo-doc/smart-break";
import { renderSsr } from "../../../packages/zudo-doc/src/__tests__/helpers/zudo-react.js";

// -----------------------------------------------------------------------------
// isPathLike
// -----------------------------------------------------------------------------

describe("isPathLike", () => {
  const positiveCases: Array<[string, string]> = [
    ["URL with scheme, query, fragment", "https://example.com/a/b?x=1&y=2"],
    ["URL with fragment", "http://foo.com/page#section"],
    ["POSIX absolute path", "/var/log/foo.txt"],
    ["relative path ./", "./foo/bar"],
    ["relative path ../", "../baz/qux"],
    ["Windows backslash path", "C:\\Users\\name\\file.txt"],
    ["Windows forward-slash path", "C:/Users/name/file.txt"],
    ["plausible domain with slash", "example.com/about"],
    ["path-like token embedded in prose", "see /var/log/foo.txt now"],
  ];

  for (const [label, input] of positiveCases) {
    it(`returns true: ${label}`, () => {
      expect(isPathLike(input)).toBe(true);
    });
  }

  const negativeCases: Array<[string, string]> = [
    ["empty string", ""],
    ["hyphenated prose", "well-known"],
    ["multi-hyphen prose", "state-of-the-art"],
    ["and/or conjunction", "and/or"],
    ["version string", "1.2.3-beta.4"],
    ["UI/UX shorthand", "UI/UX"],
  ];

  for (const [label, input] of negativeCases) {
    it(`returns false: ${label}`, () => {
      expect(isPathLike(input)).toBe(false);
    });
  }
});

// -----------------------------------------------------------------------------
// smartBreak
// -----------------------------------------------------------------------------

describe("smartBreak", () => {
  it("returns the original string (not a fragment) when not path-like", () => {
    const result = smartBreak("and/or");
    expect(typeof result).toBe("string");
    expect(result).toBe("and/or");
  });

  it("returns the original empty string when given empty input", () => {
    const result = smartBreak("");
    expect(typeof result).toBe("string");
    expect(result).toBe("");
  });

  it("returns a zudo-react description when path-like", () => {
    const result = smartBreak("/a/b");
    expect(isDescription(result)).toBe(true);
  });

  it("inserts <wbr> after each delimiter in a URL", () => {
    const html = renderSsr(smartBreak("https://example.com/a/b"));
    expect(html).toBe(
      "https:<wbr>/<wbr>/<wbr>example.<wbr>com/<wbr>a/<wbr>b",
    );
  });

  it("handles Windows backslash paths", () => {
    const html = renderSsr(smartBreak("C:\\Users\\name\\file.txt"));
    // colon, each backslash, and the dot before ext should each produce a wbr
    expect(html).toBe(
      "C:<wbr>\\<wbr>Users\\<wbr>name\\<wbr>file.<wbr>txt",
    );
  });

  it("handles URL with query and fragment", () => {
    const html = renderSsr(
      smartBreak("https://example.com/a/b?x=1&y=2#frag"),
    );
    // spot-check a few expected injection points.
    // Note: "&" in input is HTML-escaped to "&amp;" before the injected <wbr>.
    expect(html).toContain("?<wbr>");
    expect(html).toContain("&amp;<wbr>");
    expect(html).toContain("=<wbr>");
    expect(html).toContain("#<wbr>");
  });
});

// -----------------------------------------------------------------------------
// smartBreakToHtml
// -----------------------------------------------------------------------------

describe("smartBreakToHtml", () => {
  it("returns escaped text unchanged when not path-like", () => {
    expect(smartBreakToHtml("and/or")).toBe("and/or");
  });

  it("HTML-escapes angle brackets and ampersands in non-path input", () => {
    expect(smartBreakToHtml("<UI/UX>")).toBe("&lt;UI/UX&gt;");
  });

  it("inserts literal <wbr> after delimiters for a path-like URL", () => {
    expect(smartBreakToHtml("https://a.com/b")).toBe(
      "https:<wbr>/<wbr>/<wbr>a.<wbr>com/<wbr>b",
    );
  });

  it("escapes user-supplied <wbr> text but keeps injected <wbr> literal", () => {
    const out = smartBreakToHtml("/a<wbr>/b");
    // user-authored "<wbr>" is escaped
    expect(out).toContain("&lt;wbr&gt;");
    // at least one genuine injected <wbr> is present (after a "/")
    expect(out).toContain("/<wbr>");
  });

  it("escapes quotes and ampersands inside path-like input", () => {
    const out = smartBreakToHtml("https://example.com/?q=a&b='c'&d=\"e\"");
    expect(out).toContain("&amp;");
    expect(out).toContain("&#39;");
    expect(out).toContain("&quot;");
  });
});

// -----------------------------------------------------------------------------
// Parity: smartBreak (rendered) must match smartBreakToHtml exactly
// -----------------------------------------------------------------------------

describe("parity between smartBreak and smartBreakToHtml", () => {
  const inputs = [
    "https://example.com/a/b?x=1&y=2",
    "http://foo.com/page#section",
    "/var/log/foo.txt",
    "./foo/bar",
    "../baz/qux",
    "C:\\Users\\name\\file.txt",
    "C:/Users/name/file.txt",
    "example.com/about",
    "/a<wbr>/b", // already contains the literal substring "<wbr>"
    "and/or", // non-path prose
    "1.2.3-beta.4", // non-path prose with dots and hyphens
    "<UI/UX>", // non-path with special chars
    "", // empty
  ];

  for (const input of inputs) {
    it(`matches for ${JSON.stringify(input)}`, () => {
      expect(renderSsr(smartBreak(input))).toBe(smartBreakToHtml(input));
    });
  }
});

// -----------------------------------------------------------------------------
// SmartBreak component
// -----------------------------------------------------------------------------

describe("SmartBreak component", () => {
  it("renders a fragment wrapping smartBreak for string children", () => {
    const vnode = SmartBreak({ children: "/a/b" });
    expect(renderSsr(vnode)).toBe("/<wbr>a/<wbr>b");
  });

  it("stringifies non-string children safely", () => {
    const vnode = SmartBreak({ children: undefined });
    expect(renderSsr(vnode)).toBe("");
  });
});
