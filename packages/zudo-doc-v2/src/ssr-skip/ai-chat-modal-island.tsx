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
// Default fallback: `null`. The real component renders a `<dialog>`
// that is closed by default, so it has zero layout footprint —
// nothing to mock up SSR-side. Callers can override `ssrFallback` if
// they ever decide to render a hint/button while hydration is
// scheduled.

import { renderSsrSkipPlaceholder, type SsrSkipFallbackProps } from "./types.js";

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
}

/**
 * SSR-skip wrapper for the AI chat modal. Drop-in replacement for the
 * legacy `<AiChatModal client:load />` Astro pattern.
 */
export function AiChatModalIsland(props: AiChatModalIslandProps) {
  const { when = "load", ssrFallback = null, ...forwarded } = props;
  return renderSsrSkipPlaceholder("AiChatModal", when, ssrFallback, { ...forwarded });
}
