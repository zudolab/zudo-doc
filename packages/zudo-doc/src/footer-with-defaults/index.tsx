/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// footer-with-defaults — factory for the locale-aware Footer wrapper
// (epic #2344, S5).
//
// The host's `pages/lib/_footer-with-defaults.tsx` previously imported
// host singletons (`@/config/settings`, `@/config/i18n`, `@/config/tag-vocabulary`,
// `@/utils/base`, `@/utils/tags`, `@/utils/slug`). This factory receives those
// as arguments so the logic lives in the package while the host stub keeps
// the singleton imports.

import type { VNode } from "preact";
import { Footer } from "../footer/index.js";
import type { FooterLinkColumn, FooterTagColumn } from "../footer/index.js";

/** Tag info returned by the host's `collectTags` (what the factory sees). */
export interface FooterTagInfo {
  tag: string;
  count: number;
}

/** Tag vocabulary entry subset the factory reads. */
export interface FooterVocabularyEntry {
  id: string;
  group?: string;
}

/** The `settings.footer` subset the factory reads. */
export interface FooterConfig {
  links: Array<{
    title: string;
    locales?: Record<string, { title: string } | undefined>;
    items: Array<{
      label: string;
      href: string;
      locales?: Record<string, { label: string } | undefined>;
    }>;
  }>;
  copyright?: string;
  taglist?: {
    enabled?: boolean;
    groupBy?: "flat" | "group";
    title?: string;
    groupTitles?: Record<string, string>;
    locales?: Record<string, { title?: string; groupTitles?: Record<string, string> } | undefined>;
  };
}

/** Settings subset read by {@link createFooterWithDefaults}. */
export interface FooterWithDefaultsSettings {
  footer?: FooterConfig | false | null;
  tagVocabulary?: unknown;
  tagGovernance?: string;
}

/** Dependencies injected by the host stub. */
export interface FooterWithDefaultsDeps {
  settings: FooterWithDefaultsSettings;
  defaultLocale: string;
  tagVocabulary: readonly FooterVocabularyEntry[];
  isExternal: (href: string) => boolean;
  resolveHref: (href: string) => string;
  withBase: (path: string) => string;
  loadTagsForLocale: (lang: string) => FooterTagInfo[];
}

/**
 * Create a `FooterWithDefaults` component bound to the host's settings
 * and data-prep utilities.
 */
export function createFooterWithDefaults(
  deps: FooterWithDefaultsDeps,
): (props: { lang?: string }) => VNode {
  const {
    settings,
    defaultLocale,
    tagVocabulary,
    isExternal,
    resolveHref,
    withBase,
    loadTagsForLocale,
  } = deps;

  /**
   * Prefix an internal href with the locale path for non-default locales,
   * then apply the configured base prefix. External hrefs pass through.
   */
  function localizeHref(href: string, lang: string): string {
    if (isExternal(href)) return href;
    if (lang !== defaultLocale) {
      const path = href.startsWith("/") ? href : `/${href}`;
      return resolveHref(`/${lang}${path}`);
    }
    return resolveHref(href);
  }

  /**
   * Build the base-prefixed tag detail page href for the given locale.
   */
  function tagHref(tag: string, lang: string): string {
    const encoded = encodeURIComponent(tag);
    const path =
      lang === defaultLocale
        ? `/docs/tags/${encoded}`
        : `/${lang}/docs/tags/${encoded}`;
    return withBase(path);
  }

  /**
   * Locale-aware Footer wrapper.
   *
   * Reads settings.footer and assembles the linkColumns / tagColumns /
   * copyright props expected by the presentational `<Footer>` shell.
   */
  function FooterWithDefaults({
    lang = defaultLocale,
  }: {
    lang?: string;
  }): VNode {
    const footer = settings.footer;

    const persistKey = `footer-${lang}`;

    if (!footer) {
      return <Footer persistKey={persistKey} />;
    }

    const { links, copyright, taglist } = footer;

    // ── Link columns ────────────────────────────────────────────────────────

    const linkColumns: FooterLinkColumn[] = links.map((column) => ({
      title: (column.locales as Record<string, { title: string }> | undefined)?.[lang]?.title ?? column.title,
      items: column.items.map((item) => ({
        label: (item.locales as Record<string, { label: string }> | undefined)?.[lang]?.label ?? item.label,
        href: localizeHref(item.href, lang),
        isExternal: isExternal(item.href),
      })),
    }));

    // ── Tag columns (optional) ───────────────────────────────────────────────

    let tagColumns: FooterTagColumn[] = [];

    if (taglist?.enabled) {
      const allTags = loadTagsForLocale(lang);

      const vocabularyActive =
        Boolean(settings.tagVocabulary) && settings.tagGovernance !== "off";
      const requestedGroupBy = taglist.groupBy ?? "group";
      const effectiveGroupBy = vocabularyActive ? requestedGroupBy : "flat";

      const localeOverrides = (taglist.locales as Record<string, { title?: string; groupTitles?: Record<string, string> }> | undefined)?.[lang];
      const groupTitles: Record<string, string> = {
        ...taglist.groupTitles,
        ...localeOverrides?.groupTitles,
      };
      const flatTitle = localeOverrides?.title ?? taglist.title ?? "Tags";

      if (effectiveGroupBy === "flat" || !vocabularyActive) {
        if (allTags.length > 0) {
          tagColumns = [
            {
              group: "__flat__",
              title: flatTitle,
              tags: allTags.map(({ tag, count }) => ({
                tag,
                count,
                href: tagHref(tag, lang),
              })),
            },
          ];
        }
      } else {
        // Grouped mode: one column per vocabulary group, in declaration order.
        const groupByCanonical = new Map<string, string>();
        const groupOrder: string[] = [];
        const seenGroups = new Set<string>();
        for (const entry of tagVocabulary) {
          if (!entry.group) continue;
          groupByCanonical.set(entry.id, entry.group);
          if (!seenGroups.has(entry.group)) {
            seenGroups.add(entry.group);
            groupOrder.push(entry.group);
          }
        }

        const buckets = new Map<string, typeof allTags>();
        for (const group of groupOrder) buckets.set(group, []);
        const ungrouped: typeof allTags = [];

        for (const info of allTags) {
          const group = groupByCanonical.get(info.tag);
          if (group && buckets.has(group)) {
            buckets.get(group)!.push(info);
          } else {
            ungrouped.push(info);
          }
        }

        tagColumns = groupOrder
          .filter((g) => (buckets.get(g)?.length ?? 0) > 0)
          .map((g) => ({
            group: g,
            title:
              groupTitles[g] ??
              g.charAt(0).toUpperCase() + g.slice(1),
            tags: buckets.get(g)!.map(({ tag, count }) => ({
              tag,
              count,
              href: tagHref(tag, lang),
            })),
          }));

        if (ungrouped.length > 0) {
          tagColumns.push({
            group: "__flat__",
            title: flatTitle,
            tags: ungrouped.map(({ tag, count }) => ({
              tag,
              count,
              href: tagHref(tag, lang),
            })),
          });
        }
      }
    }

    return (
      <Footer
        linkColumns={linkColumns}
        tagColumns={tagColumns}
        copyright={copyright}
        persistKey={persistKey}
      />
    );
  }

  return FooterWithDefaults;
}
