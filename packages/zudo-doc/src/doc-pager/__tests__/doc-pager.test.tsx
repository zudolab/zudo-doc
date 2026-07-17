/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// SSR-shape test for the DocPager's `data-doc-pager` stable DOM hook
// (zudolab/zudo-doc#2873 — theme packs select `[data-doc-pager]` instead of
// relying on the bare `<nav>` structure).

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { createDocPager } from "../index.js";
import { makeFakeChromeContext } from "../../__tests__/fixtures/fake-chrome-context.js";

describe("createDocPager — data-doc-pager hook", () => {
  it("renders data-doc-pager on the <nav>, with both prev/next present", () => {
    const ctx = makeFakeChromeContext();
    const DocPager = createDocPager(ctx);
    const html = render(
      <DocPager
        prev={{ href: "/docs/a", label: "A" }}
        next={{ href: "/docs/b", label: "B" }}
        locale="en"
      />,
    );
    expect(html).toMatch(/<nav[^>]*data-doc-pager[^>]*>/);
  });

  it("renders data-doc-pager on the <nav> even when prev/next are both absent", () => {
    const ctx = makeFakeChromeContext();
    const DocPager = createDocPager(ctx);
    const html = render(<DocPager prev={null} next={null} locale="en" />);
    expect(html).toMatch(/<nav[^>]*data-doc-pager[^>]*>/);
  });
});
