import { describe, it, expect, beforeAll } from "vitest";
import { resolveTag, resolvePageTags } from "../tags";
import { settings } from "@/config/settings";

// Guard: these tests rely on the default settings shipping
// `tagVocabulary: true` with a non-"off" governance mode, and on the
// vocabulary declaring `"tutorials"` as an alias for `"type:tutorial"`.
// If any of those change, fail loudly here instead of via cryptic asserts below.
beforeAll(() => {
  expect(settings.tagVocabulary).toBe(true);
  expect(settings.tagGovernance).not.toBe("off");
});

describe("resolveTag", () => {
  it("rewrites a known alias to its canonical id", () => {
    expect(resolveTag("tutorials")).toEqual({
      canonical: "type:tutorial",
      known: true,
      deprecated: false,
    });
  });

  it("passes through a canonical id unchanged", () => {
    expect(resolveTag("type:tutorial")).toEqual({
      canonical: "type:tutorial",
      known: true,
      deprecated: false,
    });
  });

  it("passes through an unknown tag with known: false", () => {
    expect(resolveTag("this-tag-does-not-exist")).toEqual({
      canonical: "this-tag-does-not-exist",
      known: false,
      deprecated: false,
    });
  });
});

describe("resolvePageTags", () => {
  it("rewrites aliases and deduplicates after collapse", () => {
    expect(resolvePageTags(["tutorials", "type:tutorial", "ai"])).toEqual([
      "type:tutorial",
      "ai",
    ]);
  });
});
