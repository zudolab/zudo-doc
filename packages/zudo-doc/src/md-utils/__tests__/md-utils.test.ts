import { describe, it, expect } from "vitest";
import {
  isExcluded,
  slugToUrl,
  stripMarkdown,
  type MdDocFrontmatter,
} from "../index.js";

// Consolidates the formerly-duplicated is-excluded suites of the
// search-index and llms-txt integrations (zudo-doc#2024) — both now run
// on this single shared implementation.
describe("md-utils isExcluded", () => {
  it("includes a normal page", () => {
    expect(isExcluded({ title: "Intro" })).toBe(false);
  });

  it("excludes draft / unlisted / search_exclude pages", () => {
    expect(isExcluded({ draft: true })).toBe(true);
    expect(isExcluded({ unlisted: true })).toBe(true);
    expect(isExcluded({ search_exclude: true })).toBe(true);
  });

  it("excludes a category_no_page metadata-only index (no built route to link to)", () => {
    const data: MdDocFrontmatter = { title: "Guides", category_no_page: true };
    expect(isExcluded(data)).toBe(true);
  });

  it("does NOT exclude a category index that omits category_no_page", () => {
    expect(isExcluded({ title: "Guides", category_no_page: false })).toBe(
      false,
    );
  });
});

describe("md-utils stripMarkdown JSX comment removal (zudo-doc#2175)", () => {
  it("removes a leading single-line JSX comment so it can't become a summary", () => {
    const stripped = stripMarkdown("{/* internal note */}\n\nReal first line.");
    const firstLine = stripped
      .split("\n")
      .find((l) => l.trim().length > 0);
    expect(firstLine).toBe("Real first line.");
    expect(stripped).not.toContain("internal note");
  });

  it("removes a multi-line JSX comment from the body", () => {
    const stripped = stripMarkdown(
      "Intro line.\n\n{/* a comment\nspanning lines */}\n\nOutro line.",
    );
    expect(stripped).not.toContain("{/*");
    expect(stripped).not.toContain("spanning lines");
    expect(stripped).toContain("Intro line.");
    expect(stripped).toContain("Outro line.");
  });
});

describe("md-utils slugToUrl", () => {
  it("builds a path-only default-locale URL", () => {
    expect(slugToUrl("guides/intro", null, "")).toBe("/docs/guides/intro");
  });

  it("builds a locale-prefixed URL and trims the trailing base slash", () => {
    expect(slugToUrl("guides/intro", "ja", "/base/")).toBe(
      "/base/ja/docs/guides/intro",
    );
  });

  it("prefixes siteUrl when supplied", () => {
    expect(slugToUrl("guides/intro", null, "", "https://example.com/")).toBe(
      "https://example.com/docs/guides/intro",
    );
  });
});
