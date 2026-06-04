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
import { loadCategoryMeta, type CategoryMeta } from "@/utils/docs";
import type { DocsEntry } from "@/types/docs-entry";
import { loadDocs } from "../_data";
import { mergeLocaleDocs, mergeCategoryMeta } from "./locale-merge";

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
  const { docs } = mergeLocaleDocs({
    baseDocs: loadDocs("docs").filter((d) => !d.data.draft),
    localeDocs: loadDocs(`docs-${lang}`).filter((d) => !d.data.draft),
    applyDefaultLocaleOnlyFilter: true,
    keepUnlisted: true,
  });

  // Base meta first, locale meta wins on overlapping keys — same merge
  // order [locale]/docs/[...slug].tsx uses in its paths() pass.
  const localeDir = settings.locales[lang]?.dir ?? settings.docsDir;
  const categoryMeta = mergeCategoryMeta(settings.docsDir, localeDir);

  return { docs, categoryMeta };
}
