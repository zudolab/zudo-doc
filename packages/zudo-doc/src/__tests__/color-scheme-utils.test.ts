import { describe, it, expect } from "vitest";
import {
  resolveRampRef,
  resolveSemanticColors,
  schemeToCssPairs,
  generateCssCustomProperties,
  generateLightDarkCssProperties,
  SEMANTIC_RAMP_DEFAULTS,
  SEMANTIC_CSS_NAMES,
  SEMANTIC_KEYS,
  STATE_ROLES,
  type ColorScheme,
  type Ramps,
} from "../color-scheme-utils.js";

// A synthetic ramp set with easily-distinguishable stop values so tests can
// assert exactly which stop a role resolved to.
function makeRamps(): Ramps {
  return {
    base: Array.from({ length: 12 }, (_, i) => `base-${i}`),
    accent: Array.from({ length: 7 }, (_, i) => `accent-${i}`),
    state: {
      danger: "state-danger",
      success: "state-success",
      warning: "state-warning",
      info: "state-info",
    },
  };
}

function makeScheme(): ColorScheme {
  return {
    ramps: makeRamps(),
    map: {
      bg: { base: 11 },
      fg: { base: 1 },
      selectionBg: { base: 8 },
      selectionFg: { base: 1 },
      semantic: { ...SEMANTIC_RAMP_DEFAULTS },
    },
  };
}

describe("resolveRampRef", () => {
  const ramps = makeRamps();

  it("resolves {base:N} to ramps.base[N]", () => {
    expect(resolveRampRef({ base: 0 }, ramps)).toBe("base-0");
    expect(resolveRampRef({ base: 11 }, ramps)).toBe("base-11");
  });

  it("resolves {accent:N} to ramps.accent[N]", () => {
    expect(resolveRampRef({ accent: 0 }, ramps)).toBe("accent-0");
    expect(resolveRampRef({ accent: 6 }, ramps)).toBe("accent-6");
  });

  it("resolves {state:role} to ramps.state[role]", () => {
    expect(resolveRampRef({ state: "danger" }, ramps)).toBe("state-danger");
    expect(resolveRampRef({ state: "success" }, ramps)).toBe("state-success");
    expect(resolveRampRef({ state: "warning" }, ramps)).toBe("state-warning");
    expect(resolveRampRef({ state: "info" }, ramps)).toBe("state-info");
  });

  it("returns a literal OKLCH string as-is", () => {
    expect(resolveRampRef("oklch(0.5 0.1 200)", ramps)).toBe("oklch(0.5 0.1 200)");
  });

  it("throws RangeError on an out-of-range base index", () => {
    expect(() => resolveRampRef({ base: 12 }, ramps)).toThrow(RangeError);
  });

  it("throws RangeError on an out-of-range accent index", () => {
    expect(() => resolveRampRef({ accent: 7 }, ramps)).toThrow(RangeError);
  });
});

describe("resolveSemanticColors", () => {
  it("returns all 23 semantic keys as concrete strings", () => {
    const sem = resolveSemanticColors(makeScheme());
    expect(Object.keys(sem).sort()).toEqual([...SEMANTIC_KEYS].sort());
    for (const key of SEMANTIC_KEYS) {
      expect(typeof sem[key]).toBe("string");
      expect(sem[key].length).toBeGreaterThan(0);
    }
  });

  it("resolves each role through its map RampRef against the ramps", () => {
    const sem = resolveSemanticColors(makeScheme());
    // Sample the defaults table: surface={base:9}, accent={accent:3},
    // danger={state:danger}, matchedKeywordBg=literal.
    expect(sem.surface).toBe("base-9");
    expect(sem.muted).toBe("base-6");
    expect(sem.accent).toBe("accent-3");
    expect(sem.accentHover).toBe("accent-2");
    expect(sem.codeBg).toBe("base-10");
    expect(sem.codeFg).toBe("base-2");
    expect(sem.danger).toBe("state-danger");
    expect(sem.success).toBe("state-success");
    expect(sem.matchedKeywordBg).toBe(SEMANTIC_RAMP_DEFAULTS.matchedKeywordBg);
  });
});

describe("schemeToCssPairs — emit contract", () => {
  const emitted = new Map(schemeToCssPairs(makeScheme()));
  const keys = [...emitted.keys()];

  it("emits EXACTLY the expected set of custom properties", () => {
    const expected = [
      // 4 base roles
      "--zd-bg",
      "--zd-fg",
      "--zd-selection-bg",
      "--zd-selection-fg",
      // --palette-base-0..11
      ...Array.from({ length: 12 }, (_, i) => `--palette-base-${i}`),
      // --palette-accent-0..6
      ...Array.from({ length: 7 }, (_, i) => `--palette-accent-${i}`),
      // --palette-state-*
      ...STATE_ROLES.map((r) => `--palette-state-${r}`),
      // 23 --zd-{role}
      ...SEMANTIC_KEYS.map((k) => SEMANTIC_CSS_NAMES[k]),
    ];
    expect(keys.slice().sort()).toEqual(expected.slice().sort());
    // 4 + 12 + 7 + 4 + 23 = 50, and no duplicate keys.
    expect(keys.length).toBe(50);
    expect(new Set(keys).size).toBe(50);
  });

  it("does NOT emit the retired --zd-0..15 slots", () => {
    for (let i = 0; i <= 15; i++) {
      expect(emitted.has(`--zd-${i}`)).toBe(false);
    }
  });

  it("does NOT emit --zd-cursor", () => {
    expect(emitted.has("--zd-cursor")).toBe(false);
  });

  it("resolves base roles through the map", () => {
    expect(emitted.get("--zd-bg")).toBe("base-11");
    expect(emitted.get("--zd-fg")).toBe("base-1");
    expect(emitted.get("--zd-selection-bg")).toBe("base-8");
    expect(emitted.get("--zd-selection-fg")).toBe("base-1");
  });

  it("emits Tier-1 ramps verbatim", () => {
    expect(emitted.get("--palette-base-0")).toBe("base-0");
    expect(emitted.get("--palette-accent-6")).toBe("accent-6");
    expect(emitted.get("--palette-state-danger")).toBe("state-danger");
  });
});

describe("schemeToCssPairs — scopes", () => {
  const scheme = makeScheme();

  it('"palette" scope emits only the 23 --palette-* pairs', () => {
    const keys = schemeToCssPairs(scheme, "palette").map(([k]) => k);
    expect(keys.length).toBe(23); // 12 + 7 + 4
    expect(keys.every((k) => k.startsWith("--palette-"))).toBe(true);
  });

  it('"roles" scope emits base roles + 23 semantic (--zd-*) pairs', () => {
    const keys = schemeToCssPairs(scheme, "roles").map(([k]) => k);
    expect(keys.length).toBe(27); // 4 + 23
    expect(keys.every((k) => k.startsWith("--zd-"))).toBe(true);
    expect(keys.some((k) => k.startsWith("--palette-"))).toBe(false);
  });
});

describe("generateCssCustomProperties", () => {
  it("wraps the full pair set in a :root block", () => {
    const css = generateCssCustomProperties(makeScheme());
    expect(css.startsWith(":root {")).toBe(true);
    expect(css.trimEnd().endsWith("}")).toBe(true);
    expect(css).toContain("--zd-bg: base-11;");
    expect(css).toContain("--palette-base-0: base-0;");
    expect(css).toContain("--zd-surface: base-9;");
    expect(css).not.toContain("--zd-cursor");
    expect(css).not.toMatch(/--zd-\d+:/);
  });
});

describe("generateLightDarkCssProperties", () => {
  const light = makeScheme();
  // Give dark a distinct bg so we can see the light-dark(L, D) ordering.
  const dark: ColorScheme = {
    ramps: makeRamps(),
    map: { ...light.map, bg: { base: 0 } },
  };
  const css = generateLightDarkCssProperties(light, dark);

  it("declares color-scheme: light dark", () => {
    expect(css).toContain("color-scheme: light dark;");
  });

  it("emits --palette-* bare (not wrapped in light-dark)", () => {
    expect(css).toContain("--palette-base-0: base-0;");
    expect(css).not.toMatch(/--palette-[a-z0-9-]+:\s*light-dark/);
  });

  it("wraps --zd-* roles in light-dark(L, D)", () => {
    // light bg = base-11, dark bg = base-0
    expect(css).toContain("--zd-bg: light-dark(base-11, base-0);");
    expect(css).toContain("--zd-surface: light-dark(base-9, base-9);");
  });

  it("does not emit retired slots or cursor", () => {
    expect(css).not.toContain("--zd-cursor");
    expect(css).not.toMatch(/--zd-\d+:/);
  });
});
