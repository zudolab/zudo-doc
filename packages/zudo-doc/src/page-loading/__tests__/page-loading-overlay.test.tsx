/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import {
  AFTER_NAVIGATE_EVENT,
  BEFORE_NAVIGATE_EVENT,
} from "../../transitions/page-events.js";
import PageLoadingOverlay, {
  PAGE_LOADING_OVERLAY_ID,
  buildPageLoadingOverlayBootstrap,
} from "../page-loading-overlay.js";

describe("buildPageLoadingOverlayBootstrap", () => {
  it("inlines the overlay id and routes through the v2 transitions vocabulary", () => {
    const script = buildPageLoadingOverlayBootstrap("custom-id");
    expect(script).toContain('var id="custom-id";');
    // Event names come from the shim, not raw `astro:*` literals in the
    // component file — the assertion fixes that contract.
    expect(script).toContain(JSON.stringify(BEFORE_NAVIGATE_EVENT));
    expect(script).toContain(JSON.stringify(AFTER_NAVIGATE_EVENT));
    expect(script).toMatch(/document\.addEventListener\(/);
  });

  it("escapes the overlay id via JSON to defend against quote injection", () => {
    const script = buildPageLoadingOverlayBootstrap('id"; alert(1); //');
    // JSON.stringify yields a safely escaped literal; we just check the
    // raw quote isn't present unescaped in the body.
    expect(script).not.toMatch(/var id="id"; alert\(1\)/);
    expect(script).toContain(JSON.stringify('id"; alert(1); //'));
  });

  it("contains data-zd-nav-pending marker logic with removeAttribute cleanup", () => {
    const script = buildPageLoadingOverlayBootstrap("test-overlay");
    expect(script).toContain("data-zd-nav-pending");
    expect(script).toContain("removeAttribute");
  });
});

describe("<PageLoadingOverlay />", () => {
  it("renders the overlay element with the default id and aria-hidden", () => {
    const html = render(<PageLoadingOverlay />);
    expect(html).toContain(`id="${PAGE_LOADING_OVERLAY_ID}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="page-loading-overlay"');
    expect(html).toContain('class="page-loading-spinner"');
  });

  it("emits the bootstrap script but no inline <style> block (CSS moved to global.css)", () => {
    // CSS was moved out of an inline <style> in body to src/styles/global.css
    // to fix the HTML5 element-permitted-content violation (#1543).
    const html = render(<PageLoadingOverlay />);
    expect(html).not.toMatch(/<style>/);
    expect(html).toMatch(/<script>[\s\S]*addEventListener/);
  });

  it("honors a custom id on both the element and the bootstrap script", () => {
    const html = render(<PageLoadingOverlay id="custom-overlay" />);
    expect(html).toContain('id="custom-overlay"');
    expect(html).toContain('var id="custom-overlay";');
  });

  it("bootstrap script references data-zd-nav-pending and does not emit pointer-events: auto", () => {
    // a[data-zd-nav-pending] CSS rule lives in global.css (not inline).
    // The bootstrap script still uses the data-zd-nav-pending attribute in querySelectorAll.
    const html = render(<PageLoadingOverlay />);
    expect(html).toContain("data-zd-nav-pending");
    expect(html).not.toContain("pointer-events: auto");
  });
});
