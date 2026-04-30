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
// Default fallback: a sr-only div containing the author name, created /
// updated labels (with dates when available), and the History toggle
// label. This ensures that the migration-check can find the author
// marker in the static HTML and that assistive technology exposes the
// metadata before the island hydrates.

import type { VNode } from "preact";
import {
  renderSsrSkipPlaceholder,
  type SsrSkipFallbackProps,
} from "../ssr-skip/types.js";

/** Default label values (English) — pass locale-translated strings for non-EN routes. */
const DEFAULT_CREATED_LABEL = "Created";
const DEFAULT_UPDATED_LABEL = "Updated";
const DEFAULT_HISTORY_LABEL = "History";

/**
 * Props delivered to the real `DocHistory` Preact component on
 * hydration. Mirrors the constructor signature in
 * `src/components/doc-history.tsx` so the runtime can JSON-decode
 * `data-zfb-island-props` and forward the values straight through.
 *
 * The author / label / date props are SSR-only — they are used to
 * build the static fallback and are **not** forwarded to the client
 * component (it loads its own data from the history JSON endpoint).
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

  // ── SSR-fallback-only props (not forwarded to the client island) ──

  /**
   * Author name (typically the first commit author) rendered in the
   * static fallback so the migration-check marker and screen readers
   * can find the value without waiting for JS hydration.
   */
  author?: string;
  /**
   * Localised "Created" label. Defaults to the English string; pass
   * the locale-specific translation for non-default locales.
   */
  createdLabel?: string;
  /**
   * Localised "Updated" label. Defaults to the English string; pass
   * the locale-specific translation for non-default locales.
   */
  updatedLabel?: string;
  /**
   * Localised "History" toggle label. Defaults to the English string;
   * pass the locale-specific translation for non-default locales.
   */
  historyLabel?: string;
  /**
   * ISO-date string for the document creation date (from the oldest
   * commit). Omit when not available (e.g. shallow clone) — the label
   * is still rendered without a date value.
   */
  createdDate?: string;
  /**
   * ISO-date string for the document's last-updated date (from the
   * newest commit). Omit when not available — the label is still
   * rendered without a date value.
   */
  updatedDate?: string;
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
  const {
    when = "idle",
    ssrFallback,
    author,
    createdLabel = DEFAULT_CREATED_LABEL,
    updatedLabel = DEFAULT_UPDATED_LABEL,
    historyLabel = DEFAULT_HISTORY_LABEL,
    createdDate,
    updatedDate,
    // Only slug / locale / basePath are forwarded to the real component.
    ...forwarded
  } = props;

  // Build the static SSR fallback if the caller did not supply one.
  // sr-only keeps it invisible to sighted users while remaining
  // accessible and greppable by the migration-check text extractor.
  const fallback =
    ssrFallback !== undefined ? (
      ssrFallback
    ) : (
      <div class="sr-only">
        {author && <span>{author}</span>}
        <span>
          {createdLabel}
          {createdDate ? `: ${createdDate}` : ""}
        </span>
        <span>
          {updatedLabel}
          {updatedDate ? `: ${updatedDate}` : ""}
        </span>
        <span>{historyLabel}</span>
      </div>
    );

  return renderSsrSkipPlaceholder("DocHistory", when, fallback, {
    ...forwarded,
  });
}
