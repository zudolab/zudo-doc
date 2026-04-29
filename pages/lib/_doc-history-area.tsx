/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-aware DocHistory area wrapper for the zfb doc pages.
//
// Mirrors the Phase B-1 pattern used by _footer-with-defaults.tsx: this
// wrapper lives in pages/lib/ with a leading underscore so the zfb router
// skips it as a page module, while the two doc-page modules (docs/[...slug].tsx
// and [locale]/docs/[...slug].tsx) import it directly. It gates on
// settings.docHistory, resolves the correct locale prop (omitted for the
// default locale, matching the doc-history fetch-path branch in
// src/components/doc-history.tsx), and passes the assembled props into
// BodyFootUtilArea — restoring the `<section aria-label="Document utilities">`
// landmark and its Revision History heading that the migration-check was
// reporting as missing on all zfb doc routes.

import type { VNode } from "preact";
import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import { BodyFootUtilArea } from "@zudo-doc/zudo-doc-v2/body-foot-util";

interface DocHistoryAreaProps {
  /** Page slug, e.g. "getting-started/intro". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
}

/**
 * Renders the `<BodyFootUtilArea>` shell with a doc-history island when
 * `settings.docHistory` is enabled.  Returns null otherwise so no empty
 * landmark appears on pages where history is disabled.
 *
 * The locale prop is forwarded to `DocHistoryIsland` only for non-default
 * locales — the history JSON server stores default-locale files without a
 * locale path segment (matching the fetch-path branch in doc-history.tsx).
 */
export function DocHistoryArea({ slug, locale }: DocHistoryAreaProps): VNode | null {
  if (!settings.docHistory) return null;

  const docHistory = {
    slug,
    // Omit locale for the default locale — fetch path is /doc-history/{slug}.json.
    // For non-default locales the path is /doc-history/{locale}/{slug}.json.
    locale: locale === defaultLocale ? undefined : locale,
    basePath: settings.base ?? "/",
  };

  return <BodyFootUtilArea docHistory={docHistory} />;
}
