/** @jsxRuntime automatic */
import { describe, expect, it } from "vitest";
import { renderSsr } from "../../__tests__/helpers/zudo-react.js";

import { HighlightedCode } from "../highlighted-code.js";

describe("HighlightedCode", () => {
  it("server-renders the plain fallback with JSX-escaped source", () => {
    const html = renderSsr(
      <HighlightedCode
        code={'<script data-value="a & b">alert(1)</script>'}
        language="html"
      />,
    );

    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain(
      '&lt;script data-value="a &amp; b"&gt;alert(1)&lt;/script&gt;',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
