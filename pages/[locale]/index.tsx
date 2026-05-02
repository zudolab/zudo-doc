/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/[locale]/index.astro → zfb page module.
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

import { getCollection } from "zfb/content";
import type { DocsEntry } from "@/types/docs-entry";
import { settings } from "@/config/settings";
import { t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import {
  buildNavTree,
  groupSatelliteNodes,
  isNavVisible,
  loadCategoryMeta,
} from "@/utils/docs";
import { getCategoryOrder } from "@/utils/nav-scope";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { DocsSitemap } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";
import { bridgeEntries } from "../_data";
import { FooterWithDefaults } from "../lib/_footer-with-defaults";
import { HeaderWithDefaults } from "../lib/_header-with-defaults";
import { HeadWithDefaults } from "../lib/_head-with-defaults";
import { composeMetaTitle } from "../lib/_compose-meta-title";

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
// helpers
// ---------------------------------------------------------------------------

/**
 * Merge locale docs with base (EN) fallbacks.
 * Mirrors the merge strategy in src/utils/locale-docs.ts.
 */
function mergeLocaleDocs(locale: string): DocsEntry[] {
  const localeDocs = ((bridgeEntries(getCollection(`docs-${locale}`), `docs-${locale}`) as unknown as DocsEntry[])).filter(
    (d) => !d.data.draft,
  );
  const baseDocs = ((bridgeEntries(getCollection("docs"), "docs") as unknown as DocsEntry[])).filter(
    (d) => !d.data.draft,
  );
  const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? toRouteSlug(d.slug)));
  return [
    ...localeDocs,
    ...baseDocs.filter((d) => !localeSlugSet.has(d.data.slug ?? toRouteSlug(d.slug))),
  ];
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

  const allDocs = mergeLocaleDocs(locale);
  const localeConfig = (settings.locales as Record<string, { dir: string }>)[locale];
  const categoryMeta = localeConfig
    ? loadCategoryMeta(localeConfig.dir)
    : loadCategoryMeta(settings.docsDir);

  const navDocs = allDocs.filter(isNavVisible);
  const tree = buildNavTree(navDocs, locale, categoryMeta);
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  const tagCount = collectTags(
    navDocs,
    (id, data) => data.slug ?? toRouteSlug(id),
  ).size;

  const ctaNav = settings.headerNav[0] ?? null;
  const overview = ctaNav ? withBase(`/${locale}${ctaNav.path}`) : null;
  const logoUrl = withBase("/img/logo.svg");

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(settings.siteName)}
      head={<HeadWithDefaults title={settings.siteName} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`/${locale}/`)} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
    >
      {/* Hero: logo left, title+desc+links right, block centered */}
      <div class="flex justify-center mb-vsp-xl">
        <div class="flex flex-col items-center text-center gap-hsp-md lg:flex-row lg:text-left lg:gap-hsp-xl">
          <div
            class="w-[80%] aspect-square lg:h-[10.5rem] lg:w-[10.5rem] bg-fg shrink-0"
            style={`-webkit-mask: url(${logoUrl}) center/contain no-repeat; mask: url(${logoUrl}) center/contain no-repeat;`}
            aria-hidden="true"
          />
          <div>
            <h1 class="text-heading font-bold mb-vsp-2xs">{settings.siteName}</h1>
            <p class="text-muted text-small mb-vsp-sm">{settings.siteDescription}</p>
            <div class="flex items-center justify-center lg:justify-start gap-hsp-md text-small">
              {overview && (
                <>
                  <a href={overview} class="text-fg underline hover:text-accent">
                    {t("nav.overview", locale)}
                  </a>
                  <span class="text-muted">/</span>
                </>
              )}
              {settings.githubUrl && (
                <>
                  <a
                    href={settings.githubUrl as string}
                    class="inline-flex items-center gap-[0.3em] text-fg underline hover:text-accent"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" class="w-[1em] h-[1em] shrink-0">
                      <path
                        fill="currentColor"
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                      />
                    </svg>
                    GitHub
                  </a>
                  <span class="text-muted">/</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sitemap grid */}
      <DocsSitemap tree={groupedTree} />

      {settings.docTags && tagCount > 0 && (
        <section class="mt-vsp-xl">
          <h2 class="text-subheading font-bold mb-vsp-md">
            {t("doc.allTags", locale)}
          </h2>
          <a
            href={withBase(`/${locale}/docs/tags`)}
            class="text-accent underline hover:text-accent-hover"
          >
            {t("doc.allTags", locale)}
          </a>
        </section>
      )}
    </DocLayoutWithDefaults>
  );
}
