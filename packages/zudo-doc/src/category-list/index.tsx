/** @jsxRuntime automatic */
// category-list — the category-driven document listing (zudolab/zudo-doc#4802).
//
// `createCategoryListRenderer(deps)` binds the pure resolver (`./model.js`) to
// a locale/version-aware nav source, and `createCategoryListWrapper(deps)`
// turns it into the `<CategoryList>` server component the MDX map registers
// per page. The `category-list` home section uses the same renderer, so the
// homepage recipe and an authored MDX page resolve identical items.

import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { remapVersionedHrefs } from "../nav-data-prep/index.js";
import type { DateFormatSetting } from "../settings.js";
import { resolveDateFormats } from "../date-format-resolve/index.js";
import {
  assertValidCategoryListOptions,
  resolveCategoryList,
  type CategoryListNode,
  type CategoryListOptions,
  type CategoryListResolution,
} from "./model.js";
import {
  CategoryListView,
  resolveCategoryListDisplay,
  type CategoryListLabels,
} from "./view.js";

export * from "./model.js";
export {
  CategoryListView,
  resolveCategoryListDisplay,
  type CategoryListDisplay,
  type CategoryListLabels,
  type CategoryListViewProps,
} from "./view.js";

/** Minimal doc shape read for tags and category-index detection. */
export interface CategoryListSourceDoc {
  slug: string;
  data: { slug?: string; tags?: string[] };
}

export interface CategoryListSource {
  /** Every merged doc, including unlisted/standalone ones hidden from navigation. */
  docs?: unknown[];
  navDocs: unknown[];
  categoryMeta: Map<string, unknown>;
}

/** Injected dependencies (all available on a `ChromeContext`). */
export interface CategoryListDeps {
  defaultLocale: string;
  /** `settings.docTags`: tags are only listed when the site uses tags. */
  docTags?: boolean;
  resolveNavSource: (
    lang: string,
    currentVersion: string | undefined,
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => CategoryListSource;
  buildNavTree: (
    docs: unknown[],
    locale: string,
    categoryMeta: Map<string, unknown>,
  ) => CategoryListNode[];
  toRouteSlug: (entrySlug: string) => string;
  resolveTag?: (raw: string) => string;
  t: (key: string, locale: string) => string;
  versionedDocsUrl?: (slug: string, versionSlug: string, lang: string) => string;
  dateFormat?: DateFormatSetting;
}

/** Per-render context. */
export interface CategoryListRenderContext {
  lang: string;
  currentVersion?: string;
  /** Where the options came from, for diagnostics (e.g. `home.sections[2]`). */
  where: string;
}

export interface CategoryListRenderer {
  /** Resolve without rendering (used to decide whether a home section renders at all). */
  resolve(options: CategoryListOptions, context: CategoryListRenderContext): CategoryListResolution;
  /** Resolve + render. `null` when the category is valid but has nothing to list. */
  render(
    options: CategoryListOptions,
    context: CategoryListRenderContext,
    resolution?: CategoryListResolution,
    titleLevel?: 3 | 4,
  ): JSX.Element | null;
}

/** Localized labels; `archiveLabel` overrides the archive text when non-blank. */
export function resolveCategoryListLabels(
  t: (key: string, locale: string) => string,
  locale: string,
  archiveLabel?: string,
): CategoryListLabels {
  return {
    archive: archiveLabel?.trim() ? archiveLabel : t("categoryList.archive", locale),
    count: t("categoryList.count", locale),
    updated: t("doc.updated", locale),
    tags: t("doc.tags", locale),
    path: t("categoryList.path", locale),
  };
}

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

export function createCategoryListRenderer(deps: CategoryListDeps): CategoryListRenderer {
  function resolve(
    options: CategoryListOptions,
    { lang, currentVersion, where }: CategoryListRenderContext,
  ): CategoryListResolution {
    assertValidCategoryListOptions(options as unknown as Record<string, unknown>, where);
    // keepUnlisted applies to the locale MERGE only: an unlisted translation
    // must still shadow its default-locale fallback. `navDocs` then drops it
    // (and standalone docs) through the shared `isNavVisible` predicate.
    const source = deps.resolveNavSource(lang, currentVersion, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    const navDocs = source.navDocs as CategoryListSourceDoc[];
    const rawTree = deps.buildNavTree(navDocs, lang, source.categoryMeta);
    const tree =
      currentVersion && deps.versionedDocsUrl
        ? remapVersionedHrefs(rawTree as never[], currentVersion, lang, deps.versionedDocsUrl)
        : rawTree;

    const bySlug = new Map<string, CategoryListSourceDoc>();
    for (const doc of navDocs) {
      const routeSlug = doc.data.slug ?? deps.toRouteSlug(doc.slug);
      if (!bySlug.has(routeSlug)) bySlug.set(routeSlug, doc);
    }
    const resolveTag = deps.resolveTag ?? ((raw: string) => raw);

    const resolution = resolveCategoryList(tree as CategoryListNode[], options.category, {
      ...(options.scope !== undefined ? { scope: options.scope } : {}),
      limit: options.limit,
      tagsFor: (slug) =>
        deps.docTags === false ? [] : (bySlug.get(slug)?.data.tags ?? []).map(resolveTag),
      isCategoryIndex: (slug) => {
        const doc = bySlug.get(slug);
        return doc === undefined || doc.slug === "index" || doc.slug.endsWith("/index");
      },
    });

    if (resolution.status === "not-category") {
      throw new Error(
        `[zudo-doc] ${where}: category ${JSON.stringify(options.category)} is a document, not a category. Point it at a category (a folder with an index page or _category_.json).`,
      );
    }
    // A category that exists on disk but has nothing visible (all drafts, a
    // hidden index) has no nav node; it is a valid empty category, not a typo.
    const knownCategory =
      resolution.status === "not-found" &&
      (source.categoryMeta.has(options.category) ||
        ((source.docs ?? []) as CategoryListSourceDoc[]).some((doc) => {
          const routeSlug = doc.data.slug ?? deps.toRouteSlug(doc.slug);
          return routeSlug === options.category || routeSlug.startsWith(`${options.category}/`);
        }));
    if (knownCategory) {
      return {
        status: "ok",
        category: { slug: options.category, label: options.category, kind: "tree", dated: false },
        items: [],
        total: 0,
      };
    }
    if (resolution.status === "not-found") {
      // The default locale's unversioned tree is the authoring reference: a
      // category missing there is a typo. Elsewhere it can be legitimately
      // absent (default-locale-only prefixes, an older version) → no output.
      if (lang === deps.defaultLocale && !currentVersion) {
        throw new Error(
          `[zudo-doc] ${where}: unknown category ${JSON.stringify(options.category)}. Use the category's canonical slug as it appears in the sidebar URL (e.g. "blog" or "guides/layout-demos").`,
        );
      }
      warnOnce(
        `[zudo-doc] ${where}: category ${JSON.stringify(options.category)} is not available for locale "${lang}"${currentVersion ? ` / version "${currentVersion}"` : ""} — nothing rendered.`,
      );
      return resolution;
    }
    if ((options.showArchive ?? true) && resolution.category.href === undefined) {
      warnOnce(
        `[zudo-doc] ${where}: category ${JSON.stringify(options.category)} has no archive page (category_no_page) — the "see all" link is omitted. Set showArchive: false to silence this.`,
      );
    }
    return resolution;
  }

  function render(
    options: CategoryListOptions,
    context: CategoryListRenderContext,
    resolution: CategoryListResolution = resolve(options, context),
    titleLevel: 3 | 4 = 3,
  ): JSX.Element | null {
    if (resolution.status !== "ok" || resolution.items.length === 0) return null;
    return (
      <CategoryListView
        resolved={resolution}
        display={resolveCategoryListDisplay(options)}
        labels={resolveCategoryListLabels(deps.t, context.lang, options.archiveLabel)}
        locale={context.lang}
        dateFormats={resolveDateFormats(deps.dateFormat, context.lang)}
        titleLevel={titleLevel}
      />
    );
  }

  return { resolve, render };
}

/** `<CategoryList>` props: the shared options plus the per-page bindings the MDX map injects. */
export interface CategoryListProps extends CategoryListOptions {
  /** Active locale. Injected per page by the MDX component map. */
  lang?: string;
  /** Active version slug. Injected per page by the MDX component map. */
  currentVersion?: string;
  /** Item heading level. Use 4 when the list sits under an H3. @default 3 */
  titleLevel?: 3 | 4;
}

/**
 * Create the `<CategoryList>` server component bound to a nav source. Place it
 * under an authored `##` heading; it renders no heading of its own and
 * nothing at all when the category has no visible documents.
 */
export function createCategoryListWrapper(
  deps: CategoryListDeps,
): (props: CategoryListProps) => JSX.Element | null {
  const renderer = createCategoryListRenderer(deps);
  return function CategoryList(props: CategoryListProps): JSX.Element | null {
    const { lang = deps.defaultLocale, currentVersion, titleLevel = 3, ...options } = props;
    if (titleLevel !== 3 && titleLevel !== 4) {
      throw new TypeError(`Invalid <CategoryList> titleLevel ${JSON.stringify(titleLevel)}: must be 3 or 4.`);
    }
    // MDX may hand through `children` / `key`; they are not listing options.
    const { children: _children, key: _key, ...rest } = options as CategoryListOptions & {
      children?: unknown;
      key?: unknown;
    };
    const context = {
      lang,
      ...(currentVersion !== undefined ? { currentVersion } : {}),
      where: "<CategoryList>",
    };
    return renderer.render(rest, context, undefined, titleLevel);
  };
}
