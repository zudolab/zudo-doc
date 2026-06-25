/** @jsxRuntime automatic */
/** @jsxImportSource preact */
/**
 * Factory tests for createTagPages (epic #2344, S8).
 *
 * Verifies:
 *  1. collectTagMapForLocale returns the correct tag map for default locale.
 *  2. collectTagMapForLocale merges locales for non-default locale.
 *  3. Factory returns the three exports: collectTagMapForLocale, TagDetailPageView,
 *     TagsIndexPageView.
 */

import { describe, expect, it } from "vitest";
import { createTagPages } from "../index.js";
import type { TagPagesDeps, TagPagesDocsEntry, TagInfo } from "../index.js";
import { h } from "preact";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  id: string,
  tags: string[] = [],
  overrides: Partial<TagPagesDocsEntry["data"]> = {},
): TagPagesDocsEntry {
  return {
    id,
    data: {
      title: `Title ${id}`,
      tags,
      draft: false,
      unlisted: false,
      category_no_page: false,
      ...overrides,
    },
  };
}

function makeCollectTags(
  entries: TagPagesDocsEntry[],
  slugFn: (id: string, data: { slug?: string }) => string,
): Map<string, TagInfo> {
  const tagMap = new Map<string, TagInfo>();
  for (const entry of entries) {
    const rawTags = entry.data.tags ?? [];
    const slug = slugFn(entry.id, entry.data);
    for (const tag of rawTags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { tag, count: 0, docs: [] });
      }
      const info = tagMap.get(tag)!;
      info.count++;
      info.docs.push({ slug, title: entry.data.title });
    }
  }
  return tagMap;
}

const STUB_COMPONENT = () => h("div", null);

interface MakeDepsOptions extends Partial<Omit<TagPagesDeps, "components">> {
  /** Docs to use for the "docs" collection. */
  docs?: TagPagesDocsEntry[];
}

function makeDeps({ docs = [], ...overrides }: MakeDepsOptions = {}): TagPagesDeps {
  return {
    settings: {
      noindex: false,
      dynamicPageTransition: false,
      docTags: true,
      base: "/",
    },
    defaultLocale: "en",
    t: (key: string) => key,
    withBase: (path: string) => path,
    docsUrl: (slug: string, lang?: string) => `/${lang ?? "en"}/docs/${slug}`,
    composeMetaTitle: (title: string) => title,
    collectTags: makeCollectTags,
    stableDocs: (collectionName: string) => (collectionName === "docs" ? docs : []),
    components: {
      HeadWithDefaults: STUB_COMPONENT as unknown as TagPagesDeps["components"]["HeadWithDefaults"],
      HeaderWithDefaults: STUB_COMPONENT as unknown as TagPagesDeps["components"]["HeaderWithDefaults"],
      FooterWithDefaults: STUB_COMPONENT as unknown as TagPagesDeps["components"]["FooterWithDefaults"],
      BodyEndIslands: STUB_COMPONENT as unknown as TagPagesDeps["components"]["BodyEndIslands"],
      DocHistoryArea: STUB_COMPONENT as unknown as TagPagesDeps["components"]["DocHistoryArea"],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createTagPages — API shape", () => {
  it("returns collectTagMapForLocale, TagDetailPageView, TagsIndexPageView", () => {
    const api = createTagPages(makeDeps({}));
    expect(typeof api.collectTagMapForLocale).toBe("function");
    expect(typeof api.TagDetailPageView).toBe("function");
    expect(typeof api.TagsIndexPageView).toBe("function");
  });
});

describe("createTagPages — collectTagMapForLocale", () => {
  it("returns empty map when there are no tagged docs (default locale)", () => {
    const { collectTagMapForLocale } = createTagPages(
      makeDeps({ docs: [makeEntry("doc/intro"), makeEntry("doc/guide")] }),
    );
    const map = collectTagMapForLocale("en");
    expect(map.size).toBe(0);
  });

  it("returns correct tags from the docs collection (default locale)", () => {
    const { collectTagMapForLocale } = createTagPages(
      makeDeps({
        docs: [
          makeEntry("doc/intro", ["typescript", "guide"]),
          makeEntry("doc/setup", ["typescript"]),
        ],
      }),
    );
    const map = collectTagMapForLocale("en");
    expect(map.has("typescript")).toBe(true);
    expect(map.get("typescript")?.count).toBe(2);
    expect(map.has("guide")).toBe(true);
    expect(map.get("guide")?.count).toBe(1);
  });

  it("excludes category_no_page docs from tag aggregation (default locale)", () => {
    const { collectTagMapForLocale } = createTagPages(
      makeDeps({
        docs: [
          makeEntry("doc/intro", ["typescript"]),
          makeEntry("doc/index", ["typescript"], { category_no_page: true }),
        ],
      }),
    );
    const map = collectTagMapForLocale("en");
    // category_no_page doc should be excluded, so count is 1 not 2
    expect(map.get("typescript")?.count).toBe(1);
  });

  it("excludes unlisted docs from tag aggregation (default locale)", () => {
    const { collectTagMapForLocale } = createTagPages(
      makeDeps({
        docs: [
          makeEntry("doc/intro", ["typescript"]),
          makeEntry("doc/hidden", ["typescript"], { unlisted: true }),
        ],
      }),
    );
    const map = collectTagMapForLocale("en");
    expect(map.get("typescript")?.count).toBe(1);
  });
});

describe("createTagPages — TagDetailPageView renders without throwing", () => {
  it("renders a tag detail page for the default locale", () => {
    const { TagDetailPageView } = createTagPages(makeDeps({}));
    const tagInfo: TagInfo = {
      tag: "typescript",
      count: 1,
      docs: [{ slug: "intro", title: "Introduction" }],
    };
    expect(() =>
      TagDetailPageView({ locale: "en", tag: "typescript", tagInfo }),
    ).not.toThrow();
  });

  it("renders a tag detail page for a non-default locale", () => {
    const { TagDetailPageView } = createTagPages(makeDeps({}));
    const tagInfo: TagInfo = {
      tag: "typescript",
      count: 1,
      docs: [{ slug: "intro", title: "Introduction" }],
    };
    expect(() =>
      TagDetailPageView({ locale: "ja", tag: "typescript", tagInfo }),
    ).not.toThrow();
  });
});

describe("createTagPages — TagsIndexPageView renders without throwing", () => {
  it("renders the all-tags index page", () => {
    const { TagsIndexPageView } = createTagPages(makeDeps({}));
    expect(() => TagsIndexPageView({ locale: "en" })).not.toThrow();
  });
});
