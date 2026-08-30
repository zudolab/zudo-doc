import { describe, expect, it } from "vitest";
import { ASSET_PAGE_SCRIPT } from "../script.js";

describe("asset page inline script", () => {
  it("parses and initializes on first paint and after SPA swaps", () => {
    expect(() => new Function(ASSET_PAGE_SCRIPT)).not.toThrow();
    expect(ASSET_PAGE_SCRIPT).toContain("init();");
    expect(ASSET_PAGE_SCRIPT).toContain("zfb:after-swap");
  });
});
