// Shared utility for merging locale docs with base-locale fallbacks.
//
// Used by the locale tag pages to replicate the locale-first + base-fallback
// strategy from the Astro src/components/tag-nav.astro non-default-locale
// branch. Extracted here to avoid duplicating the logic across multiple
// [locale] page modules.
//
// Strategy:
//   1. Load `docs-${locale}` collection.
//   2. Load base "docs" collection.
//   3. Merge: locale docs take priority; base docs fill in slugs not present
//      in the locale collection.
//   4. Filter out drafts and unlisted pages.
//
// This is a zfb-only module (uses synchronous getCollection from zfb/content).
// Do not import from Astro page code.

import { loadDocs } from "../_data";
import type { DocsEntry } from "@/types/docs-entry";

/**
 * Enumerate merged doc slugs for a locale — the URL-list slice of the merge.
 *
 * Locale docs take priority; base EN docs fill in slugs not covered by the
 * locale collection. Only drafts are filtered — unlisted pages ARE included
 * because they have real URLs and should appear in the sitemap.
 *
 * Returns raw route slugs (e.g. "getting-started/intro") for
 * route-enumerators.ts to convert into full URLs.
 */
export function enumerateMergedDocsSlugs(locale: string): string[] {
  const localeDocs = loadDocs(`docs-${locale}`).filter((d) => !d.data.draft);
  const baseDocs = loadDocs("docs").filter((d) => !d.data.draft);

  const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? d.id));
  const fallbackDocs = baseDocs.filter(
    (d) => !localeSlugSet.has(d.data.slug ?? d.id),
  );

  return [
    ...localeDocs.map((d) => d.data.slug ?? d.id),
    ...fallbackDocs.map((d) => d.data.slug ?? d.id),
  ];
}

/**
 * Merge locale docs with base-locale fallbacks.
 *
 * Locale docs take priority; base docs fill in slugs not covered by the
 * locale collection. Drafts and unlisted docs are filtered out.
 */
export function mergeLocaleDocs(locale: string): DocsEntry[] {
  // zfb's CollectionEntry uses `slug`/`collection` only; @/utils/docs
  // utilities expect Astro-style `id` and `collection` fields. Map them
  // here so the rest of this module (and its callers) get the
  // DocsEntry-shaped objects they assume. Bridging on read keeps the
  // schema discrepancy contained to the I/O boundary.
  // Use `loadDocs` so the Astro-compat `id`/`collection` augmentation
  // (and the `index` slug stripping) stays in one place — the inline
  // `id: e.slug` map dropped the `/index` suffix that
  // `buildNavTree`/`buildBreadcrumbs` etc. assume Astro 5 strips, which
  // produced ambiguous-URL collisions at paths()-expansion time.
  const localeDocs = loadDocs(`docs-${locale}`);
  const baseDocs = loadDocs("docs");

  const filteredLocale = localeDocs.filter(
    (d) => !d.data.draft && !d.data.unlisted,
  );
  const filteredBase = baseDocs.filter(
    (d) => !d.data.draft && !d.data.unlisted,
  );

  const localeSlugSet = new Set(
    filteredLocale.map((d) => d.data.slug ?? d.id),
  );

  return [
    ...filteredLocale,
    ...filteredBase.filter(
      (d) => !localeSlugSet.has(d.data.slug ?? d.id),
    ),
  ];
}
