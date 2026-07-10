/**
 * nav-source-versioned-locale.test.ts
 *
 * Regression coverage for #1909: the versioned branch of `resolveNavSource`
 * used to ALWAYS return the base EN collection `docs-v-${version}` and base
 * category meta, ignoring `lang`. So on a versioned-locale page the header /
 * mobile / desktop nav showed untranslated labels and missed locale-only
 * version pages, while the body (built via `resolveVersionedLocaleSource`) was
 * localized.
 *
 * The fix delegates the versioned + non-default-locale case (when the version
 * is configured for that locale) to the SAME `resolveVersionedLocaleSource`
 * the page body / route enumeration use, so every nav surface agrees with the
 * body. This test asserts:
 *   (a) locale-first merge with base EN fallback for a configured version-locale
 *   (b) referential stability (memoization) across repeated identical calls
 *   (c) base-fallback behavior preserved when the version has NO locale config
 *
 * zfb/content (getCollection / getContentSnapshot) is a build-time runtime
 * module unavailable in Node, so it is mocked. `settings.versions` is mutated
 * per-test (and restored) rather than mocking the whole settings module — i18n
 * and the merge helpers read many other settings fields, so the real object is
 * kept intact and only `versions` is swapped.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// zfb/content mock
//
// getContentSnapshot returns a stable snapshot whose per-collection arrays are
// DISTINCT references. `stableDocs` (pages/lib/_nav-source-cache.ts) keys its
// bridged-array WeakMap on `getContentSnapshot().collections[name]` as the
// anchor object; with a snapshot installed it memoizes, giving the referential
// stability this test asserts. Distinct anchor arrays per collection are
// required — a shared array would collide in the WeakMap and make base + locale
// resolve to the same bridged array.
// ---------------------------------------------------------------------------

const SNAPSHOT = {
  collections: {
    "docs-v-1.0": [{}],
    "docs-v-1.0-ja": [{}],
  } as Record<string, readonly unknown[]>,
};

vi.mock("@takazudo/zfb/content", () => ({
  getCollection: vi.fn((_name: string) => []),
  getContentSnapshot: vi.fn(() => SNAPSHOT),
}));

import { getCollection } from "@takazudo/zfb/content";
const mockGetCollection = getCollection as ReturnType<typeof vi.fn>;

import { settings } from "@/config/settings";
import type { VersionConfig } from "@/config/settings";
import { resolveNavSource } from "../../../pages/lib/_nav-source-docs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EntryData = { title?: string; slug?: string; unlisted?: boolean; draft?: boolean };

/** Build a minimal collection entry. slug is the zfb raw slug (pre-bridge). */
function makeEntry(slug: string, data: EntryData = {}) {
  return { slug, data: { title: slug, ...data } };
}

const VERSION_WITH_JA: VersionConfig = {
  slug: "1.0",
  label: "1.0.0",
  docsDir: "src/content/docs-v1",
  locales: { ja: { dir: "src/content/docs-v1-ja" } },
};

const VERSION_NO_LOCALES: VersionConfig = {
  slug: "1.0",
  label: "1.0.0",
  docsDir: "src/content/docs-v1",
};

let savedVersions: typeof settings.versions;

beforeEach(() => {
  savedVersions = settings.versions;
  mockGetCollection.mockReset();
  mockGetCollection.mockImplementation((name: string) => {
    if (name === "docs-v-1.0-ja") {
      return [makeEntry("intro", { title: "JA intro" })];
    }
    if (name === "docs-v-1.0") {
      return [makeEntry("intro", { title: "EN intro" }), makeEntry("guide", { title: "EN guide" })];
    }
    return [];
  });
});

afterEach(() => {
  settings.versions = savedVersions;
});

// ---------------------------------------------------------------------------
// (a) Versioned non-default locale, version configured for that locale:
//     locale-first merge with base EN fallback.
// ---------------------------------------------------------------------------

describe("resolveNavSource — versioned + non-default locale (configured)", () => {
  it("merges the version-locale collection over the version's EN base", () => {
    settings.versions = [VERSION_WITH_JA];

    const { docs, localeSlugSet } = resolveNavSource("ja", "1.0", {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });

    const slugs = docs.map((d) => d.data.slug ?? d.id);
    // "intro" comes from the JA collection; "guide" falls back to EN base.
    expect(slugs).toContain("intro");
    expect(slugs).toContain("guide");
    // No duplicate "intro" — locale wins over base for the shared slug.
    expect(slugs.filter((s) => s === "intro").length).toBe(1);
    // localeSlugSet tracks which slugs came from the locale collection.
    expect(localeSlugSet.has("intro")).toBe(true);
    expect(localeSlugSet.has("guide")).toBe(false);
  });

  it("returns identity-stable docs / navDocs / categoryMeta across calls", () => {
    settings.versions = [VERSION_WITH_JA];

    const opts = { applyDefaultLocaleOnlyFilter: true, keepUnlisted: true };
    const first = resolveNavSource("ja", "1.0", opts);
    const second = resolveNavSource("ja", "1.0", opts);

    // Memoization (#1902 / #1909): repeated calls with identical logical inputs
    // must return the SAME instances so buildNavTree's identity fast-path holds.
    expect(second.docs).toBe(first.docs);
    expect(second.navDocs).toBe(first.navDocs);
    expect(second.categoryMeta).toBe(first.categoryMeta);
  });
});

// ---------------------------------------------------------------------------
// (b) Versioned non-default locale, version NOT configured for that locale:
//     existing base-fallback behavior preserved (the regression an
//     unconditional delegate would cause — case 3).
// ---------------------------------------------------------------------------

describe("resolveNavSource — versioned + non-default locale (not configured)", () => {
  it("falls back to the version's EN base collection (no locale merge)", () => {
    settings.versions = [VERSION_NO_LOCALES];

    const { docs, localeSlugSet } = resolveNavSource("ja", "1.0", {
      applyDefaultLocaleOnlyFilter: true,
      keepUnlisted: true,
    });

    const slugs = docs.map((d) => d.data.slug ?? d.id);
    // Raw EN base — both EN entries, with their EN titles, no JA override.
    expect(slugs).toContain("intro");
    expect(slugs).toContain("guide");
    expect(docs.find((d) => (d.data.slug ?? d.id) === "intro")?.data.title).toBe("EN intro");
    // Base single-collection case carries an empty localeSlugSet.
    expect(localeSlugSet.size).toBe(0);
  });
});
