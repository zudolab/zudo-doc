/**
 * scripts/contrast-pair-matrix.ts
 *
 * Data-driven pair matrix + evaluation logic shared by `contrast-audit.ts`
 * (CLI), `contrast-suggest.ts` (--suggest derivation), and
 * `src/config/__tests__/contrast.test.ts` (vitest guard). Extracted to its
 * own side-effect-free module (S3, zudolab/zudo-doc#2489) so the guard can
 * import PAIR_MATRIX/evaluateScheme directly without pulling in the CLI's
 * `main()` entrypoint — test and audit can never drift.
 *
 * PAIR_MATRIX mirrors the finalized matrix in
 * `.claude/skills/color-scheme-a11y/SKILL.md` §1 exactly — this is the single
 * place pairs/thresholds live.
 */

import { colorSchemes } from "../src/config/color-schemes";
import { schemeToCssPairs } from "../src/config/color-scheme-utils";
import type { ColorScheme } from "../src/config/color-schemes";
import { contrastRatio, colorMixSrgb, ADMONITION_TINT_PCT } from "../src/config/contrast-utils";

export interface PairSpec {
  key: string;
  label: string;
  tier: 1 | 2;
  threshold: number;
  fgVar: string;
  bgVar: string;
  tintBg?: true;
}

export const PAIR_MATRIX: PairSpec[] = [
  // ── Tier 1 — text, AA ≥ 4.5:1 ──
  { key: "fg-vs-bg", label: "fg / bg", tier: 1, threshold: 4.5, fgVar: "--zd-fg", bgVar: "--zd-bg" },
  { key: "fg-vs-surface", label: "fg / surface", tier: 1, threshold: 4.5, fgVar: "--zd-fg", bgVar: "--zd-surface" },
  { key: "muted-vs-bg", label: "muted / bg", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-bg" },
  { key: "muted-vs-surface", label: "muted / surface", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-surface" },
  { key: "muted-vs-code-bg", label: "muted / codeBg", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-code-bg" },
  { key: "muted-vs-chat-assistant-bg", label: "muted / chatAssistantBg", tier: 1, threshold: 4.5, fgVar: "--zd-muted", bgVar: "--zd-chat-assistant-bg" },
  { key: "accent-vs-bg", label: "accent / bg", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg" },
  { key: "accent-vs-surface", label: "accent / surface", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-surface" },
  { key: "accent-hover-vs-bg", label: "accentHover / bg", tier: 1, threshold: 4.5, fgVar: "--zd-accent-hover", bgVar: "--zd-bg" },
  { key: "code-fg-vs-code-bg", label: "codeFg / codeBg", tier: 1, threshold: 4.5, fgVar: "--zd-code-fg", bgVar: "--zd-code-bg" },
  { key: "admonition-accent", label: "admonition title (note/accent, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-success", label: "admonition title (tip/success, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-success", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-warning", label: "admonition title (warning, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-warning", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-info", label: "admonition title (info, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-info", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-danger", label: "admonition title (danger, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-danger", bgVar: "--zd-bg", tintBg: true },
  { key: "admonition-important", label: "admonition title (important, accent, 12% tint)", tier: 1, threshold: 4.5, fgVar: "--zd-accent", bgVar: "--zd-bg", tintBg: true },
  { key: "selection", label: "selectionFg / selectionBg", tier: 1, threshold: 4.5, fgVar: "--zd-selection-fg", bgVar: "--zd-selection-bg" },
  { key: "matched-keyword", label: "matchedKeywordFg / matchedKeywordBg", tier: 1, threshold: 4.5, fgVar: "--zd-matched-keyword-fg", bgVar: "--zd-matched-keyword-bg" },
  { key: "chat-user", label: "chatUserText / chatUserBg", tier: 1, threshold: 4.5, fgVar: "--zd-chat-user-text", bgVar: "--zd-chat-user-bg" },
  { key: "chat-assistant", label: "chatAssistantText / chatAssistantBg", tier: 1, threshold: 4.5, fgVar: "--zd-chat-assistant-text", bgVar: "--zd-chat-assistant-bg" },

  // ── Tier 2 — graphics/icons, ≥ 3.0:1 unless noted ──
  { key: "mermaid-text-vs-node-bg", label: "mermaidText / mermaidNodeBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-node-bg" },
  { key: "mermaid-text-vs-label-bg", label: "mermaidText / mermaidLabelBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-label-bg" },
  { key: "mermaid-text-vs-note-bg", label: "mermaidText / mermaidNoteBg", tier: 2, threshold: 4.5, fgVar: "--zd-mermaid-text", bgVar: "--zd-mermaid-note-bg" },
  { key: "mermaid-line-vs-bg", label: "mermaidLine / bg", tier: 2, threshold: 3.0, fgVar: "--zd-mermaid-line", bgVar: "--zd-bg" },
  { key: "image-overlay", label: "imageOverlayFg / imageOverlayBg", tier: 2, threshold: 3.0, fgVar: "--zd-image-overlay-fg", bgVar: "--zd-image-overlay-bg" },
];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type PresetSource = "colorSchemes";

export interface PairResult {
  key: string;
  label: string;
  tier: 1 | 2;
  threshold: number;
  fg: string;
  bg: string;
  ratio: number;
  pass: boolean;
}

export interface SchemeReport {
  name: string;
  source: PresetSource;
  pairs: PairResult[];
  passCount: number;
  failCount: number;
  allPass: boolean;
}

export function getAllPresets(): Array<{ name: string; scheme: ColorScheme; source: PresetSource }> {
  return Object.entries(colorSchemes).map(([name, scheme]) => ({ name, scheme, source: "colorSchemes" as const }));
}

export function evaluateScheme(name: string, scheme: ColorScheme, source: PresetSource): SchemeReport {
  const varMap = new Map(schemeToCssPairs(scheme));

  const pairs: PairResult[] = PAIR_MATRIX.map((spec) => {
    const fg = varMap.get(spec.fgVar);
    const rawBg = varMap.get(spec.bgVar);
    if (fg === undefined || rawBg === undefined) {
      throw new Error(
        `Scheme "${name}": pair "${spec.key}" references an unknown CSS var (fgVar=${spec.fgVar}, bgVar=${spec.bgVar})`,
      );
    }
    const bg = spec.tintBg ? colorMixSrgb(fg, rawBg, ADMONITION_TINT_PCT) : rawBg;
    const ratio = contrastRatio(fg, bg);
    return {
      key: spec.key,
      label: spec.label,
      tier: spec.tier,
      threshold: spec.threshold,
      fg,
      bg,
      ratio,
      pass: ratio >= spec.threshold,
    };
  });

  const passCount = pairs.filter((p) => p.pass).length;
  return {
    name,
    source,
    pairs,
    passCount,
    failCount: pairs.length - passCount,
    allPass: passCount === pairs.length,
  };
}
