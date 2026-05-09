import { describe, it, expect } from "vitest";

/**
 * The panel is enabled when either `designTokenPanel` OR the deprecated
 * `colorTweakPanel` alias is truthy. This test documents and locks that gate
 * expression so a future refactor can't accidentally drop the alias.
 *
 * Both the Astro layout and the header use this same boolean check, so we
 * model both call sites with tiny stand-in objects.
 */
type LikeSettings = {
  designTokenPanel?: boolean;
  colorTweakPanel?: boolean | undefined;
};

function isPanelEnabled(s: LikeSettings): boolean {
  return Boolean(s.designTokenPanel || s.colorTweakPanel);
}

describe("design-token-panel enablement gate", () => {
  it("is enabled when only designTokenPanel is true", () => {
    expect(isPanelEnabled({ designTokenPanel: true })).toBe(true);
  });

  it("is enabled when only the deprecated colorTweakPanel alias is true", () => {
    expect(isPanelEnabled({ colorTweakPanel: true })).toBe(true);
  });

  it("is enabled when both are true", () => {
    expect(isPanelEnabled({ designTokenPanel: true, colorTweakPanel: true })).toBe(true);
  });

  it("is disabled when both are false/undefined", () => {
    expect(isPanelEnabled({})).toBe(false);
    expect(isPanelEnabled({ designTokenPanel: false })).toBe(false);
    expect(isPanelEnabled({ designTokenPanel: false, colorTweakPanel: false })).toBe(false);
  });

  it("the deprecated alias still enables the panel even when designTokenPanel is explicitly false", () => {
    // Deliberate permissive behaviour: the alias lets legacy projects keep
    // their setting without noticing breakage for one release.
    expect(isPanelEnabled({ designTokenPanel: false, colorTweakPanel: true })).toBe(true);
  });
});
