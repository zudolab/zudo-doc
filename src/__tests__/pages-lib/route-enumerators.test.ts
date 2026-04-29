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

vi.mock("zfb/content", () => ({
  getCollection: vi.fn((_name: string) => []),
}));

// Import the mock handle after vi.mock so it is the mocked version.
import { getCollection } from "zfb/content";
const mockGetCollection = getCollection as ReturnType<typeof vi.fn>;

// Import modules under test after the mock is established.
import {
  enumerateTagsRoutes,
  enumerateDocsRoutes,
  enumerateVersionedRoutes,
} from "../../../pages/lib/route-enumerators";

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

  it("emits per-tag URLs for each tag in the EN collection", () => {
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
    expect(urls.some((u) => u.endsWith("/docs/tags/type:guide/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/docs/tags/type:reference/"))).toBe(true);
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
    expect(urls.some((u) => u.endsWith("/ja/docs/tags/type:guide/"))).toBe(true);
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
// (d) toRouteSlug strips /index suffix from category index entries
// ---------------------------------------------------------------------------

describe("enumerateDocsRoutes — toRouteSlug strips /index suffix", () => {
  beforeEach(() => {
    mockGetCollection.mockReset();
    mockGetCollection.mockImplementation((_name: string) => []);
  });

  it("does not emit /docs/category/index/ for a category index entry", () => {
    // _data.ts stripIndexSuffix converts "getting-started/index" → "getting-started"
    // before passing to enumerators. Simulate that by providing already-stripped slugs.
    mockGetCollection.mockImplementation((name: string) => {
      if (name === "docs") {
        return [
          makeEntry("getting-started", { title: "Getting Started" }),
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
});
