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
import type { ChromeContext } from "../factory-context/index.js";
import type { Settings } from "../settings.js";
import { createHeadWithDefaults } from "../head-with-defaults/index.js";
import { resolveThemePackSsrSlug } from "../theme/theme-pack-provider.js";
import { deriveComposeMetaTitle, deriveBodyEndIslands } from "../chrome/derive.js";
import { derivePrimaryChromeSlots } from "../chrome/primary-slots.js";
import { assertChromeContext } from "../chrome/assert-chrome-context.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal version config entry needed by the versions page. */
export interface VersionsPageVersionEntry {
  slug: string;
  label?: string;
  banner?: "unmaintained" | "unreleased" | false;
}

/** Settings subset read by the versions page factory. */
export interface VersionsPageSettings {
  noindex?: boolean;
  dynamicPageTransition?: boolean;
  versions: VersionsPageVersionEntry[] | false;
  base: string;
  /**
   * Route slug of the doc page linked as "latest docs" / each version's docs
   * entry point. Defaults to `"getting-started"` when omitted.
   */
  entryDocSlug?: string;
}

/** Host-supplied component bindings injected into the versions page factory. */
export interface VersionsPageComponents {
  HeadWithDefaults: (props: { title: string }) => JSX.Element;
  HeaderWithDefaults: (props: { lang: string; currentPath?: string }) => JSX.Element;
  FooterWithDefaults: (props: { lang: string }) => JSX.Element;
  BodyEndIslands: (props: { basePath: string }) => JSX.Element;
}

/**
 * Legacy shape, unused by createVersionsPageView — reads ChromeContext
 * directly; do not extend.
 */
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
 * Create a `VersionsPageView` component from the unified {@link ChromeContext}
 * (epic Collapse Wiring Shells #2420, FACTORIES #2424 — breaking signature).
 *
 * Reads `settings`/`defaultLocale`/`t`/`withBase` off the context, derives
 * `composeMetaTitle`, and rebuilds the Head / Header / Footer / BodyEndIslands
 * chrome from the SAME context (so the injected stub path and a host-bound
 * context both render byte-identically).
 */
export function createVersionsPageView<S extends Settings = Settings>(
  ctx: ChromeContext<S>,
): (props: VersionsPageViewProps) => JSX.Element {
  assertChromeContext(ctx, "createVersionsPageView");
  const settings = ctx.settings as unknown as VersionsPageSettings;
  const defaultLocale = ctx.defaultLocale;
  const t = ctx.t;
  const withBase = ctx.withBase;
  const isDefaultLocaleOnlyPath = ctx.isDefaultLocaleOnlyPath;
  const composeMetaTitle = deriveComposeMetaTitle(ctx);
  const HeadWithDefaults = createHeadWithDefaults(ctx) as VersionsPageComponents["HeadWithDefaults"];
  const { Header: HeaderWithDefaults, Footer: FooterWithDefaults } =
    derivePrimaryChromeSlots(ctx);
  const BodyEndIslands = deriveBodyEndIslands(ctx) as VersionsPageComponents["BodyEndIslands"];
  // SSR `data-theme-pack` html attribute (ADR theme-packs.md Decision 3, #2822).
  const dataThemePack = resolveThemePackSsrSlug(
    ctx.themePackRegistry,
    ctx.settings as { themePack?: string },
  );

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

    // Latest docs href — points to the configured entry-doc slug (default
    // "getting-started", settings.entryDocSlug, #3216). A defaultLocaleOnly
    // entry slug (settings.defaultLocaleOnlyPrefixes) has no non-default-locale
    // route, so the locale prefix must be dropped even on a non-default-locale
    // surface — mirrors docsUrl/navHref (#2569).
    const entryDocSlug = settings.entryDocSlug ?? "getting-started";
    const entryDocPath = `/docs/${entryDocSlug}`;
    const entryDocPrefix = isDefaultLocaleOnlyPath(entryDocPath) ? "" : prefix;
    const latestHref = withBase(`${entryDocPrefix}${entryDocPath}`);

    // Past version entries from settings
    const versions: VersionPageEntry[] = settings.versions
      ? settings.versions.map((v) => ({
          slug: v.slug,
          label: v.label ?? v.slug,
          // Version prefix comes BEFORE the locale — the only routed shape is
          // pages/v/[version]/{locale}/docs/...; /{locale}/v/... has no route.
          docsHref: withBase(`/v/${v.slug}${entryDocPrefix}/docs/${entryDocSlug}/`),
          banner: v.banner as "unmaintained" | "unreleased" | undefined,
        }))
      : [];

    return (
      <DocLayoutWithDefaults
        title={composeMetaTitle(pageTitle)}
        head={<HeadWithDefaults title={pageTitle} />}
        lang={locale}
        dataThemePack={dataThemePack}
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
