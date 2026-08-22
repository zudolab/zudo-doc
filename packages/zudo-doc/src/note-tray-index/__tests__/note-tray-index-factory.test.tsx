/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { describe, expect, it, vi } from "vitest";
import type { VNode } from "preact";
import {
  createNoteTrayIndexWrapper,
  type NoteTrayIndexDeps,
  type NoteTrayIndexNode,
} from "../index.js";
import type { NoteTrayIndexProps } from "../../nav-indexing/note-tray-index.js";

const child = (slug: string, rank: number): NoteTrayIndexNode => ({
  slug,
  label: slug,
  description: `About ${slug}`,
  href: `/docs/${slug}`,
  hasPage: true,
  rank,
  children: [],
});

const tree: NoteTrayIndexNode[] = [{
  slug: "notes",
  label: "Notes",
  href: "/docs/notes",
  hasPage: true,
  shape: "note-tray",
  noteTrayDated: true,
  sortOrder: "asc",
  children: [child("notes/one", 1), child("notes/two", 2)],
}];

function find(nodes: NoteTrayIndexNode[], slug: string): NoteTrayIndexNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const nested = find(node.children, slug);
    if (nested) return nested;
  }
}

function deps(overrides: Partial<NoteTrayIndexDeps> = {}): NoteTrayIndexDeps {
  return {
    defaultLocale: "en",
    docTags: true,
    resolveNavSource: () => ({
      navDocs: [{ slug: "notes/one", data: { tags: ["AI", "ai"] } }],
      categoryMeta: new Map(),
    }),
    buildNavTree: () => tree,
    findNode: find,
    toRouteSlug: (slug) => slug.replace(/\/index$/, ""),
    resolveTag: (tag) => tag.toLowerCase(),
    tagHref: (tag, locale) => `/${locale}/docs/tags/${tag}`,
    t: (key) => key === "doc.updated" ? "Updated" : key,
    versionedDocsUrl: (slug, version, locale) => `/v/${version}/${locale}/docs/${slug}`,
    ...overrides,
  };
}

const propsOf = (value: unknown) => (value as VNode<NoteTrayIndexProps>).props;

describe("createNoteTrayIndexWrapper", () => {
  it("defaults category to the tray containing currentSlug and resolves canonical tags", () => {
    const result = createNoteTrayIndexWrapper(deps())({ currentSlug: "notes/one" });
    expect(propsOf(result).items).toHaveLength(2);
    expect(propsOf(result).items[0]?.tagLinks).toEqual([
      { tag: "ai", href: "/en/docs/tags/ai" },
    ]);
  });

  it("supports an explicit category from any current page", () => {
    const result = createNoteTrayIndexWrapper(deps())({
      category: "notes",
      currentSlug: "elsewhere/page",
    });
    expect(propsOf(result).items.map((item) => item.slug)).toEqual(["notes/one", "notes/two"]);
  });

  it("loads the localized source and remaps versioned hrefs", () => {
    const resolveNavSource = vi.fn(deps().resolveNavSource);
    const result = createNoteTrayIndexWrapper(deps({ resolveNavSource }))({
      currentSlug: "notes",
      lang: "ja",
      currentVersion: "1.0",
    });
    expect(resolveNavSource).toHaveBeenCalledWith("ja", "1.0", { keepUnlisted: true });
    expect(propsOf(result).items[0]?.href).toBe("/v/1.0/ja/docs/notes/one");
  });
});
