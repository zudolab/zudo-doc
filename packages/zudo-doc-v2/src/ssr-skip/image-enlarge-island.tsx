// Framework wrapper around the image-enlarge dialog — emits an
// SSR-skip placeholder so the eligibility scanner (ResizeObserver,
// MutationObserver, devicePixelRatio checks) never executes
// server-side.
//
// The original Astro page used `<ImageEnlarge client:idle />`; idle
// is appropriate because the modal is purely an enhancement triggered
// by user clicks — no need to hydrate eagerly.
//
// Default fallback: `null`. The real component renders a closed
// `<dialog>` plus per-image enlarge buttons that are toggled via
// runtime DOM observation; none of that needs SSR markup. Layout is
// driven by the `.zd-enlargeable` containers in the article body, not
// by this island.

import { renderSsrSkipPlaceholder, type SsrSkipFallbackProps } from "./types.js";

/**
 * The real `ImageEnlarge` component takes no props. We still extend
 * `SsrSkipFallbackProps` so callers can override `when` / `ssrFallback`
 * if needed.
 */
export type ImageEnlargeIslandProps = SsrSkipFallbackProps;

/**
 * SSR-skip wrapper for the image-enlarge dialog. Drop-in replacement
 * for the legacy `<ImageEnlarge client:idle />` Astro pattern.
 */
export function ImageEnlargeIsland(props: ImageEnlargeIslandProps = {}) {
  const { when = "idle", ssrFallback = null } = props;
  return renderSsrSkipPlaceholder("ImageEnlarge", when, ssrFallback, {});
}
