/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of the legacy `code-block-enhancer` component.
//
// The original component rendered:
//   1. A `<div class="code-block-sr-announce">` live-region for screen-reader
//      announcements after copying.
//   2. A <script> tag that self-initializes the copy/wrap button enhancer.
//
// This JSX version renders the same markup via `dangerouslySetInnerHTML` so
// the host can drop it into any SSR layout without Astro. The init function
// is also exported separately for callers that manage their own script injection.

import type { JSX } from "preact";
import { CODE_BLOCK_ENHANCER_SCRIPT } from "./code-block-enhancer-script.js";

/**
 * Drop-in JSX replacement for the legacy `code-block-enhancer` component.
 *
 * Include **once** in the layout. Renders the screen-reader announce region
 * and emits the code-block enhancer init script via `dangerouslySetInnerHTML`.
 *
 * The script:
 * - Wraps each highlighted `<pre>` (`.hi-root`) and raw tab-panel fallback in
 *   a `.code-block-wrapper` container.
 * - Adds a copy-to-clipboard button and a word-wrap toggle button.
 * - Observes resize events to hide the wrap button when content fits.
 * - Handles before-navigate cleanup and after-navigate re-init for View
 *   Transitions. Event names come from `BEFORE_NAVIGATE_EVENT` /
 *   `AFTER_NAVIGATE_EVENT` in `../transitions/page-events.ts`.
 */
export function CodeBlockEnhancer(): JSX.Element {
  return (
    <>
      <div class="code-block-sr-announce" aria-live="polite" />
      <script dangerouslySetInnerHTML={{ __html: CODE_BLOCK_ENHANCER_SCRIPT }} />
    </>
  );
}
