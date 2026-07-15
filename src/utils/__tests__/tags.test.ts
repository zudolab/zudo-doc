import { describe, it, expect, beforeAll } from "vitest";
import { resolveTag, resolvePageTags } from "../tags";
import { settings } from "@/config/settings";

// Guard: these tests rely on the default settings shipping
// `tagVocabulary: true` with a non-"off" governance mode. The host vocabulary
// itself is canonical-only; package-level tests retain coverage for the alias
// compatibility paths until their removal in #2769.
beforeAll(() => {
  expect(settings.tagVocabulary).toBe(true);
  expect(settings.tagGovernance).not.toBe("off");
});

describe("resolveTag", () => {
  it("treats a retired alias as unknown when the host does not declare it", () => {
    expect(resolveTag("tutorials")).toEqual({
      canonical: "tutorials",
      known: false,
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
  it("preserves canonical ids and deduplicates exact repeats", () => {
    expect(resolvePageTags(["type:tutorial", "type:tutorial", "ai"])).toEqual([
      "type:tutorial",
      "ai",
    ]);
  });
});
