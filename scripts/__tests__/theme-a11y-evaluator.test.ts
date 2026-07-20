/**
 * Deterministic unit tests for the theme-a11y evaluator core
 * (`scripts/theme-a11y-evaluator.ts`). Pure math + decision logic — no browser.
 * Picked up by the vitest "scripts" project (`scripts/__tests__/**`), so
 * `pnpm test:unit` runs them.
 *
 * We do NOT rely on the real theme packs or the pre-fix brutalist state (that
 * fix lands in a sibling sub-issue) — every case uses hand-built samples with
 * known colors, so the boundaries are proven independently of the site.
 */

import { describe, it, expect } from "vitest";

import {
  MAX_SKIP_RATIO,
  THRESHOLD_NORMAL,
  THRESHOLD_UI,
  UNREADABLE_IMAGE,
  allowlistKey,
  classifyLargeText,
  compositeOver,
  detectPseudoOverlay,
  detectStaleAllowlistEntries,
  evaluateCoverage,
  evaluateSample,
  findAllowlistEntry,
  parseImageStops,
  parseSrgbA,
  resolveEffectiveBackground,
  resolveSvgInk,
  srgbToCss,
  thresholdFor,
  validateAllowlist,
} from "../theme-a11y-evaluator";
import type { AllowlistEntry, AncestorLayer, PseudoLayer, RawSample } from "../theme-a11y-evaluator";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const layer = (backgroundColor: string, opacity = 1, backgroundImage = "none"): AncestorLayer => ({
  backgroundColor,
  backgroundImage,
  opacity,
});

const CLEAR_PSEUDOS: PseudoLayer[] = [
  { backgroundColor: "rgba(0, 0, 0, 0)", backgroundImage: "none", position: "static" },
  { backgroundColor: "rgba(0, 0, 0, 0)", backgroundImage: "none", position: "static" },
];

const WHITE = "rgb(255 255 255)";

function mkSample(overrides: Partial<RawSample> = {}): RawSample {
  return {
    elementKey: "content-paragraph",
    selector: ".zd-content p",
    state: "static",
    kind: "text",
    color: "rgb(0 0 0)",
    fontSizePx: 16,
    fontWeight: 400,
    chain: [layer(WHITE)],
    pseudos: CLEAR_PSEUDOS,
    svg: null,
    text: "sample",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// color parsing / compositing
// ---------------------------------------------------------------------------

describe("parseSrgbA", () => {
  it("keeps alpha (unlike parseSrgb)", () => {
    expect(parseSrgbA("rgba(0,0,0,0.5)").a).toBeCloseTo(0.5, 5);
    expect(parseSrgbA("rgb(0,0,0)").a).toBe(1);
    expect(parseSrgbA("rgba(0,0,0,0)").a).toBe(0);
  });
  it("clamps wide-gamut components to [0,1]", () => {
    const c = parseSrgbA("oklch(1 0 0)");
    expect(c.r).toBeLessThanOrEqual(1);
    expect(c.g).toBeLessThanOrEqual(1);
  });
});

describe("compositeOver / srgbToCss", () => {
  it("50% black over white → mid grey", () => {
    const out = compositeOver({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 1, g: 1, b: 1 });
    expect(out.r).toBeCloseTo(0.5, 5);
    expect(srgbToCss(out)).toBe("rgb(127.5 127.5 127.5)");
  });
  it("alpha 0 leaves the backdrop unchanged", () => {
    const out = compositeOver({ r: 0, g: 0, b: 0, a: 0 }, { r: 1, g: 1, b: 1 });
    expect(out).toEqual({ r: 1, g: 1, b: 1 });
  });
});

// ---------------------------------------------------------------------------
// effective background walk
// ---------------------------------------------------------------------------

/** Candidate backdrops of a resolution, as `rgb(...)` strings (sorted for
 *  order-independent assertions). Fails the test if the resolution SKIPped. */
function candidateCss(res: ReturnType<typeof resolveEffectiveBackground>): string[] {
  if ("skip" in res) throw new Error(`expected candidates, got skip: ${res.skip}`);
  return res.candidates.map(srgbToCss).sort();
}

describe("resolveEffectiveBackground", () => {
  it("returns the element's own opaque background", () => {
    expect(candidateCss(resolveEffectiveBackground([layer(WHITE)]))).toEqual(["rgb(255 255 255)"]);
  });

  it("walks past a transparent element to an opaque ancestor", () => {
    expect(candidateCss(resolveEffectiveBackground([layer("rgba(0,0,0,0)"), layer("rgb(20 40 60)")]))).toEqual([
      "rgb(20 40 60)",
    ]);
  });

  it("composites a translucent element over its opaque parent", () => {
    // 50% white over black → mid grey.
    const res = resolveEffectiveBackground([layer("rgba(255,255,255,0.5)"), layer("rgb(0 0 0)")]);
    expect("candidates" in res).toBe(true);
    if ("candidates" in res) {
      expect(res.candidates).toHaveLength(1);
      expect(res.candidates[0]!.r).toBeCloseTo(0.5, 5);
    }
  });

  it("folds ancestor opacity into the base layer (a faded 'opaque' bg is not opaque)", () => {
    // parent is opaque white but opacity:0.5 → effective 0.5 over opaque black html.
    const res = resolveEffectiveBackground([
      layer("rgba(0,0,0,0)", 1),
      layer(WHITE, 0.5),
      layer("rgb(0 0 0)", 1),
    ]);
    expect("candidates" in res).toBe(true);
    if ("candidates" in res) expect(res.candidates[0]!.r).toBeCloseTo(0.5, 5);
  });

  it("resolves an opaque gradient to candidates spanning its stops + interpolated mid-stops", () => {
    // white→black gradient ⇒ backdrops range white..black, plus the mid-stop so
    // an interior worst-contrast point can't be missed.
    const css = candidateCss(resolveEffectiveBackground([layer(WHITE, 1, "linear-gradient(#fff, #000)")]));
    expect(css).toContain("rgb(0 0 0)");
    expect(css).toContain("rgb(255 255 255)");
    expect(css).toContain("rgb(127.5 127.5 127.5)"); // interpolated midpoint
  });

  it("keeps the opaque solid as a candidate under a same-layer gradient (coverage not assumable)", () => {
    // An opaque bg-color + an all-opaque gradient on the SAME layer: the gradient
    // may only paint a corner (background-size/no-repeat, not visible to us —
    // e.g. sumi's code-block seal), so the solid MUST stay a candidate alongside
    // the gradient stops. Dropping it would fabricate a false FAIL for text
    // sitting on the uncovered solid.
    const css = candidateCss(
      resolveEffectiveBackground([layer("rgb(255 0 0)", 1, "linear-gradient(rgb(0 0 0), rgb(255 255 255))")]),
    );
    expect(css).toContain("rgb(255 0 0)"); // the solid is retained
    expect(css).toContain("rgb(0 0 0)");
    expect(css).toContain("rgb(255 255 255)");
  });

  it("does NOT reach a deeper gradient once an opaque solid is found in front", () => {
    const res = resolveEffectiveBackground([
      layer("rgb(10 10 10)"), // element opaque
      layer(WHITE, 1, "linear-gradient(#fff, #000)"), // gradient behind it — never reached
    ]);
    expect(candidateCss(res)).toEqual(["rgb(10 10 10)"]);
  });

  it("does NOT SKIP a url() bitmap hidden behind a nearer opaque layer", () => {
    // the opaque element covers the deeper bitmap, so the bitmap can't affect
    // the text — no indeterminate SKIP.
    const res = resolveEffectiveBackground([
      layer("rgb(10 10 10)"),
      layer(WHITE, 1, 'url("/paper.png")'),
    ]);
    expect(candidateCss(res)).toEqual(["rgb(10 10 10)"]);
  });

  it("SKIPs when no opaque background exists in the chain", () => {
    const res = resolveEffectiveBackground([layer("rgba(0,0,0,0)"), layer("rgba(0,0,0,0)")]);
    expect("skip" in res && res.skip).toMatch(/no opaque/i);
  });

  it("resolves a near-imperceptible texture image over its opaque solid (washi paper grain)", () => {
    // washi paints a ≤0.05-alpha fleck/fiber grain over an opaque paper color —
    // every candidate is essentially the paper, so it evaluates instead of SKIPping.
    const grain =
      "radial-gradient(rgba(101, 78, 42, 0.05) 1px, rgba(0, 0, 0, 0) 1.2px), " +
      "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(80, 60, 30, 0.014) 4px)";
    const res = resolveEffectiveBackground([layer("rgb(242 236 220)", 1, grain)]);
    expect("candidates" in res).toBe(true);
    if ("candidates" in res) {
      // the paper itself is a candidate; the faint fleck barely shifts it
      expect(res.candidates.some((c) => srgbToCss(c) === "rgb(242 236 220)")).toBe(true);
      for (const c of res.candidates) {
        expect(c.r).toBeGreaterThan(0.9);
        expect(c.g).toBeGreaterThan(0.8);
      }
    }
  });

  it("SKIPs a see-through gradient when no opaque solid sits under it", () => {
    const grain = "radial-gradient(rgba(101, 78, 42, 0.05) 1px, rgba(0, 0, 0, 0) 1.2px)";
    const res = resolveEffectiveBackground([layer("rgba(0,0,0,0)", 1, grain), layer("rgba(0,0,0,0)")]);
    expect("skip" in res && res.skip).toMatch(/no opaque/i);
  });

  it("treats a fully-opaque covering gradient as the base (deeper layers hidden)", () => {
    // opaque black→white gradient over an unreached red — candidates are the
    // stops (+ mid-stop); the red below is hidden and excluded.
    const css = candidateCss(
      resolveEffectiveBackground([
        layer("rgba(0,0,0,0)", 1, "linear-gradient(rgb(0 0 0), rgb(255 255 255))"),
        layer("rgb(255 0 0)"),
      ]),
    );
    expect(css).toContain("rgb(0 0 0)");
    expect(css).toContain("rgb(255 255 255)");
    expect(css).not.toContain("rgb(255 0 0)");
  });

  it("SKIPs when a VISIBLE url() bitmap makes the backdrop indeterminate", () => {
    const res = resolveEffectiveBackground([layer(WHITE, 1, 'url("/paper.png")')]);
    expect("skip" in res && res.skip).toMatch(/unreadable|indeterminate/i);
  });
});

describe("parseImageStops", () => {
  it("returns null for none/empty", () => {
    expect(parseImageStops("none")).toBeNull();
    expect(parseImageStops("")).toBeNull();
  });
  it("parses gradient stops keeping alpha, in order", () => {
    const stops = parseImageStops("linear-gradient(rgba(101, 78, 42, 0.05) 1px, rgb(0 0 0) 4px)");
    expect(Array.isArray(stops)).toBe(true);
    if (Array.isArray(stops)) {
      expect(stops).toHaveLength(2);
      expect(stops[0]!.a).toBeCloseTo(0.05, 5);
      expect(stops[1]!.a).toBe(1);
    }
  });
  it("flags url() bitmaps as unreadable (conservative)", () => {
    expect(parseImageStops('url("/paper.png")')).toBe(UNREADABLE_IMAGE);
  });
});

// ---------------------------------------------------------------------------
// pseudo overlay
// ---------------------------------------------------------------------------

describe("detectPseudoOverlay", () => {
  it("flags a positioned pseudo with a background image", () => {
    expect(
      detectPseudoOverlay([
        { backgroundColor: "rgba(0,0,0,0)", backgroundImage: "linear-gradient(#fff,#000)", position: "absolute" },
        CLEAR_PSEUDOS[1]!,
      ]),
    ).toMatch(/indeterminate/);
  });
  it("flags a positioned pseudo with a substantially-opaque color", () => {
    expect(
      detectPseudoOverlay([
        CLEAR_PSEUDOS[0]!,
        { backgroundColor: "rgba(0,0,0,0.8)", backgroundImage: "none", position: "fixed" },
      ]),
    ).toMatch(/indeterminate/);
  });
  it("ignores non-positioned pseudos and transparent ones", () => {
    expect(detectPseudoOverlay(CLEAR_PSEUDOS)).toBeNull();
    expect(
      detectPseudoOverlay([
        { backgroundColor: "rgb(255 0 0)", backgroundImage: "none", position: "static" },
        CLEAR_PSEUDOS[1]!,
      ]),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// classification / thresholds / svg
// ---------------------------------------------------------------------------

describe("classifyLargeText", () => {
  it("≥24px is large at any weight", () => {
    expect(classifyLargeText(24, 400)).toBe(true);
    expect(classifyLargeText(23.9, 400)).toBe(false);
  });
  it("≥18.66px large only at weight ≥700", () => {
    expect(classifyLargeText(18.66, 700)).toBe(true);
    expect(classifyLargeText(18.66, 400)).toBe(false);
    expect(classifyLargeText(20, 700)).toBe(true);
  });
});

describe("thresholdFor", () => {
  it("maps kind + size to the AA floor", () => {
    expect(thresholdFor("text", false)).toBe(THRESHOLD_NORMAL);
    expect(thresholdFor("text", true)).toBe(3.0);
    expect(thresholdFor("ui", false)).toBe(THRESHOLD_UI);
  });
});

describe("resolveSvgInk", () => {
  it("resolves currentColor to the element color", () => {
    expect(resolveSvgInk("currentColor", "none", "rgb(1 2 3)")).toBe("rgb(1 2 3)");
  });
  it("falls back to stroke when fill is none", () => {
    expect(resolveSvgInk("none", "rgb(9 9 9)", "rgb(0 0 0)")).toBe("rgb(9 9 9)");
  });
  it("returns null when nothing paints", () => {
    expect(resolveSvgInk("none", "none", "rgb(0 0 0)")).toBeNull();
    expect(resolveSvgInk("rgba(0,0,0,0)", "none", "rgb(0 0 0)")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateSample
// ---------------------------------------------------------------------------

describe("evaluateSample", () => {
  it("SKIPs decorative elements (1.4.11 exempt)", () => {
    const ev = evaluateSample(mkSample({ kind: "decorative" }));
    expect(ev.verdict).toBe("SKIP");
    expect(ev.skipReason).toMatch(/decorative/);
  });

  it("PASSes high-contrast black-on-white", () => {
    const ev = evaluateSample(mkSample({ color: "rgb(0 0 0)" }));
    expect(ev.verdict).toBe("PASS");
    expect(ev.ratio).toBeGreaterThan(THRESHOLD_NORMAL + 0.3);
  });

  it("FAILs low-contrast grey text", () => {
    const ev = evaluateSample(mkSample({ color: "rgb(153 153 153)" }));
    expect(ev.verdict).toBe("FAIL");
    expect(ev.ratio!).toBeLessThan(THRESHOLD_NORMAL);
  });

  it("WARNs a pair that passes within the +0.3 band", () => {
    const ev = evaluateSample(mkSample({ color: "rgb(118 118 118)" }));
    expect(ev.verdict).toBe("WARN");
    expect(ev.ratio!).toBeGreaterThanOrEqual(THRESHOLD_NORMAL);
    expect(ev.ratio!).toBeLessThan(THRESHOLD_NORMAL + 0.3);
  });

  it("applies the large-text 3.0 floor — same color FAILs as normal, WARNs as large", () => {
    const asNormal = evaluateSample(mkSample({ color: "rgb(145 145 145)", fontSizePx: 16 }));
    const asLarge = evaluateSample(mkSample({ color: "rgb(145 145 145)", fontSizePx: 24 }));
    expect(asNormal.verdict).toBe("FAIL");
    expect(asLarge.verdict).toBe("WARN");
    expect(asLarge.threshold).toBe(3.0);
  });

  it("uses SVG ink + the 3.0 UI floor for ui elements", () => {
    const fail = evaluateSample(
      mkSample({ kind: "ui", color: "rgb(0 0 0)", svg: { fill: "rgb(153 153 153)", stroke: "none" } }),
    );
    expect(fail.verdict).toBe("FAIL"); // 2.85 < 3.0
    const pass = evaluateSample(
      mkSample({ kind: "ui", color: "rgb(0 0 0)", svg: { fill: "currentColor", stroke: "none" } }),
    );
    expect(pass.verdict).toBe("PASS"); // black ink on white
  });

  it("composites translucent text before measuring (lower rendered contrast)", () => {
    const solid = evaluateSample(mkSample({ color: "rgb(0 0 0)" }));
    const faded = evaluateSample(mkSample({ color: "rgba(0,0,0,0.3)" }));
    expect(faded.ratio!).toBeLessThan(solid.ratio!);
    expect(faded.verdict).not.toBe("SKIP");
  });

  it("PASSes a gradient backdrop when the text clears contrast on EVERY stop", () => {
    // black text over a light-grey→white gradient: worst stop still ~high contrast.
    const ev = evaluateSample(
      mkSample({
        color: "rgb(0 0 0)",
        chain: [layer(WHITE, 1, "linear-gradient(rgb(220 220 220), rgb(255 255 255))")],
      }),
    );
    expect(ev.verdict).toBe("PASS");
  });

  it("FAILs a gradient backdrop when the text fails contrast on EVERY stop", () => {
    // mid-grey text over a similar grey→grey gradient: unreadable throughout.
    const ev = evaluateSample(
      mkSample({
        color: "rgb(150 150 150)",
        chain: [layer("rgb(140 140 140)", 1, "linear-gradient(rgb(130 130 130), rgb(160 160 160))")],
      }),
    );
    expect(ev.verdict).toBe("FAIL");
  });

  it("SKIPs a gradient backdrop that straddles the threshold (position-dependent)", () => {
    // black text over a black→white gradient: fails on the dark end, passes on the
    // light end — genuinely position-dependent, so no guessed verdict.
    const ev = evaluateSample(
      mkSample({ color: "rgb(0 0 0)", chain: [layer(WHITE, 1, "linear-gradient(#000, #fff)")] }),
    );
    expect(ev.verdict).toBe("SKIP");
    expect(ev.skipReason).toMatch(/straddles|position-dependent/);
    // Tagged so the driver keeps it OUT of the coverage skip-ceiling.
    expect(ev.skipKind).toBe("straddle");
  });

  it("STRADDLEs (not FAILs) text over a solid bg carrying an opaque corner-seal gradient", () => {
    // sumi regression: light text on an opaque dark code bg with a tiny opaque
    // red corner-seal gradient. Readable on the bg, sub-AA only on the seal — the
    // solid stays a candidate, so this is position-dependent, never a false FAIL.
    const ev = evaluateSample(
      mkSample({
        color: "rgb(233 228 216)",
        chain: [layer("rgb(30 34 44)", 1, "linear-gradient(rgb(217 51 63), rgb(217 51 63))")],
      }),
    );
    expect(ev.verdict).toBe("SKIP");
    expect(ev.skipKind).toBe("straddle");
  });

  it("does NOT silently PASS a gradient that fails only BETWEEN its stops", () => {
    // black text over red→green passes at both endpoints but the dark olive
    // midpoint fails — the interpolated mid-stop candidate must surface it
    // (else a false PASS). Ends up straddle/FAIL, never PASS.
    const ev = evaluateSample(
      mkSample({
        color: "rgb(0 0 0)",
        chain: [layer("rgb(255 0 0)", 1, "linear-gradient(rgb(255 0 0), rgb(0 142 0))")],
      }),
    );
    expect(ev.verdict).not.toBe("PASS");
    expect(ev.verdict).not.toBe("WARN");
  });

  it("SKIPs fully-transparent ink", () => {
    const ev = evaluateSample(mkSample({ color: "rgba(0,0,0,0)" }));
    expect(ev.verdict).toBe("SKIP");
    expect(ev.skipReason).toMatch(/transparent/);
  });

  it("SKIPs an element inside an opacity group instead of guessing a faded ratio", () => {
    // black text on a white opacity:0.5 box over black — renders ~5.3:1 in the
    // browser; must NOT be reported as a low-contrast FAIL.
    const ev = evaluateSample(
      mkSample({ color: "rgb(0 0 0)", chain: [layer(WHITE, 0.5), layer("rgb(0 0 0)", 1)] }),
    );
    expect(ev.verdict).toBe("SKIP");
    expect(ev.skipReason).toMatch(/opacity group/);
  });
});

// ---------------------------------------------------------------------------
// allowlist
// ---------------------------------------------------------------------------

describe("allowlist", () => {
  const entry: AllowlistEntry = {
    pack: "brutalist",
    mode: "dark",
    elementKey: "header-nav-active",
    state: "active",
    reason: "tracked in #9999",
  };

  it("findAllowlistEntry matches on the 4-tuple only", () => {
    expect(findAllowlistEntry([entry], "brutalist", "dark", "header-nav-active", "active")).toBe(entry);
    expect(findAllowlistEntry([entry], "brutalist", "light", "header-nav-active", "active")).toBeUndefined();
  });

  it("validateAllowlist rejects a blank reason", () => {
    expect(validateAllowlist([entry])).toEqual([]);
    const bad = validateAllowlist([{ ...entry, reason: "  " }]);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/missing mandatory reason/);
  });

  it("detectStaleAllowlistEntries flags entries that consumed no FAIL", () => {
    const key = allowlistKey(entry.pack, entry.mode, entry.elementKey, entry.state);
    expect(detectStaleAllowlistEntries([entry], new Set([key]))).toEqual([]);
    expect(detectStaleAllowlistEntries([entry], new Set())).toEqual([key]);
  });
});

// ---------------------------------------------------------------------------
// coverage contract
// ---------------------------------------------------------------------------

describe("evaluateCoverage", () => {
  const fullCounts = {
    "header-nav": 4,
    "sidebar-link": 6,
    "toc-link": 5,
    "content-heading": 5,
    "content-paragraph": 8,
    "admonition-title": 5,
    "admonition-body": 5,
    "pager-link": 2,
  };

  it("passes when every required group meets its min and skips are low", () => {
    expect(evaluateCoverage("x/light", { groupCounts: fullCounts, matched: 40, skipped: 2 })).toEqual([]);
  });

  it("flags a required group that matched ZERO (configuration error)", () => {
    const { ["toc-link"]: _drop, ...missing } = fullCounts;
    const errors = evaluateCoverage("x/light", { groupCounts: missing, matched: 40, skipped: 0 });
    expect(errors.some((e) => e.includes("toc-link") && /ZERO/.test(e))).toBe(true);
  });

  it("flags an under-min group", () => {
    const errors = evaluateCoverage(
      "x/light",
      { groupCounts: { ...fullCounts, "admonition-title": 2 }, matched: 40, skipped: 0 },
    );
    expect(errors.some((e) => e.includes("admonition-title") && /min/.test(e))).toBe(true);
  });

  it("flags a SKIP share over the ceiling", () => {
    const errors = evaluateCoverage("x/light", { groupCounts: fullCounts, matched: 10, skipped: 4 });
    expect(errors.some((e) => /ceiling/.test(e))).toBe(true);
    // sanity: 4/10 = 40% > MAX_SKIP_RATIO
    expect(4 / 10).toBeGreaterThan(MAX_SKIP_RATIO);
  });
});
