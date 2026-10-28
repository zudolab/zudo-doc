import { describe, expect, it } from "vitest";
import { getCategoryOrder, getNavSectionForSlug, getNavSubtree, resolveCategoryOwner, type NavScopeNode } from "../index.js";

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

describe("categoryMatch owns dash satellites", () => {
  const claudeTree = [node("claude"), node("claude-md"), node("claude-skills", [node("claude-skills/x")]), node("claude-commands"), node("claudette"), node("misc")];
  const claudeNav = [{ categoryMatch: "claude" }, { categoryMatch: "!" }];

  it("claude section includes its generated sibling trees", () => {
    expect(slugs(getNavSubtree(claudeTree, "claude", claudeNav))).toEqual(["claude", "claude-md", "claude-skills", "claude-commands"]);
    expect(slugs(getNavSubtree(claudeTree, "!", claudeNav))).toEqual(["claudette", "misc"]);
  });

  it("getNavSectionForSlug resolves satellite pages to the primary section", () => {
    expect(getNavSectionForSlug("claude-skills/x", claudeNav)).toBe("claude");
    expect(getNavSectionForSlug("claude-md", claudeNav)).toBe("claude");
    expect(getNavSectionForSlug("claudette/x", claudeNav)).toBe("!");
  });

  const fooTree = [node("foo"), node("foo-bar"), node("foo-bar-baz"), node("foo-baz"), node("misc")];
  for (const nav of [
    [{ categoryMatch: "foo" }, { categoryMatch: "foo-bar" }, { categoryMatch: "!" }],
    [{ categoryMatch: "foo-bar" }, { categoryMatch: "foo" }, { categoryMatch: "!" }],
  ]) {
    const order = nav.map((n) => n.categoryMatch).join(",");
    it(`the longest explicit match wins regardless of order (${order})`, () => {
      expect(resolveCategoryOwner("foo-bar-baz/x", getCategoryOrder(nav))).toBe("foo-bar");
      expect(getNavSectionForSlug("foo-baz/x", nav)).toBe("foo");
      expect(slugs(getNavSubtree(fooTree, "foo", nav))).toEqual(["foo", "foo-baz"]);
      expect(slugs(getNavSubtree(fooTree, "foo-bar", nav))).toEqual(["foo-bar", "foo-bar-baz"]);
      expect(slugs(getNavSubtree(fooTree, "!", nav))).toEqual(["misc"]);
    });
  }
});
