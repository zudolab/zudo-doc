/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// versions-page — factory for the documentation-versions page renderer
// (epic #2344, S8).
//
// The host's `pages/lib/_versions-page.tsx` previously imported host singletons
// (`@/config/settings`, `@/config/i18n`, `@/utils/base`) directly. This factory
// receives those as injected dependencies so the logic lives in the package
// while the host stub keeps the singleton imports.

import type { ComponentChildren, JSX } from "preact";
import { DocLayoutWithDefaults } from "../doclayout/index.js";
import { VersionsPageContent } from "../nav-indexing/index.js";
import type { VersionPageEntry, VersionsPageLabels } from "../nav-indexing/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal version config entry needed by the versions page. */
export interface VersionsPageVersionEntry {
  slug: string;
  label?: string;
  banner?: "unmaintained" | "unreleased";
}

/** Settings subset read by the versions page factory. */
export interface VersionsPageSettings {
  noindex?: boolean;
  dynamicPageTransition?: boolean;
  versions: VersionsPageVersionEntry[] | false;
  base: string;
}

/** Host-supplied component bindings injected into the versions page factory. */
export interface VersionsPageComponents {
  HeadWithDefaults: (props: { title: string }) => JSX.Element;
  HeaderWithDefaults: (props: { lang?: string; currentPath?: string }) => JSX.Element;
  FooterWithDefaults: (props: { lang?: string }) => JSX.Element;
  BodyEndIslands: (props: { basePath: string }) => JSX.Element;
}

/** Injected dependencies for {@link createVersionsPageView}. */
export interface VersionsPageDeps {
  settings: VersionsPageSettings;
  /** Default locale code (e.g. `"en"`). */
  defaultLocale: string;
  /** Translate a UI string key for a locale. */
  t: (key: string, locale: string) => string;
  /** Prefix a path with the configured base directory. */
  withBase: (path: string) => string;
  /** Compose the meta `<title>` value. */
  composeMetaTitle: (title: string) => string;
  components: VersionsPageComponents;
}

/** Props for the VersionsPageView component. */
export interface VersionsPageViewProps {
  locale: string;
  children?: ComponentChildren;
}

/**
 * Create a `VersionsPageView` component bound to the host's settings and
 * component dependencies.
 */
export function createVersionsPageView(
  deps: VersionsPageDeps,
): (props: VersionsPageViewProps) => JSX.Element {
  const {
    settings,
    defaultLocale,
    t,
    withBase,
    composeMetaTitle,
    components: {
      HeadWithDefaults,
      HeaderWithDefaults,
      FooterWithDefaults,
      BodyEndIslands,
    },
  } = deps;

  /** Versions index page for one locale. Lists the latest version and any past
   *  versions configured in settings.versions. */
  function VersionsPageView({ locale }: VersionsPageViewProps): JSX.Element {
    const isDefault = locale === defaultLocale;
    const prefix = isDefault ? "" : `/${locale}`;
    const pageTitle = t("version.page.title", locale);

    const labels: VersionsPageLabels = {
      pageTitle,
      latestTitle: t("version.page.latest.title", locale),
      latestDescription: t("version.page.latest.description", locale),
      latestLink: t("version.page.latest.link", locale),
      pastTitle: t("version.page.past.title", locale),
      pastDescription: t("version.page.past.description", locale),
      unmaintained: t("version.page.unmaintained", locale),
      unreleased: t("version.page.unreleased", locale),
      versionCol: t("version.switcher.label", locale),
      statusCol: t("version.page.status", locale),
      docsCol: t("version.page.docs", locale),
    };

    // Latest docs href — points to the default docs entry point
    const latestHref = withBase(`${prefix}/docs/getting-started`);

    // Past version entries from settings
    const versions: VersionPageEntry[] = settings.versions
      ? settings.versions.map((v) => ({
          slug: v.slug,
          label: v.label ?? v.slug,
          // Version prefix comes BEFORE the locale — the only routed shape is
          // pages/v/[version]/{locale}/docs/...; /{locale}/v/... has no route.
          docsHref: withBase(`/v/${v.slug}${prefix}/docs/getting-started/`),
          banner: v.banner as "unmaintained" | "unreleased" | undefined,
        }))
      : [];

    return (
      <DocLayoutWithDefaults
        title={composeMetaTitle(pageTitle)}
        head={<HeadWithDefaults title={pageTitle} />}
        lang={locale}
        noindex={settings.noindex}
        hideSidebar={true}
        hideToc={true}
        // Empty fragment suppresses DocLayoutWithDefaults' empty-data default
        // Sidebar island — its marker never hydrates for published-package
        // consumers (zfb#999) and zfb >= next.38 warns about it; the sidebar is
        // hidden on this page anyway (zudolab/zudo-doc#2057).
        sidebarOverride={<></>}
        headerOverride={<HeaderWithDefaults lang={locale} currentPath={withBase(`${prefix}/docs/versions`)} />}
        footerOverride={<FooterWithDefaults lang={locale} />}
        bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
        enableClientRouter={settings.dynamicPageTransition}
      >
        <VersionsPageContent
          latestHref={latestHref}
          versions={versions}
          labels={labels}
        />
      </DocLayoutWithDefaults>
    );
  }

  return VersionsPageView;
}
