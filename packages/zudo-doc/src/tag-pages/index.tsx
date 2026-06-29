/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// tag-pages — factory for the doc-tags page renderers (epic #2344, S8).
//
// The host's `pages/lib/_tag-pages.tsx` previously imported host singletons
// (`@/utils/tags`, `@/utils/slug`, `@/config/i18n`, `@/config/settings`,
// `@/utils/base`) directly. This factory receives those as injected
// dependencies so the logic lives in the package while the host stub keeps
// the singleton imports.
//
// Collapses the per-locale page pairs:
//   pages/docs/tags/[tag].tsx   + pages/[locale]/docs/tags/[tag].tsx
//   pages/docs/tags/index.tsx   + pages/[locale]/docs/tags/index.tsx
// into locale-parameterized helpers. The page files stay thin shells that own
// only their paths() param shapes; URL prefixes and the default-vs-locale
// data path branch live here.
//
// Data-path branch (kept exactly as the original pages had it):
//   - Default locale: the "docs" collection directly, filtered
//     unlisted/draft/category_no_page before tag collection.
//   - Non-default locale: locale-first merge with base fallback
//     (see locale-merge.ts) — draft-filtered inputs, unlisted dropped by the
//     merge default, category_no_page filtered AFTER the merge so a locale
//     override carrying the flag first wins the merge (suppressing the base
//     doc); pre-merge filtering would drop it from localeSlugSet and the
//     unflagged base doc would resurface as a card linking to a locale route
//     the docs route never builds.

import type { ComponentChildren, JSX } from "preact";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { Breadcrumb } from "../breadcrumb/index.js";
import type { BreadcrumbItem } from "../breadcrumb/index.js";
import { DocCardGrid, TagNav } from "../nav-indexing/index.js";
import type { TagItem, TagNavLabels } from "../nav-indexing/index.js";
import { memoizeDerived } from "../nav-source-cache/index.js";
import { mergeLocaleDocs } from "../locale-merge/index.js";
import { toRouteSlug } from "../slug/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { createHeaderWithDefaults } from "../header-with-defaults/index.js";
import { createFooterWithDefaults } from "../footer-with-defaults/index.js";
import { createDocHistoryArea } from "../doc-history-area/index.js";
import { deriveComposeMetaTitle, deriveBodyEndIslands } from "../chrome/derive.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal docs entry shape needed by the tag-pages factory. */
export interface TagPagesDocsEntry {
  id: string;
  data: {
    slug?: string;
    draft?: boolean;
    unlisted?: boolean;
    category_no_page?: boolean;
    tags?: string[];
    title: string;
    description?: string;
    [key: string]: unknown;
  };
}

/** Tag info produced and consumed by the tag-pages factory. */
export interface TagInfo {
  tag: string;
  count: number;
  docs: { slug: string; title: string; description?: string }[];
}

/** Settings subset read by the tag-pages factory. */
export interface TagPagesSettings {
  noindex?: boolean;
  dynamicPageTransition?: boolean;
  docTags?: boolean;
  base: string;
}

/** Host-supplied component bindings injected into the tag-pages factory. */
export interface TagPagesComponents {
  HeadWithDefaults: (props: { title: string }) => JSX.Element;
  HeaderWithDefaults: (props: { lang?: string; currentPath?: string }) => JSX.Element;
  FooterWithDefaults: (props: { lang?: string }) => JSX.Element;
  BodyEndIslands: (props: { basePath: string }) => JSX.Element;
  DocHistoryArea: (props: { slug: string; locale: string }) => JSX.Element | null;
}

/** Injected dependencies for {@link createTagPages}. */
export interface TagPagesDeps {
  settings: TagPagesSettings;
  /** Default locale code (e.g. `"en"`). */
  defaultLocale: string;
  /** Translate a UI string key for a locale. */
  t: (key: string, locale: string) => string;
  /** Prefix a path with the configured base directory. */
  withBase: (path: string) => string;
  /** Build a docs URL for the given slug and lang. */
  docsUrl: (slug: string, lang?: string) => string;
  /** Compose the meta `<title>` value. */
  composeMetaTitle: (title: string) => string;
  /**
   * Collect tags from a docs array, producing a Map<tag, TagInfo>.
   * Host passes `collectTags` from `@/utils/tags`.
   */
  collectTags: (
    entries: TagPagesDocsEntry[],
    slugFn: (id: string, data: { slug?: string }) => string,
  ) => Map<string, TagInfo>;
  /**
   * Identity-stable, draft-filtered docs array for a collection.
   * Host passes `stableDocs` from `pages/lib/_nav-source-cache.ts`.
   */
  stableDocs: (collectionName: string) => TagPagesDocsEntry[];
  /**
   * Returns true for paths that are only shown in the default locale.
   * Host passes `isDefaultLocaleOnlyPath` from `@/utils/base`.
   */
  isDefaultLocaleOnlyPath?: (path: string) => boolean;
  components: TagPagesComponents;
}

/** Result of {@link createTagPages}. */
export interface TagPagesAPI {
  /**
   * Build the { tag → TagInfo } map for one locale, preserving each original
   * page's exact data path (see the module-header branch notes).
   *
   * Memoized on the snapshot-anchored stableDocs identity (same pattern as
   * _nav-source-cache) so the collection bridging and tag aggregation run once
   * per locale per build rather than once per built tag page.
   */
  collectTagMapForLocale: (locale: string) => Map<string, TagInfo>;
  /** Per-tag detail page (chip target). */
  TagDetailPageView: (props: {
    locale: string;
    tag: string;
    tagInfo: TagInfo;
  }) => JSX.Element;
  /** "All Tags" index page — computes the tag map at render time. */
  TagsIndexPageView: (props: { locale: string; children?: ComponentChildren }) => JSX.Element;
}

/**
 * Create the tag-pages functions from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `settings`/`defaultLocale`/`t`/`withBase`/`docsUrl`/`collectTags`/
 * `stableDocs` off the context, derives `composeMetaTitle`, and rebuilds the
 * Head / Header / Footer / BodyEndIslands / DocHistoryArea chrome from the SAME
 * context. `isDefaultLocaleOnlyPath` is left `undefined` to reproduce the
 * pre-collapse injected wiring (`routes/_chrome.tsx` passed `undefined`) — the
 * frozen baseline's tag pages are rendered through that path BYTE-FOR-BYTE.
 */
export function createTagPages<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): TagPagesAPI {
  assertChromeContext(ctx, "createTagPages");
  const settings = ctx.settings as unknown as TagPagesSettings;
  const defaultLocale = ctx.defaultLocale;
  const t = ctx.t;
  const withBase = ctx.withBase;
  const docsUrl = ctx.docsUrl;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const collectTags = ctx.collectTags as unknown as TagPagesDeps["collectTags"];
  const stableDocs = ctx.stableDocs as unknown as TagPagesDeps["stableDocs"];
  const isDefaultLocaleOnlyPath: ((path: string) => boolean) | undefined = undefined;
  const HeadWithDefaults = createHeadWithDefaults(ctx) as TagPagesComponents["HeadWithDefaults"];
  const HeaderWithDefaults = createHeaderWithDefaults(
    ctx,
  ) as TagPagesComponents["HeaderWithDefaults"];
  const FooterWithDefaults = createFooterWithDefaults(
    ctx,
  ) as TagPagesComponents["FooterWithDefaults"];
  const BodyEndIslands = deriveBodyEndIslands(ctx) as TagPagesComponents["BodyEndIslands"];
  const DocHistoryArea = createDocHistoryArea(ctx) as TagPagesComponents["DocHistoryArea"];

  // ---------------------------------------------------------------------------
  // Tag collection
  // ---------------------------------------------------------------------------

  /**
   * URL prefix for a locale: "" for the default locale, "/{locale}" otherwise.
   */
  function localePrefix(locale: string): string {
    return locale === defaultLocale ? "" : `/${locale}`;
  }

  function collectTagMapForLocale(locale: string): Map<string, TagInfo> {
    if (locale === defaultLocale) {
      const baseDocs = stableDocs("docs");
      return memoizeDerived([baseDocs], "tagMap;default", () => {
        // category_no_page index.mdx builds no route — drop it so a tag it carries
        // doesn't render a DocCard linking to a non-existent /docs/<cat>/ page.
        const docs = baseDocs.filter(
          (doc) =>
            !doc.data.unlisted && !doc.data.draft && !doc.data.category_no_page,
        );
        return collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
      });
    }

    const baseDocs = stableDocs("docs");
    const localeDocs = stableDocs(`docs-${locale}`);
    return memoizeDerived([baseDocs, localeDocs], `tagMap;${locale}`, () => {
      const { docs: mergedDocs } = mergeLocaleDocs({
        baseDocs: baseDocs.filter((d) => !d.data.draft),
        localeDocs: localeDocs.filter((d) => !d.data.draft),
        applyDefaultLocaleOnlyFilter: true,
        isDefaultLocaleOnlyPath,
      });
      const docs = mergedDocs.filter((d) => !d.data.category_no_page);
      return collectTags(docs, (id, data) => data.slug ?? toRouteSlug(id));
    });
  }

  // ---------------------------------------------------------------------------
  // Shared renderers
  // ---------------------------------------------------------------------------

  /** Per-tag detail page (chip target). */
  function TagDetailPageView({
    locale,
    tag,
    tagInfo,
  }: {
    locale: string;
    tag: string;
    tagInfo: TagInfo;
  }): JSX.Element {
    const isDefault = locale === defaultLocale;
    const prefix = localePrefix(locale);

    const countText =
      tagInfo.count === 1
        ? t("doc.pageCountSingle", locale).replace("{count}", String(tagInfo.count))
        : t("doc.pageCount", locale).replace("{count}", String(tagInfo.count));

    const pageTitle = `${t("doc.taggedWith", locale)}: ${tag}`;

    const breadcrumbItems: BreadcrumbItem[] = [
      { label: "Docs" },
      { label: t("doc.allTags", locale), href: withBase(`${prefix}/docs/tags`) },
      { label: tag },
    ];

    const cardItems = tagInfo.docs.map((doc) => ({
      href: docsUrl(doc.slug, locale),
      title: doc.title,
      description: doc.description,
    }));

    return (
      <DocLayoutWithDefaults
        title={composeMetaTitle(pageTitle)}
        head={<HeadWithDefaults title={pageTitle} />}
        // The original default-locale page omitted `lang` entirely; passing
        // undefined relies on Preact treating an undefined prop as absent.
        lang={isDefault ? undefined : locale}
        noindex={settings.noindex}
        hideSidebar={true}
        hideToc={true}
        // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
        // Sidebar island — its marker never hydrates for published-package
        // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
        // hidden on this page anyway (zudolab/zudo-doc#2057).
        sidebarOverride={<></>}
        // Tag segment URL-encoded — emitted href/path sites only; route params
        // stay raw (e.g. "type:guide" → "type%3Aguide").
        headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`${prefix}/docs/tags/${encodeURIComponent(tag)}`)} />}
        breadcrumbOverride={<Breadcrumb items={breadcrumbItems} />}
        footerOverride={<FooterWithDefaults lang={locale} />}
        bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
        enableClientRouter={settings.dynamicPageTransition}
      >
        <h1 class="text-heading font-bold mb-vsp-xs">{pageTitle}</h1>
        <p class="text-muted mb-vsp-lg">{countText}</p>
        <DocCardGrid ariaLabel={pageTitle} items={cardItems} />
        <DocHistoryArea slug={`tags/${tag}`} locale={locale} />
      </DocLayoutWithDefaults>
    );
  }

  /** "All Tags" index page — computes the tag map at render time (matching the
   *  original pages, which had no props from paths()). */
  function TagsIndexPageView({ locale }: { locale: string; children?: ComponentChildren }): JSX.Element {
    const isDefault = locale === defaultLocale;
    const prefix = localePrefix(locale);
    const pageTitle = t("doc.allTags", locale);

    const tagMap = collectTagMapForLocale(locale);

    const labels: TagNavLabels = {
      tags: t("doc.tags", locale),
      taggedWith: t("doc.taggedWith", locale),
    };

    // Sort alphabetically using the page locale — matches documented tag-nav sort order.
    const tags: TagItem[] = [...tagMap.values()]
      .sort((a, b) => a.tag.localeCompare(b.tag, locale))
      .map((info) => ({
        tag: info.tag,
        count: info.count,
        // Tag segment URL-encoded — href sites only; route params stay raw.
        href: withBase(`${prefix}/docs/tags/${encodeURIComponent(info.tag)}`),
      }));

    const breadcrumbItems: BreadcrumbItem[] = [
      { label: "Docs" },
      { label: pageTitle },
    ];

    return (
      <DocLayoutWithDefaults
        title={composeMetaTitle(pageTitle)}
        head={<HeadWithDefaults title={pageTitle} />}
        // Same undefined-≡-absent reliance as TagDetailPageView above.
        lang={isDefault ? undefined : locale}
        noindex={settings.noindex}
        hideSidebar={true}
        hideToc={true}
        // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
        // Sidebar island — its marker never hydrates for published-package
        // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
        // hidden on this page anyway (zudolab/zudo-doc#2057).
        sidebarOverride={<></>}
        headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`${prefix}/docs/tags`)} />}
        breadcrumbOverride={<Breadcrumb items={breadcrumbItems} />}
        footerOverride={<FooterWithDefaults lang={locale} />}
        bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
        enableClientRouter={settings.dynamicPageTransition}
      >
        <h1 class="text-heading font-bold mb-vsp-lg">{pageTitle}</h1>
        {!settings.docTags || tags.length === 0 ? (
          <p class="text-muted">{t("doc.noTags", locale)}</p>
        ) : (
          <TagNav variant="all" tags={tags} labels={labels} />
        )}
        <DocHistoryArea slug="tags" locale={locale} />
      </DocLayoutWithDefaults>
    );
  }

  return {
    collectTagMapForLocale,
    TagDetailPageView,
    TagsIndexPageView,
  };
}
