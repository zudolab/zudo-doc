/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import {
  AFTER_NAVIGATE_EVENT,
  BEFORE_NAVIGATE_EVENT,
} from "../../transitions/page-events";
import PageLoadingOverlay, {
  PAGE_LOADING_OVERLAY_ID,
  buildPageLoadingOverlayBootstrap,
} from "../page-loading-overlay";

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
});

describe("<PageLoadingOverlay />", () => {
  it("renders the overlay element with the default id and aria-hidden", () => {
    const html = render(<PageLoadingOverlay />);
    expect(html).toContain(`id="${PAGE_LOADING_OVERLAY_ID}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="page-loading-overlay"');
    expect(html).toContain('class="page-loading-spinner"');
  });

  it("emits both the overlay style block and the bootstrap script", () => {
    const html = render(<PageLoadingOverlay />);
    expect(html).toMatch(/<style>[\s\S]*\.page-loading-overlay/);
    expect(html).toMatch(/<script>[\s\S]*addEventListener/);
  });

  it("honors a custom id on both the element and the bootstrap script", () => {
    const html = render(<PageLoadingOverlay id="custom-overlay" />);
    expect(html).toContain('id="custom-overlay"');
    expect(html).toContain('var id="custom-overlay";');
  });
});
