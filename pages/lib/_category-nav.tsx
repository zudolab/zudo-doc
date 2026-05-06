/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-side MDX wrapper for <CategoryNav category="..." />.
//
// Mirrors the data-resolution shape of src/components/category-nav.astro:
//   1. Load docs for the active locale (or defaultLocale when not passed).
//   2. Build the nav tree with buildNavTree().
//   3. Find the target category node via findNode().
//   4. Filter to children with hasPage === true.
//   5. Forward the resolved children to the v2 CategoryNav component.
//
// All data access is synchronous (ADR-004 zfb content snapshot contract)
// via loadDocs() from pages/_data.ts.
//
// The `lang` prop is injected by createMdxComponents() in
// pages/_mdx-components.ts so locale routes get locale-aware nav data.

import type { JSX } from "preact";
import { CategoryNav as CategoryNavV2 } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import {
  buildNavTree,
  findNode,
  loadCategoryMeta,
  isNavVisible,
} from "@/utils/docs";
import { settings } from "@/config/settings";
import { defaultLocale, type Locale } from "@/config/i18n";
import { loadDocs } from "../_data";

export interface CategoryNavWrapperProps {
  /**
   * Slug of the category whose immediate children should be listed, e.g.
   * "getting-started" or "guides/layout-demos".
   */
  category: string;
  /**
   * Active locale. Injected via createMdxComponents() closure.
   * Defaults to defaultLocale when not provided.
   */
  lang?: Locale | string;
  /** Optional extra CSS classes forwarded to the <nav> element. */
  class?: string;
}

/**
 * Load merged docs + categoryMeta for the given locale.
 * Mirrors the locale-merge strategy from _header-with-defaults.tsx:
 * default locale → "docs"; non-default → locale-first + EN fallback.
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

  // Non-default locale: locale-first merge with EN fallback.
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
 * MDX wrapper for CategoryNav. Resolves nav tree data host-side and forwards
 * the resolved category children into the v2 CategoryNav component.
 *
 * Returns null when the category is not found or has no visible children —
 * matching the original Astro component's guard.
 */
export function CategoryNavWrapper({
  category,
  lang = defaultLocale,
  class: className,
}: CategoryNavWrapperProps): JSX.Element | null {
  const locale = lang as Locale;

  const { docs, categoryMeta } = loadNavSource(locale);
  const navDocs = docs.filter(isNavVisible);
  const tree = buildNavTree(navDocs, locale, categoryMeta);

  const categoryNode = findNode(tree, category);
  const children = categoryNode?.children.filter((c) => c.hasPage) ?? [];

  if (children.length === 0) return null;

  return <CategoryNavV2 children={children} class={className} />;
}
