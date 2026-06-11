/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Shared renderer for the documentation-versions pages (#2010).
//
// Collapses the per-locale page pair:
//   pages/docs/versions.tsx + pages/[locale]/docs/versions.tsx
// into one locale-parameterized renderer. The page files stay thin shells
// that own only their paths() param shapes; URL prefixes and the
// default-vs-locale href shapes live here.

import { settings } from "@/config/settings";
import { defaultLocale, t, type Locale } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { DocLayoutWithDefaults } from "@takazudo/zudo-doc/doclayout";
import { VersionsPageContent } from "@takazudo/zudo-doc/nav-indexing";
import type { VersionPageEntry, VersionsPageLabels } from "@takazudo/zudo-doc/nav-indexing";
import type { JSX } from "preact";
import { FooterWithDefaults } from "./_footer-with-defaults";
import { HeaderWithDefaults } from "./_header-with-defaults";
import { HeadWithDefaults } from "./_head-with-defaults";
import { composeMetaTitle } from "./_compose-meta-title";
import { BodyEndIslands } from "./_body-end-islands";

/** Versions index page for one locale. Lists the latest version and any past
 *  versions configured in settings.versions. */
export function VersionsPageView({ locale }: { locale: string }): JSX.Element {
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
      headerOverride={<HeaderWithDefaults lang={locale as Locale} currentPath={withBase(`${prefix}/docs/versions`)} />}
      footerOverride={<FooterWithDefaults lang={locale} />}
      bodyEndComponents={<BodyEndIslands basePath={settings.base ?? "/"} />}
    >
      <VersionsPageContent
        latestHref={latestHref}
        versions={versions}
        labels={labels}
      />
    </DocLayoutWithDefaults>
  );
}
