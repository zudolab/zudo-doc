/**
 * Ramp-native color schemes (Color Ramp Restructure — zudolab/zudo-doc#2584).
 *
 * A `ColorScheme` is `{ ramps, map }` (the MECHANISM types live in the package
 * and are re-exported by `./color-scheme-utils`):
 *   - `ramps` — the shared Tier-1 source of truth: a warm-neutral `base` ramp
 *     (12 stops, index 0 = lightest), an `accent` ramp (7 stops), and 4 `state`
 *     colors. Light and dark modes SHARE these values.
 *   - `map` — the per-mode Tier-2 wiring: which ramp stop (or literal OKLCH)
 *     each UI role points at.
 *
 * `ColorScheme` is re-exported here so the many sites that still
 * `import { ColorScheme } from "./color-schemes"` (contrast tooling,
 * zfb.config.ts, …) keep resolving until their own waves port them.
 */

import type { ColorScheme, Ramps, ModeMap } from "./color-scheme-utils";
import { SEMANTIC_RAMP_DEFAULTS } from "./color-scheme-utils";

export type { ColorScheme } from "./color-scheme-utils";

/**
 * Shared Tier-1 ramps — identical across Default Light and Default Dark.
 * Authored values from epic #2584 / #2587 (light → dark, index 0 = lightest).
 */
const ramps: Ramps = {
  base: [
    "oklch(.985 .003 65)", // 0 — lightest
    "oklch(.960 .004 65)", // 1 — dark fg
    "oklch(.920 .005 65)", // 2 — codeFg
    "oklch(.865 .006 65)", // 3
    "oklch(.795 .007 65)", // 4
    "oklch(.715 .008 65)", // 5
    "oklch(.630 .009 65)", // 6 — muted-dk
    "oklch(.540 .009 65)", // 7 — muted-lt
    "oklch(.450 .008 65)", // 8 — sel-bg
    "oklch(.360 .007 65)", // 9 — surface-dk
    "oklch(.275 .006 65)", // 10 — codeBg-dk / fg-lt
    "oklch(.190 .005 65)", // 11 — bg-dk
  ],
  accent: [
    "oklch(.905 .040 68)", // 0
    "oklch(.830 .085 66)", // 1
    "oklch(.755 .130 64)", // 2 — hover-dk
    "oklch(.700 .158 62)", // 3 — accent-dk
    "oklch(.635 .162 60)", // 4
    "oklch(.560 .150 58)", // 5 — accent-lt
    "oklch(.470 .120 56)", // 6 — hover-lt
  ],
  state: {
    danger: "oklch(.640 .170 25)",
    success: "oklch(.680 .145 145)",
    warning: "oklch(.760 .135 82)",
    info: "oklch(.680 .130 245)",
  },
};

/** Default Dark — the authored reference scheme (epic #2584 / #2587). */
const darkMap: ModeMap = {
  bg: { base: 11 },
  fg: { base: 1 },
  selectionBg: { base: 8 },
  selectionFg: { base: 1 },
  semantic: {
    surface: { base: 9 },
    muted: { base: 6 },
    accent: { accent: 3 },
    accentHover: { accent: 2 },
    codeBg: { base: 10 },
    codeFg: { base: 2 },
    success: { state: "success" },
    danger: { state: "danger" },
    warning: { state: "warning" },
    info: { state: "info" },
    mermaidNodeBg: { base: 9 },
    mermaidText: { base: 2 },
    mermaidLine: { base: 6 },
    mermaidLabelBg: { base: 10 },
    mermaidNoteBg: { base: 8 },
    chatUserBg: { accent: 3 },
    chatUserText: { base: 11 },
    chatAssistantBg: { base: 9 },
    chatAssistantText: { base: 2 },
    imageOverlayBg: { base: 11 },
    imageOverlayFg: { base: 2 },
    // Literal placeholders — the search-result <mark> highlight is AA-tuned in
    // a later wave (epic #2584, Default Dark a11y gate #2593).
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.985 .003 65)",
  },
};

// PLACEHOLDER Default Light — real AA-tuned values authored in #2594 (Wave 5).
// Shares ramps with Default Dark. Only directionally correct (light bg / dark
// fg) so the app stays usable in light mode between waves; do NOT rely on these
// values passing a11y.
const lightMap: ModeMap = {
  bg: { base: 0 },
  fg: { base: 11 },
  selectionBg: { base: 2 },
  selectionFg: { base: 11 },
  semantic: { ...SEMANTIC_RAMP_DEFAULTS },
};

export const colorSchemes: Record<string, ColorScheme> = {
  "Default Light": { ramps, map: lightMap },
  "Default Dark": { ramps, map: darkMap },
};
