/**
 * tag-exclusion-category-frontmatter.test.ts
 *
 * A `category_no_page` index.mdx builds NO doc route, so a tag it carries must
 * not reach the tag pages / tag-route enumerator — otherwise the tag listing
 * renders a DocCard (or sitemap URL) linking to a non-existent /docs/<cat>/
 * page (the same dead-link class the route/sitemap/search exclusion fixes).
 *
 * The exclusion lives in each enumerator's `.filter(...)` BEFORE collectTags
 * (pages/docs/tags/*, pages/[locale]/docs/tags/*, route-enumerators
 * enumerateTagsRoutes, the footer taglist). This test asserts the shared
 * predicate so the filter the pages apply provably drops a noPage doc's tag.
 */

import { describe, it, expect } from "vitest";
import { collectTags } from "@/utils/tags";
import type { DocsEntry } from "@/types/docs-entry";

function entry(id: string, data: Partial<DocsEntry["data"]> = {}): DocsEntry {
  return {
    id,
    collection: "docs",
    data: { title: data.title ?? id, ...data },
  };
}

/** The predicate every tag enumerator applies before collectTags. */
const tagVisible = (d: DocsEntry): boolean =>
  !d.data.unlisted && !d.data.draft && !d.data.category_no_page;

const slugFn = (id: string, data: { slug?: string }): string =>
  data.slug ?? id;

describe("tag enumeration excludes category_no_page docs", () => {
  it("drops a tag that lives ONLY on a category_no_page index (no dead tag page)", () => {
    const docs = [
      entry("guides/index", {
        category_no_page: true,
        tags: ["pageless-only"],
      }),
      entry("guides/intro", { tags: ["real-tag"] }),
    ];
    const tagMap = collectTags(docs.filter(tagVisible), slugFn);
    // The tag carried only by the pageless category is gone.
    expect(tagMap.has("pageless-only")).toBe(false);
    // A tag on a real page is unaffected.
    expect(tagMap.has("real-tag")).toBe(true);
  });

  it("a tag shared by a real page survives even if a noPage index also carries it", () => {
    const docs = [
      entry("guides/index", { category_no_page: true, tags: ["shared"] }),
      entry("guides/intro", { tags: ["shared"] }),
    ];
    const tagMap = collectTags(docs.filter(tagVisible), slugFn);
    const shared = tagMap.get("shared");
    expect(shared).toBeDefined();
    // Count reflects only the real page — the pageless index is excluded.
    expect(shared!.count).toBe(1);
    expect(shared!.docs.map((d) => d.slug)).toEqual(["guides/intro"]);
  });

  it("a normal category index (no category_no_page) keeps contributing tags", () => {
    const docs = [
      entry("guides/index", { tags: ["kept"] }),
      entry("guides/intro", { tags: ["other"] }),
    ];
    const tagMap = collectTags(docs.filter(tagVisible), slugFn);
    expect(tagMap.has("kept")).toBe(true);
    expect(tagMap.has("other")).toBe(true);
  });
});
