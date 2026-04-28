/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Framework wrapper around the doc-history Preact island — emits an
// SSR-skip placeholder so the heavy revision-history component (with
// its diff library, dialog.showModal(), keyboard handlers, View
// Transitions hooks, and runtime fetch) is never evaluated during the
// static build.
//
// The original Astro template wired the component as
// `<DocHistory ... client:idle />`; the v2 equivalent is the SSR-skip
// placeholder pattern formalised in `../ssr-skip/types.ts`. This
// wrapper sits next to the body-foot-util-area component because the
// island is only ever mounted from there — it is part of this topic
// rather than a generic ssr-skip primitive.
//
// Default fallback: `null`. The real component renders an inline
// "History" trigger button + a closed `<dialog>`; both have zero
// layout footprint until the user opens the panel, so there is
// nothing meaningful to mock up server-side.

import type { VNode } from "preact";
import {
  renderSsrSkipPlaceholder,
  type SsrSkipFallbackProps,
} from "../ssr-skip/types.js";

/**
 * Props delivered to the real `DocHistory` Preact component on
 * hydration. Mirrors the constructor signature in
 * `src/components/doc-history.tsx` so the runtime can JSON-decode
 * `data-zfb-island-props` and forward the values straight through.
 */
export interface DocHistoryIslandProps extends SsrSkipFallbackProps {
  /** Page slug used to build the history JSON fetch path. */
  slug: string;
  /**
   * Locale code, omitted for the default locale. Forwarded to the
   * fetch path resolver inside the real component.
   */
  locale?: string;
  /**
   * Site base path. Defaults to `"/"` inside the real component when
   * omitted; explicit when the site is served from a subpath.
   */
  basePath?: string;
}

/**
 * SSR-skip wrapper for the doc-history dialog. Drop-in replacement for
 * the legacy `<DocHistory ... client:idle />` Astro pattern.
 *
 * The marker emitted here is `"DocHistory"` — the hydration manifest
 * shipped by the consumer must bind that name to the real component
 * constructor.
 */
export function DocHistoryIsland(props: DocHistoryIslandProps): VNode {
  const { when = "idle", ssrFallback = null, ...forwarded } = props;
  return renderSsrSkipPlaceholder("DocHistory", when, ssrFallback, {
    ...forwarded,
  });
}
