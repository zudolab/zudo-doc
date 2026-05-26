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
//      `@takazudo/zudo-doc/transitions` module — this component does
//      not reach for the underlying browser event names directly. Under
//      zfb's Strategy B SPA navigation, the v2 vocabulary resolves to
//      `zfb:before-preparation` (BEFORE_NAVIGATE_EVENT) and
//      `zfb:after-swap` (AFTER_NAVIGATE_EVENT); see
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
function setPending(ev){document.querySelectorAll("[data-zd-nav-pending]").forEach(function(el){el.removeAttribute("data-zd-nav-pending");});var src=ev&&ev.sourceElement;if(src&&src instanceof Element)src.setAttribute("data-zd-nav-pending","");}
function clearPending(){document.querySelectorAll("[data-zd-nav-pending]").forEach(function(el){el.removeAttribute("data-zd-nav-pending");});}
document.addEventListener(${before},show);
document.addEventListener(${after},hide);
document.addEventListener(${before},setPending);
document.addEventListener(${after},clearPending);
})();`;
}

/**
 * Full-page loading overlay shown during view-transition navigations.
 *
 * Mount this once per layout (typically inside `DocLayoutWithDefaults`'s
 * `bodyEnd` slot, alongside the existing body-end providers). It is
 * server-rendered and self-wires its visibility — no hydration needed.
 *
 * CSS lives in the host project's `src/styles/global.css` (`.page-loading-overlay`,
 * `.page-loading-spinner`, `[data-zd-nav-pending]` rules) rather than in an
 * inline `<style>` block here — a `<style>` inside `<body>` violates HTML5
 * element-permitted-content and fails html-validate (same fix applied to the
 * version-switcher in zudolab/zudo-doc#1505; regression caught in W2A #1543).
 */
export default function PageLoadingOverlay({
  id = PAGE_LOADING_OVERLAY_ID,
}: PageLoadingOverlayProps = {}) {
  return (
    <>
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
