// Pure URL-enumeration helpers shared by both page paths() functions and the
// sitemap. Extracting these prevents the sitemap from drifting out of sync
// with the actual routes the page modules produce.
//
// Each enumerator returns absolute paths (with settings.base prefix and
// trailing slash applied) as expected by the sitemap and page modules.
// `enumerateAllRoutes()` composes the others and returns a deduped
// Map<url, lastmod> that the sitemap renderer wraps directly.
//
// Design principles:
//   - Draft pages are always excluded (never built).
//   - Unlisted pages ARE included — they have real HTML files and should
//     appear in the sitemap even though they're hidden from nav.
//   - toRouteSlug() is applied to all entry ids so category index pages
//     (e.g. "getting-started/index" → "getting-started") get correct URLs.
//   - Auto-generated category index pages (categories without index.mdx) are
//     emitted by building the nav tree and calling collectAutoIndexNodes.

import { loadDocs } from "../_data";
import { enumerateMergedDocsSlugs, mergeLocaleDocs } from "./locale-merge";
import { settings } from "@/config/settings";
import { defaultLocale } from "@/config/i18n";
import type { VersionConfig } from "@/config/settings";
import type { DocsEntry } from "@/types/docs-entry";
import { docsUrl, versionedDocsUrl, withBase } from "@/utils/base";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import {
  buildNavTree,
  loadCategoryMeta,
  collectAutoIndexNodes,
  isNavVisible,
} from "@/utils/docs";

// ---------------------------------------------------------------------------
// enumerateDocsRoutes
// ---------------------------------------------------------------------------

/**
 * Enumerate all doc page URLs for a locale.
 *
 * For the default locale: loads the "docs" collection directly.
 * For non-default locales: locale-first merge using enumerateMergedDocsSlugs
 * (regular pages) plus a nav-tree pass for auto-generated category index pages.
 *
 * Applies toRouteSlug so "category/index" entries become "category/" URLs.
 * Returns deduplicated URL strings with base prefix and trailing slash.
 */
export function enumerateDocsRoutes(locale: string): string[] {
  const urls: string[] = [];

  if (locale === defaultLocale) {
    const allDocs = loadDocs("docs").filter((d) => !d.data.draft);
    const categoryMeta = loadCategoryMeta(settings.docsDir);
    const navDocs = allDocs.filter(isNavVisible);
    const tree = buildNavTree(navDocs, locale, categoryMeta);

    for (const doc of allDocs) {
      urls.push(docsUrl(doc.data.slug ?? toRouteSlug(doc.id), locale as string));
    }
    for (const node of collectAutoIndexNodes(tree)) {
      urls.push(docsUrl(node.slug, locale as string));
    }
  } else {
    // Regular doc URLs — locale-first merge, draft-only filter (includes unlisted).
    for (const slug of enumerateMergedDocsSlugs(locale)) {
      urls.push(docsUrl(slug, locale as string));
    }

    // Auto-index nodes require a nav tree built from merged entries.
    const localeDocs = loadDocs(`docs-${locale}`).filter((d) => !d.data.draft);
    const baseDocs = loadDocs("docs").filter((d) => !d.data.draft);
    const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? d.id));
    const fallbackDocs = baseDocs.filter(
      (d) => !localeSlugSet.has(d.data.slug ?? d.id),
    );
    const allDocs = [...localeDocs, ...fallbackDocs] as DocsEntry[];

    const localeConfig = (
      settings.locales as Record<string, { dir: string }>
    )[locale];
    const contentDir = localeConfig?.dir ?? settings.docsDir;
    const categoryMeta = new Map([
      ...loadCategoryMeta(settings.docsDir),
      ...loadCategoryMeta(contentDir),
    ]);

    const navDocs = allDocs.filter(isNavVisible);
    const tree = buildNavTree(navDocs, locale, categoryMeta);
    for (const node of collectAutoIndexNodes(tree)) {
      urls.push(docsUrl(node.slug, locale as string));
    }
  }

  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// enumerateTagsRoutes
// ---------------------------------------------------------------------------

/**
 * Enumerate tag-index and per-tag URLs for a locale.
 *
 * Uses the same tag map as the tag pages (unlisted + draft excluded) so the
 * sitemap lists exactly the same tag pages that get built.
 *
 * Returns:
 *   - /docs/tags/ (or /{locale}/docs/tags/)
 *   - /docs/tags/{tag}/ (or /{locale}/docs/tags/{tag}/) for each unique tag
 */
export function enumerateTagsRoutes(locale: string): string[] {
  if (!settings.docTags) return [];

  const urls: string[] = [];

  const tagsBase =
    locale === defaultLocale ? "/docs/tags" : `/${locale}/docs/tags`;
  urls.push(withBase(tagsBase));

  // Collect tags from the same merged doc set the tag pages use.
  // mergeLocaleDocs (locale-merge.ts) filters unlisted + draft — mirrors
  // the tag [tag].tsx pages which do the same filter.
  let docs: DocsEntry[];
  if (locale === defaultLocale) {
    docs = loadDocs("docs").filter((d) => !d.data.unlisted && !d.data.draft);
  } else {
    docs = mergeLocaleDocs(locale);
  }

  const tagMap = collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));

  for (const tag of tagMap.keys()) {
    const tagPath =
      locale === defaultLocale
        ? `/docs/tags/${tag}`
        : `/${locale}/docs/tags/${tag}`;
    urls.push(withBase(tagPath));
  }

  return urls;
}

// ---------------------------------------------------------------------------
// enumerateVersionedRoutes
// ---------------------------------------------------------------------------

/**
 * Enumerate doc URLs for a single (version, locale) combination.
 *
 * For the default locale: loads `docs-v-${version.slug}`.
 * For non-default locales: locale-first merge — locale-specific collection
 * takes priority; base EN collection fills in pages not yet translated.
 * If the locale collection doesn't exist for this version, all pages fall
 * back to the EN base (matching the page module's behaviour).
 *
 * Returns versioned URLs like /v/{version}/docs/{slug}/ or
 * /v/{version}/{locale}/docs/{slug}/.
 */
export function enumerateVersionedRoutes(
  version: VersionConfig,
  locale: string,
): string[] {
  const urls: string[] = [];

  if (locale === defaultLocale) {
    const collectionName = `docs-v-${version.slug}`;
    const allDocs = loadDocs(collectionName).filter((d) => !d.data.draft);
    const categoryMeta = loadCategoryMeta(version.docsDir);
    const navDocs = allDocs.filter(isNavVisible);
    const tree = buildNavTree(navDocs, "en", categoryMeta);

    for (const doc of allDocs) {
      const slug = doc.data.slug ?? toRouteSlug(doc.id);
      urls.push(versionedDocsUrl(slug, version.slug));
    }
    for (const node of collectAutoIndexNodes(tree)) {
      urls.push(versionedDocsUrl(node.slug, version.slug));
    }
  } else {
    const baseCollectionName = `docs-v-${version.slug}`;
    const localeDir = (
      version.locales as Record<string, { dir: string }> | undefined
    )?.[locale]?.dir;
    const localeCollectionName = localeDir
      ? `docs-v-${version.slug}-${locale}`
      : null;

    const baseDocs = loadDocs(baseCollectionName).filter((d) => !d.data.draft);
    const localeDocs = localeCollectionName
      ? loadDocs(localeCollectionName).filter((d) => !d.data.draft)
      : [];

    const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? d.id));
    const fallbackDocs = baseDocs.filter(
      (d) => !localeSlugSet.has(d.data.slug ?? d.id),
    );
    const allDocs = [...localeDocs, ...fallbackDocs] as DocsEntry[];

    const baseCategoryMeta = loadCategoryMeta(version.docsDir);
    const localeCategoryMeta = localeDir
      ? loadCategoryMeta(localeDir)
      : new Map();
    const categoryMeta = new Map([...baseCategoryMeta, ...localeCategoryMeta]);

    const navDocs = allDocs.filter(isNavVisible);
    const tree = buildNavTree(navDocs, locale, categoryMeta);

    for (const doc of allDocs) {
      const slug = doc.data.slug ?? toRouteSlug(doc.id);
      urls.push(versionedDocsUrl(slug, version.slug, locale as string));
    }
    for (const node of collectAutoIndexNodes(tree)) {
      urls.push(versionedDocsUrl(node.slug, version.slug, locale as string));
    }
  }

  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// enumerateAllRoutes
// ---------------------------------------------------------------------------

/**
 * Compose all route enumerators into a deduped Map<url, lastmod>.
 *
 * Covers:
 *   - Site root
 *   - Default-locale docs + tags
 *   - Per-locale homepages, docs, and tags
 *   - Versioned EN docs (for each version in settings.versions)
 *   - Versioned locale docs (for each locale in settings.locales)
 *
 * The map keys are absolute paths (with settings.base prefix + trailing
 * slash). The sitemap renderer prefixes each with settings.siteUrl.
 */
export function enumerateAllRoutes(): Map<string, string> {
  const today = new Date().toISOString().split("T")[0];
  const routes = new Map<string, string>();

  function add(url: string): void {
    if (!routes.has(url)) {
      routes.set(url, today);
    }
  }

  // Site root
  add(withBase("/"));

  // Default locale docs
  for (const url of enumerateDocsRoutes(defaultLocale)) {
    add(url);
  }

  // Default locale tags
  for (const url of enumerateTagsRoutes(defaultLocale)) {
    add(url);
  }

  // Non-default locales
  for (const locale of Object.keys(settings.locales)) {
    add(withBase(`/${locale}`));

    for (const url of enumerateDocsRoutes(locale)) {
      add(url);
    }

    for (const url of enumerateTagsRoutes(locale)) {
      add(url);
    }
  }

  // Versions listing pages — /docs/versions/ and /{locale}/docs/versions/.
  // These static utility pages are built by pages/docs/versions.tsx and
  // pages/[locale]/docs/versions.tsx whenever versioning is configured.
  // They are not part of any content collection so they are added explicitly.
  if (settings.versions) {
    add(withBase("/docs/versions"));
    for (const locale of Object.keys(settings.locales)) {
      add(withBase(`/${locale}/docs/versions`));
    }
  }

  // Versioned docs
  if (settings.versions) {
    for (const version of settings.versions as VersionConfig[]) {
      for (const url of enumerateVersionedRoutes(version, defaultLocale)) {
        add(url);
      }
      // Non-default locales always have versioned pages (they fall back to EN
      // when a locale-specific collection is not configured).
      for (const locale of Object.keys(settings.locales)) {
        for (const url of enumerateVersionedRoutes(version, locale)) {
          add(url);
        }
      }
    }
  }

  return routes;
}
