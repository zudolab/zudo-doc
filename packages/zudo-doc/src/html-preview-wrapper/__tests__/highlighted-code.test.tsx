/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";

import { HighlightedCode } from "../highlighted-code.js";

describe("HighlightedCode", () => {
  it("server-renders the plain fallback with JSX-escaped source", () => {
    const html = render(
      <HighlightedCode
        code={'<script data-value="a & b">alert(1)</script>'}
        language="html"
      />,
    );

    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain(
      "&lt;script data-value=&quot;a &amp; b&quot;>alert(1)&lt;/script>",
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
