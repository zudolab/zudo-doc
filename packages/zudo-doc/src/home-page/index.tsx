/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// home-page — factory for the shared home-page body (epic #2499, S3 #2502).
//
// `/` is never injected by the routes plugin (zfb rejects `/`; upstream
// Takazudo/zudo-front-builder#1227) and re-exporting compiled routes from
// host pages hits the node_modules virtual-module gap on published installs.
// So the home body ships as an ordinary factory both the package routes
// (`routes/index.tsx` / `routes/locale-index.tsx`) AND host pages can call.
//
// Body = today's home structure lifted from `routes/index.tsx`: hero (logo
// mask block, `<h1>` siteName, description, overview + GitHub links row), the
// `SiteTreeNav` idle Island, and the docTags section. The GitHub link is
// upgraded to the RICHER showcase version (`pages/index.tsx`) — inline SVG
// icon instead of plain text — a reviewed, intentional diff for the package
// routes' output (see the module doc above this factory in the epic issue).
//
// Data inputs (nav tree, category order, tag count) differ slightly between
// the default-locale and locale-prefixed routes — that data-prep sequence now
// lives in the sibling `./prepare-home-data.js` factory (`prepareHomeData`,
// #2519) and is handed to `HomePageView` as PREPARED PROPS by every adapter;
// this factory only derives the locale-URL prefix (shared logic — `/` for the
// default locale, `/{locale}` otherwise) from `ctx`. `prepareHomeData` is
// implemented in its own file so the view-factory FILE carries no `node:fs`
// edge (importing `createHomePageView` from this module by path does not pull
// in sidebar-tree's `loadCategoryMeta`). The barrel re-export below DOES add
// that static edge for anyone importing through the barrel — acceptable because
// this barrel is a server-side-only entry and `loadCategoryMeta` degrades
// gracefully under zfb's SSG runtime `node:fs` stub.
//
// NOT an eject target — no `ejectable-snapshot` registration.

import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { SiteTreeNav } from "../site-tree-nav-island/index.js";
import type { SidebarNavNode } from "../sidebar/types.js";
import type { DocNavNode } from "../doc-page-props/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { createHeaderWithDefaults } from "../header-with-defaults/index.js";
import { createFooterWithDefaults } from "../footer-with-defaults/index.js";
import { deriveComposeMetaTitle, deriveBodyEndIslands } from "../chrome/derive.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

export { prepareHomeData } from "./prepare-home-data.js";
export type { PrepareHomeDataOptions, HomeData } from "./prepare-home-data.js";

/** Props for the `HomePageView` component built by {@link createHomePageView}. */
export interface HomePageViewProps {
  /** Active locale — drives hero copy, link locale-prefixing, and the
   *  `hostBindings.homeExtras({ locale })` call when `extras` is absent. */
  locale: string;
  /**
   * Extra content rendered after the links row, inside the hero text column.
   * A VALUE (already-rendered children) — the host-PAGE path. Takes
   * precedence over `ctx.hostBindings.homeExtras` when both are present.
   *
   * This value-vs-renderer asymmetry (prop = value, `hostBindings.homeExtras`
   * = renderer) is INTENTIONAL, not an oversight to "unify": a host page
   * already has its JSX in hand (a value), while the injected/bindings path
   * only has a locale string at render time and must derive its own content
   * from it (a renderer). Resolved as `extras ?? hostBindings.homeExtras?.({
   * locale })`.
   */
  extras?: ComponentChildren;
  /** Prepared nav tree for the `SiteTreeNav` grid (already grouped via
   *  `groupSatelliteNodes` by the caller — the two routes group their own
   *  locale-specific tree before handing it here). */
  tree: DocNavNode[];
  /** Ordered category prefixes, passed through to `SiteTreeNav`. */
  categoryOrder: string[];
  /** Root-category slugs that should start collapsed in `SiteTreeNav`. */
  initiallyCollapsedCategorySlugs?: string[];
  /** Unique tag count for the current locale — gates the "all tags" section
   *  together with `settings.docTags`. */
  tagCount: number;
  /**
   * Opt the home page into the **wide** content layout (full-viewport
   * category grid instead of the standard capped reading column). Threaded to
   * the underlying `DocLayoutWithDefaults` as `contentWide`. Defaults to
   * `false` so downstream projects keep the narrower grid unless they opt in;
   * this showcase passes `wide` from `pages/index.tsx`.
   */
  wide?: boolean;
}

/**
 * Create a `HomePageView` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420-style factory shape, adopted for the
 * home page in #2502).
 *
 * Reads `settings`/`t`/`withBase`/`defaultLocale` off the context, derives
 * `composeMetaTitle` + Head/Header/Footer/BodyEndIslands chrome from the SAME
 * context (so the injected package-routes path and a host-bound context both
 * render byte-identically), and computes the locale-URL prefix (`""` for the
 * default locale, `/{locale}` otherwise) shared by the overview link, the
 * header `currentPath`, and the "all tags" link — reproducing the exact
 * per-route path construction `routes/index.tsx` / `routes/locale-index.tsx`
 * did inline before this extraction.
 */
export function createHomePageView<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: HomePageViewProps) => JSX.Element {
  assertChromeContext(ctx, "createHomePageView");
  const settings = ctx.settings;
  const t = ctx.t;
  const withBase = ctx.withBase;
  const defaultLocale = ctx.defaultLocale;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx);
  const HeaderWithDefaults = createHeaderWithDefaults(ctx);
  const FooterWithDefaults = createFooterWithDefaults(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx);
  const homeExtras = ctx.hostBindings.homeExtras;

  /** Site index: hero + `SiteTreeNav` grid + optional tag-count section. */
  function HomePageView({
    locale,
    extras,
    tree,
    categoryOrder,
    initiallyCollapsedCategorySlugs,
    tagCount,
    wide,
  }: HomePageViewProps): JSX.Element {
    const prefix = locale === defaultLocale ? "" : `/${locale}`;
    const ctaNav = settings.headerNav[0] ?? null;
    const overview = ctaNav ? withBase(`${prefix}${ctaNav.path}`) : null;
    const logoUrl = withBase("/img/logo.svg");
    const resolvedExtras = extras ?? homeExtras?.({ locale });

    return (
      <DocLayoutWithDefaults
        title={composeMetaTitle(settings.siteName)}
        head={<HeadWithDefaults title={settings.siteName} />}
        lang={locale}
        noindex={settings.noindex}
        hideSidebar={true}
        hideToc={true}
        contentWide={wide}
        sidebarOverride={<></>}
        headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`${prefix}/`)} />}
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
                )}
              </div>

              {resolvedExtras as ComponentChildren}
            </div>
          </div>
        </div>

        {Island({
          when: "idle",
          children: (
            <SiteTreeNav
              tree={tree as unknown as SidebarNavNode[]}
              categoryOrder={categoryOrder}
              categoryIgnore={["inbox", "develop"]}
              initiallyCollapsedCategorySlugs={initiallyCollapsedCategorySlugs}
            />
          ),
        }) as unknown as VNode}

        {settings.docTags && tagCount > 0 && (
          <section class="mt-vsp-xl">
            <h2 class="text-title font-bold mb-vsp-md">{t("doc.allTags", locale)}</h2>
            <a
              href={withBase(`${prefix}/docs/tags`)}
              class="text-accent underline hover:text-accent-hover"
            >
              {t("doc.allTags", locale)}
            </a>
          </section>
        )}
      </DocLayoutWithDefaults>
    );
  }

  return HomePageView;
}
