"use client";

// Framework wrapper around the design-token tweak panel — emits an
// SSR-skip placeholder so the panel (which reads `localStorage`,
// builds an `<iframe>` bridge, and depends on a fully-resolved
// `:root` for its color-mix maths) never executes server-side.
//
// The original Astro page used `<DesignTokenTweakPanel client:only="preact" />`;
// `client:only` maps directly to zfb's SSR-skip mode. The default
// `when` is `"load"` to mirror the immediate hydration semantics of
// `client:only`.
//
// The real Preact component is being ported by the sibling `theme`
// topic at `packages/zudo-doc-v2/src/theme/design-token-tweak-panel.tsx`.
// We deliberately do not import from that path here: the wrapper's
// only job is to emit a `data-zfb-island-skip-ssr="DesignTokenTweakPanel"`
// placeholder, and the hydration manifest (set up at consumer level)
// binds the marker name to whichever constructor is in scope at
// integration time. Avoiding the import keeps this topic typecheck-
// clean even before the sibling topic merges.
//
// Default fallback: `null`. The panel is fixed-position and only
// visible after a toggle event, so there is no layout to preserve.

import { renderSsrSkipPlaceholder, type SsrSkipFallbackProps } from "./types.js";

/**
 * The real `DesignTokenTweakPanel` component takes no props. The
 * wrapper still accepts `SsrSkipFallbackProps` so callers can override
 * the defaults if needed.
 */
export type DesignTokenTweakPanelIslandProps = SsrSkipFallbackProps;

/**
 * SSR-skip wrapper for the design-token tweak panel. Drop-in
 * replacement for the legacy `<DesignTokenTweakPanel client:only="preact" />`
 * Astro pattern.
 */
export function DesignTokenTweakPanelIsland(props: DesignTokenTweakPanelIslandProps = {}) {
  const { when = "load", ssrFallback = null } = props;
  return renderSsrSkipPlaceholder("DesignTokenTweakPanel", when, ssrFallback, {});
}
