import { describe, expect, it } from "vitest";
import {
  initialCategoryOpenState,
  toggleCategoryOpenState,
} from "../state.js";

describe("SiteTreeNav category state", () => {
  it("starts expanded unless the category is explicitly collapsed", () => {
    expect(initialCategoryOpenState(false)).toBe(true);
    expect(initialCategoryOpenState(true)).toBe(false);
  });

  it("allows an initially collapsed category to expand and collapse again", () => {
    const initial = initialCategoryOpenState(true);
    const expanded = toggleCategoryOpenState(initial);

    expect(expanded).toBe(true);
    expect(toggleCategoryOpenState(expanded)).toBe(false);
  });
});
