import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateFrontmatterPillContrast,
  getShippedPillPacks,
  parsePillCssRecipe,
  PILL_ROLES,
} from "../frontmatter-pill-contrast";

describe("frontmatter status pill contrast", () => {
  it("keeps the actual CSS on the shared pill-specific derivation", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");
    expect(parsePillCssRecipe(css)).toEqual({
      foregroundRolePct: {
        danger: 92,
        success: 92,
        warning: 92,
        info: 92,
        muted: 45,
      },
      backgroundRolePct: 12,
    });
  });

  it("clears WCAG AA with headroom across every shipped pack, mode, and role", () => {
    const packs = getShippedPillPacks();
    const results = evaluateFrontmatterPillContrast();
    expect(packs).toHaveLength(21);
    expect(results).toHaveLength(210);
    expect(results).toHaveLength(packs.length * 2 * PILL_ROLES.length);

    const failures = results.filter((result) => !result.pass);
    expect(
      failures,
      failures
        .map(
          (result) =>
            `${result.pack}/${result.mode}/${result.role}: ${result.ratio}`,
        )
        .join("\n"),
    ).toEqual([]);

    const floor = results.reduce((lowest, result) =>
      result.ratio < lowest.ratio ? result : lowest,
    );
    expect(
      floor.ratio,
      `Headroom floor at ${floor.pack}/${floor.mode}/${floor.role}: ${floor.ratio}`,
    ).toBeGreaterThanOrEqual(4.53);
  });
});
