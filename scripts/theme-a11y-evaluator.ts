/**
 * scripts/theme-a11y-evaluator.ts
 *
 * PURE, browser-free evaluation core for the theme-a11y audit
 * (`scripts/theme-a11y-audit.ts`). Everything here is deterministic and unit
 * tested (`scripts/__tests__/theme-a11y-evaluator.test.ts`) — the Playwright
 * driver only *collects* raw computed-style samples in the browser and hands
 * them here for verdicts, so all the tricky logic (alpha compositing, the
 * effective-background ancestor walk, large-text classification, threshold
 * banding, gradient/overlay skip decisions, allowlist matching + stale-entry
 * detection, and the coverage contract) can be proven without a browser.
 *
 * WCAG math (`contrastRatio`) is imported from `src/config/contrast-utils.ts`
 * — the SAME module the static `pnpm contrast:audit` guard uses — so the two
 * audits can never silently diverge on luminance/contrast. `parseSrgb` there
 * discards alpha, so this module carries its own alpha-aware `parseSrgbA`
 * wrapper (culori) and the compositing helpers the rendered audit needs.
 */

import { rgb as culoriRgb } from "culori";

import { contrastRatio } from "../src/config/contrast-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Srgb {
  r: number;
  g: number;
  b: number;
}
export interface SrgbA extends Srgb {
  /** Alpha in [0, 1]. */
  a: number;
}

/** Verdict union — the report/console vocabulary. `ALLOW` is applied by the
 *  driver (a `FAIL` matched by the allowlist), never by {@link evaluateSample}. */
export type Verdict = "PASS" | "WARN" | "FAIL" | "ALLOW" | "SKIP";

/** How an inventory element is classified for gating:
 *  - `text`   → 4.5:1 (or 3.0:1 when large), the readable-text contract.
 *  - `ui`     → 3.0:1 non-text UI-indicator contract (WCAG 1.4.11); ink is the
 *               SVG fill/stroke, not `color`.
 *  - `decorative` → exempt from 1.4.11 entirely (logo, purely ornamental icons). */
export type ElementKind = "text" | "ui" | "decorative";

/** One ancestor's paint-relevant computed styles, element-first (index 0 is
 *  the measured element itself, last entry is `<html>`). */
export interface AncestorLayer {
  backgroundColor: string;
  backgroundImage: string;
  /** Parsed `opacity` in [0, 1]. */
  opacity: number;
}

/** A `::before` / `::after` computed snapshot — used to detect a positioned
 *  pseudo-element painting over the measured element (backdrop indeterminate). */
export interface PseudoLayer {
  backgroundColor: string;
  backgroundImage: string;
  position: string;
}

/** The serializable payload the browser collector emits per matched element. */
export interface RawSample {
  elementKey: string;
  selector: string;
  /** `static` | `active` | `hover`. */
  state: string;
  kind: ElementKind;
  /** Computed `color` (may carry alpha). */
  color: string;
  fontSizePx: number;
  fontWeight: number;
  /** Element-first ancestor chain up to `<html>`. */
  chain: AncestorLayer[];
  /** `[::before, ::after]` snapshots of the measured element. */
  pseudos: PseudoLayer[];
  /** Present only for `ui` elements — the icon's fill/stroke ink source. */
  svg?: { fill: string; stroke: string } | null;
  /** Trimmed, truncated text content (report readability only). */
  text?: string;
}

/** Result of evaluating one sample. `ALLOW` is never produced here. */
export interface SampleEvaluation {
  verdict: Exclude<Verdict, "ALLOW">;
  ratio: number | null;
  /** Resolved (composited) foreground ink, as an `rgb(...)` string. */
  fg: string | null;
  /** Resolved (composited, opaque) background, as an `rgb(...)` string. */
  bg: string | null;
  threshold: number | null;
  isLargeText: boolean;
  skipReason?: string;
}

// ---------------------------------------------------------------------------
// Tunables (WCAG AA)
// ---------------------------------------------------------------------------

/** Normal readable text. */
export const THRESHOLD_NORMAL = 4.5;
/** Large text AND non-text UI indicators (WCAG 1.4.11). */
export const THRESHOLD_LARGE = 3.0;
export const THRESHOLD_UI = 3.0;
/** A pass within this margin above threshold is reported `WARN` (informational,
 *  non-gating) so marginal pairs surface before they regress. */
export const WARN_BAND = 0.3;
/** Large-text lower bounds: ≥ 24px, OR ≥ 18.66px at weight ≥ 700. */
export const LARGE_TEXT_MIN_PX = 24;
export const LARGE_TEXT_BOLD_MIN_PX = 18.66;
export const LARGE_TEXT_BOLD_MIN_WEIGHT = 700;
/** A state whose SKIP share exceeds this fraction of its evaluable elements is
 *  a coverage error — a broken evaluator can't go vacuously green. */
export const MAX_SKIP_RATIO = 0.3;
/** Alpha at/above which a layer is treated as fully opaque. */
const OPAQUE_ALPHA = 0.999;

// ---------------------------------------------------------------------------
// Color parsing / compositing
// ---------------------------------------------------------------------------

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Parse any CSS color and return sRGB components AND alpha in [0, 1]. Unlike
 * `parseSrgb` in `contrast-utils.ts` (which drops alpha), this keeps it — the
 * rendered audit must composite translucent fg/bg to get true contrast.
 */
export function parseSrgbA(cssColor: string): SrgbA {
  const result = culoriRgb(cssColor);
  if (!result) throw new Error(`Cannot parse CSS color: "${cssColor}"`);
  return {
    r: clamp01(result.r),
    g: clamp01(result.g),
    b: clamp01(result.b),
    a: clamp01(result.alpha ?? 1),
  };
}

/** Composite a translucent source over an opaque backdrop (sRGB "source-over"). */
export function compositeOver(src: SrgbA, backdrop: Srgb): Srgb {
  const a = clamp01(src.a);
  return {
    r: src.r * a + backdrop.r * (1 - a),
    g: src.g * a + backdrop.g * (1 - a),
    b: src.b * a + backdrop.b * (1 - a),
  };
}

/** Emit an sRGB triple as a CSS `rgb(r g b)` string (0–255, fractional ok) —
 *  round-trips through culori / `contrastRatio`. */
export function srgbToCss(c: Srgb): string {
  const to255 = (n: number): number => Math.round(clamp01(n) * 255 * 1000) / 1000;
  return `rgb(${to255(c.r)} ${to255(c.g)} ${to255(c.b)})`;
}

// ---------------------------------------------------------------------------
// Effective background resolution
// ---------------------------------------------------------------------------

export type BackgroundResolution = { bg: Srgb } | { skip: string };

/**
 * Resolve the opaque color painted directly behind the measured element's text.
 *
 * Walks the element-first ancestor chain compositing each layer's
 * `background-color` (alpha-aware) until the accumulated backdrop is opaque.
 * `opacity` is folded in physically: a node's own group opacity (the product
 * of its opacity and every ANCESTOR'S opacity — opacity fades a subtree, not
 * its parents) scales that layer's effective alpha, so a semi-transparent
 * group both lightens the backdrop and (via {@link evaluateSample}) fades the
 * text with it.
 *
 * Returns `{ skip }` — never a guess — when the true backdrop is
 * indeterminate: a `background-image`/gradient paints beneath the element
 * before any opaque solid is reached (this is the refined rule the epic asks
 * for — a gradient on `<body>` covered by an opaque content surface is NEVER
 * reached, so fjord/drift/phosphor content still evaluates), or no opaque
 * layer exists at all.
 */
export function resolveEffectiveBackground(chain: AncestorLayer[]): BackgroundResolution {
  const n = chain.length;
  if (n === 0) return { skip: "empty ancestor chain" };

  // groupOpacity[i] = product of opacity of node i and all its ancestors
  // (i..last) — the factor by which node i's OWN paint is faded.
  const groupOpacity = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    const own = chain[i]!.opacity;
    groupOpacity[i] = i === n - 1 ? own : own * groupOpacity[i + 1]!;
  }

  const layers: SrgbA[] = [];
  let baseIndex = -1;
  for (let i = 0; i < n; i++) {
    const layer = chain[i]!;
    if (layer.backgroundImage && layer.backgroundImage !== "none") {
      return {
        skip: `background-image/gradient paints beneath element (ancestor depth ${i}) — backdrop indeterminate`,
      };
    }
    const c = parseSrgbA(layer.backgroundColor);
    const effAlpha = c.a * (groupOpacity[i] ?? 1);
    layers.push({ r: c.r, g: c.g, b: c.b, a: effAlpha });
    if (effAlpha >= OPAQUE_ALPHA) {
      baseIndex = i;
      break;
    }
  }

  if (baseIndex === -1) {
    return { skip: "no opaque background resolved in ancestor chain" };
  }

  // Composite front (0) over ... over the opaque base.
  const base = layers[baseIndex]!;
  let acc: Srgb = { r: base.r, g: base.g, b: base.b };
  for (let i = baseIndex - 1; i >= 0; i--) {
    acc = compositeOver(layers[i]!, acc);
  }
  return { bg: acc };
}

// ---------------------------------------------------------------------------
// Pseudo-element overlay detection
// ---------------------------------------------------------------------------

/**
 * A positioned `::before`/`::after` that paints a real background (image or a
 * substantially-opaque color) can sit over the measured element, making its
 * true backdrop indeterminate → SKIP. Non-positioned pseudos (inline icon
 * glyphs via `content`, underline decorations) don't trigger this.
 */
export function detectPseudoOverlay(pseudos: PseudoLayer[]): string | null {
  for (const p of pseudos) {
    const positioned = p.position === "absolute" || p.position === "fixed";
    if (!positioned) continue;
    const hasImage = Boolean(p.backgroundImage) && p.backgroundImage !== "none";
    let opaqueish = false;
    try {
      opaqueish = parseSrgbA(p.backgroundColor).a >= 0.5;
    } catch {
      opaqueish = false;
    }
    if (hasImage || opaqueish) {
      return "positioned pseudo-element paints over element — backdrop indeterminate";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Classification / thresholds / SVG ink
// ---------------------------------------------------------------------------

export function classifyLargeText(fontSizePx: number, fontWeight: number): boolean {
  if (fontSizePx >= LARGE_TEXT_MIN_PX) return true;
  return fontSizePx >= LARGE_TEXT_BOLD_MIN_PX && fontWeight >= LARGE_TEXT_BOLD_MIN_WEIGHT;
}

export function thresholdFor(kind: ElementKind, isLargeText: boolean): number {
  if (kind === "ui") return THRESHOLD_UI;
  return isLargeText ? THRESHOLD_LARGE : THRESHOLD_NORMAL;
}

/** Resolve an SVG icon's visible ink: prefer an opaque `fill`, else `stroke`,
 *  resolving `currentColor` to the element's `color`. Returns null when neither
 *  paints (both `none`/transparent) — the icon has no ink to gate. */
export function resolveSvgInk(fill: string, stroke: string, color: string): string | null {
  const resolve = (v: string): string => (v.trim().toLowerCase() === "currentcolor" ? color : v);
  const paints = (v: string): boolean => {
    if (!v || v.trim().toLowerCase() === "none") return false;
    try {
      return parseSrgbA(v).a > 0;
    } catch {
      return false;
    }
  };
  const f = resolve(fill);
  if (paints(f)) return f;
  const s = resolve(stroke);
  if (paints(s)) return s;
  return null;
}

// ---------------------------------------------------------------------------
// Core sample evaluation
// ---------------------------------------------------------------------------

function skip(reason: string): SampleEvaluation {
  return { verdict: "SKIP", ratio: null, fg: null, bg: null, threshold: null, isLargeText: false, skipReason: reason };
}

/**
 * Verdict for one raw sample. Pure: no DOM, no allowlist (the driver upgrades
 * a `FAIL` to `ALLOW`). "Surely problematic" means no false positives — any
 * indeterminate backdrop yields SKIP, never a guessed FAIL.
 */
export function evaluateSample(s: RawSample): SampleEvaluation {
  if (s.kind === "decorative") {
    return skip("decorative element — exempt from WCAG 1.4.11");
  }

  const pseudoSkip = detectPseudoOverlay(s.pseudos);
  if (pseudoSkip) return skip(pseudoSkip);

  // CSS `opacity` < 1 composites an element's text AND its background as one
  // group, then fades the group over the backdrop BEHIND it — the ink ends up
  // faded toward that backdrop, not toward its own background. Modelling that
  // correctly needs the pre-group backdrop; rather than approximate it (and
  // risk a false FAIL — e.g. black text on a white opacity:.5 box over black
  // renders ~5.3:1, not the ~2.6:1 a naive per-layer fade would report), SKIP
  // any element inside an opacity group. `product === 1` ⇔ every opacity is 1.
  const groupOpacity = s.chain.reduce((p, l) => p * l.opacity, 1);
  if (groupOpacity < 1 - 1e-6) {
    return skip("inside an opacity group (opacity<1 in ancestor chain) — rendered contrast indeterminate");
  }

  const bgRes = resolveEffectiveBackground(s.chain);
  if ("skip" in bgRes) return skip(bgRes.skip);
  const bg = bgRes.bg;
  const bgCss = srgbToCss(bg);

  // Ink source: SVG fill/stroke for UI indicators, `color` for text.
  let inkColor: string;
  if (s.kind === "ui" && s.svg) {
    const ink = resolveSvgInk(s.svg.fill, s.svg.stroke, s.color);
    if (!ink) return skip("SVG icon has no resolvable fill/stroke ink");
    inkColor = ink;
  } else {
    inkColor = s.color;
  }

  const ink = parseSrgbA(inkColor);
  // Group opacity is guaranteed 1 here (opacity groups SKIP above), so only the
  // ink's OWN color-alpha fades it — composite that translucent ink over bg.
  if (ink.a <= 0.001) return skip("ink is fully transparent");

  const fgComposited = compositeOver(ink, bg);
  const fgCss = srgbToCss(fgComposited);

  const ratio = contrastRatio(fgCss, bgCss);
  const isLargeText = s.kind === "text" && classifyLargeText(s.fontSizePx, s.fontWeight);
  const threshold = thresholdFor(s.kind, isLargeText);

  let verdict: SampleEvaluation["verdict"];
  if (ratio >= threshold + WARN_BAND) verdict = "PASS";
  else if (ratio >= threshold) verdict = "WARN";
  else verdict = "FAIL";

  return { verdict, ratio, fg: fgCss, bg: bgCss, threshold, isLargeText };
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

/** An allowlisted FAIL, keyed pack/mode/elementKey/state with a MANDATORY
 *  reason. An entry that never turns a real FAIL into ALLOW is stale (below). */
export interface AllowlistEntry {
  pack: string;
  mode: string;
  elementKey: string;
  state: string;
  reason: string;
}

export function allowlistKey(pack: string, mode: string, elementKey: string, state: string): string {
  return `${pack}/${mode}/${elementKey}/${state}`;
}

export function findAllowlistEntry(
  allowlist: readonly AllowlistEntry[],
  pack: string,
  mode: string,
  elementKey: string,
  state: string,
): AllowlistEntry | undefined {
  return allowlist.find(
    (e) => e.pack === pack && e.mode === mode && e.elementKey === elementKey && e.state === state,
  );
}

/** Structural validation: every entry needs a non-empty reason. Returns the
 *  list of offending keys (empty when clean). */
export function validateAllowlist(allowlist: readonly AllowlistEntry[]): string[] {
  const errors: string[] = [];
  for (const e of allowlist) {
    if (!e.reason || e.reason.trim().length === 0) {
      errors.push(`${allowlistKey(e.pack, e.mode, e.elementKey, e.state)} — missing mandatory reason`);
    }
  }
  return errors;
}

/**
 * Stale-entry detection (mirrors the contrast guard's integrity check): an
 * allowlist entry that consumed no real FAIL this run — its target now passes,
 * was skipped, or never existed — is itself a FAIL-grade error. Returns the
 * keys of stale entries.
 */
export function detectStaleAllowlistEntries(
  allowlist: readonly AllowlistEntry[],
  consumedKeys: ReadonlySet<string>,
): string[] {
  const stale: string[] = [];
  for (const e of allowlist) {
    const key = allowlistKey(e.pack, e.mode, e.elementKey, e.state);
    if (!consumedKeys.has(key)) stale.push(key);
  }
  return stale;
}

// ---------------------------------------------------------------------------
// Coverage contract
// ---------------------------------------------------------------------------

export interface CoverageRequirement {
  /** Inventory elementKey this requirement counts. */
  group: string;
  /** Minimum matched (visible) elements required in every audited state. */
  min: number;
}

/**
 * Required element groups + minimum match counts, per (pack × mode) state. A
 * required group matching ZERO is a configuration error (the audited page or a
 * selector drifted) — never a silent green.
 *
 * Kept to groups that are unconditional server-rendered markup so the contract
 * never false-fails before #3034's first real-site run. Active/hover/breadcrumb
 * /footer/TOC-active groups are measured-if-present (not required) here; #3034
 * can promote them once the real run confirms their presence on the default
 * page.
 */
export const COVERAGE_CONTRACT: readonly CoverageRequirement[] = [
  { group: "header-nav", min: 3 },
  { group: "sidebar-link", min: 3 },
  { group: "toc-link", min: 3 },
  { group: "content-heading", min: 1 },
  { group: "content-paragraph", min: 1 },
  { group: "admonition-title", min: 4 },
  { group: "admonition-body", min: 4 },
  { group: "pager-link", min: 1 },
];

export interface CoverageStats {
  /** Matched (visible) element count per elementKey. */
  groupCounts: Record<string, number>;
  /** Total evaluable (non-decorative) elements matched in the state. */
  matched: number;
  /** Elements that evaluated to SKIP (excluding decorative). */
  skipped: number;
}

/** Coverage errors for one state — zero-match required groups, under-min
 *  groups, and an over-ceiling SKIP share. Empty array = clean. */
export function evaluateCoverage(state: string, stats: CoverageStats): string[] {
  const errors: string[] = [];
  for (const req of COVERAGE_CONTRACT) {
    const count = stats.groupCounts[req.group] ?? 0;
    if (count === 0) {
      errors.push(`[${state}] required group "${req.group}" matched ZERO elements (configuration error)`);
    } else if (count < req.min) {
      errors.push(`[${state}] required group "${req.group}" matched ${count} (< required min ${req.min})`);
    }
  }
  if (stats.matched > 0 && stats.skipped / stats.matched > MAX_SKIP_RATIO) {
    const pct = Math.round((stats.skipped / stats.matched) * 100);
    errors.push(
      `[${state}] SKIP share ${pct}% of ${stats.matched} matched exceeds ${Math.round(
        MAX_SKIP_RATIO * 100,
      )}% ceiling — evaluator may be mis-measuring`,
    );
  }
  return errors;
}
