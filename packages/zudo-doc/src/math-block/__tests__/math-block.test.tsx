/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// katex present: rendering is unchanged by the optional-peer loading (#4209).
// Kept apart from the katex-unavailable file so no module mock is in play.
import { describe, expect, it } from "vitest";
import { renderToString } from "preact-render-to-string";
import { MathBlock } from "../index.js";

describe("math-block with katex present", () => {
  it("renders inline math through katex unchanged", () => {
    const html = renderToString(<MathBlock latex="x^2" />);
    expect(html).toMatch(/^<span class="math math-inline">/);
    expect(html).toContain('class="katex"');
  });

  it("renders display math in a block wrapper", () => {
    const html = renderToString(<MathBlock latex="\sum_{i=1}^n i" block />);
    expect(html).toMatch(/^<div class="math math-display">/);
    expect(html).toContain("katex-display");
  });
});
