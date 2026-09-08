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
  AUDIT_PAGES,
  COVERAGE_CONTRACT,
  MAX_SKIP_RATIO,
  PAGE_ADMONITIONS,
  PAGE_GETTING_STARTED,
  THRESHOLD_NORMAL,
  THRESHOLD_UI,
  UNREADABLE_IMAGE,
  allowlistKey,
  classifyLargeText,
  compositeOver,
  describeUnauditedScenarios,
  detectPseudoOverlay,
  detectStaleAllowlistEntries,
  evaluateCoverage,
  evaluateCoverageMatrix,
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
import type {
  AllowlistEntry,
  AncestorLayer,
  CoverageScenario,
  CoverageStats,
  PseudoLayer,
  RawSample,
} from "../theme-a11y-evaluator";
import { INVENTORY, validateInventoryExpectations } from "../theme-a11y-inventory";

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

  it("catches a luminance dip at an INTERIOR extremum a single midpoint misses", () => {
    // Codex counter-example (#3044): rgb(25 14 211) text over an opaque
    // rgb(235 148 160)→rgb(3 236 106) gradient reads 4.54 / 4.73 / 6.46 at
    // start / midpoint / end — a midpoint-only sampler would call it a PASS —
    // yet the relative-luminance minimum is INTERIOR (channels move opposite
    // ways), dipping to ~4.41:1 near t=0.19, a real sub-4.5 failure. Dense
    // per-segment sampling must surface that dip as the reported worst ratio.
    const ev = evaluateSample(
      mkSample({
        color: "rgb(25 14 211)",
        chain: [layer("rgba(0,0,0,0)", 1, "linear-gradient(rgb(235 148 160), rgb(3 236 106))")],
      }),
    );
    expect(ev.verdict).not.toBe("PASS");
    expect(ev.verdict).not.toBe("WARN");
    // The reported worst ratio is the interior dip, below the 4.5 floor — the
    // whole point the midpoint (4.73) hid.
    expect(ev.ratio!).toBeLessThan(THRESHOLD_NORMAL);
    expect(ev.ratio!).toBeGreaterThan(4.3);
    // Readable at the start (4.54) but sub-AA at the dip ⇒ position-dependent.
    expect(ev.verdict).toBe("SKIP");
    expect(ev.skipKind).toBe("straddle");
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

/**
 * The eight requirements the contract carried BEFORE it gained a page axis
 * (#4033), with their original minima. A per-page contract must never turn a
 * group that was required everywhere into a group required nowhere, so each of
 * these is asserted both structurally (still in the admonitions contract at the
 * same min) and behaviourally (zero and under-min both still error).
 */
const ORIGINAL_REQUIREMENTS: ReadonlyArray<readonly [string, number]> = [
  ["header-nav", 3],
  ["sidebar-link", 3],
  ["toc-link", 3],
  ["content-heading", 1],
  ["content-paragraph", 1],
  ["admonition-title", 4],
  ["admonition-body", 4],
  ["pager-link", 1],
];

/** Counts that exactly satisfy a page's contract (every min met, hover present). */
function satisfyingStats(page: string, overrides: Partial<CoverageStats> = {}): CoverageStats {
  const groupCounts: Record<string, number> = {};
  const hoverCounts: Record<string, number> = {};
  let matched = 0;
  for (const req of COVERAGE_CONTRACT[page] ?? []) {
    groupCounts[req.group] = req.min;
    matched += req.min;
    if (req.requireHover) {
      hoverCounts[req.group] = 1;
      matched += 1;
    }
  }
  return { groupCounts, hoverCounts, matched, skipped: 0, ...overrides };
}

function scenario(page: string, stats: CoverageStats, pack = "x", mode = "light"): CoverageScenario {
  return { pack, mode, page, stats };
}

describe("COVERAGE_CONTRACT (per-page)", () => {
  it("still requires every pre-#4033 group at its original minimum, on the admonitions page", () => {
    const reqs = COVERAGE_CONTRACT[PAGE_ADMONITIONS] ?? [];
    for (const [group, min] of ORIGINAL_REQUIREMENTS) {
      const found = reqs.find((r) => r.group === group);
      expect(found, `"${group}" must still be required`).toBeDefined();
      expect(found?.min, `"${group}" minimum must not be lowered`).toBe(min);
    }
  });

  it("binds each active-state group to the page that actually renders it", () => {
    const admonitions = (COVERAGE_CONTRACT[PAGE_ADMONITIONS] ?? []).map((r) => r.group);
    const gettingStarted = (COVERAGE_CONTRACT[PAGE_GETTING_STARTED] ?? []).map((r) => r.group);

    // A leaf page under a dropdown category: active dropdown + active LEAF,
    // and structurally never a plain active top-level nav item.
    expect(admonitions).toContain("header-nav-dropdown-active");
    expect(admonitions).toContain("sidebar-active-leaf");
    expect(admonitions).not.toContain("header-nav-active");
    expect(admonitions).not.toContain("sidebar-active-root");

    // A root category page under a plain nav item: the only source of
    // header-nav-active, and its active sidebar node is a ROOT.
    expect(gettingStarted).toContain("header-nav-active");
    expect(gettingStarted).toContain("sidebar-active-root");
    expect(gettingStarted).not.toContain("sidebar-active-leaf");
    expect(gettingStarted).not.toContain("toc-link");
  });

  it("requires hover samples for every hover-regression target", () => {
    const hoverRequired = new Set<string>();
    for (const page of AUDIT_PAGES) {
      for (const req of COVERAGE_CONTRACT[page] ?? []) {
        if (req.requireHover) hoverRequired.add(req.group);
      }
    }
    for (const group of [
      "header-nav-active",
      "header-nav-dropdown-active",
      "sidebar-active-leaf",
      "sidebar-active-root",
      "sidebar-link",
    ]) {
      expect(hoverRequired, `"${group}" must require a hover sample`).toContain(group);
    }
  });

  it("agrees with the inventory's declared expectations", () => {
    expect(validateInventoryExpectations()).toEqual([]);
  });

  it("detects inventory/contract drift", () => {
    const contract = { [PAGE_ADMONITIONS]: [{ group: "not-in-the-inventory" }] };
    const errors = validateInventoryExpectations(INVENTORY, contract);
    expect(errors.some((e) => e.includes("not-in-the-inventory"))).toBe(true);
    // …and the admonitions-required items now have no matching requirement.
    expect(errors.some((e) => e.includes("sidebar-active-leaf"))).toBe(true);
  });
});

describe("evaluateCoverage", () => {
  it("passes when every required group meets its min and skips are low", () => {
    for (const page of AUDIT_PAGES) {
      const stats = satisfyingStats(page, { skipped: 2 });
      expect(evaluateCoverage(scenario(page, stats)).errors, page).toEqual([]);
    }
  });

  it.each(ORIGINAL_REQUIREMENTS)(
    'still errors when the original requirement "%s" matches ZERO',
    (group) => {
      const stats = satisfyingStats(PAGE_ADMONITIONS);
      delete stats.groupCounts[group];
      const { errors } = evaluateCoverage(scenario(PAGE_ADMONITIONS, stats));
      expect(errors.some((e) => e.includes(`"${group}"`) && /ZERO/.test(e))).toBe(true);
    },
  );

  it.each(ORIGINAL_REQUIREMENTS.filter(([, min]) => min > 1))(
    'still errors when the original requirement "%s" falls below its min of %i',
    (group, min) => {
      const stats = satisfyingStats(PAGE_ADMONITIONS);
      stats.groupCounts[group] = min - 1;
      const { errors } = evaluateCoverage(scenario(PAGE_ADMONITIONS, stats));
      expect(
        errors.some((e) => e.includes(`"${group}"`) && e.includes(`min ${min}`)),
      ).toBe(true);
    },
  );

  it("reports a group's zero-match ONLY on the page that requires it", () => {
    // header-nav-active is required on getting-started and legitimately absent
    // on admonitions — the direct regression test for the single-page blind
    // spot (#4033): auditing only admonitions asserted nothing about it.
    const gs = satisfyingStats(PAGE_GETTING_STARTED);
    delete gs.groupCounts["header-nav-active"];
    delete gs.hoverCounts["header-nav-active"];
    const gsErrors = evaluateCoverage(scenario(PAGE_GETTING_STARTED, gs)).errors;
    expect(gsErrors.some((e) => e.includes('"header-nav-active"') && /ZERO/.test(e))).toBe(true);

    // The same absence on the admonitions page is not an error at all.
    const adm = satisfyingStats(PAGE_ADMONITIONS);
    expect(adm.groupCounts["header-nav-active"]).toBeUndefined();
    expect(evaluateCoverage(scenario(PAGE_ADMONITIONS, adm)).errors).toEqual([]);
  });

  it("errors when a required hover sample is missing even though the static count is fine", () => {
    const stats = satisfyingStats(PAGE_GETTING_STARTED);
    // Static coverage untouched — only the hover measurement never happened.
    delete stats.hoverCounts["sidebar-active-root"];
    const { errors } = evaluateCoverage(scenario(PAGE_GETTING_STARTED, stats));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"sidebar-active-root"');
    expect(errors[0]).toMatch(/hover/i);
  });

  it("flags a SKIP share over the ceiling", () => {
    const stats = satisfyingStats(PAGE_ADMONITIONS, { matched: 10, skipped: 4 });
    const { errors } = evaluateCoverage(scenario(PAGE_ADMONITIONS, stats));
    expect(errors.some((e) => /ceiling/.test(e))).toBe(true);
    // sanity: 4/10 = 40% > MAX_SKIP_RATIO
    expect(4 / 10).toBeGreaterThan(MAX_SKIP_RATIO);
  });

  it("reports an undeclared page as UNAUDITED instead of silently clean", () => {
    const outcome = evaluateCoverage(
      scenario("/docs/nowhere/", { groupCounts: {}, hoverCounts: {}, matched: 0, skipped: 0 }),
    );
    expect(outcome.errors).toEqual([]);
    expect(outcome.notes).toHaveLength(1);
    expect(outcome.notes[0]).toMatch(/UNAUDITED/);
  });
});

describe("evaluateCoverageMatrix", () => {
  it("never lets one pack/mode mask another's gap", () => {
    const good = satisfyingStats(PAGE_ADMONITIONS);
    const bad = satisfyingStats(PAGE_ADMONITIONS);
    delete bad.groupCounts["toc-link"];

    const outcomes = evaluateCoverageMatrix([
      scenario(PAGE_ADMONITIONS, good, "washi", "light"),
      scenario(PAGE_ADMONITIONS, bad, "brutalist", "light"),
      scenario(PAGE_ADMONITIONS, good, "brutalist", "dark"),
    ]);

    expect(outcomes.map((o) => o.errors.length)).toEqual([0, 1, 0]);
    const flagged = outcomes.filter((o) => o.errors.length > 0);
    expect(flagged[0]?.pack).toBe("brutalist");
    expect(flagged[0]?.mode).toBe("light");
    expect(flagged[0]?.errors[0]).toContain("brutalist/light");
  });

  it("keeps per-page results separate when only the second page fails", () => {
    const outcomes = evaluateCoverageMatrix([
      scenario(PAGE_ADMONITIONS, satisfyingStats(PAGE_ADMONITIONS)),
      scenario(PAGE_GETTING_STARTED, {
        ...satisfyingStats(PAGE_GETTING_STARTED),
        groupCounts: { ...satisfyingStats(PAGE_GETTING_STARTED).groupCounts, "pager-link": 0 },
      }),
    ]);
    expect(outcomes[0]?.errors).toEqual([]);
    expect(outcomes[1]?.errors.some((e) => e.includes('"pager-link"'))).toBe(true);
    expect(outcomes[1]?.errors[0]).toContain(PAGE_GETTING_STARTED);
  });
});

describe("describeUnauditedScenarios", () => {
  const full = {
    allPacks: ["default", "washi"],
    auditedPacks: ["default", "washi"],
    allModes: ["light", "dark"],
    auditedModes: ["light", "dark"],
    auditedPages: [...AUDIT_PAGES],
  };

  it("says nothing when the run covered everything", () => {
    expect(describeUnauditedScenarios(full)).toEqual([]);
  });

  it("names the omitted packs, modes and pages", () => {
    const notes = describeUnauditedScenarios({
      ...full,
      auditedPacks: ["default"],
      auditedModes: ["light"],
      auditedPages: [PAGE_ADMONITIONS],
    });
    expect(notes.some((n) => n.includes("washi"))).toBe(true);
    expect(notes.some((n) => n.includes("dark"))).toBe(true);
    const pageNote = notes.find((n) => n.includes(PAGE_GETTING_STARTED));
    expect(pageNote).toBeDefined();
    // The point of the note: the skipped page's requirements were asserted nowhere.
    expect(pageNote).toContain("header-nav-active");
  });

  it("flags an audited page that has no declared contract", () => {
    const notes = describeUnauditedScenarios({ ...full, auditedPages: [...AUDIT_PAGES, "/docs/nowhere/"] });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("/docs/nowhere/");
  });
});
