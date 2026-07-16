/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the site index route.
//
// Default-locale (EN) site index. Static route — no paths() export needed.
// Hands the resolved locale to the shared `prepareHomeData` factory (#2519)
// — which now owns the nav-tree / tag-count data-prep sequence — and passes
// the result to the shared HomePageView body (epic #2499, S4 #2503).
//
// Data flow:
//   routeContext              host RouteContext (settings + i18n + nav helpers)
//   → prepareHomeData()       nav tree, category order, tag count
//   → HomePageView            renders hero + SiteTreeNav grid + tag section
//
// Thin consumer of `HomePageView` (S3 #2502) and `prepareHomeData` (#2519):
// this file's only job is resolving the default locale and threading the
// showcase-specific `extras` — mirroring the package route's shape
// (`packages/zudo-doc/src/routes/index.tsx`). The `@Takazudo` brand link is
// showcase-specific (#1453) and is threaded via the `extras` prop rather than
// baked into the shared hero.

import { routeContext } from "./lib/_route-context";
import { prepareHomeData } from "@takazudo/zudo-doc/home-page";
import type { JSX } from "preact";
import { HomePageView } from "./lib/_chrome";

export const frontmatter = { title: "Home" };

export default function IndexPage(): JSX.Element {
  const locale = routeContext.defaultLocale;

  const { tree, categoryOrder, tagCount } = prepareHomeData(routeContext, locale);

  return (
    <HomePageView
      locale={locale}
      tree={tree}
      categoryOrder={categoryOrder}
      initiallyCollapsedCategorySlugs={["changelog"]}
      tagCount={tagCount}
      // Showcase opts into the wide layout so the category grid fills the
      // viewport (better readability for the multi-column sitemap). Downstream
      // projects keep the narrower default unless they pass `wide` too.
      wide={true}
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
