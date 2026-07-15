/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// doc-page-renderer — factory for the shared page renderer for all 4 doc routes
// (epic #2344, S7).
//
// The host's `pages/lib/_doc-page-renderer.tsx` previously imported host
// singletons (`@/config/settings`, `@/config/i18n`, `@/utils/base`,
// `@/utils/docs`, `@/utils/nav-scope`, `@takazudo/zudo-doc/slug`). This factory receives
// all host-bound dependencies as injected context so the logic lives in the
// package while the host stub keeps the singleton imports.
//
// Route-specific behavior is parameterized:
//   - `version` present → versioned chrome: versioned canonical URL, version
//     banner, version-aware switcher, auto-index child hrefs kept as the
//     pre-remapped versioned hrefs from paths() (#1916 #2), and doc history
//     hidden until versioned history is supported (#1916 #5).
//   - `version` absent → latest chrome: docsUrl canonical, child hrefs fall
//     back to the nav node's own docsUrl, doc history rendered for listed
//     entries via `docHistoryContentDir`.

import type { JSX, VNode } from "preact";
import type { DocPageBaseProps, DocNavNode, DocPageEntry } from "../doc-page-props/index.js";
import type { VersionBannerLabels } from "../i18n-version/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { createDocPageShell } from "../doc-page-shell/index.js";
import { createDocContentHeader } from "../doc-content-header/index.js";
import { createDocMetainfoArea } from "../doc-metainfo-area/index.js";
import { createDocHistoryArea } from "../doc-history-area/index.js";
import { deriveMdxComponents, deriveInlineVersionSwitcher } from "../chrome/derive.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

export type { DocPageBaseProps };

/**
 * Version config shape — structural subset of the host's `VersionConfig`.
 * Defined here so the package does not import the host `@/` alias.
 */
export interface RenderDocPageVersionConfig {
  /** Version slug, e.g. "1.0". */
  slug: string;
  /** Banner type drives the VersionBanner element (`false` = no banner). */
  banner?: "unmaintained" | "unreleased" | false;
}

export interface RenderDocPageOptions {
  /** Active locale — drives nav wrappers, labels, and URL building. */
  locale: string;
  /** Version config when rendering a versioned route; undefined = latest. */
  version?: RenderDocPageVersionConfig;
  /** True when this page falls back to the base EN collection (locale
   *  routes). Drives the fallback notice + history-area hint. */
  isFallback?: boolean;
  /**
   * Content directory for the doc-history view-source link (e.g. the active
   * locale's dir, or the base docsDir for EN/fallback pages). Latest routes
   * pass it; versioned routes omit it — doc history is hidden on versioned
   * pages regardless (#1916 #5).
   */
  docHistoryContentDir?: string;
}

/** Dependencies injected by the host stub. */
export interface DocPageRendererDeps {
  /** Build a docs URL: `docsUrl(slug, lang?)` → base-prefixed path. */
  docsUrl: (slug: string, lang?: string) => string;
  /** Build a versioned docs URL: `versionedDocsUrl(slug, versionSlug, lang?)`. */
  versionedDocsUrl: (slug: string, versionSlug: string, lang?: string) => string;
  /** Build an absolute URL: `absoluteUrl(path)` → siteUrl-prefixed. */
  absoluteUrl: (path: string) => string | undefined;
  /** Determine the nav section (categoryMatch) for a slug. */
  getNavSectionForSlug: (slug: string) => string | undefined;
  /** Convert a content entry slug to a canonical route slug. */
  toRouteSlug: (id: string) => string;
  /**
   * Build locale-aware MDX components bag.
   * Host passes `createMdxComponents` (from `pages/_mdx-components.ts`).
   */
  createMdxComponents: (locale: string) => Record<string, unknown>;
  /** Translate a UI string key for a locale. */
  t: (key: string, locale: string) => string;
  /**
   * Build an inline version switcher VNode for the breadcrumb rightSlot.
   * Host passes `buildInlineVersionSwitcher` from `pages/lib/_inline-version-switcher.tsx`.
   */
  buildInlineVersionSwitcher: (
    slug: string,
    locale: string,
    currentVersion?: string,
  ) => JSX.Element | undefined;
  /**
   * The `DocPageShell` component (host-side factory result from
   * `@takazudo/zudo-doc/doc-page-shell`).
   */
  DocPageShell: (props: {
    kind: "entry" | "autoIndex";
    locale: string;
    slug: string;
    title: string;
    description?: string;
    canonical?: string;
    breadcrumbs: Array<{ label: string; href?: string }>;
    prev: DocNavNode | null;
    next: DocNavNode | null;
    headings: Array<{ depth: number; slug: string; text: string }>;
    navSection: string | undefined;
    sidebarPersistKey: string | undefined;
    hideSidebar?: boolean;
    hideToc?: boolean;
    contentWide?: boolean;
    currentPath: string;
    currentVersion?: string;
    versionSwitcher: JSX.Element | undefined;
    versionBanner?: "unmaintained" | "unreleased";
    versionBannerLatestUrl?: string;
    versionBannerLabels?: VersionBannerLabels;
    autoIndexLabel?: string;
    autoIndexChildren?: DocNavNode[];
    metainfoSlot?: VNode | null;
    contentHeaderSlot?: VNode;
    contentSlot?: VNode;
    docHistorySlot?: VNode | null;
  }) => JSX.Element;
  /**
   * The `DocContentHeader` component (host-side factory result).
   */
  DocContentHeader: (props: {
    entry: DocPageEntry;
    slug: string;
    locale: string;
    isFallback?: boolean;
    version?: string;
  }) => JSX.Element;
  /**
   * The `DocMetainfoArea` component (host-side factory result).
   */
  DocMetainfoArea: (props: {
    slug: string;
    locale: string;
    isFallback?: boolean;
  }) => JSX.Element | null;
  /**
   * The `DocHistoryArea` component (host-side factory result).
   */
  DocHistoryArea: (props: {
    slug: string;
    locale: string;
    entrySlug?: string;
    contentDir?: string;
    isFallback?: boolean;
  }) => VNode | null;
}

/**
 * Create a `renderDocPage` function from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads the URL/nav/slug/i18n helpers off the context; rebuilds the locale-aware
 * MDX components factory + inline version-switcher from the shared derive helpers
 * (the MDX nav wrappers prefer `ctx.components`, content overrides come from
 * `ctx.hostBindings.mdxExtras`); and rebuilds DocPageShell / DocContentHeader /
 * DocMetainfoArea / DocHistoryArea from the SAME context.
 */
export function createRenderDocPage<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: DocPageBaseProps, opts: RenderDocPageOptions) => JSX.Element {
  assertChromeContext(ctx, "createRenderDocPage");
  const docsUrl = ctx.docsUrl;
  const versionedDocsUrl = ctx.versionedDocsUrl;
  const absoluteUrl = ctx.absoluteUrl;
  const getNavSectionForSlug = ctx.getNavSectionForSlug;
  const toRouteSlug = ctx.toRouteSlug;
  const createMdxComponents = deriveMdxComponents(ctx).createMdxComponentsBound as (
    locale: string,
  ) => Record<string, unknown>;
  const t = ctx.t;
  const buildInlineVersionSwitcher = deriveInlineVersionSwitcher(
    ctx,
  ) as DocPageRendererDeps["buildInlineVersionSwitcher"];
  const DocPageShell = createDocPageShell(ctx) as DocPageRendererDeps["DocPageShell"];
  const DocContentHeader = createDocContentHeader(
    ctx,
  ) as DocPageRendererDeps["DocContentHeader"];
  const DocMetainfoArea = createDocMetainfoArea(ctx);
  const DocHistoryArea = createDocHistoryArea(ctx);

  function renderDocPage(
    props: DocPageBaseProps,
    opts: RenderDocPageOptions,
  ): JSX.Element {
    const { breadcrumbs, prev, next, headings } = props;
    const { locale, version, isFallback } = opts;

    const slug = props.kind === "autoIndex"
      ? props.autoIndex.slug
      : (props.entry.data.slug ?? toRouteSlug(props.entry.slug));

    const title = props.kind === "autoIndex" ? props.autoIndex.label : props.entry.data.title;
    const description = props.kind === "autoIndex" ? props.autoIndex.description : props.entry.data.description;

    // Locale-aware components bag — creates nav wrappers bound to the active
    // locale so CategoryNav/CategoryTreeNav/SiteTreeNav query the right collection.
    const components = createMdxComponents(locale);

    // Resolve child hrefs for auto-index pages. Versioned routes: child cards
    // already carry versioned hrefs from paths() (#1916 #2) — just filter to
    // renderable nodes. Latest routes: keep the nav node's own docsUrl href
    // (fallback for a noPage parent without an href).
    const autoIndexChildren = props.kind === "autoIndex"
      ? version
        ? props.autoIndex.children.filter((c: DocNavNode) => c.hasPage || c.children.length > 0)
        : props.autoIndex.children
            .filter((c: DocNavNode) => c.hasPage || c.children.length > 0)
            .map((c: DocNavNode) => ({
              ...c,
              href: c.href ?? docsUrl(c.slug, locale),
            }))
      : [];

    // Version banner: drives the `<VersionBanner>` element inside
    // DocLayoutWithDefaults when `version.banner` is "unmaintained" or
    // "unreleased". The banner links out to the latest version of the
    // current page (slug-preserving — strips the /v/{version}/ prefix,
    // keeps the /{locale}/ locale prefix).
    const versionBannerType = version?.banner ? version.banner : undefined;
    const versionBannerLatestUrl = versionBannerType
      ? docsUrl(slug, locale)
      : undefined;
    const versionBannerLabels: VersionBannerLabels | undefined = versionBannerType
      ? {
          message:
            versionBannerType === "unmaintained"
              ? t("version.banner.unmaintained", locale)
              : t("version.banner.unreleased", locale),
          latestLink: t("version.banner.latestLink", locale),
        }
      : undefined;

    // Canonical URL — base-prefixed page path, absolutized against siteUrl.
    // Versioned pages use the versioned URL as canonical.
    const currentPath = version
      ? versionedDocsUrl(slug, version.slug, locale)
      : docsUrl(slug, locale);
    const canonical = absoluteUrl(currentPath);

    // Persist key: locale + nav-section so the sidebar DOM node is reused
    // across same-locale + same-section navigations only. No sanitizer needed —
    // both lang (BCP-47 locale string) and navSection (filesystem-derived
    // kebab-case slug) come from controlled, trusted sources.
    const navSection = getNavSectionForSlug(slug);
    const entryData = props.kind === "entry"
      ? (props.entry.data as Record<string, unknown>)
      : undefined;
    const standalone = entryData?.standalone as boolean | undefined;
    // Pre-1.0 scaffold derivation: standalone implies hide_sidebar + hide_toc.
    const hideSidebar = entryData
      ? ((entryData.hide_sidebar as boolean | undefined) || standalone)
      : undefined;
    const hideToc = entryData
      ? ((entryData.hide_toc as boolean | undefined) || standalone)
      : undefined;
    // `wide` frontmatter opts the content band into the full-width layout.
    const contentWide = entryData
      ? (entryData.wide as boolean | undefined)
      : undefined;
    const sidebarPersistKey = hideSidebar
      ? undefined
      : `sidebar-${locale}-${navSection ?? "default"}`;

    // Build the Content node for entry pages — uses the locale-aware components bag.
    const ContentComponent = props.kind === "entry"
      ? (props.entry.Content as (props: { components: Record<string, unknown> }) => JSX.Element)
      : null;

    return (
      <DocPageShell
        kind={props.kind}
        locale={locale}
        slug={slug}
        title={title}
        description={description}
        canonical={canonical}
        breadcrumbs={breadcrumbs}
        prev={prev}
        next={next}
        headings={headings}
        navSection={navSection}
        sidebarPersistKey={sidebarPersistKey}
        hideSidebar={hideSidebar}
        hideToc={hideToc}
        contentWide={contentWide}
        currentPath={currentPath}
        currentVersion={version?.slug}
        versionSwitcher={buildInlineVersionSwitcher(slug, locale, version?.slug)}
        versionBanner={versionBannerType}
        versionBannerLatestUrl={versionBannerLatestUrl}
        versionBannerLabels={versionBannerLabels}
        autoIndexLabel={props.kind === "autoIndex" ? props.autoIndex.label : undefined}
        autoIndexChildren={autoIndexChildren}
        metainfoSlot={
          // Versioned gate mirrors DocContentHeader: the doc-history-meta
          // manifest is built from latest dirs only, so a bare versioned slug
          // would surface the LATEST page's Created/Updated/Author.
          !version && props.kind === "autoIndex" ? (
            <DocMetainfoArea slug={slug} locale={locale} isFallback={isFallback} />
          ) : null
        }
        contentHeaderSlot={
          props.kind === "entry" ? (
            <DocContentHeader
              entry={props.entry}
              slug={slug}
              locale={locale}
              isFallback={isFallback}
              version={version?.slug}
            />
          ) : undefined
        }
        contentSlot={
          ContentComponent ? <ContentComponent components={components} /> : undefined
        }
        docHistorySlot={
          // #1916 #5: doc-history hidden on versioned pages until versioned
          // history is supported.
          !version &&
          opts.docHistoryContentDir !== undefined &&
          props.kind === "entry" &&
          !(props.entry.data as Record<string, unknown>).unlisted ? (
            <DocHistoryArea
              slug={slug}
              locale={locale}
              entrySlug={props.entry.slug}
              contentDir={opts.docHistoryContentDir}
              isFallback={isFallback}
            />
          ) : null
        }
      />
    );
  }

  return renderDocPage;
}
