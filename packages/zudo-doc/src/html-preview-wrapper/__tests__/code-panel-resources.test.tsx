/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */
/**
 * showResources code-panel placement (#2914).
 *
 * externalStyles/externalScripts are excluded from the visible "HTML" code
 * panel by default and only surfaced — as literal <link>/<script src> lines
 * at the TOP of the panel — when showResources is true. This is independent
 * of the iframe's srcdoc attribute, which always carries the resources
 * regardless of showResources (showResources only controls what appears in
 * the human-visible code panel, not what actually loads in the preview) — so
 * these tests scope their assertions to the code-panel segment of the SSR
 * output, not the whole string.
 *
 * SSR (no activation) means HighlightedCode falls back to a plain
 * <pre><code> block, so the source text is present verbatim. Read it through
 * the HTML parser so the assertion covers displayed source rather than the
 * serializer's entity spelling.
 */

import { describe, expect, it } from "vitest";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { HtmlPreview } from "../html-preview.js";

function extractHtmlCodePanel(rendered: string): string {
  const host = document.createElement("div");
  host.innerHTML = rendered;
  const htmlLabel = [...host.querySelectorAll("span")].find(
    (span) => span.textContent === "HTML",
  );
  expect(htmlLabel).toBeDefined();
  const code = htmlLabel?.parentElement?.querySelector("pre code");
  expect(code).toBeDefined();
  return code?.textContent ?? "";
}

describe("HtmlPreview — showResources code-panel placement", () => {
  it("excludes externalStyles/externalScripts from the HTML code panel by default", () => {
    const rendered = renderSsr(
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
    expect(panel).toContain("<div>hi</div>");
  });

  it("renders literal <link>/<script src> lines at the TOP of the HTML code panel when showResources is true", () => {
    const rendered = renderSsr(
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
      '<link rel="stylesheet" href="https://example.com/a.css">',
    );
    const scriptIdx = panel.indexOf(
      '<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>',
    );
    const htmlBodyIdx = panel.indexOf("<div>hi</div>");

    expect(linkIdx).toBeGreaterThan(-1);
    expect(scriptIdx).toBeGreaterThan(-1);
    expect(htmlBodyIdx).toBeGreaterThan(-1);

    // "TOP of the HTML code block" — resource lines precede the author html.
    expect(linkIdx).toBeLessThan(htmlBodyIdx);
    expect(scriptIdx).toBeLessThan(htmlBodyIdx);
  });

  it("adds no resource lines when showResources is true but no external resources are set", () => {
    const rendered = renderSsr(
      <HtmlPreview html="<div>hi</div>" defaultOpen showResources />,
    );
    const panel = extractHtmlCodePanel(rendered);

    expect(panel).toContain("<div>hi</div>");
    expect(panel).not.toContain('rel="stylesheet"');
    expect(panel).not.toContain("<script");
  });
});
