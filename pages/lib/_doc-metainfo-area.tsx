/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-aware DocMetainfo area wrapper for the zfb doc pages.
//
// Renders the visible date block (created / updated dates + author)
// between the article <h1> and the description paragraph, mirroring the
// position of the legacy `doc-metainfo.astro` in the Astro layout.
//
// Data source: `.zfb/doc-history-meta.json`, a build-time manifest
// emitted by `scripts/zfb-prebuild.mjs` before `zfb build` runs.
// esbuild inlines the JSON statically so no Node.js `fs` code reaches
// the client bundle — the same approach used by `_doc-history-area.tsx`
// (b11-2 pattern).
//
// Date formatting uses Intl.DateTimeFormat (browser-safe). We do NOT
// import `formatDate` from `src/utils/git-info.ts` because that module
// has top-level Node.js imports (`execFileSync`, `existsSync`) that
// would be dragged into the client bundle — the B-11 lesson.
//
// Labels are resolved from the project's i18n table so non-default
// locales (e.g. /ja/) get translated "作成" / "更新" strings.

import type { VNode } from "preact";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { DocMetainfo } from "@zudo-doc/zudo-doc-v2/metainfo";
// SSR author + date metadata comes from `.zfb/doc-history-meta.json`, a
// build-time manifest emitted by `scripts/zfb-prebuild.mjs` (step 2:
// doc-history-meta) before `zfb build` runs. esbuild inlines the JSON
// statically so no Node-only `fs` code reaches the client bundle.
// The `#doc-history-meta` alias is defined in tsconfig.json and resolves
// to the absolute path of `.zfb/doc-history-meta.json` — this is needed
// because the zfb bundler builds pages from a shadow tree; relative paths
// across the shadow boundary would resolve to the wrong location.
import docHistoryMeta from "#doc-history-meta";

// BCP-47 locale tag mapping used by Intl.DateTimeFormat.
// Kept in sync with `src/utils/git-info.ts` manually; we cannot import
// that module here because it carries top-level Node.js imports
// (`execFileSync`, `existsSync`) — the B-11 lesson applies here too.
const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  de: "de-DE",
};

/** Format an ISO date string for display, respecting the active locale. */
function formatDate(isoDate: string, locale: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(LOCALE_TO_BCP47[locale] ?? "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface DocMetainfoAreaProps {
  /** Page slug, e.g. "getting-started/intro". */
  slug: string;
  /** Active locale string, e.g. "en", "ja". */
  locale: string;
}

/**
 * Renders the visible date block (Created / Updated / Author) when
 * `settings.docMetainfo` is enabled and the build-time manifest has an
 * entry for the active page.
 *
 * Returns null when `docMetainfo` is disabled, the page is untracked
 * (no manifest entry), or the manifest was generated in a shallow clone
 * (`SKIP_DOC_HISTORY=1` → empty JSON).
 *
 * The component is intentionally server-render-only: it emits static
 * HTML from build-time data and has no client JS footprint. It sits
 * between `<h1>` and the description `<p>`, mirroring the legacy Astro
 * `doc-metainfo.astro` placement.
 */
export function DocMetainfoArea({ slug, locale }: DocMetainfoAreaProps): VNode | null {
  if (!settings.docMetainfo) return null;

  // Key format: bare slug for default locale, "<locale>/<slug>" for others.
  // Matches the prebuild step's composedSlug logic in scripts/zfb-prebuild.mjs.
  const composedSlug = locale === defaultLocale ? slug : `${locale}/${slug}`;

  type MetaEntry = { author: string; createdDate: string; updatedDate: string };
  const meta = (docHistoryMeta as Record<string, MetaEntry>)[composedSlug];

  if (!meta) return null;

  return (
    <DocMetainfo
      createdAt={meta.createdDate ? formatDate(meta.createdDate, locale) : null}
      updatedAt={meta.updatedDate ? formatDate(meta.updatedDate, locale) : null}
      author={meta.author || null}
      createdLabel={t("doc.created", locale)}
      updatedLabel={t("doc.updated", locale)}
    />
  );
}
