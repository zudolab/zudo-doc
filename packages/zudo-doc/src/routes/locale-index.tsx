/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: /[locale] — package-owned equivalent of
// pages/[locale]/index.tsx (A1 #2361). One route per non-default locale; the
// locale-prefixed site index (site-map grid + optional tag count).
//
// Thin consumer of `HomePageView` (S3 #2502): this file's only job is the
// locale-specific data prep — `resolveNavSource` with the locale-home filter
// options, `loadCategoryMeta`, `paths()`, and the locale-config guard all stay
// HERE (not in the shared factory) because they are locale-routing concerns,
// not hero-rendering concerns. The prepared tree / tag count are handed to
// the shared home body factory, same as the default-locale route.

import type { JSX } from "preact";
import { loadCategoryMeta } from "../sidebar-tree/index.js";
import {
  settings,
  getLocaleConfig,
  resolveNavSource,
  buildNavTree,
  groupSatelliteNodes,
  getCategoryOrder,
  collectTags,
  docsUrl,
  toRouteSlug,
} from "./_context.js";
import type { CategoryMeta } from "./_docs-helpers.js";
import { HomePageView } from "./_chrome.js";

export const frontmatter = { title: "Home" };

export function paths(): Array<{ params: { locale: string }; props: { locale: string } }> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
    props: { locale },
  }));
}

interface PageArgs {
  params: { locale: string };
  props: { locale: string };
}

export default function LocaleIndexPage({ params }: PageArgs): JSX.Element {
  const locale = params.locale;
  const cfg = getLocaleConfig(locale);
  if (!cfg) {
    throw new Error(`LocaleIndexPage: locale "${locale}" is not configured in settings.locales`);
  }

  const { navDocs } = resolveNavSource(locale, undefined, {
    applyDefaultLocaleOnlyFilter: true,
    keepUnlisted: true,
  });
  const categoryMeta = loadCategoryMeta(cfg.dir) as Map<string, CategoryMeta>;

  const tree = buildNavTree(navDocs, locale, categoryMeta, (slug, loc) => docsUrl(slug, loc));
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  const tagCount = collectTags(
    navDocs.filter((d) => !d.data.category_no_page),
    (id, data) => data.slug ?? toRouteSlug(id),
  ).size;

  return (
    <HomePageView
      locale={locale}
      tree={groupedTree}
      categoryOrder={categoryOrder}
      tagCount={tagCount}
    />
  );
}
