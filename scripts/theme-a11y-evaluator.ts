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
  /** Distinguishes a `SKIP` that is a determinate "the gradient crosses the
   *  threshold" result (`"straddle"`) from an indeterminate "couldn't measure the
   *  backdrop" one (absent). Only the latter counts toward the coverage
   *  MAX_SKIP_RATIO ceiling — a straddle IS a measurement, not a checker gap. */
  skipKind?: "straddle";
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
/** Hard cap on the candidate-backdrop set carried through the ancestor walk.
 *  Dense per-segment sampling ({@link GRADIENT_SEGMENT_SAMPLES}) puts a single
 *  gradient in the low dozens (a 2-stop = 21, a 3-stop = 41), and the deduped
 *  set stays well under this on a real page — translucent washes composited over
 *  an opaque base collapse to a handful. Only a pathological deep stack of many
 *  multi-stop gradients could exceed this, and such a backdrop is treated as
 *  indeterminate (SKIP) rather than lossily reduced — dropping a candidate before
 *  the ink color is known could discard the exact backdrop that fails (min
 *  contrast is not always at a luminance extreme, and luminance is weighted, not
 *  a flat RGB mean). */
const MAX_BACKDROP_CANDIDATES = 256;

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
// Background-image (gradient/overlay) stop parsing
// ---------------------------------------------------------------------------

/** Color-function / hex tokens inside a computed `background-image` value. The
 *  browser serializes gradient stops to concrete colors (no `color-mix`, no
 *  `light-dark`), so a non-nesting `\([^)]*\)` match is sufficient. */
const IMAGE_COLOR_TOKEN =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/g;

/** Sentinel: an image whose paint can't be reduced to color stops (a `url(...)`
 *  bitmap could be any opaque art). Its layer's backdrop is indeterminate. */
export const UNREADABLE_IMAGE = "unreadable" as const;

/**
 * Parse a computed `background-image` into its gradient/overlay color stops.
 * `none`/empty → `null` (no image). A `url(...)` bitmap or any unparseable
 * token → {@link UNREADABLE_IMAGE} (caller SKIPs — no guessing). Otherwise the
 * parsed stop colors, alpha kept, in source order.
 *
 * NOTE: when one `background-image` property stacks SEVERAL comma-separated
 * gradients, their stops are pooled into one flat list and (by the caller) each
 * composited independently over the solid — the stacked layers are not
 * composited onto each other. For the theme packs this is immaterial: the only
 * stacks are near-imperceptible grain/aurora washes (≤0.05–0.38 alpha over an
 * opaque surface) whose combined tint never crosses a contrast threshold that a
 * single stop wouldn't. A precise per-layer composite would need the layers kept
 * separate, which the flat computed string doesn't hand back cleanly.
 */
export function parseImageStops(backgroundImage: string): SrgbA[] | null | typeof UNREADABLE_IMAGE {
  if (!backgroundImage || backgroundImage === "none") return null;
  if (/\burl\(/i.test(backgroundImage)) return UNREADABLE_IMAGE;
  const tokens = backgroundImage.match(IMAGE_COLOR_TOKEN);
  if (!tokens || tokens.length === 0) return UNREADABLE_IMAGE;
  const stops: SrgbA[] = [];
  for (const token of tokens) {
    try {
      stops.push(parseSrgbA(token));
    } catch {
      return UNREADABLE_IMAGE;
    }
  }
  return stops;
}

/** Deduplicate candidate backdrops by 8-bit-rounded value (order-preserving).
 *  Deliberately lossless — see {@link MAX_BACKDROP_CANDIDATES}. */
function dedupeCandidates(candidates: Srgb[]): Srgb[] {
  const seen = new Map<string, Srgb>();
  for (const c of candidates) {
    const key = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}

/** Interior sample steps per gradient segment (between each ADJACENT stop
 *  pair). 20 steps ⇒ samples at every 5% plus both endpoints (21 points per
 *  segment) — see {@link interpolateStops} for why one midpoint is insufficient. */
const GRADIENT_SEGMENT_SAMPLES = 20;

/**
 * Densely sample a gradient's ADJACENT-stop segments so the worst-contrast
 * point BETWEEN two stops is in the candidate set. A single interior midpoint
 * is NOT enough: relative luminance is convex in the linear interpolation
 * parameter (each channel is linear in t, the sRGB→linear transform is convex,
 * and a sum of convex functions is convex), so the minimum-luminance point — and
 * thus the worst contrast against a fixed ink — can sit at an interior extremum
 * that the arithmetic midpoint misses when the channels move in opposite
 * directions (counter-example: rgb(25 14 211) over rgb(235 148 160)→rgb(3 236
 * 106) dips to ~4.41:1 near 19% though start/mid/end read 4.54/4.73/6.46). The
 * piecewise transform makes an exact closed-form extremum fiddly, so we sample
 * each segment at {@link GRADIENT_SEGMENT_SAMPLES} even steps (endpoints
 * included) and let the caller keep the worst. Stops in source order; shared
 * segment endpoints are emitted once.
 */
function interpolateStops(stops: SrgbA[]): SrgbA[] {
  if (stops.length < 2) return stops;
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const out: SrgbA[] = [stops[0]!];
  for (let i = 0; i < stops.length - 1; i++) {
    const s = stops[i]!;
    const next = stops[i + 1]!;
    // k starts at 1 so the shared start stop (already pushed) isn't duplicated;
    // k === GRADIENT_SEGMENT_SAMPLES emits this segment's end stop.
    for (let k = 1; k <= GRADIENT_SEGMENT_SAMPLES; k++) {
      const t = k / GRADIENT_SEGMENT_SAMPLES;
      out.push({ r: lerp(s.r, next.r, t), g: lerp(s.g, next.g, t), b: lerp(s.b, next.b, t), a: lerp(s.a, next.a, t) });
    }
  }
  return out;
}

/**
 * Backdrops a single layer paints, given the opaque color already resolved
 * behind it (`base`): the color alone (revealed wherever the layer's image is
 * transparent) plus that color tinted by each image stop (and interpolated
 * mid-stops). No image ⇒ just the color.
 */
function candidatesFromLayer(stops: SrgbA[] | null, groupOpacity: number, base: Srgb): Srgb[] {
  if (!stops || stops.length === 0) return [base];
  const out: Srgb[] = [base];
  for (const s of interpolateStops(stops)) {
    out.push(compositeOver({ r: s.r, g: s.g, b: s.b, a: s.a * groupOpacity }, base));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Effective background resolution
// ---------------------------------------------------------------------------

/** The set of opaque backdrops that can paint behind the text. A solid resolves
 *  to one; a gradient/overlay resolves to several (its stops over the solid) so
 *  the caller can gate on the worst case. `skip` when truly indeterminate. */
export type BackgroundResolution = { candidates: Srgb[] } | { skip: string };

/**
 * Resolve the opaque backdrop(s) painted behind the measured element's text.
 *
 * Walks the element-first ancestor chain to the first layer opaque ON ITS OWN
 * (an opaque `background-color`, or a fully-opaque covering `background-image`),
 * then composites the translucent layers in front of it over that base.
 * `opacity` is folded in physically: a node's group opacity (the product of its
 * own and every ANCESTOR'S opacity — opacity fades a subtree, not its parents)
 * scales that layer's effective alpha, so a semi-transparent group both lightens
 * the backdrop and (via {@link evaluateSample}) fades the text with it.
 *
 * A `background-image` is NOT a blind SKIP: its gradient/overlay stops are
 * resolved into a SET of candidate backdrops (each stop — and interpolated
 * mid-stops — composited over the solid, plus the solid itself where the image
 * is transparent). The caller gates on the worst candidate and SKIPs only a set
 * that straddles the threshold (genuinely position-dependent). This turns a
 * paper-grain wash or an ambient aurora tint over an opaque surface — previously
 * a whole-group SKIP — into a real verdict, while a `url(...)` bitmap
 * (indeterminate art) still SKIPs.
 *
 * Images are parsed only for VISIBLE layers (at/in front of the opaque base):
 * an unreadable bitmap on a layer HIDDEN behind an opaque surface can't affect
 * the text, so it does not force a SKIP. Returns `{ skip }` — never a guessed
 * pass — when a visible image is unreadable, no opaque layer exists, or the
 * candidate set is too large to bound losslessly (a pathological gradient stack).
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

  // Front→back: find the base layer and its candidate backdrops. Parse each
  // layer's image lazily as we reach it — layers behind the base are never
  // reached, so a hidden bitmap there is irrelevant.
  let baseIndex = -1;
  let candidates: Srgb[] = [];
  for (let i = 0; i < n; i++) {
    const layer = chain[i]!;
    const ga = groupOpacity[i] ?? 1;
    const stops = parseImageStops(layer.backgroundImage);
    if (stops === UNREADABLE_IMAGE) {
      return { skip: `unreadable background-image (ancestor depth ${i}) — backdrop indeterminate` };
    }
    const c = parseSrgbA(layer.backgroundColor);
    const colorEffAlpha = c.a * ga;
    const imageIsOpaqueCover =
      stops !== null && stops.length > 0 && stops.every((s) => s.a * ga >= OPAQUE_ALPHA);

    if (colorEffAlpha >= OPAQUE_ALPHA) {
      // Opaque solid base. An image on this layer — even one whose stops are all
      // opaque — does NOT necessarily cover it: background-size/background-repeat
      // (which computed styles here don't expose) can leave the solid visible,
      // e.g. sumi's 0.55rem no-repeat corner-seal gradient. So the solid stays a
      // candidate and the image stops are ADDITIONAL candidates over it; the
      // worst wins. Never drop the solid for a same-layer gradient — assuming
      // full coverage would manufacture a false FAIL where the text sits on the
      // uncovered solid.
      baseIndex = i;
      candidates = candidatesFromLayer(stops, ga, { r: c.r, g: c.g, b: c.b });
      break;
    }
    if (imageIsOpaqueCover) {
      // No opaque background-color here, but a fully-opaque gradient is present.
      // Treat it as the base (its stops + mid-stops are the backdrops). The one
      // case this can't see through is a partial (small background-size) opaque
      // gradient over a TRANSPARENT color — accepted; the packs' opaque
      // gradients on transparent-bg layers are full-cover surface fills.
      baseIndex = i;
      candidates = interpolateStops(stops).map((s) => ({ r: s.r, g: s.g, b: s.b }));
      break;
    }
    // Otherwise this layer is see-through — composited over the base below.
  }

  if (baseIndex === -1) {
    return { skip: "no opaque background resolved in ancestor chain" };
  }

  // Composite the front translucent layers (baseIndex-1 .. 0) over every base
  // candidate: each paints its background-color, then its see-through image.
  candidates = dedupeCandidates(candidates);
  if (candidates.length > MAX_BACKDROP_CANDIDATES) {
    return { skip: "gradient stack too complex to bound losslessly — backdrop indeterminate" };
  }
  for (let i = baseIndex - 1; i >= 0; i--) {
    const layer = chain[i]!;
    const ga = groupOpacity[i] ?? 1;
    const stops = parseImageStops(layer.backgroundImage);
    if (stops === UNREADABLE_IMAGE) {
      return { skip: `unreadable background-image (ancestor depth ${i}) — backdrop indeterminate` };
    }
    const c = parseSrgbA(layer.backgroundColor);
    const next: Srgb[] = [];
    for (const cand of candidates) {
      const afterColor = compositeOver({ r: c.r, g: c.g, b: c.b, a: c.a * ga }, cand);
      next.push(...candidatesFromLayer(stops, ga, afterColor));
    }
    candidates = dedupeCandidates(next);
    if (candidates.length > MAX_BACKDROP_CANDIDATES) {
      return { skip: "gradient stack too complex to bound losslessly — backdrop indeterminate" };
    }
  }
  return { candidates };
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
  const candidates = bgRes.candidates;

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
  // ink's OWN color-alpha fades it — composite that translucent ink over each bg.
  if (ink.a <= 0.001) return skip("ink is fully transparent");

  const isLargeText = s.kind === "text" && classifyLargeText(s.fontSizePx, s.fontWeight);
  const threshold = thresholdFor(s.kind, isLargeText);

  // Contrast against every candidate backdrop. A single solid ⇒ one candidate
  // (unchanged behaviour). A gradient ⇒ several: gate on unanimity so no false
  // positives — all clear ⇒ PASS/WARN by the worst; all fail ⇒ FAIL; a set that
  // straddles the threshold is genuinely position-dependent ⇒ SKIP. Report the
  // worst (min-ratio) candidate.
  let minRatio = Infinity;
  let maxRatio = -Infinity;
  let worstFg = "";
  let worstBg = "";
  for (const bg of candidates) {
    const bgCss = srgbToCss(bg);
    const fgCss = srgbToCss(compositeOver(ink, bg));
    const ratio = contrastRatio(fgCss, bgCss);
    if (ratio < minRatio) {
      minRatio = ratio;
      worstFg = fgCss;
      worstBg = bgCss;
    }
    if (ratio > maxRatio) maxRatio = ratio;
  }

  let verdict: SampleEvaluation["verdict"];
  if (minRatio >= threshold + WARN_BAND) verdict = "PASS";
  else if (minRatio >= threshold) verdict = "WARN";
  else if (maxRatio < threshold) verdict = "FAIL";
  else {
    // The gradient is readable on some positions and sub-threshold on others.
    // We measured it fully — this is NOT an indeterminate backdrop — so it is a
    // determinate `straddle` SKIP that stays out of the coverage ceiling, while
    // still surfacing (never guessed into a whole-audit FAIL — no false positives).
    return {
      verdict: "SKIP",
      ratio: minRatio,
      fg: worstFg,
      bg: worstBg,
      threshold,
      isLargeText,
      skipReason: `gradient backdrop straddles the ${threshold}:1 threshold (worst ${minRatio.toFixed(2)}, best ${maxRatio.toFixed(2)}) — position-dependent`,
      skipKind: "straddle",
    };
  }

  return { verdict, ratio: minRatio, fg: worstFg, bg: worstBg, threshold, isLargeText };
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
  /**
   * Additionally require at least ONE `hover`-state sample for the group.
   *
   * Static counts alone are not enough for the hover-regression surfaces: the
   * driver counts only non-hover samples toward `groupCounts`, so a group can
   * satisfy its `min` while its hover measurement was silently never collected
   * (element off-screen, covered, unhoverable). That is precisely how a broken
   * hover rule stays invisible — see #4033.
   */
  requireHover?: boolean;
}

/** Page paths the audit renders by default; also the contract's keys. */
export const PAGE_ADMONITIONS = "/docs/components/admonitions/";
export const PAGE_GETTING_STARTED = "/docs/getting-started/";

/**
 * Required element groups + minimum match counts, **per audited page**, applied
 * to every (pack × mode) state of that page. A required group matching ZERO is
 * a configuration error (the page or a selector drifted) — never a silent green.
 *
 * PER-PAGE, not global, because the inventory is not uniformly reachable: the
 * two default pages are structurally complementary and only their union covers
 * the chrome (#4033).
 *
 * - `/docs/components/admonitions/` is a **leaf** page under a **dropdown**
 *   category → `sidebar-active-leaf` + `header-nav-dropdown-active`, plus the
 *   TOC / breadcrumb / admonition / code content. Its top-level nav item is a
 *   dropdown wrapper, so it yields ZERO plain `header-nav-active`.
 * - `/docs/getting-started/` is a **root category** page under a **plain**
 *   top-level nav item → the only source of `header-nav-active`. Its active
 *   sidebar node is a ROOT, which carries `aria-current="page"` WITHOUT
 *   `data-nav-active`, so `sidebar-active-leaf` is legitimately zero there and
 *   `sidebar-active-root` is what must be required instead. It has no TOC, no
 *   breadcrumb, and no admonitions.
 *
 * The eight requirements bound to `/docs/components/admonitions/` are the
 * original page-agnostic contract, carried over at their original minima — a
 * group required before must never become required nowhere.
 */
export const COVERAGE_CONTRACT: Readonly<Record<string, readonly CoverageRequirement[]>> = {
  [PAGE_ADMONITIONS]: [
    // ── the original (pre-#4033) contract, minima unchanged ──
    { group: "header-nav", min: 3 },
    { group: "sidebar-link", min: 3, requireHover: true },
    { group: "toc-link", min: 3 },
    { group: "content-heading", min: 1 },
    { group: "content-paragraph", min: 1 },
    { group: "admonition-title", min: 4 },
    { group: "admonition-body", min: 4 },
    { group: "pager-link", min: 1 },
    // ── added: the active-state surfaces this page is the only source of ──
    { group: "header-nav-dropdown-active", min: 1, requireHover: true },
    { group: "sidebar-active-leaf", min: 1, requireHover: true },
    { group: "toc-active", min: 1 },
    { group: "breadcrumb-link", min: 1 },
    { group: "content-code", min: 1 },
  ],
  [PAGE_GETTING_STARTED]: [
    // `header-nav` min is 2 (not 3) here: one plain top-level item is the
    // ACTIVE one on this page, so the non-active count is one lower than on
    // the admonitions page, where the 3-minimum stays asserted.
    { group: "header-nav", min: 2 },
    { group: "header-nav-active", min: 1, requireHover: true },
    { group: "sidebar-link", min: 3, requireHover: true },
    { group: "sidebar-active-root", min: 1, requireHover: true },
    { group: "pager-link", min: 1 },
  ],
};

/** The declared page universe — every page with a coverage contract. */
export const AUDIT_PAGES: readonly string[] = Object.keys(COVERAGE_CONTRACT);

export interface CoverageStats {
  /** Matched (visible) NON-hover element count per elementKey. */
  groupCounts: Record<string, number>;
  /** Matched (visible) `hover`-state element count per elementKey. */
  hoverCounts: Record<string, number>;
  /** Total evaluable (non-decorative) elements matched in the state. */
  matched: number;
  /** Elements that evaluated to SKIP (excluding decorative). */
  skipped: number;
}

/** One audited (pack × mode × page) state's coverage input. */
export interface CoverageScenario {
  pack: string;
  mode: string;
  page: string;
  stats: CoverageStats;
}

export interface CoverageOutcome extends CoverageScenario {
  /** Gating coverage errors for THIS state only. */
  errors: string[];
  /** Non-gating honesty notes (e.g. the page has no declared contract). */
  notes: string[];
}

function scenarioLabel(s: CoverageScenario): string {
  return `${s.pack}/${s.mode} ${s.page}`;
}

/**
 * Coverage verdict for ONE state — zero-match required groups, under-min
 * groups, missing required hover samples, and an over-ceiling SKIP share.
 *
 * The zero-match check is deliberately SCOPED to the page's declared
 * requirements rather than swept across the whole inventory: `header-more-toggle`
 * is viewport-conditional and decorative samples never enter the counts, so a
 * blanket "every inventory key must appear" rule would false-fail. The
 * inventory declares each item's expectation explicitly and
 * `validateInventoryExpectations` (theme-a11y-inventory.ts) keeps the two in sync.
 */
export function evaluateCoverage(scenario: CoverageScenario): CoverageOutcome {
  const { stats, page } = scenario;
  const label = scenarioLabel(scenario);
  const errors: string[] = [];
  const notes: string[] = [];

  const requirements = COVERAGE_CONTRACT[page];
  if (!requirements) {
    notes.push(
      `[${label}] page has NO declared coverage contract — zero required groups were asserted (UNAUDITED, not clean)`,
    );
  } else {
    for (const req of requirements) {
      const count = stats.groupCounts[req.group] ?? 0;
      if (count === 0) {
        errors.push(`[${label}] required group "${req.group}" matched ZERO elements (configuration error)`);
      } else if (count < req.min) {
        errors.push(`[${label}] required group "${req.group}" matched ${count} (< required min ${req.min})`);
      }
      if (req.requireHover && (stats.hoverCounts[req.group] ?? 0) === 0) {
        errors.push(
          `[${label}] required group "${req.group}" produced NO hover sample (hover coverage error)`,
        );
      }
    }
  }

  if (stats.matched > 0 && stats.skipped / stats.matched > MAX_SKIP_RATIO) {
    const pct = Math.round((stats.skipped / stats.matched) * 100);
    errors.push(
      `[${label}] SKIP share ${pct}% of ${stats.matched} matched exceeds ${Math.round(
        MAX_SKIP_RATIO * 100,
      )}% ceiling — evaluator may be mis-measuring`,
    );
  }
  return { ...scenario, errors, notes };
}

/**
 * Evaluate every audited state INDEPENDENTLY. Coverage is never aggregated
 * across packs, modes, or pages: one pack satisfying a group must not mask
 * another pack where the same group matched zero.
 */
export function evaluateCoverageMatrix(scenarios: readonly CoverageScenario[]): CoverageOutcome[] {
  return scenarios.map(evaluateCoverage);
}

/**
 * Honest accounting of what a narrowed run did NOT look at. A partial run
 * (`--packs` / `--modes` / `--pages`) must report the omitted scenarios as
 * UNAUDITED rather than let a green summary imply full coverage.
 */
export function describeUnauditedScenarios(input: {
  allPacks: readonly string[];
  auditedPacks: readonly string[];
  allModes: readonly string[];
  auditedModes: readonly string[];
  auditedPages: readonly string[];
}): string[] {
  const notes: string[] = [];

  const omittedPacks = input.allPacks.filter((p) => !input.auditedPacks.includes(p));
  if (omittedPacks.length > 0) {
    notes.push(`${omittedPacks.length} pack(s) UNAUDITED: ${omittedPacks.join(", ")}`);
  }

  const omittedModes = input.allModes.filter((m) => !input.auditedModes.includes(m));
  if (omittedModes.length > 0) {
    notes.push(`${omittedModes.length} mode(s) UNAUDITED: ${omittedModes.join(", ")}`);
  }

  // A group required on an omitted page may still be required on an audited
  // one (`header-nav`, `sidebar-link`, `pager-link` are required on both), so
  // name only the groups this run asserted NOWHERE — claiming more would be its
  // own kind of dishonesty.
  const assertedElsewhere = new Set(
    input.auditedPages.flatMap((p) => (COVERAGE_CONTRACT[p] ?? []).map((r) => r.group)),
  );
  for (const page of AUDIT_PAGES.filter((p) => !input.auditedPages.includes(p))) {
    const dropped = (COVERAGE_CONTRACT[page] ?? [])
      .map((r) => r.group)
      .filter((g) => !assertedElsewhere.has(g));
    notes.push(
      `page ${page} UNAUDITED` +
        (dropped.length > 0
          ? ` — group(s) asserted NOWHERE this run: ${dropped.join(", ")}`
          : " (its required groups are also required on an audited page)"),
    );
  }

  const undeclared = input.auditedPages.filter((p) => !AUDIT_PAGES.includes(p));
  for (const page of undeclared) {
    notes.push(`page ${page} has no declared coverage contract — no required groups asserted for it`);
  }

  return notes;
}
