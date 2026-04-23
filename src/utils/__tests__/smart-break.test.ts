import { describe, it, expect } from "vitest";
import type { VNode } from "preact";
import {
  isPathLike,
  smartBreak,
  smartBreakToHtml,
  SmartBreak,
} from "../smart-break";

// -----------------------------------------------------------------------------
// Test-only helpers: walk a Preact VNode tree and produce an HTML string, so
// we can compare smartBreak() output against smartBreakToHtml() for parity.
// Deliberately minimal — only the surface smartBreak actually emits
// (Fragment, <wbr>, and text) plus a small escape map.
// -----------------------------------------------------------------------------

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE[c]!);
}

const VOID_TAGS = new Set([
  "wbr",
  "br",
  "hr",
  "img",
  "input",
  "meta",
  "link",
]);

function vnodeToHtml(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return htmlEscape(node);
  if (typeof node === "number") return htmlEscape(String(node));
  if (Array.isArray(node)) return node.map(vnodeToHtml).join("");

  const vnode = node as VNode<{ children?: unknown }>;
  if (typeof vnode.type === "string") {
    const tag = vnode.type;
    if (VOID_TAGS.has(tag)) return `<${tag}>`;
    return `<${tag}>${vnodeToHtml(vnode.props?.children)}</${tag}>`;
  }
  // Fragment (or any function/class component): render children only.
  return vnodeToHtml(vnode.props?.children);
}

function renderToHtml(result: VNode | string): string {
  if (typeof result === "string") return htmlEscape(result);
  return vnodeToHtml(result);
}

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

  it("returns a VNode (not a string) when path-like", () => {
    const result = smartBreak("/a/b");
    expect(typeof result).not.toBe("string");
  });

  it("inserts <wbr> after each delimiter in a URL", () => {
    const html = renderToHtml(smartBreak("https://example.com/a/b"));
    expect(html).toBe(
      "https:<wbr>/<wbr>/<wbr>example.<wbr>com/<wbr>a/<wbr>b",
    );
  });

  it("handles Windows backslash paths", () => {
    const html = renderToHtml(smartBreak("C:\\Users\\name\\file.txt"));
    // colon, each backslash, and the dot before ext should each produce a wbr
    expect(html).toBe(
      "C:<wbr>\\<wbr>Users\\<wbr>name\\<wbr>file.<wbr>txt",
    );
  });

  it("handles URL with query and fragment", () => {
    const html = renderToHtml(
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
      expect(renderToHtml(smartBreak(input))).toBe(smartBreakToHtml(input));
    });
  }
});

// -----------------------------------------------------------------------------
// SmartBreak component
// -----------------------------------------------------------------------------

describe("SmartBreak component", () => {
  it("renders a fragment wrapping smartBreak for string children", () => {
    const vnode = SmartBreak({ children: "/a/b" });
    expect(vnodeToHtml(vnode)).toBe("/<wbr>a/<wbr>b");
  });

  it("stringifies non-string children safely", () => {
    const vnode = SmartBreak({ children: undefined });
    expect(vnodeToHtml(vnode)).toBe("");
  });
});
