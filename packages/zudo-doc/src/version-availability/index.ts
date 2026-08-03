// version-availability — shared getUnavailableVersions(slug, locale) builder
// (epic #3214 Wave 1, #3215).
//
// Both version-switcher callers (the inline breadcrumb pill in
// inline-version-switcher/index.tsx, and the header dropdown in
// header-with-defaults/index.tsx) need the same per-page availability check:
// for the current slug, which of `settings.versions` DON'T contain that slug
// in their per-(locale, version) nav source. Factored out once — wired at
// both derive sites from `chrome/derive.tsx` — so neither caller re-derives
// the recipe and the traps below are fixed in exactly one place.
//
// The available-slug set for a (locale, version) pair MUST match the routes
// that pageroute generation actually emits (`route-enumerators`'
// `enumerateVersionedRoutes` / `doc-route-entries`' `buildDocRouteEntries`
// use the identical recipe), or availability drifts from reality in two
// directions:
//   - A `category_no_page` doc entry carries category metadata only —
//     `buildDocRouteEntries` deliberately emits NO route for it, so it must
//     be excluded here too (otherwise a real 404 could be reported
//     "available").
//   - An auto-generated category-index page (a directory with children but
//     no `index.mdx` of its own) IS a real, paths()-enumerated route with NO
//     corresponding docs entry — omitting it would mark every archive
//     unavailable for a category-index slug that genuinely exists in all of
//     them.
// `applyDefaultLocaleOnlyFilter: true` is likewise required for non-default
// locales — the same option `resolveVersionedLocaleSource` callers pass at
// the real versioned-locale route (`v-locale-docs-slug.tsx`) — otherwise a
// default-locale-only path can be reported available in a locale whose
// archived route was never generated.
//
// --- Client payload contract (epic #3242, #3243) ----------------------
//
// `serializeUnavailableVersions` below encodes a `getUnavailableVersions()`
// result as a `data-*` attribute so the value survives into the swapped
// document and a later SPA-navigation rewire script (#3244) can read it
// without re-deriving availability client-side. Emitted by
// `doc-page-shell/index.tsx` onto the `<article>` element (swapped content —
// NOT the persisted header, whose whole problem is that a swap leaves it
// untouched). Cross-file contract — do not rename `UNAVAILABLE_VERSIONS_ATTR`
// or change the format without updating every consumer.
//
//   attribute name:  data-doc-unavailable-versions
//   absent           → no availability data for this page (mirrors
//                      `getUnavailableVersions` returning `undefined`: no
//                      current slug, or versioning not configured). A
//                      consumer MUST treat this as "nothing to rewire" —
//                      never as "everything available" — since defaulting
//                      an unknown page to "everything available" is exactly
//                      the silent-404 failure mode #3215/#3242 exist to fix.
//   value === ""     → the set is empty: this slug is available in every
//                      configured version.
//   value === "a,b"  → comma-joined, alphabetically SORTED version slugs
//                      (sorted so the serialization is deterministic
//                      regardless of `Set` iteration / `settings.versions`
//                      order — needed for the byte-equal assertions in
//                      `__tests__/version-availability.test.ts`).
//
// CONSTRAINT: a configured version slug must never contain a comma — enforced
// at `zudoDoc()` (`../config.ts`), the single validated config entry, which
// throws a `TypeError` naming the offending slug. That constraint is what
// makes the flat comma-joined list below safe/unambiguous; it was chosen over
// re-encoding as JSON-in-attribute per the epic's locked decision (simplicity
// over a theoretical slug shape nothing else in the codebase supports;
// #3244 codex review finding 2).

import type { DocPageEntry, DocNavNode } from "../doc-page-props/index.js";
import type { CategoryMeta } from "../sidebar-tree/index.js";

/** Structural subset of `NavSourceDocs` this module reads. */
export interface VersionAvailabilityNavSource {
  docs: DocPageEntry[];
  navDocs: DocPageEntry[];
  categoryMeta: Map<string, CategoryMeta>;
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
    options?: { applyDefaultLocaleOnlyFilter?: boolean; keepUnlisted?: boolean },
  ) => VersionAvailabilityNavSource;
  /** Canonical route slug for a zfb content slug — injected, not ambient. */
  toRouteSlug: (entrySlug: string) => string;
  /**
   * Nav-tree builder, already bound to a href builder by the caller (hrefs
   * are irrelevant here — the tree is only walked to discover auto-index
   * nodes via {@link VersionAvailabilityDeps.collectAutoIndexNodes}).
   */
  buildNavTree: (
    docs: DocPageEntry[],
    locale: string,
    categoryMeta: Map<string, CategoryMeta>,
  ) => DocNavNode[];
  /** Category nodes with children but no page of their own — real routes
   *  with no corresponding docs entry (see module header). */
  collectAutoIndexNodes: (tree: DocNavNode[]) => DocNavNode[];
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

    const { docs, navDocs, categoryMeta } = deps.resolveNavSource(locale, versionSlug, {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });

    const slugs = new Set<string>();
    for (const d of docs) {
      // A `category_no_page` entry carries category metadata only —
      // buildDocRouteEntries emits no route for it (mirrored here).
      if (d.data.category_no_page === true) continue;
      slugs.add(d.data.slug ?? deps.toRouteSlug(d.slug));
    }
    // Auto-generated category-index routes have no docs entry of their own.
    const tree = deps.buildNavTree(navDocs, locale, categoryMeta);
    for (const node of deps.collectAutoIndexNodes(tree)) {
      slugs.add(node.slug);
    }

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

/**
 * `data-*` attribute name the client payload rides on — see the module
 * header's "Client payload contract" section for the full spelling/format
 * contract. Exported so a future consumer (#3244) reads the same literal
 * instead of hand-copying the string.
 */
export const UNAVAILABLE_VERSIONS_ATTR = "data-doc-unavailable-versions";

/**
 * Serialize a `getUnavailableVersions()` result into the `data-*` attribute
 * bag `<DocPageShell>` spreads onto `<article>`. Returns `{}` (no key at
 * all) for `undefined` input so the attribute is genuinely ABSENT from the
 * rendered element, preserving the three-state contract documented above —
 * an empty object here must not be confused with `{ [ATTR]: "" }`.
 */
export function serializeUnavailableVersions(
  unavailableVersions: ReadonlySet<string> | undefined,
): Record<string, string> {
  if (unavailableVersions === undefined) return {};
  return { [UNAVAILABLE_VERSIONS_ATTR]: Array.from(unavailableVersions).sort().join(",") };
}

/**
 * Enforce the comma-free version-slug constraint the module header's
 * "Client payload contract" section documents. Shared by BOTH `zudoDoc()`
 * (`../config.ts`) and `zudoDocPreset()` (`../preset.ts`) — the preset is
 * itself part of the frozen exported API and documented as directly
 * spreadable into `defineConfig`, so a consumer calling it straight (bypassing
 * `zudoDoc()`) must hit the same guard (#3244 codex review finding 2 follow-up).
 * Throws a `TypeError` naming the offending slug; no-op for `false`/`undefined`.
 */
export function assertNoCommaInVersionSlugs(
  versions: ReadonlyArray<{ slug: string }> | false | undefined,
): void {
  if (!versions) return;
  for (const v of versions) {
    if (v.slug.includes(",")) {
      throw new TypeError(
        `Invalid version slug "${v.slug}": version slugs must not contain commas ` +
          "(commas are the delimiter in the version-switcher's client-side " +
          "availability payload — see version-availability/index.ts).",
      );
    }
  }
}
