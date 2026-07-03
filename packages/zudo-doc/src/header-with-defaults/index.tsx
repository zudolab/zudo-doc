/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// header-with-defaults — factory for the locale-/version-aware Header
// wrapper (epic #2344, S5).
//
// The host's `pages/lib/_header-with-defaults.tsx` previously imported
// host singletons (`@/config/settings`, `@/config/i18n`, `@/utils/base`,
// `@/utils/github`). This factory receives those as arguments so the logic
// lives in the package while the host stub keeps the singleton imports.

import type { VNode, JSX } from "preact";
import { Island } from "@takazudo/zfb";
import { Header, filterHeaderRightItems } from "../header/index.js";
import {
  LanguageSwitcher,
  VersionSwitcher,
  type VersionSwitcherLabels,
} from "../i18n-version/index.js";
import { ThemeToggle } from "../theme-toggle/index.js";
import { SidebarToggle } from "../sidebar-toggle-island/index.js";
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { buildGitHubRepoUrl as buildGitHubRepoUrlBase } from "../github-helpers/index.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";
import { deriveNavDataPrep, deriveSearchWidgetSlot } from "../chrome/derive.js";
import type { SidebarNavNode, SidebarRootMenuItem } from "../sidebar/types.js";
import type { LocaleLink } from "../url-helpers/index.js";

export interface HeaderWithDefaultsProps {
  /** Active locale; defaults to the configured defaultLocale. */
  lang?: string;
  /** Current page URL path. Used to compute the active nav item. */
  currentPath?: string;
  /** Active version slug, when rendering inside /v/{version}/... routes. */
  currentVersion?: string;
  /** Slug of the active doc page. */
  currentSlug?: string;
  /** Header-nav category matcher used to scope the sidebar tree. */
  navSection?: string;
}

/** Version config entry subset the factory reads. */
export interface HeaderVersionEntry {
  slug: string;
  label?: string;
}

/** Settings subset read by {@link createHeaderWithDefaults}. */
export interface HeaderWithDefaultsSettings {
  siteName: string;
  /** Site base path — fed to the language-switcher SPA re-wire config. */
  base: string;
  /** Trailing-slash policy — fed to the language-switcher SPA re-wire config. */
  trailingSlash: boolean;
  headerNav: Array<{
    label: string;
    labelKey?: string;
    path: string;
    categoryMatch?: string;
    children?: Array<{
      label: string;
      labelKey?: string;
      path: string;
    }>;
  }>;
  headerRightItems?: unknown[];
  designTokenPanel?: boolean;
  aiAssistant?: boolean;
  colorMode?: { defaultMode?: string } | null | false;
  locales: Record<string, unknown>;
  versions?: HeaderVersionEntry[] | false;
  githubUrl?: string | false;
}

/**
 * Create a `HeaderWithDefaults` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Derives its old wide deps bag from the context: the URL/i18n helpers
 * (`t`/`withBase`/`docsUrl`/…) and `locales`/`defaultLocale` are read directly;
 * the nav data-prep builders + SearchWidget slot come from the shared
 * `chrome/derive` helpers; `buildGitHubRepoUrl` is bound to `settings.githubUrl`.
 */
export function createHeaderWithDefaults<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: HeaderWithDefaultsProps) => JSX.Element {
  assertChromeContext(ctx, "createHeaderWithDefaults");
  const settings = ctx.settings as unknown as HeaderWithDefaultsSettings;
  const defaultLocale = ctx.defaultLocale;
  const locales = ctx.locales;
  const t = ctx.t;
  const withBase = ctx.withBase;
  const stripBase = ctx.stripBase;
  const docsUrl = ctx.docsUrl;
  const navHref = ctx.navHref;
  const versionedDocsUrl = ctx.versionedDocsUrl;
  const { buildRootMenuItems, buildLocaleLinksForNav, buildSidebarNodes, getThemeDefaultMode } =
    deriveNavDataPrep(ctx);
  const buildGitHubRepoUrl = (): string | null =>
    buildGitHubRepoUrlBase((ctx.settings as { githubUrl?: string | false }).githubUrl);
  const SearchWidget = deriveSearchWidgetSlot(ctx);

  /**
   * Default-bearing host wrapper around v2's `<Header>` shell.
   */
  function HeaderWithDefaults(
    props: HeaderWithDefaultsProps,
  ): JSX.Element {
    const {
      lang: langProp = defaultLocale,
      currentPath = "",
      currentVersion,
      currentSlug,
      navSection,
    } = props;
    const lang = langProp;

    const rootMenuItems = buildRootMenuItems(lang, currentVersion);
    const backToMenuLabel = t("nav.backToMenu", lang);
    const localeLinks = buildLocaleLinksForNav(currentPath, lang, locales.length);
    const themeDefaultMode = getThemeDefaultMode();
    const sidebarNodes = buildSidebarNodes(lang, navSection, currentVersion);

    // Wrap SidebarToggle in Island so the SSG output carries the full tree
    // HTML AND the data-zfb-island="SidebarToggle" marker for client-side
    // hydration. See detailed comment in host's _header-with-defaults.tsx.
    const sidebarToggle = Island({
      when: "visible",
      children: (
        <SidebarToggle
          nodes={sidebarNodes}
          currentSlug={currentSlug}
          rootMenuItems={rootMenuItems}
          backToMenuLabel={backToMenuLabel}
          localeLinks={localeLinks}
          themeDefaultMode={themeDefaultMode}
        />
      ),
    }) as unknown as VNode;

    const themeToggle = Island({
      when: "load",
      children: <ThemeToggle defaultMode={themeDefaultMode} />,
    }) as unknown as VNode;

    const searchWidget = (
      <SearchWidget
        placeholderText={t("search.placeholder", lang)}
        shortcutHint={t("search.shortcutHint", lang)}
        resultCountTemplate={t("search.resultCount", lang)}
        searchLabel={t("search.label", lang)}
        searchUnavailableText={t("search.unavailable", lang)}
        loadingIndexText={t("search.loadingIndex", lang)}
        noResultsText={t("search.noResults", lang)}
      />
    );

    // Build the version-switcher component when versioning is configured.
    let versionSwitcher: VNode | undefined;

    if (settings.versions && settings.versions.length > 0) {
      const isNonDefaultLocale = lang !== defaultLocale;
      const versionsPageUrl = withBase(
        isNonDefaultLocale ? `/${lang}/docs/versions` : "/docs/versions",
      );
      const latestUrl = currentSlug != null
        ? docsUrl(currentSlug, lang)
        : versionsPageUrl;

      const versionUrls: Record<string, string> = {};
      for (const v of settings.versions) {
        versionUrls[v.slug] = currentSlug != null
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

    const languageSwitcher =
      localeLinks != null ? (
        <LanguageSwitcher
          links={localeLinks}
          config={{
            base: settings.base.replace(/\/+$/, ""),
            defaultLocale,
            trailingSlash: settings.trailingSlash,
          }}
          currentLocale={lang}
        />
      ) as unknown as VNode : undefined;

    const persistKey = `header-${lang}`;

    const headerRightItems = filterHeaderRightItems(
      (settings.headerRightItems as Parameters<typeof filterHeaderRightItems>[0]) ?? [],
      {
        designTokenPanel: Boolean(settings.designTokenPanel),
        aiAssistant: Boolean(settings.aiAssistant),
        colorMode: Boolean(settings.colorMode),
        hasLocales: Object.keys(settings.locales).length > 0,
        hasVersions: Boolean(settings.versions),
        hasGithubUrl: Boolean(settings.githubUrl),
      },
    );

    const githubRepoUrl = buildGitHubRepoUrl();
    const githubLabel = t("header.github", lang);

    return (
      <Header
        lang={lang}
        currentPath={currentPath}
        currentVersion={currentVersion}
        activeCategory={navSection}
        sidebarToggle={sidebarToggle}
        themeToggle={themeToggle}
        search={searchWidget}
        versionSwitcher={versionSwitcher}
        languageSwitcher={languageSwitcher}
        persistKey={persistKey}
        siteName={settings.siteName}
        headerNav={settings.headerNav}
        headerRightItems={headerRightItems}
        colorModeEnabled={Boolean(settings.colorMode)}
        hasLocales={locales.length > 1}
        hasVersions={Boolean(settings.versions)}
        githubRepoUrl={githubRepoUrl}
        githubLabel={githubLabel}
        urlHelpers={{
          withBase,
          stripBase,
          navHref: (path, l, v) => navHref(path, l, v),
        }}
        i18n={{
          defaultLocale,
          locales,
          t,
        }}
      />
    );
  }

  return HeaderWithDefaults;
}
