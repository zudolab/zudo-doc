/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG tests for the sidebar-prepaint factories (bug zudolab/zudo-doc#2571).
 *
 * The load-bearing fix is a PLACEMENT change: the `data-sidebar-hidden`
 * pre-paint `<script>` must be emitted in `<head>` — before the `<aside>`
 * desktop sidebar is painted — instead of in the `afterSidebar` slot (which the
 * doc layout renders AFTER the `<aside>`, so on a hard reload the expanded
 * sidebar could paint first → flash). These tests assert against serialized
 * HTML, since a real browser is out of scope for unit tests.
 *
 * Coverage:
 *   1. createSidebarVisibilityPrepaint emits the pre-paint script (gated).
 *   2. ORDERING: in a full <DocLayout> render the script sits inside <head>,
 *      before the <aside id="desktop-sidebar"> element.
 *   3. createSidebarPrepaint (afterSidebar) emits ONLY the toggle Island — the
 *      pre-paint script is no longer duplicated there.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import {
  createSidebarPrepaint,
  createSidebarVisibilityPrepaint,
} from "../index.js";
import { DocLayout } from "../../doclayout/doc-layout.js";

// Distinctive substrings of the pre-paint script body.
const SCRIPT_STORAGE_READ = `localStorage.getItem("zudo-doc-sidebar-visible")`;
const SCRIPT_SET_ATTR = `setAttribute('data-sidebar-hidden','')`;

describe("createSidebarVisibilityPrepaint — head pre-paint script", () => {
  it("emits the pre-paint script when sidebarToggle is on and the page shows a sidebar", () => {
    const SidebarVisibilityPrepaint = createSidebarVisibilityPrepaint({
      sidebarToggle: true,
    });
    const html = render(<SidebarVisibilityPrepaint hideSidebar={false} />);
    expect(html).toContain("<script");
    expect(html).toContain(SCRIPT_STORAGE_READ);
    expect(html).toContain(SCRIPT_SET_ATTR);
  });

  it("emits nothing when the page hides the sidebar (hideSidebar)", () => {
    const SidebarVisibilityPrepaint = createSidebarVisibilityPrepaint({
      sidebarToggle: true,
    });
    const html = render(<SidebarVisibilityPrepaint hideSidebar={true} />);
    expect(html).toBe("");
  });

  it("emits nothing when the sidebar toggle feature is disabled", () => {
    const SidebarVisibilityPrepaint = createSidebarVisibilityPrepaint({
      sidebarToggle: false,
    });
    const html = render(<SidebarVisibilityPrepaint hideSidebar={false} />);
    expect(html).toBe("");
  });
});

describe("sidebar-visibility pre-paint — placement/ordering in <head>", () => {
  const SidebarVisibilityPrepaint = createSidebarVisibilityPrepaint({
    sidebarToggle: true,
  });

  function renderLayout() {
    return render(
      <DocLayout
        title="Placement Test"
        // Router off keeps the head minimal; irrelevant to the pre-paint script.
        enableClientRouter={false}
        head={<SidebarVisibilityPrepaint hideSidebar={false} />}
        header={<header>hdr</header>}
        sidebar={<nav>nav</nav>}
        main={<p>body</p>}
      />,
    );
  }

  it("renders the pre-paint script before the <aside> desktop sidebar", () => {
    const html = renderLayout();

    const scriptIdx = html.indexOf(SCRIPT_SET_ATTR);
    const asideIdx = html.indexOf('<aside id="desktop-sidebar"');
    const headCloseIdx = html.indexOf("</head>");

    expect(scriptIdx).toBeGreaterThan(-1);
    expect(asideIdx).toBeGreaterThan(-1);
    // The script executes before the <aside> is parsed/painted — the whole
    // point of the fix. Also confirm it lives inside <head> (before </head>).
    expect(scriptIdx).toBeLessThan(asideIdx);
    expect(scriptIdx).toBeLessThan(headCloseIdx);
    expect(headCloseIdx).toBeLessThan(asideIdx);
  });
});

describe("createSidebarPrepaint — afterSidebar slot (Island only)", () => {
  it("emits the DesktopSidebarToggle island but NOT the pre-paint script", () => {
    const SidebarPrepaint = createSidebarPrepaint({ sidebarToggle: true });
    const html = render(<SidebarPrepaint hideSidebar={false} />);

    // The interactive toggle island is still here...
    expect(html).toContain('data-zfb-island="DesktopSidebarToggle"');
    // ...but the pre-paint visibility script was hoisted to <head> and must
    // not be duplicated in the body (that duplication was the pre-fix state).
    expect(html).not.toContain(SCRIPT_SET_ATTR);
  });

  it("emits nothing when the page hides the sidebar", () => {
    const SidebarPrepaint = createSidebarPrepaint({ sidebarToggle: true });
    const html = render(<SidebarPrepaint hideSidebar={true} />);
    expect(html).toBe("");
  });
});
