import { describe, it, expect } from "vitest";
import { createComposeMetaTitle } from "../index.js";

describe("createComposeMetaTitle", () => {
  const compose = createComposeMetaTitle("My Site");

  it("returns '<title> | <siteName>' for a normal page title", () => {
    expect(compose("Getting Started")).toBe("Getting Started | My Site");
  });

  it("returns bare site name when title equals siteName (home page case)", () => {
    expect(compose("My Site")).toBe("My Site");
  });

  it("falls back to bare title when siteName is empty", () => {
    const noSite = createComposeMetaTitle("");
    expect(noSite("Getting Started")).toBe("Getting Started");
  });

  it("produces identical output to the original inline logic for arbitrary titles", () => {
    // Verify the factory output matches what the original pages/lib file did.
    // Original: if (!siteName) return title; if (title === siteName) return siteName;
    //           return `${title} | ${siteName}`;
    const siteName = "My Site";
    const originalLogic = (title: string): string => {
      if (!siteName) return title;
      if (title === siteName) return siteName;
      return `${title} | ${siteName}`;
    };
    const factory = createComposeMetaTitle(siteName);
    const cases = [
      "Getting Started",
      "API Reference",
      "My Site",
      "",
      "A very long page title with special characters: <>&",
    ];
    for (const title of cases) {
      expect(factory(title)).toBe(originalLogic(title));
    }
  });
});
