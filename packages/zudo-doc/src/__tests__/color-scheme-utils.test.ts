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
// assert exactly which stop a role resolved to. Lengths track the minimized
// 5-base / 3-accent ramp (#2602).
function makeRamps(): Ramps {
  return {
    base: Array.from({ length: 5 }, (_, i) => `base-${i}`),
    accent: Array.from({ length: 3 }, (_, i) => `accent-${i}`),
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
      bg: { base: 4 },
      fg: { base: 0 },
      selectionBg: { base: 2 },
      selectionFg: { base: 0 },
      semantic: { ...SEMANTIC_RAMP_DEFAULTS },
    },
  };
}

describe("resolveRampRef", () => {
  const ramps = makeRamps();

  it("resolves {base:N} to ramps.base[N]", () => {
    expect(resolveRampRef({ base: 0 }, ramps)).toBe("base-0");
    expect(resolveRampRef({ base: 4 }, ramps)).toBe("base-4");
  });

  it("resolves {accent:N} to ramps.accent[N]", () => {
    expect(resolveRampRef({ accent: 0 }, ramps)).toBe("accent-0");
    expect(resolveRampRef({ accent: 2 }, ramps)).toBe("accent-2");
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
    expect(() => resolveRampRef({ base: 5 }, ramps)).toThrow(RangeError);
  });

  it("throws RangeError on an out-of-range accent index", () => {
    expect(() => resolveRampRef({ accent: 3 }, ramps)).toThrow(RangeError);
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
    // Sample the minimized defaults table: surface={base:4}, accent={accent:1},
    // danger={state:danger}, matchedKeywordBg=literal.
    expect(sem.surface).toBe("base-4");
    expect(sem.muted).toBe("base-1");
    expect(sem.accent).toBe("accent-1");
    expect(sem.accentHover).toBe("accent-0");
    expect(sem.codeBg).toBe("base-3");
    expect(sem.codeFg).toBe("base-0");
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
      // --palette-base-0..4
      ...Array.from({ length: 5 }, (_, i) => `--palette-base-${i}`),
      // --palette-accent-0..2
      ...Array.from({ length: 3 }, (_, i) => `--palette-accent-${i}`),
      // --palette-state-*
      ...STATE_ROLES.map((r) => `--palette-state-${r}`),
      // 23 --zd-{role}
      ...SEMANTIC_KEYS.map((k) => SEMANTIC_CSS_NAMES[k]),
    ];
    expect(keys.slice().sort()).toEqual(expected.slice().sort());
    // 4 + 5 + 3 + 4 + 23 = 39, and no duplicate keys.
    expect(keys.length).toBe(39);
    expect(new Set(keys).size).toBe(39);
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
    expect(emitted.get("--zd-bg")).toBe("base-4");
    expect(emitted.get("--zd-fg")).toBe("base-0");
    expect(emitted.get("--zd-selection-bg")).toBe("base-2");
    expect(emitted.get("--zd-selection-fg")).toBe("base-0");
  });

  it("emits Tier-1 ramps verbatim", () => {
    expect(emitted.get("--palette-base-0")).toBe("base-0");
    expect(emitted.get("--palette-accent-2")).toBe("accent-2");
    expect(emitted.get("--palette-state-danger")).toBe("state-danger");
  });
});

describe("schemeToCssPairs — scopes", () => {
  const scheme = makeScheme();

  it('"palette" scope emits only the 12 --palette-* pairs', () => {
    const keys = schemeToCssPairs(scheme, "palette").map(([k]) => k);
    expect(keys.length).toBe(12); // 5 + 3 + 4
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
    expect(css).toContain("--zd-bg: base-4;");
    expect(css).toContain("--palette-base-0: base-0;");
    expect(css).toContain("--zd-surface: base-4;");
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
    // light bg = base-4, dark bg = base-0
    expect(css).toContain("--zd-bg: light-dark(base-4, base-0);");
    expect(css).toContain("--zd-surface: light-dark(base-4, base-4);");
  });

  it("does not emit retired slots or cursor", () => {
    expect(css).not.toContain("--zd-cursor");
    expect(css).not.toMatch(/--zd-\d+:/);
  });
});
