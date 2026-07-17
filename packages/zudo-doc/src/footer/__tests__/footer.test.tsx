/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSR-shape test for the Footer shell's `data-footer` stable DOM hook
// (zudolab/zudo-doc#2873 — theme packs select `[data-footer]` instead of
// relying on the `<footer>` tag/structure alone).

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { Footer } from "../footer.js";

describe("Footer — data-footer hook", () => {
  it("renders data-footer on the <footer> element (no columns/copyright)", () => {
    const html = render(<Footer />);
    expect(html).toMatch(/<footer[^>]*data-footer[^>]*>/);
  });

  it("still renders data-footer when a persistKey is set (attribute co-exists with data-zfb-transition-persist)", () => {
    const html = render(<Footer persistKey="footer-en" />);
    expect(html).toMatch(/<footer[^>]*data-footer[^>]*>/);
    expect(html).toContain('data-zfb-transition-persist="footer-en"');
  });
});
