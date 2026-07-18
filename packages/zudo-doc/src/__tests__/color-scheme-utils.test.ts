import { describe, it, expect } from "vitest";
import {
  resolveRampRef,
  resolveSemanticColors,
  resolveSyntaxColors,
  schemeToCssPairs,
  generateCssCustomProperties,
  generateLightDarkCssProperties,
  rampRefToPanelDefault,
  buildSemanticTierItems,
  SEMANTIC_RAMP_DEFAULTS,
  SEMANTIC_CSS_NAMES,
  SEMANTIC_KEYS,
  STATE_ROLES,
  SYNTAX_CSS_NAMES,
  SYNTAX_DIFF_BACKGROUND_CSS,
  SYNTAX_SEMANTIC_ALIASES,
  SYNTAX_SEMANTIC_KEYS,
  ZFB_HIGHLIGHT_ROLE_TO_ZUDO_TOKEN,
  type ColorScheme,
  type Ramps,
  type RampRef,
  type StateRole,
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
      syntax: {},
    },
  };
}

// Compile-time contract: a no-syntax ModeMap is no longer accepted. This is
// intentionally never called; `tsc --noEmit` verifies the negative assertion.
function assertSyntaxMapIsRequired(): void {
  // @ts-expect-error ModeMap.syntax is required, even when it has no overrides.
  const noSyntax: ColorScheme["map"] = {
    bg: { base: 4 },
    fg: { base: 0 },
    selectionBg: { base: 2 },
    selectionFg: { base: 0 },
    semantic: { ...SEMANTIC_RAMP_DEFAULTS },
  };
  void noSyntax;
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

describe("resolveSyntaxColors — required partial syntax map", () => {
  it("lets a partial syntax map override only selected roles", () => {
    const scheme = makeScheme();
    scheme.map.syntax = { syntaxKeyword: { accent: 2 } };
    const syntax = resolveSyntaxColors(scheme);
    expect(syntax.syntaxKeyword).toBe("accent-2");
    expect(syntax.syntaxComment).toBe("base-1");
    expect(syntax.syntaxString).toBe("state-success");
  });

  it("treats an explicit empty syntax map as all inherited aliases", () => {
    const scheme = makeScheme();
    const syntax = resolveSyntaxColors(scheme);
    expect(Object.keys(syntax)).toEqual([...SYNTAX_SEMANTIC_KEYS]);
    for (const key of SYNTAX_SEMANTIC_KEYS) {
      expect(syntax[key]).toBe(resolveSemanticColors(scheme)[SYNTAX_SEMANTIC_ALIASES[key]]);
    }
  });

  it("falls back safely when runtime-authored syntax refs are invalid", () => {
    const scheme = makeScheme();
    scheme.map.syntax = {
      syntaxComment: { base: 99 },
      syntaxKeyword: "",
    } as never;
    expect(() => resolveSyntaxColors(scheme)).not.toThrow();
    expect(resolveSyntaxColors(scheme).syntaxComment).toBe("base-1");
    expect(resolveSyntaxColors(scheme).syntaxKeyword).toBe("accent-1");
  });

  it("uses a valid base foreground when an inherited semantic ref is also invalid", () => {
    const scheme = makeScheme();
    scheme.map.semantic.success = { accent: 99 };
    expect(resolveSyntaxColors(scheme).syntaxString).toBe("base-0");
  });
});

describe("zfb renderer mapping contract", () => {
  it("contracts foreground/background plus all 18 zfb roles onto semantic tokens", () => {
    expect(ZFB_HIGHLIGHT_ROLE_TO_ZUDO_TOKEN).toEqual({
      foreground: "codeFg",
      background: "codeBg",
      escape: "syntaxString",
      operator: "codeFg",
      comment: "syntaxComment",
      string: "syntaxString",
      number: "syntaxNumber",
      constant: "syntaxNumber",
      keyword: "syntaxKeyword",
      function: "syntaxCallable",
      type: "syntaxType",
      namespace: "syntaxType",
      property: "syntaxName",
      variable: "syntaxName",
      tag: "syntaxName",
      attribute: "syntaxName",
      punctuation: "codeFg",
      inserted: "syntaxInserted",
      deleted: "syntaxDeleted",
      heading: "syntaxKeyword",
    });
  });

  it("derives diff backgrounds from public foreground semantics and codeBg", () => {
    expect(SYNTAX_DIFF_BACKGROUND_CSS).toEqual({
      inserted: "color-mix(in srgb, var(--zd-syntax-inserted) 15%, var(--zd-code-bg))",
      deleted: "color-mix(in srgb, var(--zd-syntax-deleted) 15%, var(--zd-code-bg))",
    });
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
      // 9 --zd-syntax-* roles
      ...SYNTAX_SEMANTIC_KEYS.map((k) => SYNTAX_CSS_NAMES[k]),
    ];
    expect(keys.slice().sort()).toEqual(expected.slice().sort());
    // 4 + 5 + 3 + 4 + 23 + 9 = 48, and no duplicate keys.
    expect(keys.length).toBe(48);
    expect(new Set(keys).size).toBe(48);
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

  it("emits a partial syntax override without changing inherited syntax values", () => {
    const scheme = makeScheme();
    scheme.map.syntax = { syntaxKeyword: { accent: 2 } };
    const partial = new Map(schemeToCssPairs(scheme));
    expect(partial.get("--zd-syntax-keyword")).toBe("accent-2");
    expect(partial.get("--zd-syntax-comment")).toBe("base-1");
    expect(partial.get("--zd-syntax-string")).toBe("state-success");
  });
});

describe("schemeToCssPairs — scopes", () => {
  const scheme = makeScheme();

  it('"palette" scope emits only the 12 --palette-* pairs', () => {
    const keys = schemeToCssPairs(scheme, "palette").map(([k]) => k);
    expect(keys.length).toBe(12); // 5 + 3 + 4
    expect(keys.every((k) => k.startsWith("--palette-"))).toBe(true);
  });

  it('"roles" scope emits base roles + 23 UI + 9 syntax semantic (--zd-*) pairs', () => {
    const keys = schemeToCssPairs(scheme, "roles").map(([k]) => k);
    expect(keys.length).toBe(36); // 4 + 23 + 9
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
    expect(css).toContain("--zd-syntax-comment: base-1;");
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
    expect(css).toContain("--zd-syntax-comment: light-dark(base-1, base-1);");
  });

  it("does not emit retired slots or cursor", () => {
    expect(css).not.toContain("--zd-cursor");
    expect(css).not.toMatch(/--zd-\d+:/);
  });
});

describe("rampRefToPanelDefault", () => {
  it("encodes {base:N} to 'base:base-N'", () => {
    expect(rampRefToPanelDefault({ base: 0 })).toBe("base:base-0");
    expect(rampRefToPanelDefault({ base: 4 })).toBe("base:base-4");
  });

  it("encodes {accent:N} to 'accent:accent-N'", () => {
    expect(rampRefToPanelDefault({ accent: 0 })).toBe("accent:accent-0");
    expect(rampRefToPanelDefault({ accent: 2 })).toBe("accent:accent-2");
  });

  it("encodes {state:role} to 'state:state-role'", () => {
    expect(rampRefToPanelDefault({ state: "danger" })).toBe("state:state-danger");
    expect(rampRefToPanelDefault({ state: "success" })).toBe("state:state-success");
    expect(rampRefToPanelDefault({ state: "warning" })).toBe("state:state-warning");
    expect(rampRefToPanelDefault({ state: "info" })).toBe("state:state-info");
  });

  it("passes a literal OKLCH/hex string through unchanged", () => {
    expect(rampRefToPanelDefault("oklch(0.5 0.1 200)")).toBe("oklch(0.5 0.1 200)");
    expect(rampRefToPanelDefault("#ff0000")).toBe("#ff0000");
  });
});

describe("buildSemanticTierItems", () => {
  const scheme = makeScheme();
  const items = buildSemanticTierItems(scheme);

  it("returns exactly 36 rows: 4 base + 23 UI semantic + 9 syntax roles", () => {
    expect(items.length).toBe(36);
  });

  it("orders base roles, existing SEMANTIC_KEYS, then syntax roles", () => {
    const ids = items.map((item) => item.id);
    expect(ids.slice(0, 4)).toEqual(["bg", "fg", "selection-bg", "selection-fg"]);
    expect(ids.slice(4)).toEqual([...SEMANTIC_KEYS, ...SYNTAX_SEMANTIC_KEYS]);
  });

  it("wires base-role cssVars and defaults from map.bg/fg/selectionBg/selectionFg", () => {
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get("bg")).toMatchObject({
      cssVar: "--zd-bg",
      default: rampRefToPanelDefault(scheme.map.bg),
      type: { kind: "color", format: "oklch" },
    });
    expect(byId.get("fg")).toMatchObject({
      cssVar: "--zd-fg",
      default: rampRefToPanelDefault(scheme.map.fg),
    });
    expect(byId.get("selection-bg")).toMatchObject({
      cssVar: "--zd-selection-bg",
      default: rampRefToPanelDefault(scheme.map.selectionBg),
    });
    expect(byId.get("selection-fg")).toMatchObject({
      cssVar: "--zd-selection-fg",
      default: rampRefToPanelDefault(scheme.map.selectionFg),
    });
  });

  it("wires the 23 semantic rows' cssVars and defaults from SEMANTIC_CSS_NAMES / map.semantic", () => {
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const key of SEMANTIC_KEYS) {
      const item = byId.get(key);
      expect(item).toBeDefined();
      expect(item?.cssVar).toBe(SEMANTIC_CSS_NAMES[key]);
      expect(item?.default).toBe(rampRefToPanelDefault(scheme.map.semantic[key]));
      expect(item?.type).toEqual({ kind: "color", format: "oklch" });
    }
  });

  it("seeds syntax rows from explicit refs first and inherited aliases otherwise", () => {
    const partial = makeScheme();
    partial.map.syntax = { syntaxKeyword: { accent: 2 } };
    const byId = new Map(buildSemanticTierItems(partial).map((item) => [item.id, item]));
    for (const key of SYNTAX_SEMANTIC_KEYS) {
      expect(byId.get(key)?.cssVar).toBe(SYNTAX_CSS_NAMES[key]);
    }
    expect(byId.get("syntaxKeyword")?.default).toBe("accent:accent-2");
    expect(byId.get("syntaxComment")?.default).toBe("base:base-1");
  });
});

// ---------------------------------------------------------------------------
// Parity property (no-snapping guard) — replicated Default Light / Default
// Dark fixtures.
//
// Package tests must not import host files (src/config/color-schemes.ts), so
// the two shipped schemes are copied here VERBATIM (ramps + both ModeMaps).
// These mirror src/config/color-schemes.ts exactly — if that file's ramps or
// maps change, keep this fixture in sync so the parity guarantee stays honest.
// ---------------------------------------------------------------------------

const HOST_RAMPS: Ramps = {
  base: [
    "oklch(.965 .004 65)",
    "oklch(.705 .008 65)",
    "oklch(.480 .008 65)",
    "oklch(.300 .006 65)",
    "oklch(.185 .005 65)",
  ],
  accent: ["oklch(.755 .130 64)", "oklch(.700 .158 62)", "oklch(.470 .120 56)"],
  state: {
    danger: "oklch(.640 .170 25)",
    success: "oklch(.680 .145 145)",
    warning: "oklch(.760 .135 82)",
    info: "oklch(.680 .130 245)",
  },
};

const HOST_DARK_MAP: ColorScheme["map"] = {
  bg: { base: 4 },
  fg: { base: 0 },
  selectionBg: { base: 2 },
  selectionFg: { base: 0 },
  semantic: {
    surface: { base: 4 },
    muted: { base: 1 },
    accent: { accent: 1 },
    accentHover: { accent: 0 },
    codeBg: { base: 3 },
    codeFg: { base: 0 },
    success: { state: "success" },
    danger: "oklch(.655 .170 25)",
    warning: { state: "warning" },
    info: { state: "info" },
    mermaidNodeBg: { base: 3 },
    mermaidText: { base: 0 },
    mermaidLine: { base: 1 },
    mermaidLabelBg: { base: 3 },
    mermaidNoteBg: { base: 2 },
    chatUserBg: { accent: 1 },
    chatUserText: { base: 4 },
    chatAssistantBg: { base: 4 },
    chatAssistantText: { base: 0 },
    imageOverlayBg: { base: 4 },
    imageOverlayFg: { base: 0 },
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
  syntax: {
    syntaxInserted: "oklch(.750 .145 145)",
    syntaxDeleted: "oklch(.820 .100 25)",
  },
};

const HOST_LIGHT_MAP: ColorScheme["map"] = {
  bg: { base: 0 },
  fg: { base: 4 },
  selectionBg: { base: 1 },
  selectionFg: { base: 4 },
  semantic: {
    surface: { base: 0 },
    muted: { base: 2 },
    accent: { accent: 2 },
    accentHover: "oklch(.400 .096 56)",
    codeBg: { base: 0 },
    codeFg: { base: 4 },
    success: "oklch(.470 .140 145)",
    danger: "oklch(.505 .170 25)",
    warning: "oklch(.490 .100 82)",
    info: "oklch(.485 .122 245)",
    mermaidNodeBg: { base: 1 },
    mermaidText: { base: 4 },
    mermaidLine: { base: 2 },
    mermaidLabelBg: { base: 1 },
    mermaidNoteBg: { base: 1 },
    chatUserBg: { accent: 1 },
    chatUserText: { base: 4 },
    chatAssistantBg: { base: 0 },
    chatAssistantText: { base: 4 },
    imageOverlayBg: { base: 4 },
    imageOverlayFg: { base: 0 },
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
  syntax: {
    syntaxInserted: "oklch(.460 .140 145)",
    syntaxDeleted: "oklch(.490 .170 25)",
  },
};

const HOST_SCHEMES: Record<"Default Light" | "Default Dark", ColorScheme> = {
  "Default Light": { ramps: HOST_RAMPS, map: HOST_LIGHT_MAP },
  "Default Dark": { ramps: HOST_RAMPS, map: HOST_DARK_MAP },
};

/** Decode a panel-encoded default (`rampRefToPanelDefault` output) back into a
 *  `RampRef`, mirroring how the panel's grouped ramp dropdown would resolve a
 *  `tierId:itemId` selection back to a ramp stop. A bare literal (no `:`
 *  prefix matching a known tier) passes through unchanged. */
function decodePanelDefault(encoded: string): RampRef {
  const baseMatch = /^base:base-(\d+)$/.exec(encoded);
  if (baseMatch) return { base: Number(baseMatch[1]) };
  const accentMatch = /^accent:accent-(\d+)$/.exec(encoded);
  if (accentMatch) return { accent: Number(accentMatch[1]) };
  const stateMatch = /^state:state-(danger|success|warning|info)$/.exec(encoded);
  if (stateMatch) return { state: stateMatch[1] as StateRole };
  return encoded;
}

describe("parity property — no-snapping guard (Default Light / Default Dark)", () => {
  for (const [name, scheme] of Object.entries(HOST_SCHEMES) as [string, ColorScheme][]) {
    describe(name, () => {
      const items = buildSemanticTierItems(scheme);
      const resolvedSemantic = resolveSemanticColors(scheme);
      const resolvedSyntax = resolveSyntaxColors(scheme);

      it("every base-role row's default decodes+resolves to the exact scheme value", () => {
        const byId = new Map(items.map((item) => [item.id, item]));
        const cases: [string, RampRef][] = [
          ["bg", scheme.map.bg],
          ["fg", scheme.map.fg],
          ["selection-bg", scheme.map.selectionBg],
          ["selection-fg", scheme.map.selectionFg],
        ];
        for (const [id, ref] of cases) {
          const item = byId.get(id);
          expect(item).toBeDefined();
          const decoded = decodePanelDefault(item!.default);
          expect(resolveRampRef(decoded, scheme.ramps)).toBe(resolveRampRef(ref, scheme.ramps));
        }
      });

      it("every semantic row's default decodes+resolves to resolveSemanticColors' EXACT value", () => {
        const byId = new Map(items.map((item) => [item.id, item]));
        for (const key of SEMANTIC_KEYS) {
          const item = byId.get(key);
          expect(item).toBeDefined();
          const decoded = decodePanelDefault(item!.default);
          expect(resolveRampRef(decoded, scheme.ramps)).toBe(resolvedSemantic[key]);
        }
      });

      it("every syntax row's default decodes+resolves to resolveSyntaxColors' exact value", () => {
        const byId = new Map(items.map((item) => [item.id, item]));
        for (const key of SYNTAX_SEMANTIC_KEYS) {
          const item = byId.get(key);
          expect(item).toBeDefined();
          const decoded = decodePanelDefault(item!.default);
          expect(resolveRampRef(decoded, scheme.ramps)).toBe(resolvedSyntax[key]);
        }
      });

      it("guards the AA-tuned literals against drift", () => {
        if (name === "Default Dark") {
          expect(resolvedSemantic.danger).toBe("oklch(.655 .170 25)");
        }
        if (name === "Default Light") {
          expect(resolvedSemantic.accentHover).toBe("oklch(.400 .096 56)");
        }
      });
    });
  }
});
