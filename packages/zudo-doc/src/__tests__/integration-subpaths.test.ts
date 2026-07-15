import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
) as { exports: Record<string, unknown> };

describe("current integration subpaths", () => {
  it("exports all five current zfb plugins", () => {
    expect(Object.keys(packageJson.exports)).toEqual(
      expect.arrayContaining([
        "./plugins/doc-history",
        "./plugins/llms-txt",
        "./plugins/search-index",
        "./plugins/claude-resources",
        "./plugins/changelog",
      ]),
    );
  });

  it("does not export descriptor-style compatibility integrations", () => {
    for (const subpath of [
      "./integrations/doc-history",
      "./integrations/llms-txt",
      "./integrations/search-index",
      "./integrations/claude-resources",
    ]) {
      expect(packageJson.exports).not.toHaveProperty(subpath);
    }
  });

  it("retains the current changelog helper API", () => {
    expect(packageJson.exports).toHaveProperty("./integrations/changelog");
  });
});
