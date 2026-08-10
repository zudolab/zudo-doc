import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_MAP_BASE_PATH,
  buildSiteMap,
  humanizeSlug,
  type PageMeta,
} from "../site-map";
import type { OutlineDoc } from "../types";

const doc: OutlineDoc = {
  schemaVersion: 1,
  projectTitle: "Aurora Docs",
  categories: [
    {
      id: "cat-start",
      slug: "getting-started",
      title: "Getting started",
      pages: [
        { id: "page-start-index", slug: "index" },
        { id: "page-start-install", slug: "installation" },
        { id: "page-start-quick", slug: "quick-start" },
      ],
    },
    {
      id: "cat-guides",
      slug: "guides",
      title: "Guides",
      pages: [{ id: "page-guides-theming", slug: "theming" }],
    },
    { id: "cat-empty", slug: "empty", title: "Empty", pages: [] },
  ],
};

const meta: PageMeta[] = [
  {
    id: "page-start-index",
    title: "Getting started",
    description: "Install and publish.",
  },
  { id: "page-start-install", title: "Installation", draft: true },
  { id: "page-start-quick", title: "Quick start" },
  { id: "page-guides-theming", title: "Theming", draft: true },
];

describe("buildSiteMap", () => {
  it("derives header nav from the categories, in outline order", () => {
    expect(buildSiteMap(doc, meta).nav).toEqual([
      { categoryId: "cat-start", title: "Getting started", path: "/docs/getting-started" },
      { categoryId: "cat-guides", title: "Guides", path: "/docs/guides" },
      { categoryId: "cat-empty", title: "Empty", path: "/docs/empty" },
    ]);
  });

  it("lists every page of a category in sidebar order", () => {
    const category = buildSiteMap(doc, meta).categories[0];
    expect(category?.pages.map((page) => page.id)).toEqual([
      "page-start-index",
      "page-start-install",
      "page-start-quick",
    ]);
    expect(category?.pageCount).toBe(3);
    expect(category?.draftCount).toBe(1);
  });

  it("maps the index page onto the category path and children below it", () => {
    const category = buildSiteMap(doc, meta).categories[0];
    expect(category?.indexPage?.id).toBe("page-start-index");
    expect(category?.indexPage?.path).toBe("/docs/getting-started");
    expect(category?.indexPage?.isIndex).toBe(true);
    expect(category?.pages[2]?.path).toBe("/docs/getting-started/quick-start");
    expect(category?.pages[2]?.isIndex).toBe(false);
  });

  it("reports a category with no index page", () => {
    expect(buildSiteMap(doc, meta).categories[1]?.indexPage).toBeNull();
  });

  it("takes titles, descriptions and draft flags from the supplied meta", () => {
    const page = buildSiteMap(doc, meta).categories[0]?.pages[0];
    expect(page?.title).toBe("Getting started");
    expect(page?.description).toBe("Install and publish.");
    expect(page?.draft).toBe(false);
    expect(page?.hasMeta).toBe(true);

    const draft = buildSiteMap(doc, meta).categories[0]?.pages[1];
    expect(draft?.draft).toBe(true);
    expect(draft?.description).toBeUndefined();
  });

  it("keeps drafts in the projection rather than dropping them", () => {
    const slugs = buildSiteMap(doc, meta).categories[1]?.pages.map(
      (page) => page.slug,
    );
    expect(slugs).toEqual(["theming"]);
  });

  it("falls back to a humanized slug when a page has no meta", () => {
    const model = buildSiteMap(doc, []);
    const page = model.categories[0]?.pages[2];
    expect(page?.title).toBe("Quick start");
    expect(page?.hasMeta).toBe(false);
    expect(model.missingMetaPageIds).toEqual([
      "page-start-index",
      "page-start-install",
      "page-start-quick",
      "page-guides-theming",
    ]);
  });

  it("reports meta whose page is no longer in the outline", () => {
    const model = buildSiteMap(doc, [
      ...meta,
      { id: "page-deleted", title: "Deleted" },
    ]);
    expect(model.unusedMetaIds).toEqual(["page-deleted"]);
    expect(model.missingMetaPageIds).toEqual([]);
  });

  it("builds the top page grid from the categories", () => {
    const model = buildSiteMap(doc, meta);
    expect(model.topPage.title).toBe("Aurora Docs");
    expect(model.topPage.path).toBe(DEFAULT_SITE_MAP_BASE_PATH);
    expect(model.topPage.cards).toEqual([
      {
        categoryId: "cat-start",
        title: "Getting started",
        path: "/docs/getting-started",
        description: "Install and publish.",
        pageCount: 3,
        draftCount: 1,
      },
      {
        categoryId: "cat-guides",
        title: "Guides",
        path: "/docs/guides",
        pageCount: 1,
        draftCount: 1,
      },
      {
        categoryId: "cat-empty",
        title: "Empty",
        path: "/docs/empty",
        pageCount: 0,
        draftCount: 0,
      },
    ]);
  });

  it("honours a custom base path and normalizes its shape", () => {
    for (const basePath of ["/handbook", "/handbook/", "handbook"]) {
      const model = buildSiteMap(doc, meta, { basePath });
      expect(model.basePath, basePath).toBe("/handbook");
      expect(model.categories[0]?.path).toBe("/handbook/getting-started");
      expect(model.categories[0]?.pages[2]?.path).toBe(
        "/handbook/getting-started/quick-start",
      );
    }
  });

  it("supports a root base path", () => {
    const model = buildSiteMap(doc, meta, { basePath: "/" });
    expect(model.basePath).toBe("/");
    expect(model.topPage.path).toBe("/");
    expect(model.categories[0]?.path).toBe("/getting-started");
    expect(model.categories[0]?.pages[2]?.path).toBe(
      "/getting-started/quick-start",
    );
  });

  it("handles an empty outline", () => {
    const empty: OutlineDoc = {
      schemaVersion: 1,
      projectTitle: "Empty",
      categories: [],
    };
    const model = buildSiteMap(empty);
    expect(model.nav).toEqual([]);
    expect(model.categories).toEqual([]);
    expect(model.topPage.cards).toEqual([]);
    expect(model.missingMetaPageIds).toEqual([]);
    expect(model.unusedMetaIds).toEqual([]);
  });
});

describe("humanizeSlug", () => {
  it("turns a kebab slug into sentence case", () => {
    expect(humanizeSlug("quick-start")).toBe("Quick start");
    expect(humanizeSlug("index")).toBe("Index");
    expect(humanizeSlug("i18n")).toBe("I18n");
  });

  it("leaves scripts without letter case untouched", () => {
    expect(humanizeSlug("はじめに")).toBe("はじめに");
  });
});
