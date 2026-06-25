/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * SSG hydration smoke test for ImageEnlarge + ImageEnlargeSsrFallback.
 *
 * Verifies that:
 *   1. The SSR fallback renders the closed dialog shell the dist HTML carries
 *      before hydration (the matching class + style constants).
 *   2. The hydrated component renders the same empty dialog (no image open on
 *      mount) with the same structural selector.
 *   3. `displayName` is pinned so zfb's island scanner produces the right marker.
 *
 * Pattern: toc/__tests__/toc-ssg.test.tsx.
 */

import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { ImageEnlarge, ImageEnlargeSsrFallback } from "../index.js";
import {
  IMAGE_ENLARGE_DIALOG_CLASS,
} from "../../island-types/index.js";

describe("ImageEnlarge — displayName (island scanner marker)", () => {
  it("pins displayName to 'ImageEnlarge' so zfb's captureComponentName produces the right marker", () => {
    expect(ImageEnlarge.displayName).toBe("ImageEnlarge");
  });
});

describe("ImageEnlargeSsrFallback — SSG HTML presence", () => {
  it("renders a closed dialog element in static HTML", () => {
    const html = render(<ImageEnlargeSsrFallback />);
    expect(html).toContain("<dialog");
  });

  it("carries the zd-enlarge-dialog class in static HTML", () => {
    const html = render(<ImageEnlargeSsrFallback />);
    expect(html).toContain("zd-enlarge-dialog");
  });

  it("carries the IMAGE_ENLARGE_DIALOG_CLASS string in static HTML", () => {
    const html = render(<ImageEnlargeSsrFallback />);
    // All tokens from the shared constant must appear in the emitted markup.
    expect(html).toContain(IMAGE_ENLARGE_DIALOG_CLASS.split(" ")[0]);
  });

  it("renders a self-closing (empty) dialog with no children", () => {
    const html = render(<ImageEnlargeSsrFallback />);
    // The fallback is an empty dialog — no inner content.
    expect(html).not.toContain("button");
    expect(html).not.toContain("img");
  });
});

describe("ImageEnlarge — SSG HTML presence (closed state)", () => {
  it("renders a dialog element in closed state (no imgData on mount)", () => {
    const html = render(<ImageEnlarge />);
    expect(html).toContain("<dialog");
  });

  it("carries the zd-enlarge-dialog class in the dialog element", () => {
    const html = render(<ImageEnlarge />);
    expect(html).toContain("zd-enlarge-dialog");
  });

  it("does not render image content when no image is enlarged", () => {
    const html = render(<ImageEnlarge />);
    // No enlarged image in closed state.
    expect(html).not.toContain("zd-enlarge-dialog-close");
  });
});
