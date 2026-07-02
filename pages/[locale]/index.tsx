/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Page module for the locale-prefixed site index route.
//
// Non-default-locale site index. paths() emits one route per locale defined
// in settings.locales (never the default locale — that is handled by
// pages/index.tsx since prefixDefaultLocale is false).
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string }   — e.g. "ja"
//   props:  { locale }           — resolved locale passed to component
//
// Data flow (inside component — sync per ADR-004):
//   getCollection(`docs-${locale}`)  + base fallback merge
//   → buildNavTree()   → groupSatelliteNodes()
//   → collectTags()    → tag section
//   → HomePageView      renders hero + SiteTreeNav grid + tag section
//
// Thin consumer of `HomePageView` (S3 #2502, adopted here in S4 #2503): this
// file's only job is the locale-specific data prep — `resolveNavSource` with
// the locale-home filter options, `loadCategoryMeta`, `paths()`, and the
// locale-config guard all stay HERE (locale-routing concerns, not
// hero-rendering concerns) — mirroring the package route's shape
// (`packages/zudo-doc/src/routes/locale-index.tsx`). The `@Takazudo` brand
// link is showcase-specific (#1453) and is threaded via the `extras` prop
// rather than baked into the shared hero.

import { settings } from "@/config/settings";
import { getLocaleConfig, type Locale } from "@/config/i18n";
import { buildNavTree, groupSatelliteNodes, loadCategoryMeta } from "@/utils/docs";
import { getCategoryOrder } from "@/utils/nav-scope";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import type { JSX } from "preact";
import { resolveNavSource } from "../lib/_nav-source-docs";
import { HomePageView } from "../lib/_chrome";

export const frontmatter = { title: "Home" };

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/** Emit one route per non-default locale. */
export function paths(): Array<{
  params: { locale: string };
  props: { locale: string };
}> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
    props: { locale },
  }));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface PageArgs {
  params: { locale: string };
  props: { locale: string };
}

export default function LocaleIndexPage({ params }: PageArgs): JSX.Element {
  const locale = params.locale;

  // Guard: paths() only emits routes for locales defined in settings.locales,
  // but the component can still be exercised with an unconfigured locale value
  // (e.g. during testing or if the router dispatches an unexpected param).
  // Fail loudly rather than silently serving EN content under a bogus prefix.
  const cfg = getLocaleConfig(locale);
  if (!cfg) {
    throw new Error(`LocaleIndexPage: locale "${locale}" is not configured in settings.locales`);
  }

  // Identity-stable, locale-first merge with EN fallback (shared `navDocs`
  // instance). categoryMeta is intentionally locale-dir-only here — this page
  // historically did NOT merge in base meta (unlike the locale doc route), so
  // we keep that exact behavior to preserve output.
  const { navDocs } = resolveNavSource(locale as Locale, undefined, {
    applyDefaultLocaleOnlyFilter: true,
    keepUnlisted: true,
  });
  const categoryMeta = loadCategoryMeta(cfg.dir);

  const tree = buildNavTree(navDocs, locale as Locale, categoryMeta);
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
        // @Takazudo link — ported from pages/index.tsx (refs #1453).
        // Kept out of the shared hero (package HomePageView), threaded here
        // through the extras seam instead.
        <>
          <span class="text-muted">/</span>
          <a
            href="https://x.com/Takazudo"
            class="text-fg underline hover:text-accent"
            target="_blank"
            rel="noopener noreferrer"
          >
            @Takazudo
          </a>
        </>
      }
    />
  );
}
