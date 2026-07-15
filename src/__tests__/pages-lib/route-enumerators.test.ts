/**
 * route-enumerators.test.ts
 *
 * Unit tests for pages/lib/route-enumerators.ts covering:
 *   (a) Tag-route emission — /docs/tags/ and /docs/tags/<tag>/ for each locale
 *   (b) Locale-fallback URL dedup — no duplicate locale+EN URL for the same slug
 *   (c) Version-route emission — EN-only and JA-fallback versioned content
 *   (d) toRouteSlug applied to category indexes — /index suffix stripped from URLs
 *
 * zfb/content (getCollection) is not available outside the zfb runtime, so
 * the collection loader is mocked via vi.mock. Settings and filesystem
 * utilities (loadCategoryMeta) use the real project values.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// zfb/content mock
// zfb/content is a build-time runtime module unavailable in Node test context.
// Provide a controllable stub so enumerators can be tested in isolation.
// ---------------------------------------------------------------------------

vi.mock("@takazudo/zfb/content", () => ({
  getCollection: vi.fn((_name: string) => []),
  // No installed snapshot in unit tests — the nav-source cache uses its
  // fresh-each-call fallback path so the per-test mock swaps take effect.
  getContentSnapshot: vi.fn(() => undefined),
}));

// Import the mock handle after vi.mock so it is the mocked version.
import { getCollection } from "@takazudo/zfb/content";
const mockGetCollection = getCollection as ReturnType<typeof vi.fn>;

// Import modules under test after the mock is established.
// The route enumerators ride on the unified route context now (HOSTCOLLAPSE
// #2427 removed the `pages/lib/route-enumerators.ts` re-export shim). Destructure
// them off `routeContext` directly — the same instance the deleted shim exposed.
import { routeContext } from "../../../pages/lib/_route-context";

const { enumerateTagsRoutes, enumerateDocsRoutes, enumerateVersionedRoutes } =
  routeContext;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EntryData = {
  title?: string;
  tags?: string[];
  draft?: boolean;
  unlisted?: boolean;
  slug?: string;
};

/** Build a minimal collection entry. slug is the zfb raw slug (pre-bridge). */
function makeEntry(slug: string, data: EntryData = {}) {
  return { slug, data: { title: slug, ...data } };
}

// ---------------------------------------------------------------------------
// (a) Tag-route emission
// ---------------------------------------------------------------------------

describe("enumerateTagsRoutes", () => {
  beforeEach(() => {
    mockGetCollection.mockReset();
    mockGetCollection.mockImplementation((_name: string) => []);
  });

  it("emits /docs/tags/ index URL for the default locale (EN)", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs") {
        return [
          makeEntry("intro", { tags: ["type:guide"] }),
          makeEntry("advanced", { tags: ["type:guide", "type:reference"] }),
        ];
      }
      return [];
    });

    const urls = enumerateTagsRoutes("en");
    expect(urls.some((u) => u.endsWith("/docs/tags/"))).toBe(true);
  });

  it("emits per-tag URLs for each tag in the EN collection (URL-encoded)", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs") {
        return [
          makeEntry("intro", { tags: ["type:guide"] }),
          makeEntry("advanced", { tags: ["type:guide", "type:reference"] }),
        ];
      }
      return [];
    });

    const urls = enumerateTagsRoutes("en");
    // Tag segments are emitted percent-encoded (sitemap-safe URLs); the
    // built output dir keeps the raw tag name and servers decode on lookup.
    expect(urls.some((u) => u.endsWith("/docs/tags/type%3Aguide/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/docs/tags/type%3Areference/"))).toBe(true);
    // No raw (unencoded) variant alongside the encoded one.
    expect(urls.some((u) => u.includes("/docs/tags/type:"))).toBe(false);
  });

  it("does not emit duplicate tag URLs", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs") {
        return [
          makeEntry("intro", { tags: ["type:guide"] }),
          makeEntry("advanced", { tags: ["type:guide"] }),
        ];
      }
      return [];
    });

    const urls = enumerateTagsRoutes("en");
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  it("emits /{locale}/docs/tags/ index URL for non-default locale (JA)", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") {
        return [makeEntry("intro-ja", { tags: ["type:guide"] })];
      }
      if (name === "docs") {
        return [makeEntry("intro", { tags: ["type:guide"] })];
      }
      return [];
    });

    const urls = enumerateTagsRoutes("ja");
    expect(urls.some((u) => u.includes("/ja/docs/tags/") && u.endsWith("/"))).toBe(true);
  });

  it("emits /{locale}/docs/tags/{tag}/ for non-default locale tags", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") {
        return [makeEntry("intro-ja", { tags: ["type:guide"] })];
      }
      if (name === "docs") {
        return [makeEntry("intro", { tags: ["type:guide"] })];
      }
      return [];
    });

    const urls = enumerateTagsRoutes("ja");
    expect(urls.some((u) => u.endsWith("/ja/docs/tags/type%3Aguide/"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (b) Locale-fallback URL dedup
// ---------------------------------------------------------------------------

describe("enumerateDocsRoutes — locale fallback dedup", () => {
  beforeEach(() => {
    mockGetCollection.mockReset();
    mockGetCollection.mockImplementation((_name: string) => []);
  });

  it("emits only one /ja/docs/intro/ when JA has same slug as EN base", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") {
        return [makeEntry("intro", { title: "Japanese intro" })];
      }
      if (name === "docs") {
        return [makeEntry("intro", { title: "EN intro" })];
      }
      return [];
    });

    const urls = enumerateDocsRoutes("ja");
    const jaIntroUrls = urls.filter((u) => u.includes("/ja/docs/intro"));
    expect(jaIntroUrls.length).toBe(1);
  });

  it("includes EN fallback slug not covered by the locale collection", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") {
        return [makeEntry("ja-only", { title: "JA only" })];
      }
      if (name === "docs") {
        return [
          makeEntry("ja-only", { title: "EN version" }),
          makeEntry("en-only", { title: "EN only" }),
        ];
      }
      return [];
    });

    const urls = enumerateDocsRoutes("ja");
    expect(urls.some((u) => u.includes("/ja/docs/ja-only"))).toBe(true);
    expect(urls.some((u) => u.includes("/ja/docs/en-only"))).toBe(true);
  });

  it("does not emit the EN version of a slug that JA already covers", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") {
        return [makeEntry("shared", { title: "JA version" })];
      }
      if (name === "docs") {
        return [makeEntry("shared", { title: "EN version" })];
      }
      return [];
    });

    const urls = enumerateDocsRoutes("ja");
    const sharedCount = urls.filter((u) => u.includes("/ja/docs/shared")).length;
    expect(sharedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (c) Version-route emission
// ---------------------------------------------------------------------------

describe("enumerateVersionedRoutes", () => {
  beforeEach(() => {
    mockGetCollection.mockReset();
    mockGetCollection.mockImplementation((_name: string) => []);
  });

  it("emits EN versioned routes under /v/{version}/docs/", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-v-1.0") {
        return [makeEntry("intro"), makeEntry("guide")];
      }
      return [];
    });

    const urls = enumerateVersionedRoutes(
      { slug: "1.0", label: "1.0.0", docsDir: "src/content/docs-v1" },
      "en",
    );

    expect(urls.some((u) => u.includes("/v/1.0/docs/intro"))).toBe(true);
    expect(urls.some((u) => u.includes("/v/1.0/docs/guide"))).toBe(true);
    expect(urls.every((u) => !u.includes("/v/1.0/ja/"))).toBe(true);
  });

  it("emits JA fallback versioned routes when version has no locale collection", () => {
    // version.locales is undefined — JA page falls back to EN entries
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-v-1.0") {
        return [makeEntry("intro"), makeEntry("guide")];
      }
      return [];
    });

    const urls = enumerateVersionedRoutes(
      { slug: "1.0", label: "1.0.0", docsDir: "src/content/docs-v1" },
      "ja",
    );

    expect(urls.some((u) => u.includes("/v/1.0/ja/docs/intro"))).toBe(true);
    expect(urls.some((u) => u.includes("/v/1.0/ja/docs/guide"))).toBe(true);
    // No EN-path versioned routes in the JA result
    expect(urls.every((u) => !u.match(/\/v\/1\.0\/docs\//))).toBe(true);
  });

  it("merges locale and EN base when locale collection exists for the version", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-v-1.0-ja") {
        return [makeEntry("intro", { title: "JA intro" })];
      }
      if (name === "docs-v-1.0") {
        return [makeEntry("intro"), makeEntry("guide")];
      }
      return [];
    });

    const urls = enumerateVersionedRoutes(
      {
        slug: "1.0",
        label: "1.0.0",
        docsDir: "src/content/docs-v1",
        locales: { ja: { dir: "src/content/docs-v1-ja" } },
      },
      "ja",
    );

    expect(urls.some((u) => u.includes("/v/1.0/ja/docs/intro"))).toBe(true);
    expect(urls.some((u) => u.includes("/v/1.0/ja/docs/guide"))).toBe(true);
    const introCount = urls.filter((u) => u.includes("/v/1.0/ja/docs/intro")).length;
    expect(introCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (e) defaultLocaleOnlyPrefixes — JA fallback filter
// ---------------------------------------------------------------------------

describe("enumerateDocsRoutes — defaultLocaleOnlyPrefixes filter", () => {
  beforeEach(() => {
    mockGetCollection.mockReset();
    mockGetCollection.mockImplementation((_name: string) => []);
  });

  it("does not emit /ja/docs/claude-md/* for EN-only fallback entries", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") {
        return [makeEntry("claude", { title: "Claude JA stub" })];
      }
      if (name === "docs") {
        return [
          makeEntry("claude", { title: "Claude EN" }),
          makeEntry("claude-md/overview", { title: "CLAUDE.md overview" }),
          makeEntry("claude-skills/intro", { title: "Skills intro" }),
        ];
      }
      return [];
    });

    const urls = enumerateDocsRoutes("ja");
    expect(urls.some((u) => u.includes("/ja/docs/claude-md/"))).toBe(false);
    expect(urls.some((u) => u.includes("/ja/docs/claude-skills/"))).toBe(false);
  });

  it("still emits /ja/docs/claude/ for the locale-authored JA stub", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") {
        return [makeEntry("claude", { title: "Claude JA stub" })];
      }
      if (name === "docs") {
        return [
          makeEntry("claude", { title: "Claude EN" }),
          makeEntry("claude-md/overview", { title: "CLAUDE.md overview" }),
        ];
      }
      return [];
    });

    const urls = enumerateDocsRoutes("ja");
    expect(urls.some((u) => u.endsWith("/ja/docs/claude/"))).toBe(true);
  });

  it("does not filter EN enumeration — default locale emits all docs", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs") {
        return [
          makeEntry("claude", { title: "Claude EN" }),
          makeEntry("claude-md/overview", { title: "CLAUDE.md overview" }),
          makeEntry("claude-skills/intro", { title: "Skills intro" }),
          makeEntry("claude-agents/guide", { title: "Agents guide" }),
          makeEntry("claude-commands/ref", { title: "Commands ref" }),
        ];
      }
      return [];
    });

    const urls = enumerateDocsRoutes("en");
    expect(urls.some((u) => u.includes("/docs/claude-md/"))).toBe(true);
    expect(urls.some((u) => u.includes("/docs/claude-skills/"))).toBe(true);
    expect(urls.some((u) => u.includes("/docs/claude-agents/"))).toBe(true);
    expect(urls.some((u) => u.includes("/docs/claude-commands/"))).toBe(true);
  });

  it("does not emit /v/{version}/ja/docs/claude-md/* for EN-only fallback versioned entries", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-v-1.0") {
        return [makeEntry("claude-md/overview", { title: "CLAUDE.md v1" })];
      }
      return [];
    });

    const urls = enumerateVersionedRoutes(
      { slug: "1.0", label: "1.0.0", docsDir: "src/content/docs-v1" },
      "ja",
    );
    expect(urls.some((u) => u.includes("/v/1.0/ja/docs/claude-md/"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (d) toRouteSlug strips /index suffix from category index entries
// ---------------------------------------------------------------------------

describe("enumerateDocsRoutes — toRouteSlug strips /index suffix", () => {
  beforeEach(() => {
    mockGetCollection.mockReset();
    mockGetCollection.mockImplementation((_name: string) => []);
  });

  it("does not emit /docs/category/index/ for a category index entry", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs") {
        return [
          makeEntry("getting-started/index", { title: "Getting Started" }),
          makeEntry("getting-started/intro", { title: "Intro" }),
        ];
      }
      return [];
    });

    const urls = enumerateDocsRoutes("en");

    expect(urls.every((u) => !u.includes("/index/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/docs/getting-started/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/docs/getting-started/intro/"))).toBe(true);
  });

  it("maps a raw root index entry to the canonical docs root", () => {
    mockGetCollection.mockImplementation((name: string) =>
      name === "docs" ? [makeEntry("index", { title: "Docs" })] : [],
    );

    expect(enumerateDocsRoutes("en")).toEqual([expect.stringMatching(/\/docs\/$/)]);
  });

  it("preserves root/index behavior through locale fallback merging", () => {
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs-ja") return [makeEntry("index", { title: "ドキュメント" })];
      if (name === "docs") return [makeEntry("index", { title: "Docs" })];
      return [];
    });

    const urls = enumerateDocsRoutes("ja");
    expect(urls.filter((url) => /\/ja\/docs\/$/.test(url))).toHaveLength(1);
    expect(urls.every((url) => !url.includes("/index/"))).toBe(true);
  });

  it("maps raw root and nested index entries on versioned routes", () => {
    mockGetCollection.mockImplementation((name: string) =>
      name === "docs-v-1.0"
        ? [makeEntry("index", { title: "Docs" }), makeEntry("guide/index", { title: "Guide" })]
        : [],
    );

    const urls = enumerateVersionedRoutes(
      { slug: "1.0", docsDir: "src/content/docs-v1" },
      "en",
    );
    expect(urls).toContainEqual(expect.stringMatching(/\/v\/1\.0\/docs\/$/));
    expect(urls).toContainEqual(expect.stringMatching(/\/v\/1\.0\/docs\/guide\/$/));
    expect(urls.every((url) => !url.includes("/index/"))).toBe(true);
  });
});
