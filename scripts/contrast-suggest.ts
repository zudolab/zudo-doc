/**
 * scripts/contrast-suggest.ts
 *
 * Derivation engine behind `pnpm contrast:audit --suggest` (S3, #2492).
 *
 * Implements the skill's §2.2 ANSI-palette derivation recipe: for a failing
 * scheme, derive the "ANSI-broken" bg-side slots (codeBg, chatUserBg,
 * chatAssistantBg, mermaidNodeBg/LabelBg/NoteBg, matchedKeywordBg,
 * imageOverlayBg) from the scheme's REAL roles (bg/fg/accent/muted), then
 * OKLCH-nudge the paired text-side slot (§2.1: hue/chroma fixed, lightness
 * moved by the smallest step that clears the threshold) until every pair the
 * slot feeds passes.
 *
 * Ramp-native model (Color Ramp Restructure — zudolab/zudo-doc#2584): the old
 * raw-p5 exception (§2.3, a dedicated dual-constraint search on palette slot
 * 5) no longer exists — there is no raw-slot bypass of `map.semantic` in the
 * new model, so `accent` / `admonition-accent` / `admonition-important` are
 * all just the single `sem.accent` value and move together (#2590).
 *
 * Every suggested value is re-verified against the real math in
 * `contrast-utils.ts` before being emitted — this is a starting point for
 * Wave-3 batch agents, not a guarantee (see skill §2.2: "still goes through
 * the contrast check").
 */

import { oklch as toOklch, formatHex } from "culori";

import {
  resolveRampRef,
  resolveSemanticColors,
  SEMANTIC_RAMP_DEFAULTS,
  SEMANTIC_CSS_NAMES,
} from "../src/config/color-scheme-utils";
import type { ColorScheme, RampRef, SemanticKey } from "../src/config/color-scheme-utils";
import { contrastRatio, colorMixSrgb, relativeLuminance, resolveBg, resolveFg, ADMONITION_TINT_PCT } from "../src/config/contrast-utils";
import type { SchemeReport } from "./contrast-pair-matrix";

// ---------------------------------------------------------------------------
// OKLCH nudge primitive (§2.1)
// ---------------------------------------------------------------------------

interface Oklch {
  l: number;
  c: number;
  h: number;
}

export interface NudgeResult {
  value: string; // oklch(...) CSS string, ready to paste
  ratio: number; // achieved ratio against the caller's ratioFn
  upstreamHex: string;
  deltaL: number;
  deltaC: number;
  ok: boolean; // cleared rawThreshold + headroom (the search target)
  rawThreshold: number;
  headroom: number;
}

const L_STEP = 0.002;
const C_STEP = 0.01;
const MAX_C_ATTEMPTS = 20;

/**
 * Default headroom added on top of the raw WCAG floor when the suggest
 * engine searches for a value. Live-browser verification (scheme-a11y epic
 * #2489, S8) found that colors tuned to EXACTLY the floor (e.g. 4.51:1)
 * render at 4.47-4.50:1 in the real DOM — `color-mix()` compositing and 8-bit
 * quantization eat up to ~0.03-0.05 of ratio. Targeting threshold+0.1 instead
 * of the bare threshold gives every tuned pair real margin. The raw
 * PASS/FAIL floors (4.5 / 3.0, in `contrast-pair-matrix.ts`) are untouched —
 * this only affects where the tuner aims.
 */
export const HEADROOM = 0.1;
/** Hard minimum headroom accepted when gamut-clipping prevents the full
 *  HEADROOM target — never ship a retuned value below rawThreshold + this. */
export const MIN_HEADROOM = 0.05;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function parseOklch(hex: string): Oklch {
  const parsed = toOklch(hex);
  if (!parsed) throw new Error(`Cannot parse color for OKLCH nudge: "${hex}"`);
  return { l: parsed.l, c: parsed.c ?? 0, h: parsed.h ?? 0 };
}

function formatOklch(o: Oklch): string {
  return `oklch(${o.l.toFixed(3)} ${o.c.toFixed(3)} ${o.h.toFixed(2)})`;
}

function toHex(o: Oklch): string {
  return formatHex({ mode: "oklch", l: o.l, c: o.c, h: o.h }) ?? "#000000";
}

/**
 * Safety margin added to `threshold` while SEARCHING (not while reporting).
 * The emitted `value` is a 3-decimal-rounded `oklch(l c h)` string — the same
 * string a human pastes into the source file and the same string a browser
 * parses directly (no hex round-trip). Verifying with a small margin absorbs
 * that final rounding step so the shipped value doesn't land exactly on the
 * threshold boundary.
 */
const SEARCH_MARGIN = 0.005;

/**
 * Nudge `fgHex`'s OKLCH lightness (hue/chroma fixed) until `ratioFn(candidate)`
 * clears `rawThreshold + headroom` (the search TARGET — see `HEADROOM` above).
 * Direction is chosen per-candidate by comparing the ratio achievable at the
 * two lightness extremes (0 and 1) — robust even for multi-background joint
 * constraints (mermaidText, the raw-p5 dual constraint) where the "obvious"
 * direction isn't always obvious. Chroma is reduced only when neither
 * extreme clears the target at the current chroma (a practical stand-in for
 * gamut-clip detection).
 *
 * If the full `rawThreshold + headroom` target is gamut-clipped (unreachable
 * even at zero chroma), the function ships the BEST value found during the
 * search instead of failing outright — `ok` reports whether the full target
 * was reached; the caller/comment formatter classifies how far short (still
 * ≥ `MIN_HEADROOM` in practice for every pair in this scheme set — see
 * `fmtPairComment`).
 *
 * IMPORTANT: `ratioFn` is always evaluated against `formatOklch(candidate)` —
 * the exact 3-decimal string that gets emitted — never against a hex
 * round-trip. Hex-quantizing a candidate mid-search and then shipping an
 * oklch() string is a real bug class: sRGB 8-bit quantization moves the
 * computed luminance just enough, near the threshold boundary, to make the
 * "verified" ratio diverge from what the shipped oklch() string actually
 * resolves to (observed ~0.03 ratio swings in this file's own testing).
 */
function nudgeForThreshold(fgHex: string, rawThreshold: number, ratioFn: (color: string) => number, headroom: number = HEADROOM): NudgeResult {
  const upstream = parseOklch(fgHex);
  const upstreamHex = toHex(upstream);
  const target = rawThreshold + headroom;
  const searchThreshold = target + SEARCH_MARGIN;
  const startRatio = ratioFn(formatOklch(upstream));

  const toResult = (candidate: Oklch, ratio: number): NudgeResult => ({
    value: formatOklch(candidate),
    ratio,
    upstreamHex,
    deltaL: Number((candidate.l - upstream.l).toFixed(4)),
    deltaC: Number((candidate.c - upstream.c).toFixed(4)),
    ok: ratio >= target,
    rawThreshold,
    headroom,
  });

  if (startRatio >= target) {
    return toResult(upstream, startRatio);
  }

  // Tracks the best candidate seen across the whole search, so a
  // gamut-clipped target still ships the closest achievable value instead of
  // an arbitrary pure-black/white fallback.
  let bestRatio = startRatio;
  let bestCandidate: Oklch = upstream;

  let c = upstream.c;
  for (let attempt = 0; attempt <= MAX_C_ATTEMPTS; attempt++) {
    const ratioAtBlack = ratioFn(formatOklch({ l: 0, c, h: upstream.h }));
    const ratioAtWhite = ratioFn(formatOklch({ l: 1, c, h: upstream.h }));
    const towardWhite = ratioAtWhite >= ratioAtBlack;
    const dir = towardWhite ? 1 : -1;
    const bestPossible = towardWhite ? ratioAtWhite : ratioAtBlack;

    if (bestPossible >= searchThreshold) {
      const maxSteps = Math.round(1 / L_STEP);
      for (let i = 0; i <= maxSteps; i++) {
        const l = clamp01(upstream.l + dir * L_STEP * i);
        const candidate = { l, c, h: upstream.h };
        const ratio = ratioFn(formatOklch(candidate));
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestCandidate = candidate;
        }
        if (ratio >= searchThreshold) {
          return toResult(candidate, ratio);
        }
        if (l === 0 || l === 1) break;
      }
    } else if (bestPossible > bestRatio) {
      bestCandidate = { l: towardWhite ? 1 : 0, c, h: upstream.h };
      bestRatio = bestPossible;
    }

    if (c <= 0) break;
    c = Math.max(0, c - C_STEP);
  }

  // Gamut-clipped: the target is unreachable even at zero chroma. Ship the
  // best value found during the search — never worse than the upstream
  // color, and `ok`/`fmtPairComment` make the shortfall visible.
  return toResult(bestCandidate, bestRatio);
}

export function fmtUpstreamComment(r: NudgeResult): string {
  const signL = r.deltaL >= 0 ? "+" : "";
  let s = `upstream ${r.upstreamHex} → L${signL}${r.deltaL.toFixed(3)}`;
  if (r.deltaC !== 0) {
    const signC = r.deltaC >= 0 ? "+" : "";
    s += `, C${signC}${r.deltaC.toFixed(3)}`;
  }
  s += " for AA (scheme-a11y #2489)";
  return s;
}

/**
 * Recomputes `r`'s upstream hex + delta against a DIFFERENT upstream color,
 * keeping `r.value`/`ratio`/`ok` unchanged. Used by the retune-apply tooling
 * to keep a preset's `/* upstream #hex -> ... *\/` comment anchored to the
 * scheme's TRUE original (pre-#2489) palette color across repeated headroom
 * passes, instead of drifting to "upstream" = "the value from the previous
 * pass" (which `nudgeForThreshold` reports honestly, since it only knows the
 * color it started nudging FROM in this run).
 */
export function rebaseNudgeResult(r: NudgeResult, newUpstreamHex: string): NudgeResult {
  const upstream = parseOklch(newUpstreamHex);
  const final = parseOklch(r.value);
  return {
    ...r,
    upstreamHex: toHex(upstream),
    deltaL: Number((final.l - upstream.l).toFixed(4)),
    deltaC: Number((final.c - upstream.c).toFixed(4)),
  };
}

/**
 * Classifies how far a nudge result landed relative to `rawThreshold`,
 * `rawThreshold + MIN_HEADROOM`, and `rawThreshold + headroom` (the full
 * target) — surfaces gamut-clipped shortfalls per scheme-a11y §2.1 ("never
 * below +0.05; if gamut-clipping genuinely prevents +0.1, get as close as
 * possible... and note it") instead of silently shipping a short value.
 */
function fmtPairComment(r: NudgeResult, pairLabel: string): string {
  let note = "";
  if (r.ratio < r.rawThreshold) {
    note = " (still short of AA floor — needs manual chroma/hue adjustment)";
  } else if (r.ratio < r.rawThreshold + MIN_HEADROOM) {
    note = ` (gamut-limited: below +${MIN_HEADROOM} headroom minimum — manual review)`;
  } else if (!r.ok) {
    note = ` (gamut-limited: +${(r.ratio - r.rawThreshold).toFixed(3)} headroom, short of +${r.headroom} target)`;
  }
  return `/* ${fmtUpstreamComment(r)} */ // ${pairLabel} → ${r.ratio.toFixed(2)}:1${note}`;
}

/**
 * "bg-elevated" per §2.2: same hue/chroma, lightness moved away from the
 * extreme. Returns the ready-to-paste `oklch(...)` string — also used
 * directly (never hex-quantized) for downstream ratio checks so the verified
 * ratio matches what the emitted string actually resolves to.
 */
function bgElevated(bgHex: string, dark: boolean, steps: number): string {
  const o = parseOklch(bgHex);
  const delta = 0.04 * steps;
  return formatOklch({ l: clamp01(dark ? o.l + delta : o.l - delta), c: o.c, h: o.h });
}

function asOklchLiteral(hex: string): string {
  return formatOklch(parseOklch(hex));
}

/**
 * Rendered-bg finding (#2510): `muted`/`accent`/`fg` render as text on the
 * elevated `surface` background (footer, toolbar, dropdown panels), not just on
 * the page bg. When `surface` is a raw palette slot sitting FAR from bg (e.g.
 * Catppuccin's light p0), no single `muted` value can clear both the dark page
 * bg AND that light surface without pushing `muted` to near-white — so the
 * correct lever is the bg-SIDE one the skill calls out (§2.2/§3): pull `surface`
 * toward the page bg (a subtler elevation, still separated by its
 * `border-muted`) until every text color that lands on it clears
 * `rawThreshold + headroom`.
 *
 * Minimal OKLCH move: hue/chroma fixed, lightness stepped from the current
 * surface toward bg's lightness (never past it). Because `muted`/`accent`/`fg`
 * are each already tuned to clear bg at `+headroom`, `surface === bg` is a
 * guaranteed satisfying endpoint, so the search always terminates on a value at
 * least as elevated as bg.
 */
function nudgeBgTowardAnchor(
  bgSideHex: string,
  anchorBgHex: string,
  fgColors: string[],
  rawThreshold: number,
  headroom: number = HEADROOM,
): NudgeResult {
  const start = parseOklch(bgSideHex);
  const anchor = parseOklch(anchorBgHex);
  const upstreamHex = toHex(start);
  const target = rawThreshold + headroom;
  const minRatio = (o: Oklch): number => Math.min(...fgColors.map((fc) => contrastRatio(fc, formatOklch(o))));

  const toResult = (candidate: Oklch, ratio: number): NudgeResult => ({
    value: formatOklch(candidate),
    ratio,
    upstreamHex,
    deltaL: Number((candidate.l - start.l).toFixed(4)),
    deltaC: Number((candidate.c - start.c).toFixed(4)),
    ok: ratio >= target,
    rawThreshold,
    headroom,
  });

  const startRatio = minRatio(start);
  if (startRatio >= target) return toResult(start, startRatio);

  const dir = Math.sign(anchor.l - start.l) || -1;
  const maxSteps = Math.round(Math.abs(anchor.l - start.l) / L_STEP) + 1;
  let best = start;
  let bestRatio = startRatio;
  for (let i = 1; i <= maxSteps; i++) {
    const raw = start.l + dir * L_STEP * i;
    const l = dir < 0 ? Math.max(raw, anchor.l) : Math.min(raw, anchor.l);
    const candidate = { l, c: start.c, h: start.h };
    const ratio = minRatio(candidate);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
    if (ratio >= target + SEARCH_MARGIN) return toResult(candidate, ratio);
    if (l === anchor.l) break;
  }
  return toResult(best, bestRatio);
}

// ---------------------------------------------------------------------------
// Color-source description — used both by --suggest comments and the S3
// per-scheme failure inventories (which color feeds the pair).
// ---------------------------------------------------------------------------

const CSS_NAME_TO_SEMANTIC_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(SEMANTIC_CSS_NAMES).map(([key, cssName]) => [cssName, key]),
);

export function describeVarSource(scheme: ColorScheme, varName: string): string {
  if (varName === "--zd-bg") return describeRampRef("bg", scheme.map.bg);
  if (varName === "--zd-fg") return describeRampRef("fg", scheme.map.fg);
  if (varName === "--zd-selection-bg") return describeRampRef("selectionBg", scheme.map.selectionBg);
  if (varName === "--zd-selection-fg") return describeRampRef("selectionFg", scheme.map.selectionFg);

  const semanticKey = CSS_NAME_TO_SEMANTIC_KEY[varName] as SemanticKey | undefined;
  if (semanticKey) {
    const ref = scheme.map.semantic[semanticKey];
    const isDefault = rampRefEquals(ref, SEMANTIC_RAMP_DEFAULTS[semanticKey]);
    return `${describeRampRef(semanticKey, ref)} (${isDefault ? "default" : "custom"})`;
  }

  return varName;
}

function describeRampRef(field: string, ref: RampRef): string {
  if (typeof ref === "string") return `${field} (literal)`;
  if ("base" in ref) return `${field}→base[${ref.base}]`;
  if ("accent" in ref) return `${field}→accent[${ref.accent}]`;
  return `${field}→state.${ref.state}`;
}

function rampRefEquals(a: RampRef, b: RampRef): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  if ("base" in a && "base" in b) return a.base === b.base;
  if ("accent" in a && "accent" in b) return a.accent === b.accent;
  if ("state" in a && "state" in b) return a.state === b.state;
  return false;
}

// ---------------------------------------------------------------------------
// Suggestion builder
// ---------------------------------------------------------------------------

export interface Edit {
  key: string;
  value: string;
  comment: string;
  /** Present for nudged (non-derived) edits. Lets a caller reformat `comment`
   *  with a DIFFERENT upstream hex/delta than the one this run computed — the
   *  retune-apply tooling uses this to preserve a scheme's true original
   *  upstream hex across repeated headroom passes (see `NudgeResult`). */
  nudge?: NudgeResult;
}

export interface SchemeEdits {
  topLevelEdits: Edit[];
  semanticEdits: Edit[];
}

/**
 * Derives the palette/semantic/top-level edits for `scheme`. A pair is
 * targeted whenever its current ratio hasn't reached `threshold + headroom`
 * yet — this covers both genuine failures (ratio < threshold) AND pairs that
 * already pass the raw floor but sit inside the headroom band (scheme-a11y
 * epic #2489, S8: no tuned pair should ship without margin). Every nudge
 * below searches for `threshold + headroom`, never the bare threshold.
 */
export function computeSchemeEdits(scheme: ColorScheme, report: SchemeReport, headroom: number = HEADROOM): SchemeEdits {
  const byKey = new Map(report.pairs.map((p) => [p.key, p]));
  const EPS = 1e-9;
  const fails = (key: string): boolean => {
    const p = byKey.get(key);
    return p ? p.ratio < p.threshold + headroom - EPS : false;
  };

  const bg = resolveBg(scheme);
  const fg = resolveFg(scheme);
  const bgIsDark = relativeLuminance(bg) < 0.5;
  const sem = resolveSemanticColors(scheme);

  const topLevelEdits: Edit[] = [];
  const semanticEdits: Edit[] = [];

  let mutedFinal = sem.muted;
  let accentFinal = sem.accent;
  let warningFinal = sem.warning;
  let codeBgFinal: string | undefined;

  // 1. muted (§3 decision + rendered-bg finding #2510). `muted` renders as
  //    secondary text on the page bg AND on the elevated backgrounds codeBg /
  //    chatAssistantBg (code-block title, ai-chat loading bubble). One muted
  //    value must clear its WORST near-bg background at +headroom — tune against
  //    the min-contrast of all three. `surface` is handled bg-side below (it can
  //    sit far from bg on some schemes; blowing muted up to clear it would wreck
  //    muted's character — see nudgeBgTowardAnchor).
  const mutedNearBgFails = fails("muted-vs-bg") || fails("muted-vs-code-bg") || fails("muted-vs-chat-assistant-bg");
  if (mutedNearBgFails) {
    const mutedBgs = [bg, sem.codeBg, sem.chatAssistantBg];
    const ratioFn = (color: string) => Math.min(...mutedBgs.map((t) => contrastRatio(color, t)));
    const r = nudgeForThreshold(sem.muted, 4.5, ratioFn, headroom);
    mutedFinal = r.value;
    semanticEdits.push({ key: "muted", value: r.value, comment: fmtPairComment(r, "muted-vs-{bg,codeBg,chatAssistantBg}"), nudge: r });
  }

  // 2. accent / admonition-accent / admonition-important. The ramp-native
  //    model has no raw-slot bypass of `map.semantic` (the old raw-p5
  //    exception, §2.3) — admonition-important now pairs against
  //    `--zd-accent` too (contrast-pair-matrix.ts), so all three targets are
  //    just `sem.accent` and move together.
  const accentVsBgFails = fails("accent-vs-bg");
  const admonitionAccentFails = fails("admonition-accent");
  const importantFails = fails("admonition-important");
  if (accentVsBgFails || admonitionAccentFails || importantFails) {
    const ratioFn = (color: string) => {
      const plain = contrastRatio(color, bg);
      const tinted = contrastRatio(color, colorMixSrgb(color, bg, ADMONITION_TINT_PCT));
      return Math.min(plain, tinted);
    };
    const r = nudgeForThreshold(sem.accent, 4.5, ratioFn, headroom);
    accentFinal = r.value;
    semanticEdits.push({ key: "accent", value: r.value, comment: fmtPairComment(r, "accent-vs-bg + admonition-accent + admonition-important"), nudge: r });
  }

  // 3. fg-vs-bg / fg-vs-surface. When fg-vs-bg fails we move fg (satisfying
  //    fg-vs-surface at the same time if it also fails). The fg-vs-surface-only
  //    case (fg clears bg but not surface) is folded into the surface section
  //    below, so surface is edited in exactly one place.
  let fgFinal = fg;
  const fgVsBgFails = fails("fg-vs-bg");
  const fgVsSurfaceFails = fails("fg-vs-surface");
  if (fgVsBgFails) {
    const targets = [bg];
    if (fgVsSurfaceFails) targets.push(sem.surface);
    const ratioFn = (color: string) => Math.min(...targets.map((t) => contrastRatio(color, t)));
    const r = nudgeForThreshold(fg, 4.5, ratioFn, headroom);
    fgFinal = r.value;
    topLevelEdits.push({ key: "foreground", value: r.value, comment: fmtPairComment(r, "fg-vs-bg" + (fgVsSurfaceFails ? " + fg-vs-surface" : "")), nudge: r });
  }

  // 3b. surface (rendered-bg finding #2510). `surface` is the elevated chrome bg
  //     (footer/toolbar/dropdowns); fg/muted/accent all render as text on it.
  //     Pull surface toward the page bg (minimal L move) until every text color
  //     landing on it clears +headroom. Handles muted-vs-surface (16 schemes),
  //     accent-vs-surface (3), and the fg-vs-surface-only case. All surface edits
  //     go through here — never a second `key:"surface"` push.
  const surfaceFgColors: string[] = [];
  if (fgVsSurfaceFails && !fgVsBgFails) surfaceFgColors.push(fgFinal);
  if (fails("muted-vs-surface")) surfaceFgColors.push(mutedFinal);
  if (fails("accent-vs-surface")) surfaceFgColors.push(accentFinal);
  if (surfaceFgColors.length > 0) {
    const r = nudgeBgTowardAnchor(sem.surface, bg, surfaceFgColors, 4.5, headroom);
    // Skip a no-op surface override: when raising `muted` above already lifted
    // muted-vs-surface past the headroom target at the CURRENT surface, surface
    // needs no move — don't pin an otherwise-default `surface` to an explicit
    // literal for nothing.
    if (Math.abs(r.deltaL) > 1e-9) {
      const pairLabel = [
        fgVsSurfaceFails && !fgVsBgFails ? "fg" : null,
        fails("muted-vs-surface") ? "muted" : null,
        fails("accent-vs-surface") ? "accent" : null,
      ]
        .filter(Boolean)
        .join("/");
      semanticEdits.push({ key: "surface", value: r.value, comment: fmtPairComment(r, `${pairLabel}-vs-surface (surface→bg)`), nudge: r });
    }
  }

  // 4. accentHover
  if (fails("accent-hover-vs-bg")) {
    const r = nudgeForThreshold(sem.accentHover, 4.5, (color) => contrastRatio(color, bg), headroom);
    semanticEdits.push({ key: "accentHover", value: r.value, comment: fmtPairComment(r, "accent-hover-vs-bg"), nudge: r });
  }

  // 5. codeBg / codeFg. `map.semantic.surface` is always populated in the
  //    ramp-native model (no optional-override distinction), so codeBg is
  //    simply derived from the scheme's real surface color.
  if (fails("code-fg-vs-code-bg")) {
    const codeBg = sem.surface;
    codeBgFinal = codeBg;
    const r = nudgeForThreshold(fg, 4.5, (color) => contrastRatio(color, codeBg), headroom);
    semanticEdits.push({ key: "codeBg", value: asOklchLiteral(codeBg), comment: "/* derived: bg-elevated (base for codeFg) — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "codeFg", value: r.value, comment: fmtPairComment(r, "code-fg-vs-code-bg"), nudge: r });
  }

  // 6. admonition-success / -warning / -info / -danger
  for (const semKey of ["success", "warning", "info", "danger"] as const) {
    const pairKey = `admonition-${semKey}`;
    if (fails(pairKey)) {
      const ratioFn = (color: string) => contrastRatio(color, colorMixSrgb(color, bg, ADMONITION_TINT_PCT));
      const r = nudgeForThreshold(sem[semKey], 4.5, ratioFn, headroom);
      if (semKey === "warning") warningFinal = r.value;
      semanticEdits.push({ key: semKey, value: r.value, comment: fmtPairComment(r, pairKey), nudge: r });
    }
  }

  // 7. selection
  if (fails("selection")) {
    const selBg = resolveRampRef(scheme.map.selectionBg, scheme.ramps);
    const selFg = resolveRampRef(scheme.map.selectionFg, scheme.ramps);
    const r = nudgeForThreshold(selFg, 4.5, (color) => contrastRatio(color, selBg), headroom);
    topLevelEdits.push({ key: "selectionFg", value: r.value, comment: fmtPairComment(r, "selection"), nudge: r });
  }

  // 8. matchedKeyword — bg derived from warning, fg forced dark/light then nudged
  if (fails("matched-keyword")) {
    const bgBase = warningFinal;
    const fgStart = relativeLuminance(bgBase) > 0.5 ? "oklch(0.150 0 0)" : "oklch(0.950 0 0)";
    const r = nudgeForThreshold(fgStart, 4.5, (color) => contrastRatio(color, bgBase), headroom);
    semanticEdits.push({ key: "matchedKeywordBg", value: asOklchLiteral(bgBase), comment: "/* derived: warning (base for matchedKeywordFg) — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "matchedKeywordFg", value: r.value, comment: fmtPairComment(r, "matched-keyword"), nudge: r });
  }

  // 9. chatUser — bg derived from accent, fg forced dark/light then nudged
  if (fails("chat-user")) {
    const bgBase = accentFinal;
    const fgStart = relativeLuminance(bgBase) > 0.5 ? "oklch(0.150 0 0)" : "oklch(0.950 0 0)";
    const r = nudgeForThreshold(fgStart, 4.5, (color) => contrastRatio(color, bgBase), headroom);
    semanticEdits.push({ key: "chatUserBg", value: asOklchLiteral(bgBase), comment: "/* derived: accent (base for chatUserText) — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "chatUserText", value: r.value, comment: fmtPairComment(r, "chat-user"), nudge: r });
  }

  // 10. chatAssistant — bg derived from the scheme's real surface color, fg derived from real fg
  if (fails("chat-assistant")) {
    const bgBase = sem.surface;
    const r = nudgeForThreshold(fg, 4.5, (color) => contrastRatio(color, bgBase), headroom);
    semanticEdits.push({ key: "chatAssistantBg", value: asOklchLiteral(bgBase), comment: "/* derived: surface — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "chatAssistantText", value: r.value, comment: fmtPairComment(r, "chat-assistant"), nudge: r });
  }

  // 11. mermaid node/label/note bg + shared mermaidText
  const mermaidPairKeys = ["mermaid-text-vs-node-bg", "mermaid-text-vs-label-bg", "mermaid-text-vs-note-bg"];
  if (mermaidPairKeys.some(fails)) {
    const nodeBg = bgElevated(bg, bgIsDark, 1);
    const labelBg = codeBgFinal ?? bgElevated(bg, bgIsDark, 1);
    const noteBg = bgElevated(bg, bgIsDark, 2);
    const ratioFn = (color: string) => Math.min(contrastRatio(color, nodeBg), contrastRatio(color, labelBg), contrastRatio(color, noteBg));
    const r = nudgeForThreshold(fg, 4.5, ratioFn, headroom);
    semanticEdits.push({ key: "mermaidNodeBg", value: asOklchLiteral(nodeBg), comment: "/* derived: bg-elevated — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "mermaidLabelBg", value: asOklchLiteral(labelBg), comment: "/* derived: codeBg-like/bg-elevated — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "mermaidNoteBg", value: asOklchLiteral(noteBg), comment: "/* derived: bg-elevated ×2, distinct from node/label — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "mermaidText", value: r.value, comment: fmtPairComment(r, "mermaid-text-vs-{node,label,note}-bg"), nudge: r });
  }

  // 12. mermaidLine — derived from (fixed) muted
  if (fails("mermaid-line-vs-bg")) {
    const r = nudgeForThreshold(mutedFinal, 3.0, (color) => contrastRatio(color, bg), headroom);
    semanticEdits.push({ key: "mermaidLine", value: r.value, comment: fmtPairComment(r, "mermaid-line-vs-bg"), nudge: r });
  }

  // 13. imageOverlay — bg forced near-bg-dark, fg derived from real fg
  if (fails("image-overlay")) {
    const bgOklch = parseOklch(bg);
    const overlayBgOklch = { l: Math.min(bgOklch.l, 0.15), c: bgOklch.c * 0.5, h: bgOklch.h };
    const overlayBg = formatOklch(overlayBgOklch);
    const r = nudgeForThreshold(fg, 3.0, (color) => contrastRatio(color, overlayBg), headroom);
    semanticEdits.push({ key: "imageOverlayBg", value: overlayBg, comment: "/* derived: near-bg dark — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "imageOverlayFg", value: r.value, comment: fmtPairComment(r, "image-overlay"), nudge: r });
  }

  return { topLevelEdits, semanticEdits };
}

/** Number of pairs in `report` that haven't reached `threshold + headroom` yet
 *  (superset of raw `failCount` — also counts passing-but-marginal pairs). */
function countNeedingWork(report: SchemeReport, headroom: number): number {
  const EPS = 1e-9;
  return report.pairs.filter((p) => p.ratio < p.threshold + headroom - EPS).length;
}

/** Text-rendering wrapper around `computeSchemeEdits`, used by `contrast:audit --suggest`. */
export function buildSuggestionFragment(name: string, scheme: ColorScheme, report: SchemeReport, headroom: number = HEADROOM): string {
  const { topLevelEdits, semanticEdits } = computeSchemeEdits(scheme, report, headroom);

  const lines: string[] = [`=== "${name}" — ${countNeedingWork(report, headroom)} pair(s) below threshold+${headroom} (${report.failCount} raw failure(s)) ===`];
  if (topLevelEdits.length > 0) {
    lines.push("// top-level field tweaks:");
    for (const e of topLevelEdits) lines.push(`${e.key}: ${e.value}, ${e.comment}`);
  }
  if (semanticEdits.length > 0) {
    lines.push("semantic: {");
    for (const e of semanticEdits) lines.push(`  ${e.key}: ${e.value}, ${e.comment}`);
    lines.push("},");
  }
  return lines.join("\n");
}
