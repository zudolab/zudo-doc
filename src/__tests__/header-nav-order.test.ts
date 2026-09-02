import { describe, expect, it } from "vitest";
import { settings } from "@/config/settings";

describe("showcase header navigation", () => {
  it("keeps the complete root order", () => {
    expect(settings.headerNav.map((item) => item.label)).toEqual([
      "Getting Started",
      "Learn",
      "Reference",
      "Develop",
      "Changelog",
      "Assets",
      "Blog",
      "Claude",
      "Codex",
    ]);
  });
});
