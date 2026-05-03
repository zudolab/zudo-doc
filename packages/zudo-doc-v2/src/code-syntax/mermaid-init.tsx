/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/mermaid-init.astro.
//
// The original .astro component rendered a single <script> tag that:
//   1. Lazily imports mermaid on first after-navigate event (today
//      `DOMContentLoaded`; pre-migration this was `astro:page-load`).
//   2. Reads CSS custom properties to build mermaid theme variables.
//   3. Renders `[data-mermaid]` elements and marks them with
//      `[data-mermaid-rendered]` to avoid double-rendering.
//   4. Watches `documentElement[style]` mutations (from the color-tweak panel)
//      and re-renders diagrams when the palette changes.
//
// This JSX version emits the identical script via `dangerouslySetInnerHTML`.
// Include once in the layout, before any mermaid diagram content.
//
// Wave 13 (zudolab/zudo-doc#1355 Topic 4): the script's mermaid import
// target was changed from the bare `"mermaid"` specifier to a public
// ESM CDN URL so the inline `<script>` (no bundler in the path) can
// resolve the module at runtime. See `mermaid-init-script.ts` for the
// full rationale and the override knob.

import type { JSX } from "preact";
import { MERMAID_INIT_SCRIPT } from "./mermaid-init-script.js";

/**
 * Drop-in JSX replacement for `src/components/mermaid-init.astro`.
 *
 * Include **once** in the layout. Emits the mermaid init script via
 * `dangerouslySetInnerHTML`. The script lazily imports mermaid only when
 * `[data-mermaid]` elements are found on the page, so pages without any
 * mermaid diagrams pay zero runtime cost.
 *
 * The script hooks into `AFTER_NAVIGATE_EVENT` (from
 * `../transitions/page-events.ts`) for View Transitions support and into
 * a `MutationObserver` on `:root[style]` to re-render when the user
 * changes the color scheme via the color-tweak panel.
 */
export function MermaidInit(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: MERMAID_INIT_SCRIPT }} />;
}

export default MermaidInit;
