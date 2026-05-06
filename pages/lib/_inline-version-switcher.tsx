/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Inline VersionSwitcher for the afterBreadcrumb slot on doc pages.
//
// The reference site (takazudomodular.com) renders a
// <div class="version-switcher relative" data-version-switcher> block
// inside <main> immediately after the breadcrumb on every doc page
// (Wave 2 parity sweep, zudolab/zudo-doc#1478). The header already
// shows a VersionSwitcher via _header-with-defaults.tsx; this helper
// provides the same component for the `afterBreadcrumb` slot so the
// DOM position matches the reference.
//
// Gate: only returns a non-null element when settings.versions is a
// non-empty array. When versioning is disabled the caller gets undefined
// and DocLayoutWithDefaults renders nothing in the slot.

import type { JSX } from "preact";
import {
  VersionSwitcher,
  type VersionSwitcherLabels,
} from "@zudo-doc/zudo-doc-v2/i18n-version";
import { settings } from "@/config/settings";
import { defaultLocale, t, type Locale } from "@/config/i18n";
import { docsUrl, versionedDocsUrl, withBase } from "@/utils/base";

/**
 * Build an inline VersionSwitcher element for the `afterBreadcrumb` slot.
 *
 * Returns `undefined` when versioning is not configured (callers can pass
 * the return value directly as `afterBreadcrumb` — DocLayoutWithDefaults
 * renders nothing for `undefined`).
 *
 * @param slug       - Slug of the current doc page (used to build per-version URLs).
 * @param locale     - Active locale string.
 * @param currentVersion - Active version slug, or `undefined` on the "latest" route.
 */
export function buildInlineVersionSwitcher(
  slug: string,
  locale: Locale,
  currentVersion?: string,
): JSX.Element | undefined {
  if (!settings.versions || settings.versions.length === 0) return undefined;

  const isNonDefaultLocale = locale !== defaultLocale;
  const versionsPageUrl = withBase(
    isNonDefaultLocale ? `/${locale}/docs/versions` : "/docs/versions",
  );
  const latestUrl = slug ? docsUrl(slug, locale) : versionsPageUrl;

  const versionUrls: Record<string, string> = {};
  for (const v of settings.versions) {
    versionUrls[v.slug] = slug
      ? versionedDocsUrl(slug, v.slug, locale)
      : versionsPageUrl;
  }

  const labels: VersionSwitcherLabels = {
    latest: t("version.latest", locale),
    switcher: t("version.switcher.label", locale),
    unavailable: t("version.switcher.unavailable", locale),
    allVersions: t("version.switcher.allVersions", locale),
  };

  return (
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
      idSuffix="inline"
    />
  );
}
