/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG hydration smoke test for MermaidEnlarge + MermaidEnlargeSsrFallback.
 *
 * Verifies that:
 *   1. The SSR fallback renders the closed dialog shell the dist HTML carries
 *      before hydration (the matching class + style constants).
 *   2. The hydrated component renders the same empty dialog (no diagram open on
 *      mount) with the same structural selector.
 *   3. `displayName` is pinned so zfb's island scanner produces the right marker.
 *
 * Pattern: toc/__tests__/toc-ssg.test.tsx.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { MermaidEnlarge, MermaidEnlargeSsrFallback } from "../index.js";
import {
  MERMAID_ENLARGE_DIALOG_CLASS,
} from "../../island-types/index.js";

describe("MermaidEnlarge — displayName (island scanner marker)", () => {
  it("pins displayName to 'MermaidEnlarge' so zfb's captureComponentName produces the right marker", () => {
    expect(MermaidEnlarge.displayName).toBe("MermaidEnlarge");
  });
});

describe("MermaidEnlargeSsrFallback — SSG HTML presence", () => {
  it("renders a closed dialog element in static HTML", () => {
    const html = render(<MermaidEnlargeSsrFallback />);
    expect(html).toContain("<dialog");
  });

  it("carries the zd-mermaid-dialog class in static HTML", () => {
    const html = render(<MermaidEnlargeSsrFallback />);
    expect(html).toContain("zd-mermaid-dialog");
  });

  it("carries the MERMAID_ENLARGE_DIALOG_CLASS string in static HTML", () => {
    const html = render(<MermaidEnlargeSsrFallback />);
    // At least the first token from the shared constant must appear.
    expect(html).toContain(MERMAID_ENLARGE_DIALOG_CLASS.split(" ")[0]);
  });

  it("renders an empty dialog with no toolbar or close button", () => {
    const html = render(<MermaidEnlargeSsrFallback />);
    expect(html).not.toContain("zd-mermaid-toolbar");
    expect(html).not.toContain("zd-enlarge-dialog-close");
  });
});

describe("MermaidEnlarge — SSG HTML presence (closed state)", () => {
  it("renders a dialog element in closed state (no diagram open on mount)", () => {
    const html = render(<MermaidEnlarge />);
    expect(html).toContain("<dialog");
  });

  it("carries the zd-mermaid-dialog class in the dialog element", () => {
    const html = render(<MermaidEnlarge />);
    expect(html).toContain("zd-mermaid-dialog");
  });

  it("does not render the toolbar when no diagram is enlarged", () => {
    const html = render(<MermaidEnlarge />);
    expect(html).not.toContain("zd-mermaid-toolbar");
  });

  it("does not render the close button when no diagram is enlarged", () => {
    const html = render(<MermaidEnlarge />);
    expect(html).not.toContain("zd-enlarge-dialog-close");
  });
});
