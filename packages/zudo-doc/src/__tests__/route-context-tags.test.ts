import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../config.js";
import { createRouteContext } from "../route-context/index.js";

function makeContext(tagGovernance: "off" | "warn" | "strict" = "warn") {
  return createRouteContext(
    {
      settings: {
        ...DEFAULT_SETTINGS,
        tagVocabulary: true,
        tagGovernance,
      },
      translations: {},
      tagVocabulary: [
        { id: "type:tutorial", label: "Tutorial", group: "type" },
        { id: "ai", label: "AI", group: "topic" },
      ],
      colorSchemes: null,
      themePackRegistry: null,
    },
    { stableDocs: () => [] },
  );
}

describe("createRouteContext canonical tag aggregation", () => {
  it("keeps exact canonical ids and retired ids as separate tag pages", () => {
    const ctx = makeContext();
    const tags = ctx.collectTags(
      [
        {
          slug: "guide",
          data: {
            title: "Guide",
            tags: ["type:tutorial", "tutorials", "type:tutorial"],
          },
        },
      ],
      (slug) => slug,
    );

    expect([...tags.keys()]).toEqual(["type:tutorial", "tutorials"]);
    expect(tags.get("type:tutorial")).toMatchObject({
      tag: "type:tutorial",
      count: 1,
    });
    expect(tags.get("tutorials")).toMatchObject({ tag: "tutorials", count: 1 });
  });

  it("reports exact vocabulary membership through the bound helper", () => {
    const ctx = makeContext("strict");
    expect(ctx.resolveTagBound("ai")).toEqual({ canonical: "ai", known: true });
    expect(ctx.resolveTagBound("artificial-intelligence")).toEqual({
      canonical: "artificial-intelligence",
      known: false,
    });
  });
});
