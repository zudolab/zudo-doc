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

// Link-color rule (epic #4235, S4 #4239): the footer's inline copyright row
// keeps `underline` static and puts `text-accent` on hover/focus only; the
// link-column and tag-column anchors stay `text-muted` with
// hover/focus-visible `text-accent`. Neither carries a bare (non-variant)
// `text-accent` class token.
describe("Footer — link-color rule", () => {
  it("copyright row underlines statically and colors accent only on hover/focus", () => {
    const html = render(
      <Footer copyright='&copy; 2026 <a href="/">Acme</a>' />,
    );
    const match = html.match(/class="([^"]*text-muted[^"]*)"/);
    expect(match).not.toBeNull();
    // preact-render-to-string HTML-escapes `&` in attribute values, so the
    // `[&_a]:...` arbitrary-variant selectors serialize as `[&amp;_a]:...`.
    const classAttr = match?.[1] ?? "";
    expect(classAttr).toContain("[&amp;_a]:underline");
    expect(classAttr).toContain("[&amp;_a:hover]:text-accent");
    expect(classAttr).toContain("[&amp;_a:focus-visible]:text-accent");
    expect(classAttr).not.toContain("[&amp;_a]:text-accent");
  });

  it("link-column anchors have no bare text-accent or underline token", () => {
    const html = render(
      <Footer
        linkColumns={[
          { title: "Docs", items: [{ label: "Guides", href: "/docs/guides/" }] },
        ]}
      />,
    );
    const match = html.match(/<a href="\/docs\/guides\/" class="([^"]*)"/);
    expect(match).not.toBeNull();
    const tokens = (match?.[1] ?? "").split(/\s+/);
    expect(tokens).not.toContain("text-accent");
    expect(tokens).not.toContain("underline");
    expect(tokens).toContain("hover:text-accent");
    expect(tokens).toContain("focus-visible:text-accent");
    expect(tokens).toContain("hover:underline");
    expect(tokens).toContain("focus-visible:underline");
  });

  it("tag-column anchors have no bare text-accent or underline token", () => {
    const html = render(
      <Footer
        tagColumns={[
          {
            group: "topic",
            title: "Tags",
            tags: [{ tag: "css", count: 3, href: "/tags/css/" }],
          },
        ]}
      />,
    );
    const match = html.match(/<a href="\/tags\/css\/" class="([^"]*)"/);
    expect(match).not.toBeNull();
    const tokens = (match?.[1] ?? "").split(/\s+/);
    expect(tokens).not.toContain("text-accent");
    expect(tokens).not.toContain("underline");
    expect(tokens).toContain("hover:text-accent");
    expect(tokens).toContain("focus-visible:text-accent");
    expect(tokens).toContain("hover:underline");
    expect(tokens).toContain("focus-visible:underline");
  });
});
