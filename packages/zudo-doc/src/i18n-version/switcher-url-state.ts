// Pure URL helpers shared by server callers and frozen browser script generation.
/**
 * The minimal project config the client re-wire needs to reproduce
 * `getPathForLocale`'s output from the live pathname. Emitted as `data-*`
 * attributes on the switcher container so {@link LANGUAGE_SWITCHER_INIT_SCRIPT}
 * can read it without any serialized props.
 */
export interface LanguageSwitcherConfig {
  /** Normalized site base with no trailing slash (`""` for a root site). */
  base: string;
  /** The project's default locale (rendered without a locale prefix). */
  defaultLocale: string;
  /** Whether the project appends trailing slashes to page URLs. */
  trailingSlash: boolean;
}

/**
 * Client-side re-computation of a locale-switched href from the *current*
 * pathname. This is a self-contained port of `getPathForLocale` (+ its
 * `stripBase` / version-prefix split / `withBase` / `applyTrailingSlash`
 * dependencies) from `url-helpers`. It MUST stay behaviourally identical to
 * that function — pinned by the drift-guard test in
 * `__tests__/language-switcher.test.tsx`, which asserts equality against the
 * real `buildLocaleLinks` output across a case table.
 *
 * It is deliberately self-contained (no references to module-scope helpers)
 * because {@link LANGUAGE_SWITCHER_INIT_SCRIPT} embeds it verbatim via
 * package-build serialization, so it must be valid as a standalone function
 * in the browser. Downstream builds consume a frozen script string.
 */
export function switchLocaleHref(
  pathname: string,
  config: LanguageSwitcherConfig,
  currentLang: string,
  targetLang: string,
): string {
  const normalizedBase = config.base;
  const defaultLocale = config.defaultLocale;
  const trailingSlash = config.trailingSlash;

  const stripBase = (path: string): string => {
    if (normalizedBase === "") return path;
    if (path === normalizedBase) return "/";
    return path.indexOf(normalizedBase + "/") === 0
      ? path.slice(normalizedBase.length)
      : path;
  };

  const applyTrailingSlash = (url: string): string => {
    if (!trailingSlash) return url;
    if (url.charAt(url.length - 1) === "/") return url;
    const suffixIdx = url.search(/[?#]/);
    const pathPart = suffixIdx >= 0 ? url.slice(0, suffixIdx) : url;
    const suffix = suffixIdx >= 0 ? url.slice(suffixIdx) : "";
    if (pathPart.charAt(pathPart.length - 1) === "/") return url;
    const segments = pathPart.split("/");
    const lastSegment = segments[segments.length - 1] || "";
    if (/\.[a-zA-Z]\w*$/.test(lastSegment)) return url;
    return pathPart + "/" + suffix;
  };

  const withBase = (path: string): string => {
    const raw =
      normalizedBase === ""
        ? path
        : normalizedBase + (path.charAt(0) === "/" ? path : "/" + path);
    return applyTrailingSlash(raw);
  };

  const stripped = stripBase(pathname);
  const versionMatch = stripped.match(/^(\/v\/[^/]+)(\/.*|$)/);
  const versionPrefix = versionMatch ? versionMatch[1] || "" : "";
  let relativePath = versionMatch ? versionMatch[2] || "/" : stripped;
  if (currentLang !== defaultLocale) {
    relativePath = relativePath.replace(
      new RegExp("^/" + currentLang + "(?:/|$)"),
      "/",
    );
  }
  if (targetLang !== defaultLocale) {
    relativePath = "/" + targetLang + relativePath;
  }
  return withBase(versionPrefix + relativePath);
}

/**
 * The minimal project config the client re-wire needs to reproduce the header
 * factory's per-page menu URLs from the live pathname. Emitted as `data-*`
 * attributes on the switcher container so {@link VERSION_SWITCHER_REWIRE_SCRIPT}
 * can read it without any serialized props.
 */
export interface VersionSwitcherRewireConfig {
  /** Normalized site base with no trailing slash (`""` for a root site). */
  base: string;
  /** The project's default locale (rendered without a locale prefix). */
  defaultLocale: string;
  /** Whether the project appends trailing slashes to page URLs. */
  trailingSlash: boolean;
  /**
   * The active locale code — constant within a `header-${lang}` persist window,
   * so it can be read once from the SSR container rather than re-derived.
   */
  currentLocale: string;
}

/** The re-computed per-page menu state {@link computeVersionSwitcherState} returns. */
export interface VersionSwitcherState {
  /** Href for the "Latest" entry, matching the SSR `latestUrl`. */
  latestHref: string;
  /** version slug → href for that version of the current page (SSR `versionUrls`). */
  versionHrefs: Record<string, string>;
  /** Active version slug, or `null` when the current page is on "latest". */
  activeVersion: string | null;
}

/**
 * Client-side re-computation of the version-switcher's per-page menu state from
 * the *current* pathname. This is a self-contained port of the header factory's
 * URL logic (`createHeaderWithDefaults`'s `latestUrl` / `versionUrls` block, in
 * turn `docsUrl` / `versionedDocsUrl` / `withBase` from `url-helpers`). It MUST
 * stay behaviourally identical to that SSR path — pinned by the drift-guard test
 * in `__tests__/version-switcher.test.tsx`, which asserts equality against the
 * real `makeUrlHelpers` output across a case table.
 *
 * It is deliberately self-contained (no references to module-scope helpers)
 * because {@link VERSION_SWITCHER_REWIRE_SCRIPT} embeds it verbatim via
 * package-build serialization, so it must be valid as a standalone function
 * in the browser. Downstream builds consume a frozen script string.
 *
 * The `/docs/versions` listing is a standalone package route (`currentSlug`
 * `undefined` on the SSR side), so — like the SSR factory — every menu href
 * there collapses to `versionsPageUrl`; the exact-path check below mirrors that.
 */
export function computeVersionSwitcherState(
  pathname: string,
  config: VersionSwitcherRewireConfig,
  versionSlugs: string[],
): VersionSwitcherState {
  const normalizedBase = config.base;
  const defaultLocale = config.defaultLocale;
  const currentLocale = config.currentLocale;
  const trailingSlash = config.trailingSlash;

  const stripBase = (path: string): string => {
    if (normalizedBase === "") return path;
    if (path === normalizedBase) return "/";
    return path.indexOf(normalizedBase + "/") === 0
      ? path.slice(normalizedBase.length)
      : path;
  };

  const applyTrailingSlash = (url: string): string => {
    if (!trailingSlash) return url;
    if (url.charAt(url.length - 1) === "/") return url;
    const suffixIdx = url.search(/[?#]/);
    const pathPart = suffixIdx >= 0 ? url.slice(0, suffixIdx) : url;
    const suffix = suffixIdx >= 0 ? url.slice(suffixIdx) : "";
    if (pathPart.charAt(pathPart.length - 1) === "/") return url;
    const segments = pathPart.split("/");
    const lastSegment = segments[segments.length - 1] || "";
    if (/\.[a-zA-Z]\w*$/.test(lastSegment)) return url;
    return pathPart + "/" + suffix;
  };

  const withBase = (path: string): string => {
    const raw =
      normalizedBase === ""
        ? path
        : normalizedBase + (path.charAt(0) === "/" ? path : "/" + path);
    return applyTrailingSlash(raw);
  };

  const versionsPageUrl = withBase(
    currentLocale === defaultLocale
      ? "/docs/versions"
      : "/" + currentLocale + "/docs/versions",
  );

  const stripped = stripBase(pathname);
  const versionMatch = stripped.match(/^\/v\/([^/]+)(\/.*|$)/);
  const rest = versionMatch ? versionMatch[2] || "/" : stripped;

  let localeStripped = rest;
  if (currentLocale !== defaultLocale) {
    localeStripped = rest.replace(
      new RegExp("^/" + currentLocale + "(?:/|$)"),
      "/",
    );
  }
  // A page carries a `currentSlug` (and thus per-page menu URLs) iff it is one
  // of the doc-collection catch-all routes — every `/docs/...` path EXCEPT the
  // standalone `/docs/versions` listing, which has no `currentSlug`.
  const isVersionsIndex =
    localeStripped === "/docs/versions" || localeStripped === "/docs/versions/";
  const isDocPage = /^\/docs(\/|$)/.test(localeStripped) && !isVersionsIndex;
  const activeVersion = isDocPage && versionMatch ? versionMatch[1] || null : null;

  const versionHrefs: Record<string, string> = {};
  let latestHref: string;
  if (isDocPage) {
    latestHref = withBase(rest);
    for (let i = 0; i < versionSlugs.length; i++) {
      const slug = versionSlugs[i];
      if (slug) versionHrefs[slug] = withBase("/v/" + slug + rest);
    }
  } else {
    latestHref = versionsPageUrl;
    for (let i = 0; i < versionSlugs.length; i++) {
      const slug = versionSlugs[i];
      if (slug) versionHrefs[slug] = versionsPageUrl;
    }
  }

  return { latestHref, versionHrefs, activeVersion };
}

