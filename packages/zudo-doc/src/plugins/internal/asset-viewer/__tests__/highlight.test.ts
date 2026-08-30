import { beforeEach, describe, expect, it, vi } from "vitest";

const highlightCode = vi.fn();

vi.mock("@takazudo/zfb-md-wasm/highlight", () => ({ highlightCode }));

import {
  MAX_EXCERPT_LINES,
  MAX_HIGHLIGHT_BYTES,
  MAX_INLINE_BYTES,
  MAX_PLAIN_LINES,
  highlightAsset,
  renderExcerpt,
  sliceLines,
  withLineIds,
} from "../highlight.js";

describe("highlightAsset", () => {
  beforeEach(() => {
    highlightCode.mockReset();
    highlightCode.mockResolvedValue({
      html: '<pre class="hi-root"><code><span class="line"><span class="hi-kw">const</span></span></code></pre>',
      diagnostics: [],
    });
  });

  it("awaits class-mode highlighting at the highlight cap boundary", async () => {
    const text = "x".repeat(MAX_HIGHLIGHT_BYTES);

    await expect(highlightAsset(text, "javascript")).resolves.toMatchObject({
      plain: false,
      previewable: true,
      truncated: false,
    });
    expect(highlightCode).toHaveBeenCalledOnce();
    expect(highlightCode).toHaveBeenCalledWith(text, {
      language: "javascript",
      mode: "class",
    });
  });

  it("uses escaped exact-shape fallback markup for errors and hostile input", async () => {
    highlightCode.mockResolvedValue({
      html: "<pre>unsafe partial result</pre>",
      diagnostics: [
        {
          severity: "error",
          source: "internal",
          message: "failed",
          line: null,
          column: null,
        },
      ],
    });

    const result = await highlightAsset(
      '</code><script data-x="yes">&</script>\nnext',
      "javascript",
    );

    expect(result).toEqual({
      html: '<pre class="hi-root"><code><span class="line">&lt;/code&gt;&lt;script data-x=&quot;yes&quot;&gt;&amp;&lt;/script&gt;\n</span><span class="line">next</span></code></pre>',
      plain: true,
      previewable: true,
      truncated: false,
    });
    expect(result.html).not.toContain("<script");
  });

  it("falls back when highlighting rejects", async () => {
    highlightCode.mockRejectedValue(new Error("optional peer unavailable"));
    await expect(highlightAsset("a\n", "text")).resolves.toEqual({
      html: '<pre class="hi-root"><code><span class="line">a\n</span></code></pre>',
      plain: true,
      previewable: true,
      truncated: false,
    });
  });

  it("applies the plain-line cap to warning and rejection fallbacks", async () => {
    const text = `${"short\n".repeat(MAX_PLAIN_LINES)}last`;
    highlightCode.mockResolvedValueOnce({
      html: "<pre>upstream plain output</pre>",
      diagnostics: [
        {
          severity: "warning",
          source: "highlight",
          message: "unknown language",
          line: null,
          column: null,
        },
      ],
    });

    const warning = await highlightAsset(text, "unknown");
    expect(warning.truncated).toBe(true);
    expect(warning.html?.match(/class="line"/g)).toHaveLength(MAX_PLAIN_LINES);
    expect(warning.html).not.toContain("last");

    highlightCode.mockRejectedValueOnce(new Error("missing peer"));
    const rejection = await highlightAsset(text, "text");
    expect(rejection.truncated).toBe(true);
    expect(rejection.html?.match(/class="line"/g)).toHaveLength(
      MAX_PLAIN_LINES,
    );
    expect(rejection.html).not.toContain("last");
  });

  it("skips WASM above the highlight cap and truncates plain previews by line", async () => {
    const overCap = `${"x".repeat(MAX_HIGHLIGHT_BYTES)}\n`;
    const plain = await highlightAsset(overCap, "javascript");
    expect(plain).toMatchObject({ plain: true, previewable: true });
    expect(highlightCode).not.toHaveBeenCalled();

    const manyLines = `${"a\n".repeat(MAX_PLAIN_LINES)}${"x".repeat(
      MAX_HIGHLIGHT_BYTES,
    )}\nlast`;
    const truncated = await highlightAsset(manyLines, "javascript");
    expect(truncated.truncated).toBe(true);
    expect(truncated.html?.match(/class="line"/g)).toHaveLength(
      MAX_PLAIN_LINES,
    );
    expect(truncated.html).not.toContain("last");
    expect(highlightCode).not.toHaveBeenCalled();
  });

  it("keeps the inline boundary previewable and omits the body only above it", async () => {
    const atBoundary = "x".repeat(MAX_INLINE_BYTES);
    const boundary = await highlightAsset(atBoundary, "text");
    expect(boundary).toMatchObject({ previewable: true, plain: true });
    expect(boundary.html).not.toBeNull();

    const aboveBoundary = await highlightAsset(`${atBoundary}x`, "text");
    expect(aboveBoundary).toEqual({
      html: null,
      plain: true,
      previewable: false,
      truncated: false,
    });
    expect(highlightCode).not.toHaveBeenCalled();
  });
});

describe("line transforms", () => {
  const highlighted =
    '<pre class="hi-root"><code><span class="line"><span class="hi-kw">const</span> a\n</span><span class="line"><span class="hi-str">x</span></span></code></pre>';

  it("adds full-viewer ids idempotently while preserving token spans", () => {
    const once = withLineIds(highlighted);
    expect(once).toContain(
      '<span class="line" id="L1"><span class="hi-kw">const</span>',
    );
    expect(once).toContain(
      '<span class="line" id="L2"><span class="hi-str">x</span>',
    );
    expect(withLineIds(once)).toBe(once);
  });

  it("adds ids to fallback line spans", async () => {
    highlightCode.mockRejectedValue(new Error("missing"));
    const fallback = await highlightAsset("one\ntwo", "text");
    expect(withLineIds(fallback.html!)).toContain(
      '<span class="line" id="L2">two</span>',
    );
  });

  it("does not mistake data-id for a line anchor", () => {
    expect(withLineIds('<span class="line" data-id="source">x</span>')).toBe(
      '<span class="line" data-id="source" id="L1">x</span>',
    );
  });
});

describe("excerpt slicing", () => {
  beforeEach(() => {
    highlightCode.mockReset();
    highlightCode.mockImplementation(async (text: string) => ({
      html: `<pre class="hi-root"><code>${text
        .split("\n")
        .filter((line, index, all) => index < all.length - 1 || line !== "")
        .map(
          (line, index, all) =>
            `<span class="line"><span class="hi-var">${line}</span>${
              index < all.length - 1 ? "\n" : ""
            }</span>`,
        )
        .join("")}</code></pre>`,
      diagnostics: [],
    }));
  });

  it("clamps ranges and caps them at the first 200 lines", () => {
    const text = Array.from({ length: 300 }, (_, index) => `line ${index + 1}\n`).join(
      "",
    );
    expect(sliceLines(text, -10, 999)).toMatchObject({
      startLine: 1,
      endLine: MAX_EXCERPT_LINES,
      totalLines: 300,
      truncated: true,
    });
    expect(sliceLines(text, 500, 600)).toMatchObject({
      startLine: 300,
      endLine: 300,
      truncated: false,
    });
  });

  it("uses real data-line offsets and never viewer ids", async () => {
    const text = "one\ntwo\nthree\nfour";
    const excerpt = await renderExcerpt(text, "javascript", 2, 3, 4);

    expect(excerpt).toMatchObject({
      startLine: 2,
      endLine: 3,
      totalLines: 4,
      truncated: false,
    });
    expect(excerpt.html).toContain('data-line="2"');
    expect(excerpt.html).toContain('data-line="3"');
    expect(excerpt.html).toContain('class="hi-var"');
    expect(excerpt.html).not.toMatch(/\sid=/);
  });
});
