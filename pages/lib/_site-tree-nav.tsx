/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <SiteTreeNav /> and <SiteTreeNavDemo />.
//
// The original Astro project had two files:
//   - src/components/site-tree-nav.astro — interactive Preact island
//   - src/components/site-tree-nav-demo.astro — Astro wrapper that loaded
//     collection data and rendered the island
//
// In the v2 package the presentational tree is exposed as SiteTreeNavDemo.
// Both <SiteTreeNav> and <SiteTreeNavDemo> MDX tags are mapped to this
// wrapper which does the same data loading that site-tree-nav-demo.astro did:
//
//   1. Load the full docs collection for the active locale.
//   2. Build nav tree via buildNavTree().
//   3. Group satellite nodes via groupSatelliteNodes().
//   4. Forward the tree + category configuration to v2 SiteTreeNavDemo.
//
// All data access is synchronous (ADR-004 zfb content snapshot contract).
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.
//
// categoryIgnore defaults to ["inbox"] — same as the original index page
// and site-tree-nav-demo.astro.

import type { JSX } from "preact";
import { SiteTreeNavDemo } from "@zudo-doc/zudo-doc-v2/nav-indexing";
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
 * Builds the full site nav tree and renders it via v2 SiteTreeNavDemo
 * (static collapsible sections — no JS required). The interactive
 * SiteTreeNav island is not used here because MDX components are server-
 * rendered at build time; the static demo variant provides parity with
 * the original site-tree-nav-demo.astro wrapper.
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

  return (
    <SiteTreeNavDemo
      tree={groupedTree}
      categoryOrder={categoryOrder}
      categoryIgnore={["inbox"]}
      ariaLabel={ariaLabel}
    />
  );
}
