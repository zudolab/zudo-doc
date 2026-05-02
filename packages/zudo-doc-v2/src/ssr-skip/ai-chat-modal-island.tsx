"use client";

// Framework wrapper around the AI chat modal — emits an SSR-skip
// placeholder so the heavy modal Preact island never renders during
// the static build (it depends on `dialog.showModal()`, browser-only
// fetch, and toggle events that can't fire server-side).
//
// The original Astro page used `<AiChatModal client:load />`. The
// equivalent zfb shape is `<Island ssrFallback={...} when="load">`,
// and the placeholder lets a doc page write
// `<AiChatModalIsland basePath={...} />` without re-implementing the
// marker plumbing every time.
//
// Default fallback: a visually-hidden `<p>` containing the body label
// "Ask a question about the documentation." so SSG HTML includes the
// string for migration-check and screen-reader discovery. When JS
// hydrates, the placeholder div is replaced by the real `<dialog>`.
// Callers can override `ssrFallback` or supply `bodyLabel` for locale
// variants.

import { renderSsrSkipPlaceholder, type SsrSkipFallbackProps } from "./types.js";

/** Default body label text (English). */
const DEFAULT_BODY_LABEL = "Ask a question about the documentation.";

/**
 * Props passed through to the real `AiChatModal` component on
 * hydration. The hydration manifest binds the marker name
 * `"AiChatModal"` to the actual component constructor.
 */
export interface AiChatModalIslandProps extends SsrSkipFallbackProps {
  /**
   * Base path the chat modal uses to construct API URLs. Forwarded
   * verbatim to the real component on hydration.
   */
  basePath: string;
  /**
   * Label rendered in the sr-only SSR fallback so migration-check and
   * assistive technology can find the body text in SSG output. Defaults
   * to the English phrase. Pass a locale-translated string for
   * non-default locales.
   */
  bodyLabel?: string;
}

/**
 * SSR-skip wrapper for the AI chat modal. Drop-in replacement for the
 * legacy `<AiChatModal client:load />` Astro pattern.
 */
export function AiChatModalIsland(props: AiChatModalIslandProps) {
  const { when = "load", ssrFallback, bodyLabel = DEFAULT_BODY_LABEL, ...forwarded } = props;
  // Use a visually-hidden paragraph as the default SSR fallback so the
  // body label string is present in the static HTML. sr-only keeps it
  // invisible to sighted users while remaining accessible and greppable.
  const fallback =
    ssrFallback !== undefined ? ssrFallback : <p class="sr-only">{bodyLabel}</p>;
  return renderSsrSkipPlaceholder("AiChatModal", when, fallback, { ...forwarded });
}
