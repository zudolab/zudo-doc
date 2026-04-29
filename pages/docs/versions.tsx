/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/docs/versions.astro → zfb page module.
//
// Default-locale (EN) documentation versions page. Static route — no
// paths() export needed. Lists the latest version and any past versions
// configured in settings.versions.
//
// Data flow:
//   settings.versions          → build version entry list
//   t() for locale strings     → labels bag passed to VersionsPageContent

import { settings } from "@/config/settings";
import { defaultLocale, t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { VersionsPageContent } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { VersionPageEntry, VersionsPageLabels } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";
import { FooterWithDefaults } from "../lib/_footer-with-defaults";

export const frontmatter = { title: "Versions" };

export default function VersionsPage(): JSX.Element {
  const locale = defaultLocale;
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
  const latestHref = withBase("/docs/getting-started");

  // Past version entries from settings
  const versions: VersionPageEntry[] = settings.versions
    ? settings.versions.map((v) => ({
        slug: v.slug,
        label: v.label ?? v.slug,
        docsHref: withBase(`/v/${v.slug}/docs`),
        banner: v.banner as "unmaintained" | "unreleased" | undefined,
      }))
    : [];

  return (
    <DocLayoutWithDefaults
      title={pageTitle}
      lang={locale}
      hideSidebar={true}
      hideToc={true}
      footerOverride={<FooterWithDefaults lang={locale} />}
    >
      <VersionsPageContent
        latestHref={latestHref}
        versions={versions}
        labels={labels}
      />
    </DocLayoutWithDefaults>
  );
}
