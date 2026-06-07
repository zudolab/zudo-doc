import { describe, it, expect } from "vitest";
import { isExcluded } from "../load.js";
import type { LlmsTxtFrontmatter } from "../types.js";

describe("llms-txt isExcluded", () => {
  it("includes a normal page", () => {
    expect(isExcluded({ title: "Intro" })).toBe(false);
  });

  it("excludes draft / unlisted / search_exclude pages", () => {
    expect(isExcluded({ draft: true })).toBe(true);
    expect(isExcluded({ unlisted: true })).toBe(true);
    expect(isExcluded({ search_exclude: true })).toBe(true);
  });

  it("excludes a category_no_page metadata-only index (no built route to link to)", () => {
    const data: LlmsTxtFrontmatter = { title: "Guides", category_no_page: true };
    expect(isExcluded(data)).toBe(true);
  });

  it("does NOT exclude a category index that omits category_no_page", () => {
    expect(isExcluded({ title: "Guides", category_no_page: false })).toBe(false);
  });
});
