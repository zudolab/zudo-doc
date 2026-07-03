// url-helpers — `makeUrlHelpers(settings, i18n)`: the base.ts URL logic,
// parameterized into a package-pure constructor (epic #2344, S1a).
//
// The host's `src/utils/base.ts` read the project's `settings` and `@/config/i18n`
// singletons at module scope (`normalizedBase = settings.base…` eager). That
// coupling is exactly what the package-first migration removes: this constructor
// takes the settings fields and the i18n surface as ARGUMENTS and returns the
// same helper set, so the logic moves into the package while the host stub keeps
// the singleton import. Pure functions, node-builtin-free — safe in the config
// eval graph and in client islands.

import type { Settings } from "../settings.js";
import type { FactoryI18n } from "../factory-context/index.js";

/** Represents a locale switcher link (mirrors the host `LocaleLink`). */
export interface LocaleLink {
  code: string;
  label: string;
  href: string;
  active: boolean;
}

/** The settings fields the URL helpers read. */
export type UrlHelperSettings = Pick<
  Settings,
  "base" | "trailingSlash" | "siteUrl" | "defaultLocaleOnlyPrefixes"
>;

/** The full set of URL helpers built from `(settings, i18n)`. */
export interface UrlHelpers {
  /** Normalized base path with no trailing slash (empty string when "/"). */
  normalizedBase: string;
  applyTrailingSlash(url: string): string;
  withBase(path: string): string;
  stripBase(path: string): string;
  absoluteUrl(pageUrl: string): string | undefined;
  docsUrl(slug: string, lang?: string): string;
  isExternal(href: string): boolean;
  resolveHref(href: string): string;
  navHref(
    path: string,
    lang: string | undefined,
    currentVersion: string | undefined,
  ): string;
  getPathForLocale(path: string, currentLang: string, targetLang: string): string;
  buildLocaleLinks(currentPath: string, currentLang: string): LocaleLink[];
  isDefaultLocaleOnlyPath(path: string): boolean;
  versionedDocsUrl(slug: string, versionSlug: string, lang?: string): string;
}

/**
 * Build the URL helper set from the host's settings + i18n surface.
 *
 * Equivalent to the legacy `src/utils/base.ts` module functions, but with the
 * project singletons injected rather than imported — so the same logic ships
 * from the package. The host stub calls this once with its concrete settings and
 * i18n and re-exports the result.
 */
export function makeUrlHelpers(
  settings: UrlHelperSettings,
  i18n: FactoryI18n,
): UrlHelpers {
  const { defaultLocale, locales, getLocaleLabel } = i18n;

  /** Normalized base path with no trailing slash (empty string when "/"). */
  const normalizedBase = settings.base.replace(/\/+$/, "");

  /**
   * Append a trailing slash to page URLs when `settings.trailingSlash` is true.
   * Skips paths that already end with `/`, contain a file extension, or have a
   * query string / fragment before the slash would be inserted.
   */
  function applyTrailingSlash(url: string): string {
    if (!settings.trailingSlash) return url;
    if (url.endsWith("/")) return url;
    // Split off query string and fragment
    const suffixIdx = url.search(/[?#]/);
    const pathPart = suffixIdx >= 0 ? url.slice(0, suffixIdx) : url;
    const suffix = suffixIdx >= 0 ? url.slice(suffixIdx) : "";
    if (pathPart.endsWith("/")) return url;
    // Check file extension on the last path segment only, requiring the extension
    // to start with a letter to avoid false positives on version-like paths (e.g. /docs/v2.0)
    const lastSegment = pathPart.split("/").pop() ?? "";
    if (/\.[a-zA-Z]\w*$/.test(lastSegment)) return url;
    return pathPart + "/" + suffix;
  }

  /** Prefix a path with the configured base directory. */
  function withBase(path: string): string {
    const raw =
      normalizedBase === ""
        ? path
        : `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
    return applyTrailingSlash(raw);
  }

  /** Strip the base prefix from a URL pathname. */
  function stripBase(path: string): string {
    if (normalizedBase === "") return path;
    // Require a segment boundary so base "/app" doesn't strip "/application/...".
    if (path === normalizedBase) return "/";
    return path.startsWith(`${normalizedBase}/`)
      ? path.slice(normalizedBase.length)
      : path;
  }

  /**
   * Build an absolute URL by joining `settings.siteUrl` (trailing slash stripped)
   * with a base-prefixed page path. Returns `undefined` when `siteUrl` is unset
   * (e.g. a freshly scaffolded project), so callers can skip emitting a useless
   * relative canonical / og:image.
   */
  function absoluteUrl(pageUrl: string): string | undefined {
    return settings.siteUrl ? settings.siteUrl.replace(/\/$/, "") + pageUrl : undefined;
  }

  /** Build a docs URL for the given slug and lang. */
  function docsUrl(slug: string, lang: string = defaultLocale): string {
    const defaultPath = `/docs/${slug}`;
    // defaultLocaleOnly docs (settings.defaultLocaleOnlyPrefixes, epic #1592) ship
    // ONLY default-locale routes, so a non-default locale must still resolve into the
    // default-locale URL space — a `/${lang}/docs/...` href would 404 (#2569).
    const path =
      lang === defaultLocale || isDefaultLocaleOnlyPath(defaultPath)
        ? defaultPath
        : `/${lang}/docs/${slug}`;
    return withBase(path);
  }

  /** Check if a URL is external (starts with http:// or https://). */
  function isExternal(href: string): boolean {
    return href.startsWith("http://") || href.startsWith("https://");
  }

  /** Resolve a href: external URLs pass through, internal ones get the base prefix. */
  function resolveHref(href: string): string {
    return isExternal(href) ? href : withBase(href);
  }

  /**
   * Build a localized, versioned nav href.
   * Uses /v/{version}/{lang}/... ordering — the only shape the routing layer
   * serves (pages/v/[version]/ja/docs/...), matching versionedDocsUrl().
   * The /{lang}/v/{version}/... ordering has no route and 404s.
   */
  function navHref(
    path: string,
    lang: string | undefined,
    currentVersion: string | undefined,
  ): string {
    // A defaultLocaleOnly path (settings.defaultLocaleOnlyPrefixes, #1592/#2569)
    // has no non-default-locale route, so keep it in the default-locale URL space
    // even on a non-default-locale surface. The version prefix is applied
    // separately below, so this preserves `/v/{version}/docs/...`
    // (isDefaultLocaleOnlyPath matches the plain `/docs/` shape only).
    const isNonDefaultLocale =
      lang != null && lang !== defaultLocale && !isDefaultLocaleOnlyPath(path);
    const versionPrefix = currentVersion ? `/v/${currentVersion}` : "";
    return withBase(
      isNonDefaultLocale
        ? `${versionPrefix}/${lang}${path}`
        : `${versionPrefix}${path}`,
    );
  }

  /**
   * Split a leading /v/{version} prefix off a base-stripped path.
   * Versioned routes nest the locale AFTER the version (/v/1.0/ja/docs/...),
   * so locale stripping/prefixing must operate on the remainder only.
   */
  function splitVersionPrefix(path: string): { versionPrefix: string; rest: string } {
    const m = path.match(/^(\/v\/[^/]+)(\/.*|$)/);
    return m ? { versionPrefix: m[1] ?? "", rest: m[2] ?? "/" } : { versionPrefix: "", rest: path };
  }

  /** Build a locale-switched path from the current page path. */
  function getPathForLocale(
    path: string,
    currentLang: string,
    targetLang: string,
  ): string {
    const { versionPrefix, rest } = splitVersionPrefix(stripBase(path));
    let relativePath = rest;
    if (currentLang !== defaultLocale) {
      relativePath = relativePath.replace(new RegExp(`^/${currentLang}(?:/|$)`), "/");
    }
    if (targetLang !== defaultLocale) {
      relativePath = `/${targetLang}${relativePath}`;
    }
    return withBase(`${versionPrefix}${relativePath}`);
  }

  /**
   * Returns true when the given default-locale-shaped path falls under one of
   * the configured `defaultLocaleOnlyPrefixes`. Callers that work with
   * locale-prefixed paths (e.g. `/ja/docs/...`) are responsible for stripping
   * the locale segment before calling this function. The path is normalized to
   * end with `/` before the comparison so the helper is robust to projects that
   * disable `settings.trailingSlash` (where `docsUrl` returns slashless paths).
   */
  function isDefaultLocaleOnlyPath(path: string): boolean {
    const stripped = stripBase(path);
    const normalized = stripped.endsWith("/") ? stripped : `${stripped}/`;
    return settings.defaultLocaleOnlyPrefixes.some((prefix) => normalized.startsWith(prefix));
  }

  /** Build locale links for locale switcher UI components. */
  function buildLocaleLinks(currentPath: string, currentLang: string): LocaleLink[] {
    let defaultLocalePath = splitVersionPrefix(stripBase(currentPath)).rest;
    if (currentLang !== defaultLocale) {
      defaultLocalePath = defaultLocalePath.replace(new RegExp(`^/${currentLang}(?:/|$)`), "/");
    }
    if (isDefaultLocaleOnlyPath(defaultLocalePath)) {
      return [{
        code: currentLang,
        label: getLocaleLabel(currentLang),
        href: getPathForLocale(currentPath, currentLang, currentLang),
        active: true,
      }];
    }
    return locales.map((code) => ({
      code,
      label: getLocaleLabel(code),
      href: getPathForLocale(currentPath, currentLang, code),
      active: code === currentLang,
    }));
  }

  /** Build a versioned docs URL for the given slug, version, and lang. */
  function versionedDocsUrl(slug: string, versionSlug: string, lang: string = defaultLocale): string {
    const path = lang === defaultLocale
      ? `/v/${versionSlug}/docs/${slug}`
      : `/v/${versionSlug}/${lang}/docs/${slug}`;
    return withBase(path);
  }

  return {
    normalizedBase,
    applyTrailingSlash,
    withBase,
    stripBase,
    absoluteUrl,
    docsUrl,
    isExternal,
    resolveHref,
    navHref,
    getPathForLocale,
    buildLocaleLinks,
    isDefaultLocaleOnlyPath,
    versionedDocsUrl,
  };
}
