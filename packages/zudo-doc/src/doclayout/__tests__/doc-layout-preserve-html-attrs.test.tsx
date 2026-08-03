/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Pins the full `<ClientRouter preserveHtmlAttrs>` array emitted by
 * `<DocLayout>` (previously unguarded — closes the gap called out by #3254).
 *
 * The array must stay identical on every page (see the inline comment above
 * the `ClientRouter({ preserveHtmlAttrs: [...] })` call site in
 * doc-layout.tsx) — this test catches an accidental addition/removal/reorder
 * that a feature working on just one attribute could otherwise miss.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { DocLayout } from "../doc-layout.js";

describe("DocLayout — preserveHtmlAttrs full array pin", () => {
  it("emits the exact preserveHtmlAttrs list via the zfb-preserve-html-attrs meta", () => {
    const html = render(
      <DocLayout
        title="Preserve Attrs Test"
        header={<header>hdr</header>}
        main={<p>body</p>}
      />,
    );

    expect(html).toContain(
      'name="zfb-preserve-html-attrs" content="data-sidebar-hidden data-theme data-theme-pack style data-toc-hidden"',
    );
  });
});
