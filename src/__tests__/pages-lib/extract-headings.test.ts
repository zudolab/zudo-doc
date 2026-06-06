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
import GithubSlugger from "github-slugger";
import { extractHeadings } from "../../../pages/lib/_extract-headings";

/**
 * Reference: compute the slug the same way rehype-heading-links does —
 * slug the plain visible text (no markdown markup).
 */
function renderedSlug(plainText: string): string {
  return new GithubSlugger().slug(plainText);
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
});
