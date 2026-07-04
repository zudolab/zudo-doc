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
    // Per-mode AA-tuned literal — was { base: 9 } oklch(.360 .007 65); the base-9
    // stop is too light for muted/accent text to clear AA on it. L .360→.308
    // (H/C fixed) — muted-vs-surface, accent-vs-surface at threshold+0.1; contrast:audit #2593.
    surface: "oklch(.308 .007 65)",
    // Per-mode AA-tuned literal — was { base: 6 } oklch(.630 .009 65); lifted so
    // secondary text clears AA on the (now darker) elevated backgrounds. L .630→.685
    // (H/C fixed) — muted-vs-surface/codeBg/chatAssistantBg at threshold+0.1; contrast:audit #2593.
    muted: "oklch(.685 .009 65)",
    accent: { accent: 3 },
    accentHover: { accent: 2 },
    codeBg: { base: 10 },
    codeFg: { base: 2 },
    success: { state: "success" },
    // Per-mode AA-tuned literal — was { state: "danger" } oklch(.640 .170 25); the
    // shared state red is too dark for the danger-admonition title on its 12%-tint
    // dark bg. L .640→.655 (H/C fixed) — admonition-danger at threshold+0.1; contrast:audit #2593.
    // (Kept mode-local so the shared state ramp stays canonical for Light, Wave 5.)
    danger: "oklch(.655 .170 25)",
    warning: { state: "warning" },
    info: { state: "info" },
    mermaidNodeBg: { base: 9 },
    mermaidText: { base: 2 },
    mermaidLine: { base: 6 },
    mermaidLabelBg: { base: 10 },
    mermaidNoteBg: { base: 8 },
    chatUserBg: { accent: 3 },
    chatUserText: { base: 11 },
    // Per-mode AA-tuned literal — was { base: 9 } oklch(.360 .007 65); mirrors the
    // surface literal (both are elevated panels) so the "Thinking…" loading text
    // (text-muted on bg-chat-assistant-bg) clears AA. L .360→.308 (H/C fixed) —
    // muted-vs-chatAssistantBg at threshold+0.1; contrast:audit #2593.
    chatAssistantBg: "oklch(.308 .007 65)",
    chatAssistantText: { base: 2 },
    imageOverlayBg: { base: 11 },
    imageOverlayFg: { base: 2 },
    // Search-result <mark> highlight: an amber (accent-hue) fill with dark text —
    // the classic highlighter look. matchedKeywordFg tuned L .985→.300 (H/C fixed)
    // so dark text clears AA on the amber bg — matched-keyword at threshold+0.1;
    // contrast:audit #2593. (Was a light-on-amber literal placeholder at 2.66:1.)
    matchedKeywordBg: "oklch(.700 .158 62)",
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
};

/**
 * Default Light — the authored light-mode scheme (epic #2584 / #2594 / #2595).
 * Shares `ramps` with Default Dark; only the `map` inverts (light bg = high-L
 * near-white end of the base ramp, dark fg = low-L end). AA-tuned in the Light
 * a11y gate (#2595): the base-ramp neutrals reindex, and the accent/state
 * colors — authored for a dark bg — need darker per-mode literals to clear AA
 * on a near-white bg. Every deviation from #2594's starting-point map carries a
 * provenance line. Full WCAG matrix passes at threshold+0.1; ramps untouched so
 * Default Dark is unaffected.
 */
const lightMap: ModeMap = {
  bg: { base: 1 },
  fg: { base: 10 },
  // Light: was { base: 7 } (#2594) — dark selectionFg only reached 2.93:1 on that
  // mid-grey fill; base:4 (.795) is a clearly-visible neutral highlight that gives
  // selectionFg 7.80 (mirrors Default Dark's mid-grey selection). contrast:audit #2595.
  selectionBg: { base: 4 },
  selectionFg: { base: 10 },
  semantic: {
    surface: { base: 3 },
    // Light: reindexed { base: 7 }→{ base: 8 } (#2594) — muted at base:7 fails AA on
    // the light surface (3.36:1); base:8 (.450) clears muted-vs-surface/codeBg/
    // chatAssistantBg at threshold+0.1. contrast:audit #2595.
    muted: { base: 8 },
    // Light: reindexed { accent: 3 }→{ accent: 6 } — the dark end of the shared accent
    // ramp. The light-amber accent:3 only reached 1.85:1 on surface; accent:6
    // (oklch(.470 .120 56)) clears accent-vs-bg/surface and the note/important
    // admonitions at threshold+0.1. contrast:audit #2595.
    accent: { accent: 6 },
    // Light: per-mode literal — the accent ramp has no stop darker than accent:6, so
    // the link-hover state darkens further (hover-darkens-on-light convention).
    // L .400, C fitted to the sRGB gamut edge at that L; accent-hover-vs-bg 8.46.
    // contrast:audit #2595.
    accentHover: "oklch(.400 .096 56)",
    codeBg: { base: 2 },
    codeFg: { base: 10 },
    // Light: per-mode literal — shared state.success oklch(.680 .145 145) is too light
    // for the 12%-tint success admonition on a light bg (2.19:1). L→.470 (H fixed,
    // C at gamut max) → admonition-success 4.79. contrast:audit #2595.
    success: "oklch(.470 .140 145)",
    // Light: per-mode literal — shared state.danger oklch(.640 .170 25) fails on the
    // light danger tint (2.83:1). L→.505 (H/C fixed) → admonition-danger 4.76.
    // contrast:audit #2595.
    danger: "oklch(.505 .170 25)",
    // Light: per-mode literal — shared state.warning oklch(.760 .135 82) fails on the
    // light warning tint (1.79:1). L→.490; C .135→.100 (gamut-clips at this L) →
    // admonition-warning 4.77. contrast:audit #2595.
    warning: "oklch(.490 .100 82)",
    // Light: per-mode literal — shared state.info oklch(.680 .130 245) fails on the
    // light info tint (2.28:1). L→.485; C→gamut max .122 → admonition-info 4.73.
    // contrast:audit #2595.
    info: "oklch(.485 .122 245)",
    mermaidNodeBg: { base: 3 },
    mermaidText: { base: 10 },
    mermaidLine: { base: 7 },
    mermaidLabelBg: { base: 2 },
    mermaidNoteBg: { base: 4 },
    chatUserBg: { accent: 3 },
    // Light: reindexed { base: 1 }→{ base: 11 } (#2594) — dark text on the amber user
    // bubble (matches Default Dark); the light text of #2594's starting point only
    // reached 2.48:1. chat-user 6.64. contrast:audit #2595.
    chatUserText: { base: 11 },
    chatAssistantBg: { base: 3 },
    chatAssistantText: { base: 10 },
    imageOverlayBg: { base: 11 },
    imageOverlayFg: { base: 1 },
    // Search-result <mark>: amber highlighter fill with dark text — same look as
    // Default Dark (an amber-on-white highlight reads identically in both modes).
    matchedKeywordBg: "oklch(.700 .158 62)",
    // Light: dark text on the amber highlight (matches Default Dark) — #2594's
    // light-on-amber placeholder only reached 2.66:1. matched-keyword 4.90.
    // contrast:audit #2595.
    matchedKeywordFg: "oklch(.300 .003 65)",
  },
};

export const colorSchemes: Record<string, ColorScheme> = {
  "Default Light": { ramps, map: lightMap },
  "Default Dark": { ramps, map: darkMap },
};
