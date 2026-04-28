/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// JSX port of src/components/code-block-enhancer.astro.
//
// The original .astro component rendered:
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
 * Drop-in JSX replacement for `src/components/code-block-enhancer.astro`.
 *
 * Include **once** in the layout. Renders the screen-reader announce region
 * and emits the code-block enhancer init script via `dangerouslySetInnerHTML`.
 *
 * The script:
 * - Wraps each `<pre.astro-code>` in a `.code-block-wrapper` container.
 * - Adds a copy-to-clipboard button and a word-wrap toggle button.
 * - Observes resize events to hide the wrap button when content fits.
 * - Handles `astro:before-swap` cleanup and `astro:page-load` re-init for
 *   Astro view transitions.
 */
export function CodeBlockEnhancer(): JSX.Element {
  return (
    <>
      <div class="code-block-sr-announce" aria-live="polite" />
      <script dangerouslySetInnerHTML={{ __html: CODE_BLOCK_ENHANCER_SCRIPT }} />
    </>
  );
}

export default CodeBlockEnhancer;
