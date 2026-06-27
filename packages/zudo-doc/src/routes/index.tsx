/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Package route entrypoint: / — package-owned equivalent of pages/index.tsx
// (A1 #2361). Default-locale (EN) site index: site-map grid + optional tag
// count, rendered through the package chrome (`_chrome`). Static route — no
// paths() export.

import type { JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { SiteTreeNav } from "../site-tree-nav-island/index.js";
import type { SidebarNavNode } from "../sidebar/types.js";
import {
  settings,
  defaultLocale,
  t,
  withBase,
  resolveNavSource,
  buildNavTree,
  groupSatelliteNodes,
  getCategoryOrder,
  collectTags,
  docsUrl,
  toRouteSlug,
} from "./_context.js";
import type { CategoryMeta } from "./_docs-helpers.js";
import {
  HeadWithDefaults,
  HeaderWithDefaults,
  FooterWithDefaults,
  BodyEndIslands,
  composeMetaTitle,
} from "./_chrome.js";

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

  const ctaNav = settings.headerNav[0] ?? null;
  const overview = ctaNav ? withBase(ctaNav.path) : null;
  const logoUrl = withBase("/img/logo.svg");

  return (
    <DocLayoutWithDefaults
      title={composeMetaTitle(settings.siteName)}
      head={<HeadWithDefaults title={settings.siteName} />}
      lang={locale}
      noindex={settings.noindex}
      hideSidebar={true}
      hideToc={true}
      sidebarOverride={<></>}
      headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase("/")} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
      enableClientRouter={settings.dynamicPageTransition}
    >
      <div class="flex justify-center mb-vsp-xl">
        <div class="flex flex-col items-center text-center gap-hsp-md lg:flex-row lg:text-left lg:gap-hsp-xl">
          <div
            class="w-[320px] max-w-full aspect-[1200/630] bg-fg shrink-0"
            style={{
              WebkitMask: `url(${logoUrl}) center/contain no-repeat`,
              mask: `url(${logoUrl}) center/contain no-repeat`,
            }}
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
                    GitHub
                  </a>
                  <span class="text-muted">/</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {Island({
        when: "idle",
        children: (
          <SiteTreeNav
            tree={groupedTree as unknown as SidebarNavNode[]}
            categoryOrder={categoryOrder}
            categoryIgnore={["inbox", "develop"]}
          />
        ),
      }) as unknown as VNode}

      {settings.docTags && tagCount > 0 && (
        <section class="mt-vsp-xl">
          <h2 class="text-title font-bold mb-vsp-md">{t("doc.allTags", locale)}</h2>
          <a href={withBase("/docs/tags")} class="text-accent underline hover:text-accent-hover">
            {t("doc.allTags", locale)}
          </a>
        </section>
      )}
    </DocLayoutWithDefaults>
  );
}
