import { describe, expect, it } from "vitest";

import { resolvePageTags, resolveTag } from "../tag-helpers/index.js";
import type { TagVocabularyEntry } from "../settings.js";

const vocabulary: readonly TagVocabularyEntry[] = [
  { id: "type:tutorial", label: "Tutorial", group: "type" },
  { id: "ai", label: "AI", description: "AI features", group: "topic" },
];

describe("canonical tag helpers", () => {
  it("recognizes exact ids and treats retired aliases as unknown", () => {
    expect(resolveTag("type:tutorial", vocabulary, "warn")).toEqual({
      canonical: "type:tutorial",
      known: true,
    });
    expect(resolveTag("tutorials", vocabulary, "warn")).toEqual({
      canonical: "tutorials",
      known: false,
    });
  });

  it("deduplicates exact repeats without collapsing unknown and canonical ids", () => {
    expect(
      resolvePageTags(
        ["tutorials", "type:tutorial", "tutorials", "type:tutorial"],
        vocabulary,
        "strict",
      ),
    ).toEqual(["tutorials", "type:tutorial"]);
  });

  it("preserves pass-through behavior when governance is off", () => {
    expect(resolveTag("type:tutorial", vocabulary, "off")).toEqual({
      canonical: "type:tutorial",
      known: false,
    });
    expect(resolvePageTags(["x", "x", "type:tutorial"], vocabulary, "off")).toEqual([
      "x",
      "type:tutorial",
    ]);
  });
});
