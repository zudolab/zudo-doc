// Shared helper — pick the right loadDocs() collection and category-meta dir
// for the active (locale, version) pair, applying the locale-first + EN-fallback
// merge that pages/[locale]/docs/[...slug].tsx uses in its own paths() pass so
// the sidebar tree mirrors what those pages enumerate.
//
// Used by _sidebar-with-defaults.tsx (desktop sidebar) and
// _header-with-defaults.tsx (mobile SidebarToggle) so both nav surfaces apply
// the same defaultLocaleOnlyPrefixes filter and stay in sync.

import { defaultLocale, type Locale } from "@/config/i18n";
import { settings } from "@/config/settings";
import { docsUrl, isDefaultLocaleOnlyPath } from "@/utils/base";
import { loadCategoryMeta, type CategoryMeta } from "@/utils/docs";
import type { DocsEntry } from "@/types/docs-entry";
import { loadDocs } from "../_data";

export type NavSourceDocs = {
  docs: DocsEntry[];
  categoryMeta: Map<string, CategoryMeta>;
};

/**
 * Pick the right `loadDocs(...)` collection name and category-meta dir
 * for the active (locale, version) pair, applying the same locale-first
 * + EN-fallback merge that `pages/[locale]/docs/[...slug].tsx` performs
 * in its own `paths()` so the sidebar tree mirrors what those pages
 * enumerate.
 */
export function loadNavSourceDocs(
  lang: Locale,
  currentVersion: string | undefined,
): NavSourceDocs {
  if (currentVersion) {
    const collectionName = `docs-v-${currentVersion}`;
    const versionConfig = settings.versions?.find((v) => v.slug === currentVersion);
    const docs = loadDocs(collectionName).filter((d) => !d.data.draft);
    const categoryMeta = loadCategoryMeta(versionConfig?.docsDir ?? settings.docsDir);
    return { docs, categoryMeta };
  }

  if (lang === defaultLocale) {
    const docs = loadDocs("docs").filter((d) => !d.data.draft);
    const categoryMeta = loadCategoryMeta(settings.docsDir);
    return { docs, categoryMeta };
  }

  // Non-default locale: locale-first merge with EN fallback so docs the
  // active locale has not yet translated still appear in the tree.
  const localeDocs = loadDocs(`docs-${lang}`).filter((d) => !d.data.draft);
  const baseDocs = loadDocs("docs").filter((d) => !d.data.draft);
  const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? d.id));
  const fallbackDocs = baseDocs
    .filter((d) => !localeSlugSet.has(d.data.slug ?? d.id))
    .filter((d) => !isDefaultLocaleOnlyPath(docsUrl(d.data.slug ?? d.id)));
  const allDocs = [...localeDocs, ...fallbackDocs];

  const localeDir =
    (settings.locales as Record<string, { dir?: string }>)[lang]?.dir ??
    settings.docsDir;
  // Base meta first, locale meta wins on overlapping keys — same merge
  // order [locale]/docs/[...slug].tsx uses in its paths() pass.
  const categoryMeta = new Map<string, CategoryMeta>([
    ...loadCategoryMeta(settings.docsDir),
    ...loadCategoryMeta(localeDir),
  ]);

  return { docs: allDocs, categoryMeta };
}
