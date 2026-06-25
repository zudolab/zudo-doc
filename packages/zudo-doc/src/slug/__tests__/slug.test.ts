import { describe, expect, it } from "vitest";
import {
  toRouteSlug,
  toHistorySlug,
  toSlugParams,
  toTitleCase,
} from "../index.js";

describe("toRouteSlug", () => {
  it("maps a bare root index to the empty slug (URL /docs/)", () => {
    expect(toRouteSlug("index")).toBe("");
  });

  it("strips a trailing /index from a nested id", () => {
    expect(toRouteSlug("guides/index")).toBe("guides");
  });

  it("passes through a regular slug unchanged", () => {
    expect(toRouteSlug("guides/getting-started")).toBe(
      "guides/getting-started",
    );
  });
});

describe("toHistorySlug", () => {
  it("maps the empty route slug to the 'index' storage sentinel", () => {
    expect(toHistorySlug("")).toBe("index");
  });

  it("passes non-empty slugs through unchanged", () => {
    expect(toHistorySlug("guides")).toBe("guides");
  });
});

describe("toSlugParams", () => {
  it("maps the bare root to an empty params array", () => {
    expect(toSlugParams("")).toEqual([]);
  });

  it("splits a multi-segment slug on '/'", () => {
    expect(toSlugParams("a/b/c")).toEqual(["a", "b", "c"]);
  });
});

describe("toTitleCase", () => {
  it("title-cases a hyphenated slug", () => {
    expect(toTitleCase("getting-started")).toBe("Getting Started");
  });
});
