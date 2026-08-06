// auto-logo/render-shape.ts — shared ShapePrimitive → SVG-string serializer
// for the two dependency-free string renderers (standalone.ts's luminance
// mask and icon.ts's direct paint). Imports only shapes.ts types — no
// `.tsx`, no preact — so both renderers stay importable from plain node/CLI
// scripts (enforced by __tests__/standalone-eval-graph.test.ts).

import type { ShapePrimitive } from "./shapes.js";

export function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Serialize one primitive, substituting any attr value found in `colors` —
 * keyed on the exactly-two color tokens of the shapes.ts color contract
 * (`currentColor` for ink, `var(--color-bg)` for knockouts), so a full
 * substitution map guarantees neither token reaches the output.
 */
export function renderShape(shape: ShapePrimitive, colors: Record<string, string>): string {
  const attrs = Object.entries(shape.attrs)
    .map(([key, value]) => {
      const resolved = typeof value === "string" && value in colors ? colors[value]! : value;
      return `${key}="${escapeAttr(String(resolved))}"`;
    })
    .join(" ");
  return `<${shape.el} ${attrs} />`;
}
