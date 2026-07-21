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

import { Fragment } from "preact";
import type { ComponentChildren, JSX, VNode } from "preact";
import { Island } from "@takazudo/zfb";
import { AutoLogo } from "../auto-logo/index.js";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { SiteTreeNav } from "../site-tree-nav-island/index.js";
import { TagNav } from "../nav-indexing/tag-nav.js";
import type { TagItem } from "../nav-indexing/types.js";
import { CategoryLinkIcon } from "../tree-nav-shared/index.js";
import type { SidebarNavNode } from "../sidebar/types.js";
import type { DocNavNode } from "../doc-page-props/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import { deriveComposeMetaTitle, deriveBodyEndIslands } from "../chrome/derive.js";
import { derivePrimaryChromeSlots } from "../chrome/primary-slots.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

export { prepareHomeData } from "./prepare-home-data.js";
export type { PrepareHomeDataOptions, HomeData } from "./prepare-home-data.js";

/**
 * Serialize a URL as a quoted CSS `url()` token. The `logo` setting accepts an
 * arbitrary user-supplied path, and an unquoted `url()` breaks on characters
 * that are legal in a filename but not in a CSS url-token — whitespace and
 * parentheses, e.g. `/img/logo (1).svg` — which makes the browser drop the
 * whole mask declaration and render nothing.
 */
function cssUrl(url: string): string {
  return `url("${url.replace(/[\\"]/g, "\\$&")}")`;
}

/** Props for the `HomePageView` component built by {@link createHomePageView}. */
export interface HomePageViewProps {
  /** Active locale — drives hero copy, link locale-prefixing, and the
   *  `hostBindings.homeExtras({ locale })` call when `extras` is absent. */
  locale: string;
  /**
   * Extra content rendered INLINE at the end of the links row, `/`-separated
   * from whatever precedes it (the primary link and/or the GitHub link). A
   * VALUE (already-rendered children) — the host-PAGE path. Takes precedence
   * over `ctx.hostBindings.homeExtras` when both are present.
   *
   * This value-vs-renderer asymmetry (prop = value, `hostBindings.homeExtras`
   * = renderer) is INTENTIONAL, not an oversight to "unify": a host page
   * already has its JSX in hand (a value), while the injected/bindings path
   * only has a locale string at render time and must derive its own content
   * from it (a renderer). Resolved as `extras ?? hostBindings.homeExtras?.({
   * locale })`.
   */
  extras?: ComponentChildren;
  /**
   * Overrides the default first hero link, which is otherwise
   * `settings.headerNav[0]` + `t("nav.overview", locale)`. `path` is
   * locale-relative (the view prefixes it with the locale-URL prefix and
   * resolves it through `withBase`, same as the default); `labelKey`
   * resolves through `t(labelKey, locale)`.
   */
  heroLink?: { path: string; labelKey: string };
  /** Prepared nav tree for the `SiteTreeNav` grid (already grouped via
   *  `groupSatelliteNodes` by the caller — the two routes group their own
   *  locale-specific tree before handing it here). */
  tree: DocNavNode[];
  /** Ordered category prefixes, passed through to `SiteTreeNav`. */
  categoryOrder: string[];
  /** Root-category slugs that should start collapsed in `SiteTreeNav`. */
  initiallyCollapsedCategorySlugs?: string[];
  /** Unique tag count for the current locale — gates the "Tags" section
   *  together with `settings.docTags`. Part of the documented public
   *  `@takazudo/zudo-doc/home-page` props shape (kept for back-compat). */
  tagCount: number;
  /**
   * Alphabetically-sorted tag list (tag + doc count + pre-resolved href) for
   * the current locale. When provided (and non-empty) the section renders the
   * tag chips (first {@link HomePageViewProps.tagLimit}) plus a "see all tags"
   * nav. When omitted — legacy callers that pass only `tagCount` — the section
   * falls back to the pre-#3027 single "All Tags" link, so existing
   * `@takazudo/zudo-doc/home-page` consumers are not broken.
   */
  tags?: TagItem[];
  /**
   * Max number of tag chips rendered in the home "Tags" section before a "…"
   * overflow indicator is shown. The full set stays reachable via the
   * "see all tags" link. @default 30
   */
  tagLimit?: number;
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
  const { Header: HeaderWithDefaults, Footer: FooterWithDefaults } =
    derivePrimaryChromeSlots(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx);
  const homeExtras = ctx.hostBindings.homeExtras;
  // SSR `data-theme-pack` html attribute (ADR theme-packs.md Decision 3, #2822).
  const dataThemePack = resolveThemePackSsrSlug(
    ctx.themePackRegistry,
    ctx.settings as { themePack?: string },
  );

  /** Site index: hero + `SiteTreeNav` grid + optional tag-count section. */
  function HomePageView({
    locale,
    extras,
    heroLink,
    tree,
    categoryOrder,
    initiallyCollapsedCategorySlugs,
    tagCount,
    tags,
    tagLimit = 30,
    wide,
  }: HomePageViewProps): JSX.Element {
    const prefix = locale === defaultLocale ? "" : `/${locale}`;
    const ctaNav = settings.headerNav[0] ?? null;
    const primary = heroLink
      ? { href: withBase(`${prefix}${heroLink.path}`), label: t(heroLink.labelKey, locale) }
      : ctaNav
        ? { href: withBase(`${prefix}${ctaNav.path}`), label: t("nav.overview", locale) }
        : null;
    // `"auto"` (default) = generated deterministic SVG seeded by siteName;
    // a path string = theme-adaptive CSS-mask of that asset; `false` = no
    // logo block. `"auto"` is what makes a fresh scaffold's hero render
    // something without shipping any `/img/logo.svg`.
    const logoSetting = settings.logo ?? "auto";
    const resolvedExtras = extras ?? homeExtras?.({ locale });
    // `false`/`true`/`null`/`undefined` all render nothing in Preact (a
    // caller may pass a conditional like `extras={cond && <Link />}`), so
    // exclude them here — otherwise a "/" separator would render for content
    // that never actually appears in the row.
    const hasExtras = resolvedExtras != null && typeof resolvedExtras !== "boolean";
    // Row items rendered `/`-separated — building an explicit list (instead
    // of each item hard-coding its own trailing/leading separator) is what
    // keeps the separator count correct regardless of which combination of
    // primary/GitHub/extras is present.
    const rowItems: ComponentChildren[] = [];
    if (primary) {
      rowItems.push(
        <a href={primary.href} class="text-fg underline hover:text-accent">
          {primary.label}
        </a>,
      );
    }
    if (settings.githubUrl) {
      rowItems.push(
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
        </a>,
      );
    }
    if (hasExtras) {
      rowItems.push(resolvedExtras as ComponentChildren);
    }

    return (
      <DocLayoutWithDefaults
        title={composeMetaTitle(settings.siteName)}
        head={<HeadWithDefaults title={settings.siteName} />}
        lang={locale}
        dataThemePack={dataThemePack}
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
            {logoSetting === "auto" ? (
              <AutoLogo
                seed={settings.siteName}
                class="w-[320px] max-w-full aspect-[1200/630] text-fg shrink-0"
              />
            ) : logoSetting !== false ? (
              <div
                class="w-[320px] max-w-full aspect-[1200/630] bg-fg shrink-0"
                style={{
                  WebkitMask: `${cssUrl(withBase(logoSetting))} center/contain no-repeat`,
                  mask: `${cssUrl(withBase(logoSetting))} center/contain no-repeat`,
                }}
                aria-hidden="true"
              />
            ) : null}
            <div>
              <h1 class="text-heading font-bold mb-vsp-2xs">{settings.siteName}</h1>
              <p class="text-muted text-small mb-vsp-sm">{settings.siteDescription}</p>
              <div class="flex items-center justify-center lg:justify-start gap-hsp-md text-small">
                {rowItems.map((item, index) => (
                  <Fragment key={index}>
                    {index > 0 && <span class="text-muted">/</span>}
                    {item}
                  </Fragment>
                ))}
              </div>
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
            {tags && tags.length > 0 ? (
              <>
                <h2 class="text-title font-bold mb-vsp-md">{t("doc.tags", locale)}</h2>
                <TagNav
                  variant="all"
                  tags={tags.slice(0, tagLimit)}
                  labels={{
                    tags: t("doc.tags", locale),
                    taggedWith: t("doc.taggedWith", locale),
                  }}
                />
                {tags.length > tagLimit && (
                  <div class="mt-vsp-sm text-title text-muted" aria-hidden="true">
                    …
                  </div>
                )}
                <div class="mt-vsp-md">
                  <a
                    href={withBase(`${prefix}/docs/tags`)}
                    class="group inline-flex items-center gap-hsp-xs text-accent hover:underline"
                  >
                    <CategoryLinkIcon className="w-icon-sm text-accent" />
                    <span>{t("doc.seeAllTags", locale)}</span>
                  </a>
                </div>
              </>
            ) : (
              // Legacy fallback: caller passed only `tagCount` (no tag list) —
              // reproduce the pre-#3027 single "All Tags" link so existing
              // `@takazudo/zudo-doc/home-page` consumers are unaffected.
              <>
                <h2 class="text-title font-bold mb-vsp-md">{t("doc.allTags", locale)}</h2>
                <a
                  href={withBase(`${prefix}/docs/tags`)}
                  class="text-accent underline hover:text-accent-hover"
                >
                  {t("doc.allTags", locale)}
                </a>
              </>
            )}
          </section>
        )}
      </DocLayoutWithDefaults>
    );
  }

  return HomePageView;
}
