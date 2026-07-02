import { describe, it, expect } from "vitest";
import {
  flattenTree,
  findNode,
  resolveDocPrevNext,
  flattenSubtree,
  rewriteNavHref,
  remapNavChildHrefs,
  type DocNavNode,
  type PaginationOverrides,
} from "../index.js";

/** Tiny NavNode fixture builder, mirroring build-tree.test.ts's `entry()`. */
function node(slug: string, overrides: Partial<DocNavNode> = {}): DocNavNode {
  return {
    slug,
    label: slug,
    position: 0,
    hasPage: true,
    children: [],
    ...overrides,
  };
}

describe("flattenTree / findNode", () => {
  it("flattens a tree in pre-order, skipping nodes without a backing page", () => {
    const tree = [
      node("guides", {
        hasPage: false,
        children: [node("guides/a", { position: 1 }), node("guides/b", { position: 2 })],
      }),
      node("about", { position: 3 }),
    ];
    expect(flattenTree(tree).map((n) => n.slug)).toEqual([
      "guides/a",
      "guides/b",
      "about",
    ]);
  });

  it("finds a node anywhere in the tree, including nested children", () => {
    const tree = [node("guides", { hasPage: false, children: [node("guides/a")] })];
    expect(findNode(tree, "guides/a")?.slug).toBe("guides/a");
    expect(findNode(tree, "missing")).toBeUndefined();
  });
});

describe("resolveDocPrevNext", () => {
  const noOverrides: PaginationOverrides = {};

  it("returns null prev/next for a single-page tree", () => {
    const a = node("a");
    const { prev, next } = resolveDocPrevNext([a], [a], "a", noOverrides);
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });

  it("returns null prev and a next node for the first node", () => {
    const a = node("a");
    const b = node("b");
    const { prev, next } = resolveDocPrevNext([a, b], [a, b], "a", noOverrides);
    expect(prev).toBeNull();
    expect(next?.slug).toBe("b");
  });

  it("returns a prev node and null next for the last node", () => {
    const a = node("a");
    const b = node("b");
    const { prev, next } = resolveDocPrevNext([a, b], [a, b], "b", noOverrides);
    expect(prev?.slug).toBe("a");
    expect(next).toBeNull();
  });

  it("jumps over hidden (no-page) nodes because they are absent from the flattened subtree", () => {
    const hiddenCategory = node("guides", { hasPage: false });
    const a = node("a");
    const b = node("b");
    const tree = [a, hiddenCategory, b];
    const flat = flattenTree(tree); // [a, b] — the hidden category has no page
    const { next } = resolveDocPrevNext(tree, flat, "a", noOverrides);
    expect(next?.slug).toBe("b");
  });

  it("returns null prev/next when the slug is not present in the flattened subtree", () => {
    const flat = [node("a"), node("b")];
    const { prev, next } = resolveDocPrevNext(flat, flat, "missing", noOverrides);
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });

  it("resolves a pagination_prev override against the full tree, not just the subtree", () => {
    const target = node("elsewhere/target");
    const a = node("a");
    const b = node("b");
    const tree = [node("elsewhere", { hasPage: false, children: [target] }), a, b];
    const subtreeFlat = [a, b]; // this route's own subtree — target lives elsewhere
    const { prev } = resolveDocPrevNext(tree, subtreeFlat, "b", {
      pagination_prev: "elsewhere/target",
    });
    expect(prev?.slug).toBe("elsewhere/target");
  });

  it("a null override suppresses the link entirely", () => {
    const a = node("a");
    const b = node("b");
    const c = node("c");
    const flat = [a, b, c];
    const { prev, next } = resolveDocPrevNext(flat, flat, "b", {
      pagination_prev: null,
      pagination_next: null,
    });
    expect(prev).toBeNull();
    expect(next).toBeNull();
  });

  it("falls back to the sequential default when an override slug is not found", () => {
    const a = node("a");
    const b = node("b");
    const flat = [a, b];
    const { prev } = resolveDocPrevNext(flat, flat, "b", {
      pagination_prev: "does-not-exist",
    });
    expect(prev?.slug).toBe("a");
  });

  it("an override on one side leaves the other side's sequential default untouched", () => {
    const a = node("a");
    const b = node("b");
    const c = node("c");
    const target = node("z");
    const tree = [a, b, c, target];
    const flat = [a, b, c];
    const { prev, next } = resolveDocPrevNext(tree, flat, "b", {
      pagination_next: "z",
    });
    expect(prev?.slug).toBe("a");
    expect(next?.slug).toBe("z");
  });
});

describe("flattenSubtree", () => {
  it("delegates to flattenTree", () => {
    const tree = [node("a"), node("b", { hasPage: false, children: [node("b/c")] })];
    expect(flattenSubtree(tree).map((n) => n.slug)).toEqual(["a", "b/c"]);
  });
});

describe("rewriteNavHref", () => {
  it("returns null for a null node", () => {
    expect(rewriteNavHref(null, (slug) => `/v/1.0/docs/${slug}/`)).toBeNull();
  });

  it("returns the same node reference untouched when urlFor is not supplied (latest routes)", () => {
    const a = node("a", { href: "/docs/a/" });
    expect(rewriteNavHref(a, undefined)).toBe(a);
  });

  it("rewrites the href via urlFor for a versioned route", () => {
    const a = node("a", { href: "/docs/a/" });
    const result = rewriteNavHref(a, (slug) => `/v/1.0/docs/${slug}/`);
    expect(result?.href).toBe("/v/1.0/docs/a/");
    expect(result).not.toBe(a);
  });

  it("builds a versioned ja-locale href from the node's slug", () => {
    const a = node("guides/intro", { href: "/docs/guides/intro/" });
    const result = rewriteNavHref(a, (slug) => `/v/2.0/ja/docs/${slug}/`);
    expect(result?.href).toBe("/v/2.0/ja/docs/guides/intro/");
  });
});

describe("remapNavChildHrefs", () => {
  it("returns the same children array reference when urlFor is not supplied", () => {
    const children = [node("a", { href: "/docs/a/" })];
    expect(remapNavChildHrefs(children, undefined)).toBe(children);
  });

  it("overrides every child's href unconditionally, even when already set", () => {
    const children = [node("a", { href: "/docs/a/" }), node("b")];
    const result = remapNavChildHrefs(children, (slug) => `/v/1.0/docs/${slug}/`);
    expect(result.map((c) => c.href)).toEqual(["/v/1.0/docs/a/", "/v/1.0/docs/b/"]);
  });

  it("produces versioned ja-locale hrefs for every child", () => {
    const children = [node("intro"), node("advanced")];
    const result = remapNavChildHrefs(children, (slug) => `/v/1.0/ja/docs/${slug}/`);
    expect(result.map((c) => c.href)).toEqual([
      "/v/1.0/ja/docs/intro/",
      "/v/1.0/ja/docs/advanced/",
    ]);
  });
});
