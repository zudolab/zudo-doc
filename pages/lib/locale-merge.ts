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

import { getCollection } from "zfb/content";
import { toRouteSlug } from "@/utils/slug";
import type { DocsEntry } from "@/types/docs-entry";

/**
 * Merge locale docs with base-locale fallbacks.
 *
 * Locale docs take priority; base docs fill in slugs not covered by the
 * locale collection. Drafts and unlisted docs are filtered out.
 */
export function mergeLocaleDocs(locale: string): DocsEntry[] {
  const localeDocs = getCollection(`docs-${locale}`) as unknown as DocsEntry[];
  const baseDocs = getCollection("docs") as unknown as DocsEntry[];

  const filteredLocale = localeDocs.filter(
    (d) => !d.data.draft && !d.data.unlisted,
  );
  const filteredBase = baseDocs.filter(
    (d) => !d.data.draft && !d.data.unlisted,
  );

  const localeSlugSet = new Set(
    filteredLocale.map((d) => d.data.slug ?? toRouteSlug(d.id)),
  );

  return [
    ...filteredLocale,
    ...filteredBase.filter(
      (d) => !localeSlugSet.has(d.data.slug ?? toRouteSlug(d.id)),
    ),
  ];
}
