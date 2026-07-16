import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import ColorSchemeProvider from "../color-scheme-provider.js";

describe("ColorSchemeProvider", () => {
  it("renders a fixed scheme without a localStorage bootstrap", () => {
    const html = render(
      <ColorSchemeProvider
        cssText=":root { --zd-bg: black; }"
        colorMode={null}
      />,
    );

    expect(html).toContain("<style>:root { --zd-bg: black; }</style>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("zudo-doc-color-scheme-css");
  });

  it("keeps the current light/dark preference bootstrap", () => {
    const html = render(
      <ColorSchemeProvider
        cssText=":root { color-scheme: light dark; }"
        colorMode={{ defaultMode: "dark", respectPrefersColorScheme: true }}
      />,
    );

    expect(html).toContain("<script");
    expect(html).toContain("zudo-doc-theme");
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).not.toContain("zudo-doc-color-scheme-css");
  });
});
