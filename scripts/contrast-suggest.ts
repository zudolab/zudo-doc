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
 * slot feeds passes. The raw-p5 exception (§2.3) is handled as a dedicated
 * dual-constraint search on palette slot 5 rather than a semantic override.
 *
 * Every suggested value is re-verified against the real math in
 * `contrast-utils.ts` before being emitted — this is a starting point for
 * Wave-3 batch agents, not a guarantee (see skill §2.2: "still goes through
 * the contrast check").
 */

import { oklch as toOklch, formatHex } from "culori";

import {
  resolveColor,
  resolveSemanticColors,
  SEMANTIC_DEFAULTS,
  SEMANTIC_CSS_NAMES,
} from "../src/config/color-scheme-utils";
import type { ColorScheme, ColorRef } from "../src/config/color-schemes";
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

interface NudgeResult {
  value: string; // oklch(...) CSS string, ready to paste
  ratio: number; // achieved ratio against the caller's ratioFn
  upstreamHex: string;
  deltaL: number;
  deltaC: number;
  ok: boolean;
}

const L_STEP = 0.002;
const C_STEP = 0.01;
const MAX_C_ATTEMPTS = 20;

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
 * clears `threshold`. Direction is chosen per-candidate by comparing the
 * ratio achievable at the two lightness extremes (0 and 1) — robust even for
 * multi-background joint constraints (mermaidText, the raw-p5 dual
 * constraint) where the "obvious" direction isn't always obvious. Chroma is
 * reduced only when neither extreme clears the threshold at the current
 * chroma (a practical stand-in for gamut-clip detection).
 *
 * IMPORTANT: `ratioFn` is always evaluated against `formatOklch(candidate)` —
 * the exact 3-decimal string that gets emitted — never against a hex
 * round-trip. Hex-quantizing a candidate mid-search and then shipping an
 * oklch() string is a real bug class: sRGB 8-bit quantization moves the
 * computed luminance just enough, near the threshold boundary, to make the
 * "verified" ratio diverge from what the shipped oklch() string actually
 * resolves to (observed ~0.03 ratio swings in this file's own testing).
 */
function nudgeForThreshold(fgHex: string, threshold: number, ratioFn: (color: string) => number): NudgeResult {
  const upstream = parseOklch(fgHex);
  const upstreamHex = toHex(upstream);
  const searchThreshold = threshold + SEARCH_MARGIN;
  const startRatio = ratioFn(formatOklch(upstream));
  if (startRatio >= threshold) {
    return { value: formatOklch(upstream), ratio: startRatio, upstreamHex, deltaL: 0, deltaC: 0, ok: true };
  }

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
        if (ratio >= searchThreshold) {
          return {
            value: formatOklch(candidate),
            ratio,
            upstreamHex,
            deltaL: Number((l - upstream.l).toFixed(4)),
            deltaC: Number((c - upstream.c).toFixed(4)),
            ok: true,
          };
        }
        if (l === 0 || l === 1) break;
      }
    }

    if (c <= 0) break;
    c = Math.max(0, c - C_STEP);
  }

  // Fallback: pure black/white at zero chroma — should not happen for any
  // realistic scheme color, but keeps the function total.
  const fallbackL = ratioFn(formatOklch({ l: 0, c: 0, h: upstream.h })) >= ratioFn(formatOklch({ l: 1, c: 0, h: upstream.h })) ? 0 : 1;
  const fallback = { l: fallbackL, c: 0, h: upstream.h };
  const ratio = ratioFn(formatOklch(fallback));
  return {
    value: formatOklch(fallback),
    ratio,
    upstreamHex,
    deltaL: Number((fallback.l - upstream.l).toFixed(4)),
    deltaC: Number((0 - upstream.c).toFixed(4)),
    ok: ratio >= threshold,
  };
}

function fmtUpstreamComment(r: NudgeResult): string {
  const signL = r.deltaL >= 0 ? "+" : "";
  let s = `upstream ${r.upstreamHex} → L${signL}${r.deltaL.toFixed(3)}`;
  if (r.deltaC !== 0) {
    const signC = r.deltaC >= 0 ? "+" : "";
    s += `, C${signC}${r.deltaC.toFixed(3)}`;
  }
  s += " for AA (scheme-a11y #2489)";
  return s;
}

function fmtPairComment(r: NudgeResult, pairLabel: string): string {
  return `/* ${fmtUpstreamComment(r)} */ // ${pairLabel} → ${r.ratio.toFixed(2)}:1${r.ok ? "" : " (still short — needs manual chroma/hue adjustment)"}`;
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

// ---------------------------------------------------------------------------
// Color-source description — used both by --suggest comments and the S3
// per-scheme failure inventories (which color feeds the pair).
// ---------------------------------------------------------------------------

const CSS_NAME_TO_SEMANTIC_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(SEMANTIC_CSS_NAMES).map(([key, cssName]) => [cssName, key]),
);

export function describeVarSource(scheme: ColorScheme, varName: string): string {
  if (varName === "--zd-bg") return describeTopLevel("bg", scheme.background);
  if (varName === "--zd-fg") return describeTopLevel("fg", scheme.foreground);
  if (varName === "--zd-sel-bg") return describeTopLevel("selectionBg", scheme.selectionBg);
  if (varName === "--zd-sel-fg") return describeTopLevel("selectionFg", scheme.selectionFg);

  const paletteMatch = /^--zd-(\d{1,2})$/.exec(varName);
  if (paletteMatch) return `p${paletteMatch[1]} (raw)`;

  const semanticKey = CSS_NAME_TO_SEMANTIC_KEY[varName];
  if (semanticKey) {
    const override = (scheme.semantic as Record<string, ColorRef | undefined> | undefined)?.[semanticKey];
    if (override !== undefined) {
      return typeof override === "number" ? `semantic.${semanticKey}→p${override}` : `semantic.${semanticKey} (explicit)`;
    }
    const defaultSlot = SEMANTIC_DEFAULTS[semanticKey];
    return `default→p${defaultSlot} (${semanticKey})`;
  }

  return varName;
}

function describeTopLevel(field: string, value: ColorRef): string {
  return typeof value === "number" ? `${field}→p${value}` : `${field} (explicit)`;
}

// ---------------------------------------------------------------------------
// Suggestion builder
// ---------------------------------------------------------------------------

interface Edit {
  key: string;
  value: string;
  comment: string;
}

export function buildSuggestionFragment(name: string, scheme: ColorScheme, report: SchemeReport): string {
  const byKey = new Map(report.pairs.map((p) => [p.key, p]));
  const fails = (key: string): boolean => {
    const p = byKey.get(key);
    return p ? !p.pass : false;
  };

  const bg = resolveBg(scheme);
  const fg = resolveFg(scheme);
  const bgIsDark = relativeLuminance(bg) < 0.5;
  const sem = resolveSemanticColors(scheme);

  const paletteEdits: Edit[] = [];
  const topLevelEdits: Edit[] = [];
  const semanticEdits: Edit[] = [];

  let mutedFinal = sem.muted;
  let accentFinal = sem.accent;
  let warningFinal = sem.warning;
  let codeBgFinal: string | undefined;

  // 1. muted (§3 decision — raise to the 4.5 text floor)
  if (fails("muted-vs-bg")) {
    const r = nudgeForThreshold(sem.muted, 4.5, (color) => contrastRatio(color, bg));
    mutedFinal = r.value;
    semanticEdits.push({ key: "muted", value: r.value, comment: fmtPairComment(r, "muted-vs-bg") });
  }

  // 2. accent / admonition-accent / admonition-important (raw-p5 exception, §2.3)
  const accentIsRawP5 = sem.accent === scheme.palette[5];
  const accentVsBgFails = fails("accent-vs-bg");
  const admonitionAccentFails = fails("admonition-accent");
  const importantFails = fails("admonition-important");

  if (accentIsRawP5) {
    if (accentVsBgFails || admonitionAccentFails || importantFails) {
      const p5 = scheme.palette[5];
      const ratioFn = (color: string) => {
        const plain = contrastRatio(color, bg);
        const tinted = contrastRatio(color, colorMixSrgb(color, bg, ADMONITION_TINT_PCT));
        return Math.min(plain, tinted);
      };
      const r = nudgeForThreshold(p5, 4.5, ratioFn);
      accentFinal = r.value;
      paletteEdits.push({
        key: "5",
        value: r.value,
        comment: `/* ${fmtUpstreamComment(r)} */ // accent-vs-bg AND admonition-important (raw p5) both ≥4.5 → ${r.ratio.toFixed(2)}:1 (binding pair)`,
      });
    }
  } else {
    if (accentVsBgFails || admonitionAccentFails) {
      const ratioFn = (color: string) => {
        const plain = contrastRatio(color, bg);
        const tinted = contrastRatio(color, colorMixSrgb(color, bg, ADMONITION_TINT_PCT));
        return Math.min(plain, tinted);
      };
      const r = nudgeForThreshold(sem.accent, 4.5, ratioFn);
      accentFinal = r.value;
      semanticEdits.push({ key: "accent", value: r.value, comment: fmtPairComment(r, "accent-vs-bg + admonition-accent") });
    }
    if (importantFails) {
      const p5 = scheme.palette[5];
      const ratioFn = (color: string) => contrastRatio(color, colorMixSrgb(color, bg, ADMONITION_TINT_PCT));
      const r = nudgeForThreshold(p5, 4.5, ratioFn);
      paletteEdits.push({
        key: "5",
        value: r.value,
        comment: `/* ${fmtUpstreamComment(r)} */ // admonition-important (raw p5 only — accent is overridden elsewhere) → ${r.ratio.toFixed(2)}:1`,
      });
    }
  }

  // 3. fg-vs-bg / fg-vs-surface
  const fgVsBgFails = fails("fg-vs-bg");
  const fgVsSurfaceFails = fails("fg-vs-surface");
  if (fgVsBgFails) {
    const targets = [bg];
    if (fgVsSurfaceFails) targets.push(sem.surface);
    const ratioFn = (color: string) => Math.min(...targets.map((t) => contrastRatio(color, t)));
    const r = nudgeForThreshold(fg, 4.5, ratioFn);
    topLevelEdits.push({ key: "foreground", value: r.value, comment: fmtPairComment(r, "fg-vs-bg" + (fgVsSurfaceFails ? " + fg-vs-surface" : "")) });
  } else if (fgVsSurfaceFails) {
    const r = nudgeForThreshold(sem.surface, 4.5, (color) => contrastRatio(fg, color));
    semanticEdits.push({ key: "surface", value: r.value, comment: fmtPairComment(r, "fg-vs-surface") });
  }

  // 4. accentHover
  if (fails("accent-hover-vs-bg")) {
    const r = nudgeForThreshold(sem.accentHover, 4.5, (color) => contrastRatio(color, bg));
    semanticEdits.push({ key: "accentHover", value: r.value, comment: fmtPairComment(r, "accent-hover-vs-bg") });
  }

  // 5. codeBg / codeFg
  if (fails("code-fg-vs-code-bg")) {
    const codeBg = scheme.semantic?.surface !== undefined ? sem.surface : bgElevated(bg, bgIsDark, 1);
    codeBgFinal = codeBg;
    const r = nudgeForThreshold(fg, 4.5, (color) => contrastRatio(color, codeBg));
    semanticEdits.push({ key: "codeBg", value: asOklchLiteral(codeBg), comment: "/* derived: bg-elevated (base for codeFg) — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "codeFg", value: r.value, comment: fmtPairComment(r, "code-fg-vs-code-bg") });
  }

  // 6. admonition-success / -warning / -info / -danger
  for (const semKey of ["success", "warning", "info", "danger"] as const) {
    const pairKey = `admonition-${semKey}`;
    if (fails(pairKey)) {
      const ratioFn = (color: string) => contrastRatio(color, colorMixSrgb(color, bg, ADMONITION_TINT_PCT));
      const r = nudgeForThreshold(sem[semKey], 4.5, ratioFn);
      if (semKey === "warning") warningFinal = r.value;
      semanticEdits.push({ key: semKey, value: r.value, comment: fmtPairComment(r, pairKey) });
    }
  }

  // 7. selection
  if (fails("selection")) {
    const selBg = resolveColor(scheme.selectionBg, scheme.palette, bg);
    const selFg = resolveColor(scheme.selectionFg, scheme.palette, fg);
    const r = nudgeForThreshold(selFg, 4.5, (color) => contrastRatio(color, selBg));
    topLevelEdits.push({ key: "selectionFg", value: r.value, comment: fmtPairComment(r, "selection") });
  }

  // 8. matchedKeyword — bg derived from warning, fg forced dark/light then nudged
  if (fails("matched-keyword")) {
    const bgBase = warningFinal;
    const fgStart = relativeLuminance(bgBase) > 0.5 ? "oklch(0.150 0 0)" : "oklch(0.950 0 0)";
    const r = nudgeForThreshold(fgStart, 4.5, (color) => contrastRatio(color, bgBase));
    semanticEdits.push({ key: "matchedKeywordBg", value: asOklchLiteral(bgBase), comment: "/* derived: warning (base for matchedKeywordFg) — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "matchedKeywordFg", value: r.value, comment: fmtPairComment(r, "matched-keyword") });
  }

  // 9. chatUser — bg derived from accent, fg forced dark/light then nudged
  if (fails("chat-user")) {
    const bgBase = accentFinal;
    const fgStart = relativeLuminance(bgBase) > 0.5 ? "oklch(0.150 0 0)" : "oklch(0.950 0 0)";
    const r = nudgeForThreshold(fgStart, 4.5, (color) => contrastRatio(color, bgBase));
    semanticEdits.push({ key: "chatUserBg", value: asOklchLiteral(bgBase), comment: "/* derived: accent (base for chatUserText) — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "chatUserText", value: r.value, comment: fmtPairComment(r, "chat-user") });
  }

  // 10. chatAssistant — bg derived from surface/bg-elevated, fg derived from real fg
  if (fails("chat-assistant")) {
    const bgBase = scheme.semantic?.surface !== undefined ? sem.surface : bgElevated(bg, bgIsDark, 1);
    const r = nudgeForThreshold(fg, 4.5, (color) => contrastRatio(color, bgBase));
    semanticEdits.push({ key: "chatAssistantBg", value: asOklchLiteral(bgBase), comment: "/* derived: surface/bg-elevated (base for chatAssistantText) — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "chatAssistantText", value: r.value, comment: fmtPairComment(r, "chat-assistant") });
  }

  // 11. mermaid node/label/note bg + shared mermaidText
  const mermaidPairKeys = ["mermaid-text-vs-node-bg", "mermaid-text-vs-label-bg", "mermaid-text-vs-note-bg"];
  if (mermaidPairKeys.some(fails)) {
    const nodeBg = bgElevated(bg, bgIsDark, 1);
    const labelBg = codeBgFinal ?? bgElevated(bg, bgIsDark, 1);
    const noteBg = bgElevated(bg, bgIsDark, 2);
    const ratioFn = (color: string) => Math.min(contrastRatio(color, nodeBg), contrastRatio(color, labelBg), contrastRatio(color, noteBg));
    const r = nudgeForThreshold(fg, 4.5, ratioFn);
    semanticEdits.push({ key: "mermaidNodeBg", value: asOklchLiteral(nodeBg), comment: "/* derived: bg-elevated — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "mermaidLabelBg", value: asOklchLiteral(labelBg), comment: "/* derived: codeBg-like/bg-elevated — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "mermaidNoteBg", value: asOklchLiteral(noteBg), comment: "/* derived: bg-elevated ×2, distinct from node/label — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "mermaidText", value: r.value, comment: fmtPairComment(r, "mermaid-text-vs-{node,label,note}-bg") });
  }

  // 12. mermaidLine — derived from (fixed) muted
  if (fails("mermaid-line-vs-bg")) {
    const r = nudgeForThreshold(mutedFinal, 3.0, (color) => contrastRatio(color, bg));
    semanticEdits.push({ key: "mermaidLine", value: r.value, comment: fmtPairComment(r, "mermaid-line-vs-bg") });
  }

  // 13. imageOverlay — bg forced near-bg-dark, fg derived from real fg
  if (fails("image-overlay")) {
    const bgOklch = parseOklch(bg);
    const overlayBgOklch = { l: Math.min(bgOklch.l, 0.15), c: bgOklch.c * 0.5, h: bgOklch.h };
    const overlayBg = formatOklch(overlayBgOklch);
    const r = nudgeForThreshold(fg, 3.0, (color) => contrastRatio(color, overlayBg));
    semanticEdits.push({ key: "imageOverlayBg", value: overlayBg, comment: "/* derived: near-bg dark — scheme-a11y #2492 §2.2 recipe */" });
    semanticEdits.push({ key: "imageOverlayFg", value: r.value, comment: fmtPairComment(r, "image-overlay") });
  }

  // ---- render fragment ----
  const lines: string[] = [`=== "${name}" — ${report.failCount} failing pair(s) ===`];
  if (paletteEdits.length > 0) {
    lines.push("// palette-slot tweaks (raw-p5 exception — edit palette[] directly, NOT semantic.accent):");
    for (const e of paletteEdits) lines.push(`palette[${e.key}]: ${e.value}, ${e.comment}`);
  }
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
