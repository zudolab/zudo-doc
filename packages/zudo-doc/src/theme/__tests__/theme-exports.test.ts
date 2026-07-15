import { describe, expect, it } from "vitest";
import * as theme from "../index.js";

describe("theme public exports", () => {
  it("contains only the current theme controls", () => {
    expect(Object.keys(theme).sort()).toEqual([
      "ColorSchemeProvider",
      "ThemeToggle",
    ]);
  });
});
