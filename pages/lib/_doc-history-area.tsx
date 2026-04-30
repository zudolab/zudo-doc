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
import { defaultLocale, t } from "@/config/i18n";
import { BodyFootUtilArea } from "@zudo-doc/zudo-doc-v2/body-foot-util";
import { buildGitHubSourceUrl } from "@/utils/github";
import { getFileCommits, getCommitInfo } from "@/utils/doc-history";

interface DocHistoryAreaProps {
  /** Page slug, e.g. "getting-started/intro". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
  /**
   * Raw zfb entry slug (relative path without extension), e.g.
   * "getting-started/intro" or "getting-started/index". Appended with
   * ".mdx" to form the file path passed to buildGitHubSourceUrl.
   * Omit for auto-index pages (no underlying MDX file) — sourceUrl
   * will be suppressed automatically.
   */
  entrySlug?: string;
  /**
   * Content directory for the active locale, e.g. "src/content/docs"
   * or "src/content/docs-ja". Combined with entrySlug to build the
   * view-source GitHub URL. Omit to suppress the view-source link.
   */
  contentDir?: string;
}

/**
 * Lightweight git lookup for the SSR fallback: returns author name from the
 * oldest commit (= document creator) plus ISO-date strings for created
 * (oldest) and updated (newest). Returns null on any git failure so that
 * shallow clones and CI environments gracefully degrade without crashing SSR.
 *
 * Uses only the commit-hash list + per-commit metadata (no file content) so
 * it is significantly faster than a full `getDocHistory()` call.
 */
function getHistoryMeta(
  entrySlug: string,
  contentDir: string,
): { author?: string; createdDate?: string; updatedDate?: string } | null {
  try {
    const filePath = `${contentDir}/${entrySlug}.mdx`;
    const commits = getFileCommits(filePath, 100);
    if (commits.length === 0) return null;
    const newest = getCommitInfo(commits[0], filePath);
    const oldest =
      commits.length > 1
        ? getCommitInfo(commits[commits.length - 1], filePath)
        : newest;
    return {
      // First commit author is the document creator; fall back to newest
      // committer when the oldest lookup returns empty (shallow clone).
      author: oldest.author || newest.author || undefined,
      createdDate: oldest.date || undefined,
      updatedDate: newest.date || undefined,
    };
  } catch {
    // git unavailable or repo missing — degrade gracefully
    return null;
  }
}

/**
 * Renders the `<BodyFootUtilArea>` shell with a doc-history island when
 * `settings.docHistory` is enabled.  Returns null otherwise so no empty
 * landmark appears on pages where history is disabled.
 *
 * The locale prop is forwarded to `DocHistoryIsland` only for non-default
 * locales — the history JSON server stores default-locale files without a
 * locale path segment (matching the fetch-path branch in doc-history.tsx).
 *
 * When entrySlug + contentDir are both provided and settings.bodyFootUtilArea
 * has viewSourceLink enabled, computes sourceUrl via buildGitHubSourceUrl and
 * resolves the i18n label for the active locale — keeping the v2 component
 * oblivious to project settings (host-side computation, B-8-2).
 *
 * The SSR fallback for the DocHistoryIsland is built from git metadata
 * (author name, created/updated dates) so that static HTML contains the
 * author marker required by the migration-check before JS hydration.
 * Following the B-8-1 AiChatModal pattern, all text strings are resolved
 * from the project's i18n table and passed as props so locale switching works.
 */
export function DocHistoryArea({
  slug,
  locale,
  entrySlug,
  contentDir,
}: DocHistoryAreaProps): VNode | null {
  if (!settings.docHistory) return null;

  const docHistory = {
    slug,
    // Omit locale for the default locale — fetch path is /doc-history/{slug}.json.
    // For non-default locales the path is /doc-history/{locale}/{slug}.json.
    locale: locale === defaultLocale ? undefined : locale,
    basePath: settings.base ?? "/",
    // SSR fallback labels — resolved per locale so /ja/ routes get Japanese strings.
    createdLabel: t("doc.created", locale),
    updatedLabel: t("doc.updated", locale),
    historyLabel: t("doc.history", locale),
    // Author + dates from git; undefined when not available (shallow clone / error).
    ...(entrySlug && contentDir ? (getHistoryMeta(entrySlug, contentDir) ?? {}) : {}),
  };

  // Compute the view-source GitHub URL host-side so the v2 BodyFootUtilArea
  // component stays oblivious to project settings. Guards mirror the legacy
  // body-foot-util-area.astro: gate on bodyFootUtilArea.viewSourceLink, and
  // require both entrySlug and contentDir (auto-index pages pass neither).
  const utilSettings = settings.bodyFootUtilArea;
  const sourceUrl =
    utilSettings && utilSettings.viewSourceLink && entrySlug && contentDir
      ? buildGitHubSourceUrl(contentDir, entrySlug + ".mdx")
      : null;

  // Resolve the i18n label host-side; pass the result so the v2 component
  // stays framework-agnostic. Falls back to the EN default when locale has
  // no translation (see DEFAULT_VIEW_SOURCE_LABEL in the v2 package).
  const viewSourceLabel = t("doc.viewSource", locale);

  return (
    <BodyFootUtilArea
      docHistory={docHistory}
      sourceUrl={sourceUrl}
      viewSourceLabel={viewSourceLabel}
    />
  );
}
