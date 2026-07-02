/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the site index route.
//
// Default-locale (EN) site index. Static route — no paths() export needed.
// Collects the EN docs tree and hands it to the shared HomePageView body
// (epic #2499, S4 #2503).
//
// Data flow:
//   getCollection("docs")   [sync, zfb ADR-004]
//   → buildNavTree()        builds the nav tree for the sitemap grid
//   → collectTags()         counts unique tags for the tag section header
//   → HomePageView          renders hero + SiteTreeNav grid + tag section
//
// Thin consumer of `HomePageView` (S3 #2502, adopted here in S4 #2503): this
// file's only job is preparing the default-locale nav tree / tag count with
// its exact data calls, then handing them to the shared home body factory —
// mirroring the package route's shape (`packages/zudo-doc/src/routes/index.tsx`).
// The `@Takazudo` brand link is showcase-specific (#1453) and is threaded via
// the `extras` prop rather than baked into the shared hero.

import { defaultLocale } from "@/config/i18n";
import { buildNavTree, groupSatelliteNodes } from "@/utils/docs";
import { resolveNavSource } from "./lib/_nav-source-docs";
import { getCategoryOrder } from "@/utils/nav-scope";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import type { JSX } from "preact";
import { HomePageView } from "./lib/_chrome";

export const frontmatter = { title: "Home" };

export default function IndexPage(): JSX.Element {
  const locale = defaultLocale;

  // Identity-stable nav source (draft-filtered, unlisted retained). navDocs is
  // pre-filtered (isNavVisible) and shared with the nav-tree fast-path.
  const { navDocs, categoryMeta } = resolveNavSource(locale, undefined);
  const tree = buildNavTree(navDocs, locale, categoryMeta);
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  // Drop category_no_page index files so the count matches the number of tag
  // pages actually built (the tag routes exclude them too).
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
      extras={
        // @Takazudo link — established in #1453 (project-specific brand
        // link). Kept out of the shared hero (package HomePageView), threaded
        // here through the extras seam instead. HomePageView renders `extras`
        // as a standalone line AFTER the links row (not inline within it), so
        // this is its own small line, not a row continuation.
        <p class="mt-vsp-2xs text-small">
          <a
            href="https://x.com/Takazudo"
            class="text-fg underline hover:text-accent"
            target="_blank"
            rel="noopener noreferrer"
          >
            @Takazudo
          </a>
        </p>
      }
    />
  );
}
