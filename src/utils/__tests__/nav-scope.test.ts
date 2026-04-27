import { describe, it, expect } from "vitest";
import { getNavSectionForSlug } from "../nav-scope";

describe("getNavSectionForSlug", () => {
  it("resolves blog/* slugs to the synthetic 'blog' section", () => {
    // The headerNav entry generated for the blog feature already carries
    // categoryMatch: "blog", but we keep an explicit early return as a
    // defensive default for downstream projects that enable blog routes
    // without the matching headerNav entry. Either way, blog/* MUST
    // resolve to "blog" so the sidebar swaps to the blog tree.
    expect(getNavSectionForSlug("blog/hello-world")).toBe("blog");
    expect(getNavSectionForSlug("blog/archives")).toBe("blog");
    expect(getNavSectionForSlug("blog")).toBe("blog");
  });
});
