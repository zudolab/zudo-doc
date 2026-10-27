import { describe, expect, it } from "vitest";
import { getNavSectionForSlug, getNavSubtree, type NavScopeNode } from "../index.js";

const node = (slug: string, children: NavScopeNode[] = []): NavScopeNode => ({ slug, children });
const tree = [node("foo", [node("foo/bar")]), node("foo2", [node("foo2/x")]), node("misc")];
const headerNav = [{ categoryMatch: "foo" }, { categoryMatch: "foo2" }, { categoryMatch: "!" }];
const slugs = (nodes: NavScopeNode[]) => nodes.map((n) => n.slug);

describe("categoryMatch matches the whole top-level segment", () => {
  it("foo section excludes foo2 and keeps nested foo slugs", () => {
    expect(slugs(getNavSubtree(tree, "foo", headerNav))).toEqual(["foo"]);
  });

  it("foo2 section includes only foo2", () => {
    expect(slugs(getNavSubtree(tree, "foo2", headerNav))).toEqual(["foo2"]);
  });

  it('"!" section includes foo2 when only foo is explicit', () => {
    expect(slugs(getNavSubtree(tree, "!", [{ categoryMatch: "foo" }, { categoryMatch: "!" }]))).toEqual(["foo2", "misc"]);
  });

  it("getNavSectionForSlug does not resolve foo2/x to foo", () => {
    expect(getNavSectionForSlug("foo2/x", headerNav)).toBe("foo2");
    expect(getNavSectionForSlug("foo2/x", [{ categoryMatch: "foo" }, { categoryMatch: "!" }])).toBe("!");
    expect(getNavSectionForSlug("foo/bar", headerNav)).toBe("foo");
  });
});
