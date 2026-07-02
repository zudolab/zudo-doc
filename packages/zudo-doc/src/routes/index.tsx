/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: / — package-owned equivalent of pages/index.tsx
// (A1 #2361). Default-locale (EN) site index: site-map grid + optional tag
// count, rendered through the package chrome (`_chrome`). Static route — no
// paths() export.
//
// Thin consumer of `HomePageView` (S3 #2502): this file's only job is
// preparing the default-locale nav tree / tag count with its exact data
// calls, then handing them to the shared home body factory.

import type { JSX } from "preact";
import {
  defaultLocale,
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

export default function IndexPage(): JSX.Element {
  const locale = defaultLocale;

  const { navDocs, categoryMeta } = resolveNavSource(locale, undefined);
  const tree = buildNavTree(
    navDocs,
    locale,
    categoryMeta as Map<string, CategoryMeta>,
    (slug, loc) => docsUrl(slug, loc),
  );
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
