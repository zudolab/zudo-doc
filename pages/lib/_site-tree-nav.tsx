/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <SiteTreeNav /> and <SiteTreeNavDemo />.
//
// The original Astro project had two files:
//   - src/components/site-tree-nav.astro — interactive Preact island
//   - src/components/site-tree-nav-demo.astro — Astro wrapper that loaded
//     collection data and rendered the island
//
// Restored to use the interactive SiteTreeNav island (refs #1453):
// Both <SiteTreeNav> and <SiteTreeNavDemo> MDX tags are mapped to this
// wrapper which does the same data loading that site-tree-nav-demo.astro did:
//
//   1. Load the full docs collection for the active locale.
//   2. Build nav tree via buildNavTree().
//   3. Group satellite nodes via groupSatelliteNodes().
//   4. Wrap the interactive SiteTreeNav in Island({when:"idle"}) so the MDX
//      page gets the same collapsible grid the reference renders at
//      /docs/components/site-tree-nav/ (refs #1453/#1442).
//
// All data access is synchronous (ADR-004 zfb content snapshot contract).
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.
//
// categoryIgnore defaults to ["inbox", "develop"] — same as the original index page
// and site-tree-nav-demo.astro.

import type { JSX } from "preact";
import { Island } from "@takazudo/zfb";
import SiteTreeNav from "@/components/site-tree-nav";
import {
  buildNavTree,
  groupSatelliteNodes,
  loadCategoryMeta,
  isNavVisible,
} from "@/utils/docs";
import { settings } from "@/config/settings";
import { defaultLocale, type Locale } from "@/config/i18n";
import { getCategoryOrder } from "@/utils/nav-scope";
import { loadDocs } from "../_data";

export interface SiteTreeNavWrapperProps {
  /**
   * Active locale. Injected via createMdxComponents() closure.
   * Defaults to defaultLocale when not provided.
   */
  lang?: Locale | string;
  /**
   * Optional aria-label for the wrapping <nav> element.
   * Forwarded to the v2 SiteTreeNavDemo component.
   */
  ariaLabel?: string;
}

/**
 * Load merged docs + categoryMeta for the given locale.
 * Matches the locale-merge strategy used by _category-nav.tsx.
 */
function loadNavSource(
  locale: string,
): { docs: ReturnType<typeof loadDocs>; categoryMeta: Map<string, import("@/utils/docs").CategoryMeta> } {
  if (locale === defaultLocale) {
    return {
      docs: loadDocs("docs").filter((d) => !d.data.draft),
      categoryMeta: loadCategoryMeta(settings.docsDir),
    };
  }

  const localeDocs = loadDocs(`docs-${locale}`).filter((d) => !d.data.draft);
  const baseDocs = loadDocs("docs").filter((d) => !d.data.draft);
  const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? d.id));
  const fallbackDocs = baseDocs.filter(
    (d) => !localeSlugSet.has(d.data.slug ?? d.id),
  );

  const localeDir =
    (settings.locales as Record<string, { dir?: string }>)[locale]?.dir ??
    settings.docsDir;
  const categoryMeta = new Map([
    ...loadCategoryMeta(settings.docsDir),
    ...loadCategoryMeta(localeDir),
  ]);

  return { docs: [...localeDocs, ...fallbackDocs], categoryMeta };
}

/**
 * MDX wrapper shared by both <SiteTreeNav> and <SiteTreeNavDemo> tags.
 *
 * Builds the full site nav tree and renders it via the interactive SiteTreeNav
 * island (wrapped in Island({when:"idle"})) — restoring byte-parity with the
 * Astro reference at /docs/components/site-tree-nav/ (refs #1453/#1442).
 *
 * The island renders the collapsible multi-column grid the reference shows.
 * SiteTreeNavDemo (static <details> list) is no longer used for MDX content.
 *
 * Returns null when the tree is empty after filtering.
 */
export function SiteTreeNavWrapper({
  lang = defaultLocale,
  ariaLabel,
}: SiteTreeNavWrapperProps): JSX.Element | null {
  const locale = lang as Locale;

  const { docs, categoryMeta } = loadNavSource(locale);
  const navDocs = docs.filter(isNavVisible);
  const tree = buildNavTree(navDocs, locale, categoryMeta);
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  if (groupedTree.length === 0) return null;

  return Island({
    when: "idle",
    children: (
      <SiteTreeNav
        tree={groupedTree}
        categoryOrder={categoryOrder}
        categoryIgnore={["inbox", "develop"]}
        ariaLabel={ariaLabel}
      />
    ),
  }) as unknown as JSX.Element;
}
