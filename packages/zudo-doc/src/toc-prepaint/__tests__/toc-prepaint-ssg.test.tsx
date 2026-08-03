/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG tests for the toc-prepaint factories (epic #3252, #3254). Mirrors
 * sidebar-prepaint/__tests__/sidebar-prepaint-ssg.test.tsx 1:1 for the desktop
 * TOC-toggle feature.
 *
 * The load-bearing fix is a PLACEMENT change: the `data-toc-hidden` pre-paint
 * `<script>` must be emitted in `<head>` — before the `.zd-toc-col` TOC column
 * is painted — instead of in the `afterSidebar` slot (which the doc layout
 * renders in the body). These tests assert against serialized HTML, since a
 * real browser is out of scope for unit tests.
 *
 * Coverage:
 *   1. tocPrepaintActive gate: script emitted iff tocToggle && shouldRenderDefaultToc.
 *   2. ORDERING: in a full <DocLayout> render the script sits inside <head>.
 *   3. createTocPrepaint (afterSidebar) emits ONLY the toggle Island — the
 *      pre-paint script is no longer duplicated there.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import {
  createTocPrepaint,
  createTocVisibilityPrepaint,
  tocPrepaintActive,
} from "../index.js";
import { DocLayout } from "../../doclayout/doc-layout.js";

// Distinctive substrings of the pre-paint script body.
const SCRIPT_STORAGE_READ = `localStorage.getItem("zudo-doc-toc-visible")`;
const SCRIPT_SET_ATTR = `setAttribute('data-toc-hidden','')`;

describe("tocPrepaintActive — shared gate", () => {
  it("is true only when tocToggle is on AND shouldRenderDefaultToc is true", () => {
    expect(tocPrepaintActive({ tocToggle: true }, true)).toBe(true);
  });

  it("is false when tocToggle is off, even with a default TOC present", () => {
    expect(tocPrepaintActive({ tocToggle: false }, true)).toBe(false);
  });

  it("is false when shouldRenderDefaultToc is false (no TOC, or a custom Toc override)", () => {
    expect(tocPrepaintActive({ tocToggle: true }, false)).toBe(false);
    expect(tocPrepaintActive({ tocToggle: true }, undefined)).toBe(false);
  });
});

describe("createTocVisibilityPrepaint — head pre-paint script", () => {
  it("emits the pre-paint script when tocToggle is on and the page renders the default TOC", () => {
    const TocVisibilityPrepaint = createTocVisibilityPrepaint({
      tocToggle: true,
    });
    const html = render(
      <TocVisibilityPrepaint shouldRenderDefaultToc={true} />,
    );
    expect(html).toContain("<script");
    expect(html).toContain(SCRIPT_STORAGE_READ);
    expect(html).toContain(SCRIPT_SET_ATTR);
  });

  it("emits nothing when the page does not render the default TOC (no TOC or a custom Toc override)", () => {
    const TocVisibilityPrepaint = createTocVisibilityPrepaint({
      tocToggle: true,
    });
    const html = render(
      <TocVisibilityPrepaint shouldRenderDefaultToc={false} />,
    );
    expect(html).toBe("");
  });

  it("emits nothing when the toc toggle feature is disabled", () => {
    const TocVisibilityPrepaint = createTocVisibilityPrepaint({
      tocToggle: false,
    });
    const html = render(
      <TocVisibilityPrepaint shouldRenderDefaultToc={true} />,
    );
    expect(html).toBe("");
  });
});

describe("toc-visibility pre-paint — placement in <head>", () => {
  const TocVisibilityPrepaint = createTocVisibilityPrepaint({
    tocToggle: true,
  });

  it("renders the pre-paint script inside <head>", () => {
    const html = render(
      <DocLayout
        title="Placement Test"
        // Router off keeps the head minimal; irrelevant to the pre-paint script.
        enableClientRouter={false}
        head={<TocVisibilityPrepaint shouldRenderDefaultToc={true} />}
        header={<header>hdr</header>}
        main={<p>body</p>}
      />,
    );

    const scriptIdx = html.indexOf(SCRIPT_SET_ATTR);
    const headCloseIdx = html.indexOf("</head>");

    expect(scriptIdx).toBeGreaterThan(-1);
    expect(headCloseIdx).toBeGreaterThan(-1);
    // The script executes before <body> is parsed/painted — the whole point
    // of hoisting it into <head> rather than the afterSidebar body slot.
    expect(scriptIdx).toBeLessThan(headCloseIdx);
  });
});

describe("createTocPrepaint — afterSidebar slot (Island only)", () => {
  it("emits the DesktopTocToggle island but NOT the pre-paint script", () => {
    const TocPrepaint = createTocPrepaint({ tocToggle: true });
    const html = render(<TocPrepaint shouldRenderDefaultToc={true} />);

    // The interactive toggle island is still here...
    expect(html).toContain('data-zfb-island="DesktopTocToggle"');
    // ...but the pre-paint visibility script was hoisted to <head> and must
    // not be duplicated in the body (that duplication was the pre-fix state
    // the sidebar's #2571 fix retired).
    expect(html).not.toContain(SCRIPT_SET_ATTR);
  });

  it("emits nothing when the page does not render the default TOC", () => {
    const TocPrepaint = createTocPrepaint({ tocToggle: true });
    const html = render(<TocPrepaint shouldRenderDefaultToc={false} />);
    expect(html).toBe("");
  });
});
