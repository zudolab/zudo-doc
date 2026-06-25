/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// inline-version-switcher — factory for the breadcrumb inline version-switcher
// pill (epic #2344, S8).
//
// The host's `pages/lib/_inline-version-switcher.tsx` previously imported host
// singletons (`@/config/settings`, `@/config/i18n`, `@/utils/base`) directly.
// This factory receives those as injected dependencies so the logic lives in
// the package while the host stub keeps the singleton imports.

import type { JSX } from "preact";
import {
  VersionSwitcher,
  type VersionSwitcherLabels,
} from "../i18n-version/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal version config entry needed by the inline version switcher. */
export interface InlineVersionSwitcherVersionEntry {
  slug: string;
  label?: string;
}

/** Settings subset read by the inline version switcher factory. */
export interface InlineVersionSwitcherSettings {
  versions: InlineVersionSwitcherVersionEntry[] | false;
}

/** Injected dependencies for {@link createInlineVersionSwitcher}. */
export interface InlineVersionSwitcherDeps {
  settings: InlineVersionSwitcherSettings;
  /** Default locale code (e.g. `"en"`). */
  defaultLocale: string;
  /** Translate a UI string key for a locale. */
  t: (key: string, locale: string) => string;
  /** Build a docs URL for the given slug and lang. */
  docsUrl: (slug: string, lang?: string) => string;
  /** Build a versioned docs URL for the given slug, version, and lang. */
  versionedDocsUrl: (slug: string, versionSlug: string, lang?: string) => string;
  /** Prefix a path with the configured base directory. */
  withBase: (path: string) => string;
}

/**
 * Build the `buildInlineVersionSwitcher` function bound to the host's settings
 * and dependencies.
 */
export function createInlineVersionSwitcher(deps: InlineVersionSwitcherDeps): (
  slug: string,
  locale: string,
  currentVersion?: string,
) => JSX.Element | undefined {
  const { settings, defaultLocale, t, docsUrl, versionedDocsUrl, withBase } = deps;

  /**
   * Build an inline VersionSwitcher element for the `<Breadcrumb rightSlot>` prop.
   *
   * Returns `undefined` when versioning is not configured (callers can pass
   * the return value directly as `rightSlot` — `<Breadcrumb>` renders the
   * plain nav (no flex wrapper, no version pill) when `rightSlot` is
   * `undefined`).
   *
   * @param slug           - Slug of the current doc page (used to build per-version URLs).
   * @param locale         - Active locale string.
   * @param currentVersion - Active version slug, or `undefined` on the "latest" route.
   */
  function buildInlineVersionSwitcher(
    slug: string,
    locale: string,
    currentVersion?: string,
  ): JSX.Element | undefined {
    if (!settings.versions || settings.versions.length === 0) return undefined;

    const isNonDefaultLocale = locale !== defaultLocale;
    const versionsPageUrl = withBase(
      isNonDefaultLocale ? `/${locale}/docs/versions` : "/docs/versions",
    );
    // The docs root index has the canonical empty slug "" (#1891), and
    // docsUrl("")/versionedDocsUrl("") resolve to the per-version docs roots —
    // so an empty slug must NOT fall back to the versions page.
    const latestUrl = docsUrl(slug, locale);

    const versionUrls: Record<string, string> = {};
    for (const v of settings.versions) {
      versionUrls[v.slug] = versionedDocsUrl(slug, v.slug, locale);
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

  return buildInlineVersionSwitcher;
}
