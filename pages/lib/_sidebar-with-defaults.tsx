/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-/version-aware Sidebar wrapper for the zfb doc pages.
//
// Mirrors the data-prep that lived in src/components/sidebar.astro
// (deleted in commit a4d9956): build root-menu items from
// settings.headerNav, load the locale's docs collection (with EN
// fallback for non-default locales), build the nav tree for the active
// section, optionally remap hrefs for versioned routes, and feed the
// result into the v2 <Sidebar> shell with the project's Preact
// SidebarTree island wired in via `treeComponent`.
//
// Why this wrapper exists: the v2 Sidebar shell is intentionally
// framework-agnostic — it does not import host helpers (@/config/*,
// @/utils/*) so the package can be published independently. The data
// prep stays on the host side. Without this wrapper the zfb doc pages
// fall through to `<Sidebar nodes={[]} />` (the DocLayoutWithDefaults
// default) and the SSG output emits an empty
// `<div data-zfb-island="Sidebar" data-when="load"></div>` marker.

import type { JSX } from "preact";
// `<Island>` is applied here at the call site rather than inside the v2
// `<Sidebar>` module so the zfb island bundle's hydrate pass targets
// the bare Sidebar component (not a self-Island'd wrapper). Wave 13
// follow-on for the duplicate-nav fix family — see the head comment in
// `packages/zudo-doc-v2/src/sidebar/sidebar.tsx` for the full diagnosis.
// zudolab/zudo-doc#1355.
import { Island } from "@takazudo/zfb";
import { Sidebar } from "@zudo-doc/zudo-doc-v2/sidebar";
import SidebarTree from "@/components/sidebar-tree";
import { settings } from "@/config/settings";
import { defaultLocale, locales, t, type Locale } from "@/config/i18n";
import { buildLocaleLinks, navHref, versionedDocsUrl } from "@/utils/base";
import {
  isNavVisible,
  loadCategoryMeta,
  type CategoryMeta,
  type NavNode,
} from "@/utils/docs";
import { buildSidebarForSection } from "@/utils/sidebar";
import type { DocsEntry } from "@/types/docs-entry";
import { loadDocs } from "../_data";

export interface SidebarWithDefaultsProps {
  /** Slug of the active doc page, used to highlight the current entry. */
  currentSlug?: string;
  /** Active locale; defaults to the configured defaultLocale. */
  lang?: Locale;
  /** Header-nav category matcher used to scope the tree (e.g. "guides"). */
  navSection?: string;
  /** Active version slug, when rendering inside `/v/{version}/...`. */
  currentVersion?: string;
  /**
   * Current page URL path used to build the locale-switcher links shown in
   * the mobile sidebar footer. The Astro template read this from
   * `Astro.url.pathname`; in zfb the page module passes it explicitly.
   */
  currentPath?: string;
}

/**
 * Walk the nav tree and rewrite each node's `href` to its versioned form.
 *
 * `buildNavTree` always emits hrefs via `docsUrl()`; when the active route
 * lives under `/v/{version}/...` we need the same nodes pointing at the
 * versioned URL so internal nav clicks stay inside the version. Skips
 * nodes without an href (link-only or category placeholders).
 */
function remapVersionedHrefs(
  nodes: NavNode[],
  version: string,
  nodeLang: Locale,
): NavNode[] {
  return nodes.map((node) => {
    const children =
      node.children.length > 0
        ? remapVersionedHrefs(node.children, version, nodeLang)
        : node.children;

    if (!node.href || node.slug.startsWith("__link__")) {
      return children !== node.children ? { ...node, children } : node;
    }

    const newHref = versionedDocsUrl(node.slug, version, nodeLang);
    return { ...node, href: newHref, children };
  });
}

/**
 * Pick the right `loadDocs(...)` collection name and category-meta dir
 * for the active (locale, version) pair, applying the same locale-first
 * + EN-fallback merge that `pages/[locale]/docs/[...slug].tsx` performs
 * in its own `paths()` so the sidebar tree mirrors what those pages
 * enumerate.
 */
function loadNavSourceDocs(
  lang: Locale,
  currentVersion: string | undefined,
): { docs: DocsEntry[]; categoryMeta: Map<string, CategoryMeta> } {
  if (currentVersion) {
    const collectionName = `docs-v-${currentVersion}`;
    const versionConfig = settings.versions?.find((v) => v.slug === currentVersion);
    const docs = loadDocs(collectionName).filter((d) => !d.data.draft);
    const categoryMeta = loadCategoryMeta(versionConfig?.docsDir ?? settings.docsDir);
    return { docs, categoryMeta };
  }

  if (lang === defaultLocale) {
    const docs = loadDocs("docs").filter((d) => !d.data.draft);
    const categoryMeta = loadCategoryMeta(settings.docsDir);
    return { docs, categoryMeta };
  }

  // Non-default locale: locale-first merge with EN fallback so docs the
  // active locale has not yet translated still appear in the tree.
  const localeDocs = loadDocs(`docs-${lang}`).filter((d) => !d.data.draft);
  const baseDocs = loadDocs("docs").filter((d) => !d.data.draft);
  const localeSlugSet = new Set(localeDocs.map((d) => d.data.slug ?? d.id));
  const fallbackDocs = baseDocs.filter(
    (d) => !localeSlugSet.has(d.data.slug ?? d.id),
  );
  const allDocs = [...localeDocs, ...fallbackDocs];

  const localeDir =
    (settings.locales as Record<string, { dir?: string }>)[lang]?.dir ??
    settings.docsDir;
  // Base meta first, locale meta wins on overlapping keys — same merge
  // order [locale]/docs/[...slug].tsx uses in its paths() pass.
  const categoryMeta = new Map<string, CategoryMeta>([
    ...loadCategoryMeta(settings.docsDir),
    ...loadCategoryMeta(localeDir),
  ]);

  return { docs: allDocs, categoryMeta };
}

/**
 * Default-bearing host wrapper around v2's `<Sidebar>` shell. Performs
 * the data prep that the deleted `sidebar.astro` template did, plugs
 * the project's `<SidebarTree>` Preact island into the shell via the
 * `treeComponent` prop, and wraps the result in `<Island when="load">`
 * here at the call site so the SSG output ships a populated
 * `<div data-zfb-island="Sidebar" data-when="load">…tree…</div>` marker
 * for the hydration runtime to pick up.
 *
 * Wave 13 follow-on (zudolab/zudo-doc#1355): the Island wrap moved
 * from inside `v2/sidebar/sidebar.tsx` to this call site for the same
 * reason it moved for Toc / MobileToc — when the v2 module exported a
 * self-Island'd `Sidebar`, the zfb island bundle hydrated *that*
 * wrapper inside the existing data-zfb-island marker, appending a
 * duplicate (empty here, because `treeComponent` is a function and
 * gets dropped by `JSON.stringify` during data-props serialisation).
 * Hydrating the bare `<Sidebar>` against the existing data-zfb-island
 * element in-place is the correct behaviour and reclaims a wasted
 * hydration slot.
 */
export function SidebarWithDefaults(
  props: SidebarWithDefaultsProps,
): JSX.Element {
  const {
    currentSlug,
    lang = defaultLocale,
    navSection,
    currentVersion,
    currentPath = "",
  } = props;

  // Root-menu items derived from headerNav (mobile back-to-menu list).
  // The Astro template fed labelKey through `t(...)` and computed hrefs
  // with `navHref()`; mirror that exactly so the rendered list stays
  // identical between the A and B sites.
  const rootMenuItems = settings.headerNav.map((item) => ({
    label: item.labelKey
      ? t(item.labelKey as Parameters<typeof t>[0], lang)
      : item.label,
    href: navHref(item.path, lang, currentVersion),
    children: item.children?.map((child) => ({
      label: child.labelKey
        ? t(child.labelKey as Parameters<typeof t>[0], lang)
        : child.label,
      href: navHref(child.path, lang, currentVersion),
    })),
  }));

  const backToMenuLabel = navSection ? t("nav.backToMenu", lang) : undefined;

  const { docs, categoryMeta } = loadNavSourceDocs(lang, currentVersion);
  const navDocs = docs.filter(isNavVisible);
  const rawNodes = buildSidebarForSection(navDocs, lang, navSection, categoryMeta);
  const nodes = currentVersion
    ? remapVersionedHrefs(rawNodes, currentVersion, lang)
    : rawNodes;

  // Locale-switcher links are only meaningful when more than one locale is
  // configured — matches the Astro template's guard.
  const localeLinks =
    locales.length > 1 ? buildLocaleLinks(currentPath, lang) : undefined;

  // Wrap the populated <Sidebar> in <Island when="load"> so the SSR
  // pass emits the `data-zfb-island="Sidebar"` marker around the
  // rendered tree and the bundle's hydrate pass targets the bare
  // Sidebar against the existing marker element in-place.
  return Island({
    when: "load",
    children: (
      <Sidebar
        treeComponent={SidebarTree}
        nodes={nodes}
        currentSlug={currentSlug}
        rootMenuItems={rootMenuItems}
        backToMenuLabel={backToMenuLabel}
        localeLinks={localeLinks}
        themeDefaultMode={
          settings.colorMode ? settings.colorMode.defaultMode : undefined
        }
      />
    ),
  }) as unknown as JSX.Element;
}
