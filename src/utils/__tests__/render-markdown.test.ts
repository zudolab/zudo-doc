import { describe, it, expect } from "vitest";
import { renderMarkdown } from "@takazudo/zudo-doc/render-markdown";

describe("renderMarkdown — bold + italic interaction", () => {
  it("renders two bold spans with no stray <em> when input has multiple ** pairs", () => {
    const html = renderMarkdown("**a** and **b**");
    expect(html).toContain("<strong>a</strong>");
    expect(html).toContain("<strong>b</strong>");
    expect(html).not.toContain("<em>");
  });

  it("renders bold and italic together without garbling either", () => {
    const html = renderMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    // No stray asterisks should survive into the output
    expect(html).not.toMatch(/\*/);
  });

  it("handles bold-inside-sentence with following italic (mixed inline)", () => {
    const html = renderMarkdown("Say **hello** or *hi* to everyone");
    expect(html).toContain("<strong>hello</strong>");
    expect(html).toContain("<em>hi</em>");
    expect(html).not.toContain("<em>hello</em>");
    expect(html).not.toContain("<strong>hi</strong>");
  });

  it("does not wrap stray asterisk boundaries as italic when three or more ** groups appear", () => {
    const html = renderMarkdown("**x** then **y** then **z**");
    expect(html).toContain("<strong>x</strong>");
    expect(html).toContain("<strong>y</strong>");
    expect(html).toContain("<strong>z</strong>");
    expect(html).not.toContain("<em>");
  });
});
