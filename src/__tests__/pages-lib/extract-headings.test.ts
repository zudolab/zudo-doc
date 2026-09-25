/**
 * extract-headings.test.ts
 *
 * Unit tests for pages/lib/_extract-headings.ts covering slug fidelity and the
 * hierarchical allocation contract mirrored from zfb's Heading Links plugin.
 */

import { describe, it, expect } from "vitest";
import { compile } from "@takazudo/zfb-md-wasm";
import { renderHtml } from "@takazudo/zfb-md-wasm/render";
import { extractAllHeadingIds } from "@takazudo/zudo-doc/extract-headings";
import { extractHeadings, slugify } from "../../../pages/lib/_extract-headings";

/**
 * Reference: the slug the renderer assigns is `slugify(plainText)` for a first
 * (non-duplicated) occurrence — the same exact-zfb-port slugify the extractor
 * uses. (For clean text this also equals github-slugger's output.)
 */
function renderedSlug(plainText: string): string {
  return slugify(plainText);
}

describe("extractHeadings — slug fidelity", () => {
  it("matches rendered id for a heading with inline code", () => {
    const body = "## Install `foo-bar`\n\nSome text.";
    const [heading] = extractHeadings(body);
    // Rendered: <h2 id="install-foo-bar">Install <code>foo-bar</code></h2>
    expect(heading?.slug).toBe(renderedSlug("Install foo-bar"));
    expect(heading?.slug).toBe("install-foo-bar");
    expect(heading?.text).toBe("Install foo-bar");
  });

  it("matches rendered id for a heading with bold text", () => {
    const body = "## Use **bold** features\n\nSome text.";
    const [heading] = extractHeadings(body);
    // Rendered: <h2 id="use-bold-features">Use <strong>bold</strong> features</h2>
    expect(heading?.slug).toBe(renderedSlug("Use bold features"));
    expect(heading?.slug).toBe("use-bold-features");
    expect(heading?.text).toBe("Use bold features");
  });

  it("matches rendered id for a heading with an inline link (key regression)", () => {
    // This is the real regression: without stripping, the raw URL leaks into
    // the slug — "configure-foohttpsexamplecomapi" instead of "configure-foo".
    const body = "## Configure [foo](https://example.com/api)\n\nSome text.";
    const [heading] = extractHeadings(body);
    // Rendered: <h2 id="configure-foo">Configure <a href="...">foo</a></h2>
    expect(heading?.slug).toBe(renderedSlug("Configure foo"));
    expect(heading?.slug).toBe("configure-foo");
    expect(heading?.text).toBe("Configure foo");
    // Also assert the old (wrong) value is NOT produced.
    expect(heading?.slug).not.toContain("example");
    expect(heading?.slug).not.toContain("https");
  });

  it("does not extract headings inside an indented code fence", () => {
    // An indented fence block (common in list items or blockquotes) should not
    // allow its contents to be treated as document headings.
    const body = [
      "## Real heading",
      "",
      "  ```ts",
      "  ## Not a heading",
      "  ```",
      "",
      "## Another real heading",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Real heading");
    expect(headings[1]?.text).toBe("Another real heading");
  });

  it("handles a plain heading with no inline markup (baseline)", () => {
    const body = "## Plain Heading\n\nContent.";
    const [heading] = extractHeadings(body);
    expect(heading?.slug).toBe("plain-heading");
    expect(heading?.text).toBe("Plain Heading");
  });

  it("handles italic text in a heading", () => {
    const body = "## Enable *fast* mode\n\nContent.";
    const [heading] = extractHeadings(body);
    expect(heading?.slug).toBe(renderedSlug("Enable fast mode"));
    expect(heading?.text).toBe("Enable fast mode");
  });

  it("keeps intraword underscores in identifiers (CommonMark: not emphasis)", () => {
    // Regression: the naive `_x_` italic strip used to eat the underscores in
    // `SKIP_DOC_HISTORY`, producing slug "skipdochistory" that diverged from the
    // renderer's "skip_doc_history". The renderer keeps the underscores.
    const body = "## The `SKIP_DOC_HISTORY` env var\n\nContent.";
    const [heading] = extractHeadings(body);
    expect(heading?.text).toBe("The SKIP_DOC_HISTORY env var");
    expect(heading?.slug).toBe("the-skip_doc_history-env-var");
    expect(heading?.slug).toBe(renderedSlug("The SKIP_DOC_HISTORY env var"));
  });

  it("still strips underscore emphasis at word boundaries", () => {
    const body = "## Enable _fast_ mode\n\nContent.";
    const [heading] = extractHeadings(body);
    expect(heading?.text).toBe("Enable fast mode");
    expect(heading?.slug).toBe("enable-fast-mode");
  });
});

describe("extractHeadings — Markdown escape parity with zfb 2.20.2", () => {
  const cases = [
    ["escaped underscore", "## Facts: ABSOLUTE\\_MAXIMUM", "Facts: ABSOLUTE_MAXIMUM"],
    ["escaped underscore beside emphasis", "## A \\__x__ Z", "A _x_ Z"],
    ["escaped asterisk", "## Use \\*fast* mode", "Use *fast* mode"],
    ["escaped brackets", "## Use \\[literal](url)", "Use [literal](url)"],
    ["escaped closing bracket", "## Use \\[literal\\]", "Use [literal]"],
    ["escaped punctuation", "## A \\!wow", "A !wow"],
    ["escaped backtick", "## A \\`raw` value", "A `raw` value"],
    ["escaped backslash", "## A \\\\_id", "A \\_id"],
    ["odd backslash run", "## A \\\\\\_id", "A \\_id"],
    ["non-punctuation escape", "## A \\q value", "A \\q value"],
    ["code span keeps backslash", "## Code `A\\_B`", "Code A\\_B"],
    ["mixed link and emphasis", "## [A\\_B](https://example.com) and *fast*", "A_B and fast"],
    ["intraword identifier", "## SKIP_DOC_HISTORY", "SKIP_DOC_HISTORY"],
  ] as const;

  it.each(cases)("matches the renderer for %s", async (_name, source, visible) => {
    const rendered = await renderHtml(source, {
      filename: "heading.md",
      pipeline: { features: { headingIds: { strategy: "hierarchical" } } },
    });
    expect(rendered.diagnostics).toEqual([]);
    const renderedId = /<h2 id="([^"]+)">/.exec(rendered.html ?? "")?.[1];
    expect(renderedId).toBeTruthy();
    const [heading] = extractHeadings(source);
    expect(heading?.text).toBe(visible);
    expect(heading?.slug).toBe(renderedId);
  });

  it("keeps escaped duplicates and nested depths in the renderer's allocation order", async () => {
    const source = "## Facts: ABSOLUTE\\_MAXIMUM\n### Child\n## Facts: ABSOLUTE\\_MAXIMUM\n##### Deep\n#### Deep";
    const rendered = await renderHtml(source, {
      filename: "heading.md",
      pipeline: { features: { headingIds: { strategy: "hierarchical" } } },
    });
    expect(rendered.diagnostics).toEqual([]);
    const renderedIds = [...(rendered.html ?? "").matchAll(/<h[2-6] id="([^"]+)">/g)].map((match) => match[1]);
    expect(extractHeadings(source).map((heading) => heading.slug)).toEqual([
      renderedIds[0], renderedIds[1], renderedIds[2], renderedIds[4],
    ]);
  });
});

// zfb's real build path. `renderHtml` in MDX mode omits ids for headings in
// JSX children, so `compile()` — not `renderHtml` — is the oracle here.
async function compiledHeadingIds(source: string): Promise<string[]> {
  const result = await compile(source, {
    filename: "page.mdx",
    pipeline: { features: { headingIds: { strategy: "hierarchical" } } },
  });
  expect(result.diagnostics).toEqual([]);
  return [...(result.code ?? "").matchAll(/id: ?"([^"]*)"/g)].map((match) => match[1] ?? "");
}

describe("extractHeadings — MDX JSX parity with zfb compile() (#4396)", () => {
  it("ignores `##` lines inside a template-literal JSX prop (issue repro)", async () => {
    const body = "Intro\n\n<HtmlPreview displayJs={`\nconst doc = \\`# Demo\n\n## Features\n\\`;\n`} />\n\n## Real\n";
    expect(await compiledHeadingIds(body)).toEqual(["real"]);
    expect(extractHeadings(body).map((heading) => heading.slug)).toEqual(["real"]);
    expect(extractAllHeadingIds(body)).toEqual(["real"]);
  });

  const cases = [
    ["multi-line JSX comment", "{/*\n## Hidden\n*/}\n\n## Real\n"],
    ["multi-line flow expression", "{`\n## Hidden\n`}\n\n## Real\n"],
    ["multi-line double-quoted attribute", '<Foo t="x\n## Hidden\n" />\n\n## Real\n'],
    ["multi-line single-quoted attribute", "<Foo t='x\n## Hidden\n' />\n\n## Real\n"],
    ["blank line inside a quoted attribute", '<Foo t="x\n\n## Hidden\n" />\n\n## Real\n'],
    ["`>` inside an earlier quoted attribute", '<Foo a="1 > 2"\n  b="x\n## Hidden\n" />\n\n## Real\n'],
    ["template literal in a spread attribute", "<Foo {...{ a: `\n## Hidden\n` }} />\n\n## Real\n"],
    ["escaped backticks in a template literal", "<Foo a={`\n\\`\n## Hidden\n\\`\n`} />\n\n## Real\n"],
    ["nested ${} in a template literal", "<Foo a={`\n${ { b: `\n## Hidden\n` } }\n`} />\n\n## Real\n"],
    ["JSX tag inside a template literal", "<Foo a={`\n<b>\n## Hidden\n`} />\n\n## Real\n"],
    ["apostrophe in JSX text inside an expression", "<Foo render={() => (\n  <p>It's</p>\n)} />\n\n## Real\n\nlast' quote\n\n## After\n"],
    ["headings in JSX children", "<Bar>\n\n## Inside\n\n</Bar>\n\n## Real\n"],
    ["headings in JSX children without blank lines", "<Bar>\n## Inside\n</Bar>\n\n## Real\n"],
    ["headings in a fragment", "<>\n\n## Inside\n\n</>\n\n## Real\n"],
    ["children of a tag with a multi-line attribute expression", "<Foo\n  a={{\n    b: 1,\n  }}\n>\n\n## Inside\n\n</Foo>\n\n## Real\n"],
    ["single-line expression", "{1 + 1}\n\n## A\n\n## Real\n"],
    ["brace in an inline code span", "Text `{` and `<Foo` more\n\n## A\n\n## Real\n"],
    ["brace in a multi-line inline code span", "Use `{\nfoo` here\n\n## A\n\nlater } x\n\n## Real\n"],
    ["braces and backticks in a fenced code block", "```js\nconst a = {\n`\n```\n\n## A\n\n## Real\n"],
    ["escaped brace in prose", "Text \\{ brace\n\n## A\n\n## Real\n"],
    ["less-than in prose", "a < b\n\n## A\n\n## Real\n"],
    ["heading right after the literal closes", "<Foo a={`\nx\n`} />\n## Right\n"],
    ["heading right after a multi-line tag closes", '<Foo\n  a="1"\n/>\n## Right\n'],
  ] as const;

  it.each(cases)("matches compile() ids for %s", async (_name, body) => {
    const expected = await compiledHeadingIds(body);
    expect(extractAllHeadingIds(body)).toEqual(expected);
    expect(extractHeadings(body).map((heading) => heading.slug)).toEqual(expected);
  });

  it("fails open: an expression never closed before EOF hides no headings", () => {
    // The renderer rejects this document (unexpected EOF); the extractor falls
    // back to reading the stray `{` as literal text rather than dropping
    // everything after it.
    expect(extractAllHeadingIds("Text { brace\n\n## A\n\n## Real\n")).toEqual(["a", "real"]);
    expect(extractAllHeadingIds("{`\n## A\n\n## Real\n")).toEqual(["a", "real"]);
  });

  it("fails open: an unclosed quoted attribute hides no headings", () => {
    expect(extractAllHeadingIds('<Foo t="x\n## A\n\n## Real\n')).toEqual(["a", "real"]);
  });

  it("fails open: a closed construct before an unclosed one keeps its suppression", () => {
    expect(extractAllHeadingIds("{`\n## Hidden\n`}\n\n## A\n\nText {\n\n## B\n")).toEqual(["a", "b"]);
  });

  it("abandons a bare open tag at a heading line", () => {
    expect(extractAllHeadingIds("<Foo\n\n## A\n\n## Real\n")).toEqual(["a", "real"]);
    expect(extractAllHeadingIds("x <b\n\n## A\n\n## Real\n")).toEqual(["a", "real"]);
  });

  it("does not toggle fence state from a fence line inside an expression", () => {
    const body = "<Foo code={`\n```js\n## Hidden\n`} />\n\n## Real\n\n## Also\n";
    expect(extractAllHeadingIds(body)).toEqual(["real", "also"]);
  });
});

describe("extractHeadings — cross-level hierarchical dedup (h5/h6 parity)", () => {
  it("an out-of-window h5 advances the full-path counter for a matching h4", () => {
    const body = [
      "## Parent",    // rendered id: "parent"
      "##### Dup",    // rendered id: "parent-dup" (not in TOC)
      "#### Dup",     // rendered id: "parent-dup-1"
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("parent");
    expect(headings[1]?.slug).toBe("parent-dup-1");
  });

  it("an out-of-window h6 advances the full-path counter for a matching h4", () => {
    const body = [
      "## Parent",
      "###### Alpha",
      "#### Alpha",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("parent");
    expect(headings[1]?.slug).toBe("parent-alpha-1");
  });

  it("multiple out-of-window duplicates each advance the full-path counter", () => {
    const body = [
      "## Parent",
      "##### Foo",
      "##### Foo",
      "#### Foo",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("parent");
    expect(headings[1]?.slug).toBe("parent-foo-2");
  });

  it("an out-of-window heading with unique text does not affect another path", () => {
    const body = [
      "## Parent",
      "##### Details",
      "#### Setup",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("parent");
    expect(headings[1]?.slug).toBe("parent-setup");
  });
});

describe("extractHeadings — tilde fence (~~~) recognition", () => {
  it("does not extract headings inside a tilde fence block", () => {
    const body = [
      "## Before fence",
      "",
      "~~~md",
      "## Inside tilde fence — not a heading",
      "~~~",
      "",
      "## After fence",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.text).toBe("Before fence");
    expect(headings[1]?.text).toBe("After fence");
  });

  it("backtick fence does not close a tilde fence", () => {
    // A ``` line inside a ~~~ fence is content, not a fence boundary.
    const body = [
      "~~~",
      "```",            // content — should not close the tilde fence
      "## Still inside",
      "```",            // content — still inside
      "~~~",            // closes the tilde fence
      "",
      "## Real heading",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Real heading");
  });

  it("tilde fence does not close a backtick fence", () => {
    const body = [
      "```",
      "~~~",            // content — should not close the backtick fence
      "## Still inside",
      "~~~",            // content — still inside
      "```",            // closes the backtick fence
      "",
      "## Real heading",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(1);
    expect(headings[0]?.text).toBe("Real heading");
  });
});

describe("extractHeadings — configurable depth window (opts override)", () => {
  it("default depth (no opts) emits h2–h4 only", () => {
    const body = [
      "# H1 title",
      "## H2 section",
      "### H3 sub",
      "#### H4 deep",
      "##### H5 too deep",
      "###### H6 too deep",
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(3);
    expect(headings[0]?.depth).toBe(2);
    expect(headings[1]?.depth).toBe(3);
    expect(headings[2]?.depth).toBe(4);
  });

  it("h1 does NOT advance the slugger counter (renderer assigns no id to h1)", () => {
    // The renderer's heading-links plugin slugs h2–h6 only; an h1 in the body
    // (rare — the frontmatter title is the page h1) must NOT consume a slug, or
    // a same-text h2 would diverge from its rendered id. Regression for #1938.
    const body = ["# Intro", "## Intro"].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(1);
    expect(headings[0]?.slug).toBe("intro");
  });

  it("tocMinDepth:3 excludes h2 from result", () => {
    const body = [
      "## H2 excluded",
      "### H3 included",
      "#### H4 included",
    ].join("\n");
    const headings = extractHeadings(body, { tocMinDepth: 3, tocMaxDepth: 4 });
    expect(headings).toHaveLength(2);
    expect(headings[0]?.depth).toBe(3);
    expect(headings[1]?.depth).toBe(4);
  });

  it("tocMaxDepth:2 emits only h2", () => {
    const body = [
      "## H2 included",
      "### H3 excluded",
      "#### H4 excluded",
    ].join("\n");
    const headings = extractHeadings(body, { tocMinDepth: 2, tocMaxDepth: 2 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.depth).toBe(2);
  });

  it("window-excluded h2 still contributes to a subsequent h3 path", () => {
    const body = [
      "## Concept",
      "### Concept",
    ].join("\n");
    const headings = extractHeadings(body, { tocMinDepth: 3, tocMaxDepth: 4 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.slug).toBe("concept-concept");
  });

  it("invalid tocMinDepth > tocMaxDepth falls back to 2/4", () => {
    // min > max is invalid — fall back to the full default window.
    const body = [
      "## H2",
      "### H3",
      "#### H4",
    ].join("\n");
    const headings = extractHeadings(body, { tocMinDepth: 4, tocMaxDepth: 2 });
    // Fallback: 2/4, so all three headings are emitted.
    expect(headings).toHaveLength(3);
  });

  it("tocMinDepth below 2 falls back to 2/4", () => {
    const body = "## H2\n### H3";
    const headings = extractHeadings(body, { tocMinDepth: 1, tocMaxDepth: 4 });
    // min:1 < 2 → invalid → fallback 2/4: both headings emitted
    expect(headings).toHaveLength(2);
  });

  it("tocMaxDepth above 4 falls back to 2/4", () => {
    const body = "## H2\n### H3";
    const headings = extractHeadings(body, { tocMinDepth: 2, tocMaxDepth: 5 });
    // max:5 > 4 → invalid → fallback 2/4: both headings emitted
    expect(headings).toHaveLength(2);
  });

  it("non-integer values are truncated before validation", () => {
    // 2.9 truncates to 2, 4.9 truncates to 4 — both valid after truncation.
    const body = "## H2\n### H3\n#### H4";
    const headings = extractHeadings(body, { tocMinDepth: 2.9, tocMaxDepth: 3.9 });
    // min:2, max:3 after trunc → valid → emit h2+h3 only
    expect(headings).toHaveLength(2);
    expect(headings[0]?.depth).toBe(2);
    expect(headings[1]?.depth).toBe(3);
  });
});

describe("extractHeadings — hierarchical IDs (zfb#871 contract)", () => {
  // These cases are ported verbatim from zfb's own Rust unit tests
  // (crates/zfb-content/src/plugins/heading_links.rs) — they ARE the contract
  // the host TOC builder must mirror so TOC anchors match the rendered ids.
  const slugs = (body: string, opts?: { tocMinDepth?: number; tocMaxDepth?: number }) =>
    extractHeadings(body, opts).map((h) => h.slug);

  it("the headline example: ## Foo / ### Moo / #### Mew → foo, foo-moo, foo-moo-mew", () => {
    expect(slugs("## Foo\n### Moo\n#### Mew")).toEqual(["foo", "foo-moo", "foo-moo-mew"]);
  });

  it("a sibling pops its predecessor; a new h2 resets the chain", () => {
    // h2 A / h3 B / h3 C / h2 D / h3 E
    expect(slugs("## A\n### B\n### C\n## D\n### E")).toEqual([
      "a",
      "a-b",
      "a-c",
      "d",
      "d-e",
    ]);
  });

  it("a depth jump (h2 → h4, no h3) prefixes with the nearest real ancestor", () => {
    // h2 A / h4 B / h3 C — both nest under "a".
    expect(slugs("## A\n#### B\n### C")).toEqual(["a", "a-b", "a-c"]);
  });

  it("duplicate siblings under the same parent are deduped on the full path", () => {
    // h2 A / h3 B / h3 B → a, a-b, a-b-1
    expect(slugs("## A\n### B\n### B")).toEqual(["a", "a-b", "a-b-1"]);
  });

  it("a deduped parent contributes its FINAL id to children", () => {
    // h2 Foo / h2 Foo / h3 Bar → foo, foo-1, foo-1-bar
    expect(slugs("## Foo\n## Foo\n### Bar")).toEqual(["foo", "foo-1", "foo-1-bar"]);
  });

  it("h1 is untouched — a following h2 starts an unprefixed chain", () => {
    // h1 Title / h2 A / h3 B → (h1 not emitted) a, a-b
    expect(slugs("# Title\n## A\n### B")).toEqual(["a", "a-b"]);
  });

  it("a standalone nested-depth heading stays unprefixed and calls do not leak state", () => {
    expect(slugs("## A\n### B")).toEqual(["a", "a-b"]);
    // A fresh call must NOT inherit the stale "a" ancestor from the previous one.
    expect(slugs("### B")).toEqual(["b"]);
  });

  it("an out-of-window h5 still advances the chain for a following in-window h3", () => {
    // h2 A / h3 B / h5 C (out of [2,4] window) / h3 D.
    // The h5 is allocated (id "a-b-c", pushed to the ancestor stack) but not
    // emitted; the following h3 D pops past it and re-roots under "a" → "a-d".
    const headings = extractHeadings("## A\n### B\n##### C\n### D");
    expect(headings.map((h) => h.slug)).toEqual(["a", "a-b", "a-d"]);
    expect(headings.map((h) => h.depth)).toEqual([2, 3, 3]);
  });

  it("preserves CJK heading text in the ancestor chain", () => {
    // github-slugger preserves CJK; the hierarchical prefix joins them with "-".
    expect(slugs("## 概要\n### 詳細")).toEqual(["概要", "概要-詳細"]);
  });
});

describe("slugify — exact port of zfb's Rust slugify", () => {
  // Vectors copied verbatim from zfb's own unit tests
  // (crates/zfb-content/src/plugins/heading_links.rs). These pin the parity that
  // npm github-slugger could not provide (punctuation handling, CJK, emoji).
  it("strips punctuation to single dashes and lowercases", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });
  it("keeps existing hyphens verbatim (no collapsing of `-`)", () => {
    expect(slugify("  --weird-- ")).toBe("--weird--");
  });
  it("lowercases mixed case and keeps digits", () => {
    expect(slugify("MixedCase 123")).toBe("mixedcase-123");
  });
  it("empty / all-stripped / whitespace-only inputs slug to empty", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!@#$%")).toBe("");
    expect(slugify("   \t\n  ")).toBe("");
  });
  it("preserves CJK and Korean (with spaces → dash)", () => {
    expect(slugify("コンポーネント構文")).toBe("コンポーネント構文");
    expect(slugify("中文标题")).toBe("中文标题");
    expect(slugify("한국어 제목")).toBe("한국어-제목");
    expect(slugify("Section 一")).toBe("section-一");
  });
  it("preserves emoji as a single code point", () => {
    expect(slugify("🚀 Launch")).toBe("🚀-launch");
  });
  it("preserves accented Latin", () => {
    expect(slugify("Café au lait")).toBe("café-au-lait");
  });

  // The cases that DIVERGE from npm github-slugger — the whole reason for the
  // port. github-slugger removes `.` (→ `pr-checksyml`); zfb treats it as a
  // separator (→ `pr-checks-yml`), matching the rendered heading id.
  it("treats `.` as a separator (matches zfb, unlike github-slugger)", () => {
    expect(slugify("pr-checks.yml")).toBe("pr-checks-yml");
    expect(slugify("CLAUDE.md files")).toBe("claude-md-files");
  });
  it("keeps underscores verbatim", () => {
    expect(slugify("SKIP_DOC_HISTORY env var")).toBe("skip_doc_history-env-var");
  });
  it("collapses an ASCII ` / ` (with surrounding spaces) to a single dash", () => {
    expect(slugify("zfb / zdtp")).toBe("zfb-zdtp");
  });
  it("keeps non-ASCII punctuation (em-dash) verbatim, matching zfb's ASCII-only strip set", () => {
    // zfb's `is_stripped` only covers ASCII punctuation, so a U+2014 em-dash is
    // NOT a separator — it is kept (surrounded by dashes from the spaces). The
    // host port must match this exactly, or the TOC anchor would desync.
    expect(slugify("Mode 1 — Standalone")).toBe("mode-1-—-standalone");
  });
});
