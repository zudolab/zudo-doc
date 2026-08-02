/**
 * Tests for createGetUnavailableVersions (epic #3214 Wave 1, #3215).
 *
 * Verifies:
 *  1. A slug present in every version's docs yields an empty unavailable set.
 *  2. A slug missing from one version's docs yields that version in the set.
 *  3. A no-current-slug call (`slug === undefined`) returns `undefined`,
 *     never marking every archive unavailable.
 *  4. No configured versions (`false` / empty array) returns `undefined`.
 *  5. The available-slug cache is keyed by BOTH locale and version — the
 *     same version slug resolves independently per locale.
 *  6. `d.data.slug ?? toRouteSlug(d.slug)` is the slug-mapping recipe used.
 *  7. Route parity with real route generation (#3215 review fixes):
 *     - `category_no_page` entries are excluded (no route is emitted for them).
 *     - Auto-generated category-index nodes (no docs entry of their own) ARE
 *       counted as available.
 *     - `resolveNavSource` is called with `applyDefaultLocaleOnlyFilter: true`
 *       (matching the versioned-locale route recipe), not just `keepUnlisted`.
 */

import { describe, expect, it, vi } from "vitest";
import { createGetUnavailableVersions } from "../index.js";
import type { VersionAvailabilityDeps, VersionAvailabilityNavSource } from "../index.js";
import type { DocPageEntry } from "../../doc-page-props/index.js";

/** Minimal-but-complete fake DocPageEntry (CollectionEntry<DocPageFrontmatter>). */
function makeDoc(
  slug: string,
  data: Partial<DocPageEntry["data"]> = {},
): DocPageEntry {
  return {
    slug,
    data: { title: slug, ...data },
    body: "",
    module_specifier: `${slug}.mdx`,
    Content: () => ({ type: "div", props: {}, key: null }),
  } as DocPageEntry;
}

function makeNavSource(
  overrides: Partial<VersionAvailabilityNavSource> = {},
): VersionAvailabilityNavSource {
  return {
    docs: [],
    navDocs: [],
    categoryMeta: new Map(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<VersionAvailabilityDeps> = {}): VersionAvailabilityDeps {
  return {
    versions: [{ slug: "v1" }, { slug: "v2" }],
    resolveNavSource: () => makeNavSource(),
    toRouteSlug: (id: string) => (id === "index" ? "" : id.replace(/\/index$/, "")),
    buildNavTree: () => [],
    collectAutoIndexNodes: () => [],
    ...overrides,
  };
}

describe("createGetUnavailableVersions — no-op gates", () => {
  it("returns undefined when slug is undefined (no current page to test)", () => {
    const resolveNavSource = vi.fn(() => makeNavSource());
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ resolveNavSource }),
    );
    expect(getUnavailableVersions(undefined, "en")).toBeUndefined();
    // Must not even consult the nav source — nothing to test against.
    expect(resolveNavSource).not.toHaveBeenCalled();
  });

  it("returns undefined when versions is false", () => {
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: false }),
    );
    expect(getUnavailableVersions("getting-started", "en")).toBeUndefined();
  });

  it("returns undefined when versions is an empty array", () => {
    const getUnavailableVersions = createGetUnavailableVersions(makeDeps({ versions: [] }));
    expect(getUnavailableVersions("getting-started", "en")).toBeUndefined();
  });
});

describe("createGetUnavailableVersions — availability computation", () => {
  it("returns an empty set when the slug exists in every version", () => {
    const resolveNavSource = () =>
      makeNavSource({ docs: [makeDoc("getting-started")] });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ resolveNavSource }),
    );
    const result = getUnavailableVersions("getting-started", "en");
    expect(result).toEqual(new Set());
  });

  it("marks a version unavailable when the slug is missing from its docs", () => {
    const resolveNavSource = (locale: string, versionSlug: string) =>
      makeNavSource({
        docs:
          versionSlug === "v1"
            ? [makeDoc("getting-started")]
            : [makeDoc("other-page")],
      });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ resolveNavSource }),
    );
    const result = getUnavailableVersions("getting-started", "en");
    expect(result).toEqual(new Set(["v2"]));
  });

  it("maps slugs via data.slug ?? toRouteSlug(entry.slug)", () => {
    const resolveNavSource = () =>
      makeNavSource({
        docs: [
          // No frontmatter override — falls back to toRouteSlug(entry.slug).
          makeDoc("guides/index"),
          // Frontmatter override wins over the raw entry slug.
          makeDoc("internal-name", { slug: "custom-slug" }),
        ],
      });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: [{ slug: "v1" }], resolveNavSource }),
    );
    expect(getUnavailableVersions("guides", "en")).toEqual(new Set());
    expect(getUnavailableVersions("custom-slug", "en")).toEqual(new Set());
  });
});

describe("createGetUnavailableVersions — route parity (#3215 review fixes)", () => {
  it("excludes category_no_page entries — buildDocRouteEntries emits no route for them", () => {
    const resolveNavSource = () =>
      makeNavSource({
        docs: [makeDoc("guides/index", { slug: "guides", category_no_page: true })],
      });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: [{ slug: "v1" }], resolveNavSource }),
    );
    // "guides" has a docs entry, but it is category_no_page — no real route
    // was ever emitted for it, so it must NOT count as available.
    expect(getUnavailableVersions("guides", "en")).toEqual(new Set(["v1"]));
  });

  it("counts auto-generated category-index nodes as available even with no docs entry", () => {
    const resolveNavSource = () => makeNavSource({ docs: [] });
    const buildNavTree = vi.fn(() => [{ slug: "guides" } as never]);
    const collectAutoIndexNodes = vi.fn((tree: unknown[]) => tree as never[]);
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({
        versions: [{ slug: "v1" }],
        resolveNavSource,
        buildNavTree,
        collectAutoIndexNodes,
      }),
    );
    // No docs entry for "guides" at all — but it IS a real auto-index route,
    // so it must count as available, not unavailable.
    expect(getUnavailableVersions("guides", "en")).toEqual(new Set());
  });

  it("calls resolveNavSource with applyDefaultLocaleOnlyFilter AND keepUnlisted", () => {
    const resolveNavSource = vi.fn(() => makeNavSource());
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: [{ slug: "v1" }], resolveNavSource }),
    );
    getUnavailableVersions("getting-started", "ja");
    expect(resolveNavSource).toHaveBeenCalledWith("ja", "v1", {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
  });
});

describe("createGetUnavailableVersions — cache keyed by BOTH locale and version", () => {
  it("does not leak availability across locales for the same version slug", () => {
    const resolveNavSource = (locale: string) =>
      makeNavSource({
        docs:
          locale === "en"
            ? [makeDoc("getting-started")]
            : [makeDoc("other-page")],
      });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: [{ slug: "v1" }], resolveNavSource }),
    );

    expect(getUnavailableVersions("getting-started", "en")).toEqual(new Set());
    // Same version slug ("v1"), different locale — must be recomputed, not
    // served from an "en" cache entry keyed by version slug alone.
    expect(getUnavailableVersions("getting-started", "ja")).toEqual(new Set(["v1"]));
  });

  it("caches the resolved slug set per (locale, version) — resolveNavSource called once each", () => {
    const resolveNavSource = vi.fn(() =>
      makeNavSource({ docs: [makeDoc("getting-started")] }),
    );
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: [{ slug: "v1" }], resolveNavSource }),
    );

    getUnavailableVersions("getting-started", "en");
    getUnavailableVersions("other-page", "en");
    getUnavailableVersions("getting-started", "ja");

    // (en, v1) computed once despite two calls; (ja, v1) is a separate entry.
    expect(resolveNavSource).toHaveBeenCalledTimes(2);
    expect(resolveNavSource).toHaveBeenCalledWith("en", "v1", {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
    expect(resolveNavSource).toHaveBeenCalledWith("ja", "v1", {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });
  });
});
