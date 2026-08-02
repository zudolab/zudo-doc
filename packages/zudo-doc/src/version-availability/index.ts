// version-availability — shared getUnavailableVersions(slug, locale) builder
// (epic #3214 Wave 1, #3215).
//
// Both version-switcher callers (the inline breadcrumb pill in
// inline-version-switcher/index.tsx, and the header dropdown in
// header-with-defaults/index.tsx) need the same per-page availability check:
// for the current slug, which of `settings.versions` DON'T contain that slug
// in their per-(locale, version) nav source. Factored out once — wired at
// both derive sites from `chrome/derive.tsx` — so neither caller re-derives
// the recipe and the locale+version cache-key trap below is fixed in exactly
// one place.

/** Structural subset of a `NavSourceDocs` entry this module reads. */
export interface VersionAvailabilityDocEntry {
  slug: string;
  data: { slug?: string };
}

/** Injected dependencies for {@link createGetUnavailableVersions}. */
export interface VersionAvailabilityDeps {
  /** Configured versions to check availability for (`false` / empty ⇒ no-op). */
  versions: Array<{ slug: string }> | false;
  /**
   * Identity-stable nav-source resolver (`resolveNavSource` from
   * `nav-source-docs`) — already memoized per (locale, version, options), so
   * a cache miss in {@link createGetUnavailableVersions} is cheap.
   */
  resolveNavSource: (
    locale: string,
    versionSlug: string,
    options?: { keepUnlisted?: boolean },
  ) => { docs: VersionAvailabilityDocEntry[] };
  /** Canonical route slug for a zfb content slug — injected, not ambient. */
  toRouteSlug: (entrySlug: string) => string;
}

/**
 * Build `getUnavailableVersions(slug, locale)`, bound to the injected deps.
 *
 * Returns `undefined` when there is no current slug to test (e.g. a
 * no-current-slug header render on the home page) or when versioning is not
 * configured — NEVER mark every archive unavailable just because there is no
 * page to test against.
 *
 * Each version's available-slug Set is cached here keyed by BOTH locale and
 * version (`${locale}\n${versionSlug}`) — a version-slug-only key would be
 * wrong, because a versioned locale merge differs per language.
 */
export function createGetUnavailableVersions(
  deps: VersionAvailabilityDeps,
): (slug: string | undefined, locale: string) => ReadonlySet<string> | undefined {
  const availableSlugCache = new Map<string, ReadonlySet<string>>();

  function getAvailableSlugs(locale: string, versionSlug: string): ReadonlySet<string> {
    const key = `${locale}\n${versionSlug}`;
    const cached = availableSlugCache.get(key);
    if (cached) return cached;
    const { docs } = deps.resolveNavSource(locale, versionSlug, { keepUnlisted: true });
    const slugs = new Set(docs.map((d) => d.data.slug ?? deps.toRouteSlug(d.slug)));
    availableSlugCache.set(key, slugs);
    return slugs;
  }

  return function getUnavailableVersions(
    slug: string | undefined,
    locale: string,
  ): ReadonlySet<string> | undefined {
    if (slug === undefined) return undefined;
    if (!deps.versions || deps.versions.length === 0) return undefined;

    const unavailable = new Set<string>();
    for (const v of deps.versions) {
      if (!getAvailableSlugs(locale, v.slug).has(slug)) {
        unavailable.add(v.slug);
      }
    }
    return unavailable;
  };
}
