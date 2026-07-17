/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * showResources code-panel placement (#2914).
 *
 * externalStyles/externalScripts are excluded from the visible "HTML" code
 * panel by default and only surfaced — as literal <link>/<script src> lines
 * at the TOP of the panel — when showResources is true. This is independent
 * of the iframe's srcdoc attribute, which always carries the resources
 * regardless of showResources (showResources only controls what appears in
 * the human-visible code panel, not what actually loads in the preview) — so
 * these tests scope their assertions to the code-panel segment of the
 * render() output, not the whole string.
 *
 * SSR (no hydration) means HighlightedCode falls back to a plain
 * <pre><code> block, so the dedented source text is present verbatim.
 * preact-render-to-string escapes `<` to `&lt;` and `"` to `&quot;` in text
 * content but leaves `>` literal — see the exact escaping asserted below.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { HtmlPreview } from "../html-preview.js";

// The code panel starts at the "HTML" block label and ends at the first
// </pre> (the primary/always-present HTML panel is always emitted first).
function extractHtmlCodePanel(rendered: string): string {
  const labelIdx = rendered.indexOf(">HTML</span>");
  expect(labelIdx).toBeGreaterThan(-1);
  const closeIdx = rendered.indexOf("</pre>", labelIdx);
  expect(closeIdx).toBeGreaterThan(-1);
  return rendered.slice(labelIdx, closeIdx);
}

describe("HtmlPreview — showResources code-panel placement", () => {
  it("excludes externalStyles/externalScripts from the HTML code panel by default", () => {
    const rendered = render(
      <HtmlPreview
        html="<div>hi</div>"
        defaultOpen
        externalStyles={["https://example.com/a.css"]}
        externalScripts={[
          "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
        ]}
      />,
    );
    const panel = extractHtmlCodePanel(rendered);

    expect(panel).not.toContain("https://example.com/a.css");
    expect(panel).not.toContain(
      "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
    );
    expect(panel).toContain("&lt;div>hi&lt;/div>");
  });

  it("renders literal <link>/<script src> lines at the TOP of the HTML code panel when showResources is true", () => {
    const rendered = render(
      <HtmlPreview
        html="<div>hi</div>"
        defaultOpen
        showResources
        externalStyles={["https://example.com/a.css"]}
        externalScripts={[
          "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
        ]}
      />,
    );
    const panel = extractHtmlCodePanel(rendered);

    const linkIdx = panel.indexOf(
      '&lt;link rel=&quot;stylesheet&quot; href=&quot;https://example.com/a.css&quot;>',
    );
    const scriptIdx = panel.indexOf(
      '&lt;script src=&quot;https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4&quot;>&lt;/script>',
    );
    const htmlBodyIdx = panel.indexOf("&lt;div>hi&lt;/div>");

    expect(linkIdx).toBeGreaterThan(-1);
    expect(scriptIdx).toBeGreaterThan(-1);
    expect(htmlBodyIdx).toBeGreaterThan(-1);

    // "TOP of the HTML code block" — resource lines precede the author html.
    expect(linkIdx).toBeLessThan(htmlBodyIdx);
    expect(scriptIdx).toBeLessThan(htmlBodyIdx);
  });

  it("adds no resource lines when showResources is true but no external resources are set", () => {
    const rendered = render(
      <HtmlPreview html="<div>hi</div>" defaultOpen showResources />,
    );
    const panel = extractHtmlCodePanel(rendered);

    expect(panel).toContain("&lt;div>hi&lt;/div>");
    expect(panel).not.toContain("rel=&quot;stylesheet&quot;");
    expect(panel).not.toContain("&lt;script");
  });
});
