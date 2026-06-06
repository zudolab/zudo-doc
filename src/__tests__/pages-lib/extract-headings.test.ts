/**
 * extract-headings.test.ts
 *
 * Unit tests for pages/lib/_extract-headings.ts covering slug fidelity:
 * the slug computed by extractHeadings must match the rendered heading id
 * produced by rehype-heading-links (which extracts plain text via extractText,
 * then slugs via GithubSlugger).
 *
 * The expected slug in each test is derived independently:
 *   new GithubSlugger().slug(<plain visible text>)
 * matching exactly what the renderer computes from the HAST node's text
 * content after MDX → HTML conversion.
 */

import { describe, it, expect } from "vitest";
import {
  extractHeadings as extractHeadingsRaw,
  slugify,
  type HeadingIdStrategy,
} from "../../../pages/lib/_extract-headings";

/**
 * The suites below test the FLAT heading-ID contract. Production now defaults
 * to "hierarchical" (`settings.headingIdStrategy`), so pin these calls to flat
 * via a thin wrapper — existing call sites stay unchanged and decoupled from
 * the showcase default. The hierarchical contract has its own suite at the
 * bottom (calling `extractHeadingsRaw` with `strategy: "hierarchical"`), plus a
 * settings-default guard that calls `extractHeadingsRaw` with no strategy.
 */
function extractHeadings(
  body: string,
  opts?: { tocMinDepth?: number; tocMaxDepth?: number; strategy?: HeadingIdStrategy },
) {
  return extractHeadingsRaw(body, { strategy: "flat", ...opts });
}

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

describe("extractHeadings — cross-level dedup (h5/h6 counter parity)", () => {
  it("h5 duplicating an earlier h2 advances the renderer counter — second h2 gets -2 suffix", () => {
    // The renderer slugs ALL headings (h2–h6), so an h5 with text "Dup" that
    // follows the first h2 "Dup" advances the shared counter. Without the fix,
    // extractHeadings only slugged h2–h4 and the second h2 anchor would be
    // "#dup-1" while the rendered id would be "#dup-2" — a broken TOC link.
    const body = [
      "## Dup",    // rendered id: "dup"  / TOC slug: "dup"
      "##### Dup", // rendered id: "dup-1" (renderer counts it; not in TOC)
      "## Dup",   // rendered id: "dup-2" / TOC slug must also be "dup-2"
    ].join("\n");
    const headings = extractHeadings(body);
    // Only depth-2 items are pushed; the h5 is invisible to the result.
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("dup");
    // Post-fix: second h2 gets "dup-2" (h5 consumed "dup-1" in the counter).
    // Pre-fix: would have been "dup-1" (counter didn't advance for the h5).
    expect(headings[1]?.slug).toBe("dup-2");
  });

  it("h6 duplicating an earlier h3 advances the renderer counter — second h3 gets -2 suffix", () => {
    const body = [
      "### Alpha",   // slug: "alpha"
      "###### Alpha", // not in TOC, but advances counter to "alpha-1"
      "### Alpha",   // slug must be "alpha-2", not "alpha-1"
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("alpha");
    expect(headings[1]?.slug).toBe("alpha-2");
  });

  it("multiple h5/h6 dup entries each advance the counter correctly", () => {
    // Each intermediate h5/h6 with the same text advances the counter by one.
    const body = [
      "## Foo",    // slug: "foo"
      "##### Foo", // not in TOC, counter: "foo-1"
      "##### Foo", // not in TOC, counter: "foo-2"
      "## Foo",   // slug must be "foo-3"
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("foo");
    expect(headings[1]?.slug).toBe("foo-3");
  });

  it("h5 with unique text does not affect counter for different h2 text", () => {
    // Counter is per-text (slug-based), so an h5 with a different slug does
    // not affect the dedup count for unrelated headings.
    const body = [
      "## Setup",       // slug: "setup"
      "##### Details",  // slug: "details" (different text; does not affect "setup" counter)
      "## Setup",       // slug must be "setup-1"
    ].join("\n");
    const headings = extractHeadings(body);
    expect(headings).toHaveLength(2);
    expect(headings[0]?.slug).toBe("setup");
    expect(headings[1]?.slug).toBe("setup-1");
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

  it("window-excluded h2 still advances counter for subsequent same-text h3 in window", () => {
    // When tocMinDepth:3, h2 headings are not pushed but must still be slugged
    // so that a subsequent h3 with the same text gets the correct dedup suffix.
    const body = [
      "## Concept",   // excluded from result, but slugger consumes "concept"
      "### Concept",  // included; slug must be "concept-1" (not "concept")
    ].join("\n");
    const headings = extractHeadings(body, { tocMinDepth: 3, tocMaxDepth: 4 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.slug).toBe("concept-1");
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

describe("extractHeadings — hierarchical strategy (zfb#871 contract)", () => {
  // These cases are ported verbatim from zfb's own Rust unit tests
  // (crates/zfb-content/src/plugins/heading_links.rs) — they ARE the contract
  // the host TOC builder must mirror so TOC anchors match the rendered ids.
  const hier = (body: string, opts?: { tocMinDepth?: number; tocMaxDepth?: number }) =>
    extractHeadingsRaw(body, { ...opts, strategy: "hierarchical" });

  const slugs = (body: string, opts?: { tocMinDepth?: number; tocMaxDepth?: number }) =>
    hier(body, opts).map((h) => h.slug);

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

  it("each call is its own document — no ancestor stack leaks across calls", () => {
    expect(slugs("## A\n### B")).toEqual(["a", "a-b"]);
    // A fresh call must NOT inherit the stale "a" ancestor from the previous one.
    expect(slugs("### B")).toEqual(["b"]);
  });

  it("an out-of-window h5 still advances the chain for a following in-window h3", () => {
    // h2 A / h3 B / h5 C (out of [2,4] window) / h3 D.
    // The h5 is allocated (id "a-b-c", pushed to the ancestor stack) but not
    // emitted; the following h3 D pops past it and re-roots under "a" → "a-d".
    const headings = hier("## A\n### B\n##### C\n### D");
    expect(headings.map((h) => h.slug)).toEqual(["a", "a-b", "a-d"]);
    expect(headings.map((h) => h.depth)).toEqual([2, 3, 3]);
  });

  it("preserves CJK heading text in the ancestor chain", () => {
    // github-slugger preserves CJK; the hierarchical prefix joins them with "-".
    expect(slugs("## 概要\n### 詳細")).toEqual(["概要", "概要-詳細"]);
  });
});

describe("extractHeadings — settings default", () => {
  it("uses settings.headingIdStrategy (hierarchical) when no strategy override is passed", () => {
    // Guards the showcase config: settings.headingIdStrategy is "hierarchical",
    // and zfb.config.ts reads the same value — so an unqualified call must
    // produce ancestor-prefixed ids matching the rendered output.
    const headings = extractHeadingsRaw("## Foo\n### Moo");
    expect(headings.map((h) => h.slug)).toEqual(["foo", "foo-moo"]);
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
