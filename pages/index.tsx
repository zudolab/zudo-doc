/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/index.astro → zfb page module.
//
// Default-locale (EN) site index. Static route — no paths() export needed.
// Collects the EN docs tree and renders the site-map grid plus optional
// tag count.
//
// Data flow:
//   getCollection("docs")   [sync, zfb ADR-004]
//   → buildNavTree()        builds the nav tree for the sitemap grid
//   → collectTags()         counts unique tags for the tag section header
//   → DocLayoutWithDefaults renders the page with no sidebar/TOC

import { loadDocs } from "./_data";
import type { DocsEntry } from "@/types/docs-entry";
import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import {
  buildNavTree,
  groupSatelliteNodes,
  isNavVisible,
} from "@/utils/docs";
import { loadCategoryMeta } from "@/utils/docs";
import { getCategoryOrder } from "@/utils/nav-scope";
import { collectTags } from "@/utils/tags";
import { toRouteSlug } from "@/utils/slug";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { DocsSitemap } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";
import { FooterWithDefaults } from "./lib/_footer-with-defaults";
import { HeaderWithDefaults } from "./lib/_header-with-defaults";

export const frontmatter = { title: "Home" };

export default function IndexPage(): JSX.Element {
  const locale = defaultLocale;

  // `loadDocs` bridges zfb's CollectionEntry → Astro-style DocsEntry
  // (adds `id`/`collection`) so `@/utils/docs` helpers see the shape
  // they expect.
  const allDocs = loadDocs("docs");
  const docs = allDocs.filter((doc) => !doc.data.draft);
  const categoryMeta = loadCategoryMeta(settings.docsDir);
  const navDocs = docs.filter(isNavVisible);
  const tree = buildNavTree(navDocs, locale, categoryMeta);
  const categoryOrder = getCategoryOrder();
  const groupedTree = groupSatelliteNodes(tree, categoryOrder);

  const tagDocs = docs.filter(isNavVisible);
  const tagCount = collectTags(
    tagDocs,
    (id, data) => data.slug ?? toRouteSlug(id),
  ).size;

  const ctaNav = settings.headerNav[0] ?? null;
  const overview = ctaNav ? withBase(ctaNav.path) : null;
  const logoUrl = withBase("/img/logo.svg");

  return (
    <DocLayoutWithDefaults
      title={settings.siteName}
      lang={locale}
      hideSidebar={true}
      hideToc={true}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase("/")} />}
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
          <a href={withBase("/docs/tags")} class="text-accent underline hover:text-accent-hover">
            {t("doc.allTags", locale)}
          </a>
        </section>
      )}
    </DocLayoutWithDefaults>
  );
}
