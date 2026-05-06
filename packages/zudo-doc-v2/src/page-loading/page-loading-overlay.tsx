/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Server-rendered, zero-hydration full-page loading overlay.
//
// JSX port of src/components/page-loading-overlay.astro.
//
// Renders three things into the document:
//
//   1. A fixed-position overlay `<div>` with a centered spinner. Hidden
//      by default (`opacity: 0; pointer-events: none;`) and made
//      visible by adding `data-visible` to it.
//   2. A `<style>` block that owns the overlay + spinner CSS plus the
//      `prefers-reduced-motion` fallback. Inlined via
//      `dangerouslySetInnerHTML` (matching the ColorSchemeProvider
//      pattern) so no separate stylesheet has to be wired up.
//   3. A small `<script>` that toggles the `data-visible` attribute on
//      navigation lifecycle events. The event names come from the
//      `@zudo-doc/zudo-doc-v2/transitions` module — this component does
//      not reach for the underlying browser event names directly. After
//      zudolab/zudo-doc#1335 (E2 task 2 half B) the v2 vocabulary
//      resolves to `pagehide` (BEFORE_NAVIGATE_EVENT) and
//      `DOMContentLoaded` (AFTER_NAVIGATE_EVENT); see
//      `transitions/page-events.ts` for rationale.
//
// The component is intentionally not hydrated. Hydrating Preact just to
// attach two listeners would be wasteful given the original Astro file
// shipped a tiny imperative script — this port keeps that profile.

import {
  AFTER_NAVIGATE_EVENT,
  BEFORE_NAVIGATE_EVENT,
} from "../transitions/page-events.js";

/** Default `id` for the overlay element. Stable so test rigs can target it. */
export const PAGE_LOADING_OVERLAY_ID = "page-loading-overlay";

export interface PageLoadingOverlayProps {
  /**
   * Override the DOM `id` used by both the overlay element and the
   * bootstrap script. Useful when multiple overlays could co-exist on
   * the page (e.g. tests). Defaults to `PAGE_LOADING_OVERLAY_ID`.
   */
  id?: string;
}

/**
 * Build the inline bootstrap script body. Exported so test rigs can
 * inspect / snapshot it without rendering the component.
 */
export function buildPageLoadingOverlayBootstrap(overlayId: string): string {
  // Values are inlined as JSON literals so the script is fully
  // self-contained and matches the `define:vars` shape used elsewhere
  // (see ColorSchemeProvider). Event names come from the transitions
  // module's exported constants — no raw `astro:*` strings live in
  // this file.
  const id = JSON.stringify(overlayId);
  const before = JSON.stringify(BEFORE_NAVIGATE_EVENT);
  const after = JSON.stringify(AFTER_NAVIGATE_EVENT);
  return `(function(){
var id=${id};
function show(){var el=document.getElementById(id);if(!el)return;el.setAttribute("data-visible","");el.setAttribute("aria-hidden","false");}
function hide(){var el=document.getElementById(id);if(!el)return;el.removeAttribute("data-visible");el.setAttribute("aria-hidden","true");}
document.addEventListener(${before},show);
document.addEventListener(${after},hide);
})();`;
}

const OVERLAY_CSS = `.page-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--color-overlay) 60%, transparent);
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease-out;
}

.page-loading-overlay[data-visible] {
  opacity: 1;
  pointer-events: auto;
}

.page-loading-spinner {
  width: 48px;
  height: 48px;
  border: 5px solid var(--color-fg, #fff);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: page-loading-spin 1s linear infinite;
}

@media (min-width: 1024px) {
  .page-loading-spinner {
    width: 64px;
    height: 64px;
    border-width: 6px;
  }
}

@keyframes page-loading-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .page-loading-spinner {
    animation: none;
    border-bottom-color: var(--color-fg, #fff);
    opacity: 0.5;
  }
}`;

/**
 * Full-page loading overlay shown during view-transition navigations.
 *
 * Mount this once per layout (typically inside `DocLayoutWithDefaults`'s
 * `bodyEnd` slot, alongside the existing body-end providers). It is
 * server-rendered and self-wires its visibility — no hydration needed.
 */
export default function PageLoadingOverlay({
  id = PAGE_LOADING_OVERLAY_ID,
}: PageLoadingOverlayProps = {}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_CSS }} />
      <div
        id={id}
        class="page-loading-overlay"
        aria-hidden="true"
      >
        <span class="page-loading-spinner" />
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: buildPageLoadingOverlayBootstrap(id),
        }}
      />
    </>
  );
}
