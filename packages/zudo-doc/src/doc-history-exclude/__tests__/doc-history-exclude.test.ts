import { describe, expect, it } from "vitest";
import { compileExclude } from "../index.js";

describe("compileExclude", () => {
  it("matches ** across any number of segments", () => {
    const isExcluded = compileExclude(["guides/**/draft"]);
    expect(isExcluded("guides/draft")).toBe(true);
    expect(isExcluded("guides/internal/deep/draft")).toBe(true);
  });

  it("matches * only within one segment", () => {
    const isExcluded = compileExclude(["guides/*"]);
    expect(isExcluded("guides/intro")).toBe(true);
    expect(isExcluded("guides/nested/intro")).toBe(false);
  });

  it("matches ? as exactly one non-slash character", () => {
    const isExcluded = compileExclude(["release-?.notes"]);
    expect(isExcluded("release-1.notes")).toBe(true);
    expect(isExcluded("release-10.notes")).toBe(false);
  });

  it("matches literal text exactly and escapes regexp syntax", () => {
    const isExcluded = compileExclude(["api/v1.0+(legacy)"]);
    expect(isExcluded("api/v1.0+(legacy)")).toBe(true);
    expect(isExcluded("api/v1x00legacy")).toBe(false);
  });

  it("does not match an unrelated slug", () => {
    expect(compileExclude(["drafts/**"])("guides/intro")).toBe(false);
  });

  it("never excludes when the pattern list is empty", () => {
    expect(compileExclude([])("anything/nested")).toBe(false);
  });

  it("matches the root index slug", () => {
    expect(compileExclude(["index"])("index")).toBe(true);
  });

  // A trailing `/**` must also match the parent itself — `**` may span zero
  // segments. This is the branch `doc-history-area` relies on to suppress the
  // island for an excluded section's own index page.
  it("matches the parent itself for a trailing /**", () => {
    const isExcluded = compileExclude(["drafts/**"]);
    expect(isExcluded("drafts")).toBe(true);
    expect(isExcluded("drafts/one")).toBe(true);
    expect(isExcluded("drafts/one/two")).toBe(true);
  });

  it("excludes when any one of several patterns matches", () => {
    const isExcluded = compileExclude(["drafts/**", "internal/*"]);
    expect(isExcluded("drafts/x")).toBe(true);
    expect(isExcluded("internal/y")).toBe(true);
    expect(isExcluded("guides/z")).toBe(false);
  });
});
