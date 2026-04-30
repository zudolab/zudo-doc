/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Locale-/version-aware Header wrapper for the zfb doc pages.
//
// Mirrors the data-prep that lived in src/components/header.astro
// (deleted in commit a4d9956): build the header nav, compute active-path
// state, wire the mobile SidebarToggle island (hamburger + slide-in panel)
// with the full sidebar tree for doc routes, and feed everything into the
// v2 <Header> shell.
//
// Why this wrapper exists: the v2 Header shell is intentionally
// framework-agnostic — it accepts slot props (sidebarToggle, themeToggle,
// etc.) but does not import host helpers (@/config/*, @/utils/*) so the
// package can be published independently. The data prep stays on the host
// side. Without this wrapper the zfb doc pages fall through to the
// DocLayoutWithDefaults minimal default (a bare <header> with only
// <ThemeToggle>) — the full logo + nav + mobile-sidebar markup is absent
// from the SSG output, failing the migration-check parity test.
//
// Mobile sidebar strategy:
//   - The v2 <Header> accepts a `sidebarToggle` slot that holds the
//     complete mobile sidebar widget: hamburger button + backdrop overlay +
//     slide-in <aside> panel (all rendered by <SidebarToggle>).
//   - This wrapper builds the same nav-tree data that _sidebar-with-defaults
//     produces, then wraps <SidebarToggle>(<SidebarTree ...>) in Island so
//     the SSG output carries the full tree HTML (closed/hidden by CSS
//     transform) AND a data-zfb-island="SidebarToggle" hydration marker.
//   - The mobile sidebar slot is only wired when `navSection` is defined
//     (i.e. the caller is rendering a doc route with an active sidebar
//     section). Pages with hideSidebar=true or no docs section (404, index,
//     tags, versions) omit the sidebarToggle prop; the Header renders without
//     the hamburger in that case, which matches the Astro original.
//   - ThemeToggle from the package (self-island-wrapped) is always passed to
//     Header.themeToggle so the ThemeToggle island marker appears in the
//     header on every page — matching the original header.astro behavior.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { Header } from "@zudo-doc/zudo-doc-v2/header";
import {
  VersionSwitcher,
  type VersionSwitcherLabels,
} from "@zudo-doc/zudo-doc-v2/i18n-version";
// Don't import ThemeToggle from "@zudo-doc/zudo-doc-v2/theme" — that barrel
// also re-exports DesignTokenTweakPanel and ColorTweakExportModal, which
// transitively pull `src/components/design-token-tweak/*` and the v2 panel
// modules into the zfb esbuild graph. Those files import `react`, which
// zfb does not alias to `preact/compat`, so the build fails. Use the host's
// local ThemeToggle (already on `preact/hooks`) and wrap it in Island here
// so the SSG output still emits the `data-zfb-island="ThemeToggle"` marker.
import ThemeToggle from "@/components/theme-toggle";
import SidebarToggle from "@/components/sidebar-toggle";
import SidebarTree from "@/components/sidebar-tree";
import { settings } from "@/config/settings";
import { defaultLocale, locales, t, type Locale } from "@/config/i18n";
import { buildLocaleLinks, docsUrl, navHref, versionedDocsUrl, withBase } from "@/utils/base";
import {
  isNavVisible,
  loadCategoryMeta,
  type CategoryMeta,
  type NavNode,
} from "@/utils/docs";
import { buildSidebarForSection } from "@/utils/sidebar";
import type { DocsEntry } from "@/types/docs-entry";
import { loadDocs } from "../_data";

// ---------------------------------------------------------------------------
// Internal helpers — duplicated from _sidebar-with-defaults.tsx so that
// module stays self-contained and this wrapper owns its own data-prep.
// ---------------------------------------------------------------------------

/**
 * Rewrite versioned hrefs — same logic as _sidebar-with-defaults.tsx.
 * The nav tree always emits hrefs via docsUrl(); when the active route lives
 * under /v/{version}/... we need the same nodes pointing at the versioned URL.
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
 * Pick the right loadDocs() collection for the (locale, version) pair —
 * same merge strategy as _sidebar-with-defaults.tsx.
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

  // Non-default locale: locale-first merge with EN fallback.
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
  const categoryMeta = new Map<string, CategoryMeta>([
    ...loadCategoryMeta(settings.docsDir),
    ...loadCategoryMeta(localeDir),
  ]);

  return { docs: allDocs, categoryMeta };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface HeaderWithDefaultsProps {
  /** Active locale; defaults to the configured defaultLocale. */
  lang?: Locale;
  /**
   * Current page URL path (as the layout passes from Astro.url.pathname or
   * the zfb equivalent). Used by the Header to compute the active nav item
   * and by the mobile sidebar footer locale-switcher links.
   */
  currentPath?: string;
  /** Active version slug, when rendering inside /v/{version}/... routes. */
  currentVersion?: string;
  /**
   * Slug of the active doc page — forwarded to SidebarTree so it can
   * highlight the current entry. Required when navSection is set.
   */
  currentSlug?: string;
  /**
   * Header-nav category matcher used to scope the sidebar tree (e.g.
   * "guides"). When provided the mobile sidebar toggle is wired with the
   * full sidebar tree for this section. When omitted (404, index, tags,
   * versions pages) no mobile sidebar toggle is included in the header.
   */
  navSection?: string;
}

/**
 * Default-bearing host wrapper around v2's <Header> shell.
 *
 * Handles:
 *  1. Logo, main nav with active-path highlight — delegated to <Header>.
 *  2. ThemeToggle island in the right items row — passed as themeToggle slot.
 *  3. Mobile SidebarToggle island (hamburger + slide-in aside + tree) —
 *     built from the same nav data as SidebarWithDefaults and passed as
 *     the sidebarToggle slot when navSection is defined.
 */
export function HeaderWithDefaults(
  props: HeaderWithDefaultsProps,
): JSX.Element {
  const {
    lang = defaultLocale,
    currentPath = "",
    currentVersion,
    currentSlug,
    navSection,
  } = props;

  // Root-menu items for the mobile sidebar's "back to menu" list.
  // Mirrors the data-prep in _sidebar-with-defaults.tsx.
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

  // Build the mobile sidebar toggle only when we have an active docs section.
  // Pages with hideSidebar=true or no sidebar section (404, index, tags,
  // versions) pass no navSection and get no hamburger button / slide-in panel.
  let sidebarToggle: VNode | undefined;

  if (navSection !== undefined) {
    const backToMenuLabel = t("nav.backToMenu", lang);
    const { docs, categoryMeta } = loadNavSourceDocs(lang, currentVersion);
    const navDocs = docs.filter(isNavVisible);
    const rawNodes = buildSidebarForSection(navDocs, lang, navSection, categoryMeta);
    const nodes = currentVersion
      ? remapVersionedHrefs(rawNodes, currentVersion, lang)
      : rawNodes;

    // Locale-switcher links in the mobile sidebar footer — only when
    // multiple locales are configured (mirrors _sidebar-with-defaults.tsx).
    const localeLinks =
      locales.length > 1 ? buildLocaleLinks(currentPath, lang) : undefined;

    const themeDefaultMode = settings.colorMode
      ? settings.colorMode.defaultMode
      : undefined;

    // Wrap SidebarToggle (hamburger button + slide-in aside + SidebarTree) in
    // Island so the SSG output carries the full tree HTML AND the
    // data-zfb-island="SidebarToggle" marker for client-side hydration.
    // Island.captureComponentName reads SidebarToggle.name → "SidebarToggle".
    sidebarToggle = Island({
      when: "load",
      children: (
        <SidebarToggle>
          <SidebarTree
            nodes={nodes}
            currentSlug={currentSlug}
            rootMenuItems={rootMenuItems}
            backToMenuLabel={backToMenuLabel}
            localeLinks={localeLinks}
            themeDefaultMode={themeDefaultMode}
          />
        </SidebarToggle>
      ),
    }) as unknown as VNode;
  }

  // Wrap the host's local ThemeToggle in Island({when:"load"}) so the SSG
  // output emits a data-zfb-island="ThemeToggle" marker the hydration
  // runtime can find — matching the original header.astro output. The v2
  // package's <ThemeToggle> already does this internally, but importing it
  // forces the v2 theme barrel into the bundle (see import note at the top
  // of this file).
  const themeToggle = Island({
    when: "load",
    children: <ThemeToggle />,
  }) as unknown as VNode;

  // Build the version-switcher component when versioning is configured.
  // The VersionSwitcher is a pure SSR component — it emits the full dropdown
  // markup (including the "All versions" footer link) directly in the SSG
  // HTML so crawlers and JS-off users see the version list. The interactive
  // toggle behavior is wired by VERSION_SWITCHER_INIT_SCRIPT included in
  // the layout's body-end scripts.
  //
  // Gate: only render when settings.versions is a non-empty array. When
  // versioning is disabled (settings.versions === false) the slot is
  // undefined and the Header renders nothing for the version-switcher item.
  let versionSwitcher: VNode | undefined;

  if (settings.versions && settings.versions.length > 0) {
    const isNonDefaultLocale = lang !== defaultLocale;
    // "All versions" page URL — locale-prefixed when not on the default locale.
    const versionsPageUrl = withBase(
      isNonDefaultLocale ? `/${lang}/docs/versions` : "/docs/versions",
    );
    // "Latest" entry links to the current page in the latest (unversioned)
    // docs when a slug is available, or falls back to the versions index page.
    const latestUrl = currentSlug
      ? docsUrl(currentSlug, lang)
      : versionsPageUrl;

    // Per-version URLs for the current page. When there is no slug in scope
    // (e.g. on the versions page itself) all entries point to the versions
    // index. This mirrors the original version-switcher.astro behavior.
    const versionUrls: Record<string, string> = {};
    for (const v of settings.versions) {
      versionUrls[v.slug] = currentSlug
        ? versionedDocsUrl(currentSlug, v.slug, lang)
        : versionsPageUrl;
    }

    const labels: VersionSwitcherLabels = {
      latest: t("version.latest", lang),
      switcher: t("version.switcher.label", lang),
      unavailable: t("version.switcher.unavailable", lang),
      allVersions: t("version.switcher.allVersions", lang),
    };

    versionSwitcher = (
      <VersionSwitcher
        versions={settings.versions.map((v) => ({
          slug: v.slug,
          label: v.label ?? v.slug,
        }))}
        currentVersion={currentVersion}
        latestUrl={latestUrl}
        versionsPageUrl={versionsPageUrl}
        versionUrls={versionUrls}
        labels={labels}
        idSuffix="header"
      />
    ) as unknown as VNode;
  }

  return (
    <Header
      lang={lang}
      currentPath={currentPath}
      currentVersion={currentVersion}
      sidebarToggle={sidebarToggle}
      themeToggle={themeToggle}
      versionSwitcher={versionSwitcher}
    />
  );
}
