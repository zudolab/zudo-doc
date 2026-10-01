/** @vitest-environment happy-dom */
/** @jsxRuntime automatic */

import { describe, expect, it } from "vitest";
import { renderIsland, renderSsr } from "../../__tests__/helpers/zudo-react.js";
import { MermaidEnlarge, MermaidEnlargeSsrFallback } from "../index.js";
import { MERMAID_ENLARGE_DIALOG_CLASS } from "../../island-types/index.js";

describe("MermaidEnlarge — SSR shell", () => {
  it("pins the island marker name", () => {
    expect(MermaidEnlarge.displayName).toBe("MermaidEnlarge");
  });

  it("renders an empty closed shell in its static fallback and the island", () => {
    const fallback = renderSsr(<MermaidEnlargeSsrFallback />);
    const closed = renderSsr(<MermaidEnlarge />);
    expect(fallback).toContain("<dialog");
    expect(fallback).toContain(MERMAID_ENLARGE_DIALOG_CLASS.split(" ")[0]);
    expect(fallback).toContain('aria-label="Enlarged diagram"');
    expect(fallback).not.toContain("zd-mermaid-toolbar");
    expect(fallback).not.toContain("zd-enlarge-dialog-close");
    expect(closed).toContain("<dialog");
    expect(closed).toContain(MERMAID_ENLARGE_DIALOG_CLASS.split(" ")[0]);
    expect(closed).not.toContain("zd-mermaid-toolbar");
    expect(closed).not.toContain("zd-enlarge-dialog-close");
    expect(closed).toBe(fallback);
  });

  it("hydrates the same closed dialog and activates without diagnostics", async () => {
    const view = await renderIsland(MermaidEnlarge, {}, {
      identity: { component: "MermaidEnlarge", build: "test" },
    });
    expect(view.diagnostics).toEqual([]);
    expect(view.root.querySelector("dialog")?.getAttribute("aria-label")).toBe("Enlarged diagram");
    view.dispose();
  });
});
