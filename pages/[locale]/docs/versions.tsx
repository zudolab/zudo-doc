/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Port of src/pages/[locale]/docs/versions.astro → zfb page module.
//
// Non-default-locale versions page. paths() emits one route per locale in
// settings.locales. Locale string is passed as a prop to drive label
// translation in the component.
//
// paths() contract (zfb ADR-004 — synchronous):
//   params: { locale: string }
//   props:  { locale }

import { settings } from "@/config/settings";
import { t } from "@/config/i18n";
import { withBase } from "@/utils/base";
import { DocLayoutWithDefaults } from "@zudo-doc/zudo-doc-v2/doclayout";
import { VersionsPageContent } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { VersionPageEntry, VersionsPageLabels } from "@zudo-doc/zudo-doc-v2/nav-indexing";
import type { JSX } from "preact";

export const frontmatter = { title: "Versions" };

// ---------------------------------------------------------------------------
// paths() — synchronous (ADR-004)
// ---------------------------------------------------------------------------

/** One route per non-default locale. */
export function paths(): Array<{
  params: { locale: string };
  props: { locale: string };
}> {
  return Object.keys(settings.locales).map((locale) => ({
    params: { locale },
    props: { locale },
  }));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface PageArgs {
  params: { locale: string };
  props: { locale: string };
}

export default function LocaleVersionsPage({ params }: PageArgs): JSX.Element {
  const locale = params.locale;
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

  const latestHref = withBase(`/${locale}/docs/getting-started`);

  const versions: VersionPageEntry[] = settings.versions
    ? settings.versions.map((v) => ({
        slug: v.slug,
        label: v.label ?? v.slug,
        docsHref: withBase(`/${locale}/v/${v.slug}/docs`),
        banner: v.banner as "unmaintained" | "unreleased" | undefined,
      }))
    : [];

  return (
    <DocLayoutWithDefaults
      title={pageTitle}
      lang={locale}
      hideSidebar={true}
      hideToc={true}
    >
      <VersionsPageContent
        latestHref={latestHref}
        versions={versions}
        labels={labels}
      />
    </DocLayoutWithDefaults>
  );
}
