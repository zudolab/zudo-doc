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
 */

import { describe, expect, it, vi } from "vitest";
import { createGetUnavailableVersions } from "../index.js";
import type { VersionAvailabilityDeps } from "../index.js";

function makeDeps(overrides: Partial<VersionAvailabilityDeps> = {}): VersionAvailabilityDeps {
  return {
    versions: [{ slug: "v1" }, { slug: "v2" }],
    resolveNavSource: () => ({ docs: [] }),
    toRouteSlug: (id: string) => (id === "index" ? "" : id.replace(/\/index$/, "")),
    ...overrides,
  };
}

describe("createGetUnavailableVersions — no-op gates", () => {
  it("returns undefined when slug is undefined (no current page to test)", () => {
    const resolveNavSource = vi.fn(() => ({ docs: [] }));
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
    const resolveNavSource = () => ({
      docs: [{ slug: "getting-started", data: {} }],
    });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ resolveNavSource }),
    );
    const result = getUnavailableVersions("getting-started", "en");
    expect(result).toEqual(new Set());
  });

  it("marks a version unavailable when the slug is missing from its docs", () => {
    const resolveNavSource = (locale: string, versionSlug: string) => ({
      docs:
        versionSlug === "v1"
          ? [{ slug: "getting-started", data: {} }]
          : [{ slug: "other-page", data: {} }],
    });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ resolveNavSource }),
    );
    const result = getUnavailableVersions("getting-started", "en");
    expect(result).toEqual(new Set(["v2"]));
  });

  it("maps slugs via data.slug ?? toRouteSlug(entry.slug)", () => {
    const resolveNavSource = () => ({
      docs: [
        // No frontmatter override — falls back to toRouteSlug(entry.slug).
        { slug: "guides/index", data: {} },
        // Frontmatter override wins over the raw entry slug.
        { slug: "internal-name", data: { slug: "custom-slug" } },
      ],
    });
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: [{ slug: "v1" }], resolveNavSource }),
    );
    expect(getUnavailableVersions("guides", "en")).toEqual(new Set());
    expect(getUnavailableVersions("custom-slug", "en")).toEqual(new Set());
  });
});

describe("createGetUnavailableVersions — cache keyed by BOTH locale and version", () => {
  it("does not leak availability across locales for the same version slug", () => {
    const resolveNavSource = (locale: string) => ({
      docs:
        locale === "en"
          ? [{ slug: "getting-started", data: {} }]
          : [{ slug: "other-page", data: {} }],
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
    const resolveNavSource = vi.fn(() => ({
      docs: [{ slug: "getting-started", data: {} }],
    }));
    const getUnavailableVersions = createGetUnavailableVersions(
      makeDeps({ versions: [{ slug: "v1" }], resolveNavSource }),
    );

    getUnavailableVersions("getting-started", "en");
    getUnavailableVersions("other-page", "en");
    getUnavailableVersions("getting-started", "ja");

    // (en, v1) computed once despite two calls; (ja, v1) is a separate entry.
    expect(resolveNavSource).toHaveBeenCalledTimes(2);
    expect(resolveNavSource).toHaveBeenCalledWith("en", "v1", { keepUnlisted: true });
    expect(resolveNavSource).toHaveBeenCalledWith("ja", "v1", { keepUnlisted: true });
  });
});
