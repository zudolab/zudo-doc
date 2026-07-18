import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateFrontmatterPillContrast,
  parsePillCssRecipe,
  PILL_ROLES,
  REQUIRED_PILL_PACKS,
} from "../frontmatter-pill-contrast";

describe("frontmatter status pill contrast", () => {
  it("keeps the actual CSS on the shared pill-specific derivation", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");
    expect(parsePillCssRecipe(css)).toEqual({
      foregroundRolePct: 90,
      backgroundRolePct: 12,
    });
  });

  it("clears WCAG AA with headroom across every required pack, mode, and role", () => {
    const results = evaluateFrontmatterPillContrast();
    expect(results).toHaveLength(
      REQUIRED_PILL_PACKS.length * 2 * PILL_ROLES.length,
    );

    const failures = results.filter((result) => !result.pass);
    expect(
      failures,
      failures.map((result) => `${result.pack}/${result.mode}/${result.role}: ${result.ratio}`).join("\n"),
    ).toEqual([]);

    const floor = Math.min(...results.map((result) => result.ratio));
    expect(floor).toBeGreaterThanOrEqual(4.6);
  });
});
