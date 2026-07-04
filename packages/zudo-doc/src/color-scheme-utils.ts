/**
 * Color-scheme MECHANISM — ramp → `--palette-*` / `--zd-*` CSS custom-property
 * injection.
 *
 * This module ships the pure computation layer used by every project that
 * builds on @takazudo/zudo-doc. It is DATA-free: callers pass in their own
 * color-scheme manifest and settings.
 *
 * Ramp-native model (Color Ramp Restructure — zudolab/zudo-doc#2584). A
 * `ColorScheme` is `{ ramps, map }`:
 *   - `ramps` — the shared Tier-1 source of truth: a warm-neutral `base` ramp
 *     (12 stops, index 0 = lightest), an `accent` ramp (7 stops), and 4 `state`
 *     colors. Emitted verbatim as `--palette-{group}-{n}`.
 *   - `map` — the per-mode Tier-2 wiring: which ramp stop (or literal OKLCH)
 *     each UI role (`--zd-*`) points at, via a `RampRef`.
 *
 * The legacy ghostty 16-slot palette (`--zd-0..15`), `cursor`, `shikiTheme`,
 * and the numeric `ColorRef` were dropped in that epic.
 *
 * Moved from the host's `src/config/color-scheme-utils.ts` as part of the
 * package-first migration (S9a zudolab/zudo-doc#2333). The DATA (ramp values,
 * scheme names, `colorMode` settings) stays project-side.
 */

/** A color literal — an `oklch(…)` (or any valid CSS color) string. */
export type OKLCH = string;

/** The four semantic state colors that live on their own ramp. */
export type StateRole = "danger" | "success" | "warning" | "info";

/** Canonical order of the state ramp — used for `--palette-state-*` emit. */
export const STATE_ROLES: readonly StateRole[] = ["danger", "success", "warning", "info"];

/**
 * A reference into the shared ramps, resolved by `resolveRampRef`:
 *   - `{ base: n }`   → `ramps.base[n]`
 *   - `{ accent: n }` → `ramps.accent[n]`
 *   - `{ state: r }`  → `ramps.state[r]`
 *   - a bare string   → a literal OKLCH value, returned as-is
 */
export type RampRef = { base: number } | { accent: number } | { state: StateRole } | OKLCH;

/** The shared Tier-1 ramps. Values are identical across light/dark modes; the
 *  per-mode differences live in `ModeMap`, not here. */
export interface Ramps {
  /** Warm-neutral base ramp — 12 entries, index 0 = lightest. */
  base: OKLCH[];
  /** Accent ramp — 7 entries. */
  accent: OKLCH[];
  /** The four state colors. */
  state: Record<StateRole, OKLCH>;
}

/** The 23 semantic roles that map onto `--zd-*` custom properties. */
export type SemanticKey =
  | "surface"
  | "muted"
  | "accent"
  | "accentHover"
  | "codeBg"
  | "codeFg"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "mermaidNodeBg"
  | "mermaidText"
  | "mermaidLine"
  | "mermaidLabelBg"
  | "mermaidNoteBg"
  | "chatUserBg"
  | "chatUserText"
  | "chatAssistantBg"
  | "chatAssistantText"
  | "imageOverlayBg"
  | "imageOverlayFg"
  | "matchedKeywordBg"
  | "matchedKeywordFg";

/** Canonical order of the 23 semantic roles — used for `--zd-*` emit. */
export const SEMANTIC_KEYS: readonly SemanticKey[] = [
  "surface",
  "muted",
  "accent",
  "accentHover",
  "codeBg",
  "codeFg",
  "success",
  "danger",
  "warning",
  "info",
  "mermaidNodeBg",
  "mermaidText",
  "mermaidLine",
  "mermaidLabelBg",
  "mermaidNoteBg",
  "chatUserBg",
  "chatUserText",
  "chatAssistantBg",
  "chatAssistantText",
  "imageOverlayBg",
  "imageOverlayFg",
  "matchedKeywordBg",
  "matchedKeywordFg",
];

/** The per-mode wiring: each UI role points at a ramp stop (or literal OKLCH)
 *  via a `RampRef`. Two `ColorScheme`s (light + dark) share `ramps` but carry
 *  their own `ModeMap`. */
export interface ModeMap {
  bg: RampRef;
  fg: RampRef;
  selectionBg: RampRef;
  selectionFg: RampRef;
  semantic: Record<SemanticKey, RampRef>;
}

/** A complete color scheme — shared Tier-1 ramps + per-mode Tier-2 wiring. */
export interface ColorScheme {
  ramps: Ramps;
  map: ModeMap;
}

/** Default per-mode semantic wiring (Default Dark reference — see epic #2584).
 *  Scheme authors spread this into `map.semantic` and override individual roles
 *  where a mode needs a different stop (or a per-mode AA-tuned literal). */
export const SEMANTIC_RAMP_DEFAULTS: Record<SemanticKey, RampRef> = {
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
  // Literal placeholders — the search-result <mark> highlight is tuned for AA
  // in a later wave (epic #2584 Wave 4/5). Kept as raw OKLCH, not ramp refs.
  matchedKeywordBg: "oklch(0.900 0.120 95)",
  matchedKeywordFg: "oklch(0.250 0.010 95)",
};

export const SEMANTIC_CSS_NAMES: Record<SemanticKey, string> = {
  surface: "--zd-surface",
  muted: "--zd-muted",
  accent: "--zd-accent",
  accentHover: "--zd-accent-hover",
  codeBg: "--zd-code-bg",
  codeFg: "--zd-code-fg",
  success: "--zd-success",
  danger: "--zd-danger",
  warning: "--zd-warning",
  info: "--zd-info",
  mermaidNodeBg: "--zd-mermaid-node-bg",
  mermaidText: "--zd-mermaid-text",
  mermaidLine: "--zd-mermaid-line",
  mermaidLabelBg: "--zd-mermaid-label-bg",
  mermaidNoteBg: "--zd-mermaid-note-bg",
  chatUserBg: "--zd-chat-user-bg",
  chatUserText: "--zd-chat-user-text",
  chatAssistantBg: "--zd-chat-assistant-bg",
  chatAssistantText: "--zd-chat-assistant-text",
  imageOverlayBg: "--zd-image-overlay-bg",
  imageOverlayFg: "--zd-image-overlay-fg",
  matchedKeywordBg: "--zd-matched-keyword-bg",
  matchedKeywordFg: "--zd-matched-keyword-fg",
};

/**
 * Resolve a `RampRef` to a concrete color string against the given `ramps`.
 *   - `{ base: n }`   → `ramps.base[n]`
 *   - `{ accent: n }` → `ramps.accent[n]`
 *   - `{ state: r }`  → `ramps.state[r]`
 *   - a bare string   → the literal OKLCH value, returned as-is
 *
 * Throws on an out-of-range ramp index — a ramp reference to a stop that does
 * not exist is a programming/authoring error and must fail loud rather than
 * silently emit an invalid CSS value.
 */
export function resolveRampRef(ref: RampRef, ramps: Ramps): string {
  if (typeof ref === "string") return ref;
  if ("base" in ref) {
    const color = ramps.base[ref.base];
    if (color === undefined) {
      throw new RangeError(`RampRef {base:${ref.base}} out of range (base ramp has ${ramps.base.length} stops)`);
    }
    return color;
  }
  if ("accent" in ref) {
    const color = ramps.accent[ref.accent];
    if (color === undefined) {
      throw new RangeError(`RampRef {accent:${ref.accent}} out of range (accent ramp has ${ramps.accent.length} stops)`);
    }
    return color;
  }
  return ramps.state[ref.state];
}

/** Resolve every semantic role to a concrete color string via the scheme's
 *  per-mode `map.semantic` wiring. Returns all 23 keys. */
export function resolveSemanticColors(scheme: ColorScheme): Record<SemanticKey, string> {
  const { ramps, map } = scheme;
  const out = {} as Record<SemanticKey, string>;
  for (const key of SEMANTIC_KEYS) {
    out[key] = resolveRampRef(map.semantic[key], ramps);
  }
  return out;
}

/** Which tiers a `schemeToCssPairs` call emits:
 *   - `"all"` (default) — base roles + `--palette-*` + `--zd-*` semantic
 *   - `"palette"`       — only the bare Tier-1 `--palette-*` pairs
 *   - `"roles"`         — base roles + the 23 `--zd-*` semantic pairs
 *
 * The split lets `generateLightDarkCssProperties` emit the shared `--palette-*`
 * once (bare) while wrapping the per-mode `--zd-*` roles in `light-dark(…)`.
 * (A literal `"light"|"dark"` param would be inert here — each `ColorScheme`'s
 * own `map` already encodes its mode.) */
export type CssEmitScope = "all" | "palette" | "roles";

/**
 * Convert a `ColorScheme` to a flat list of `[cssProperty, value]` pairs.
 *
 * The full (`"all"`) set is the exact set of custom properties the
 * ColorSchemeProvider emits onto `:root`:
 *   - base roles: `--zd-bg`, `--zd-fg`, `--zd-selection-bg`, `--zd-selection-fg`
 *   - Tier-1 ramps: `--palette-base-0..11`, `--palette-accent-0..6`,
 *     `--palette-state-{danger,success,warning,info}`
 *   - the 23 Tier-2 `--zd-{role}` semantic tokens
 *
 * It intentionally does NOT emit the retired `--zd-0..15` slots or `--zd-cursor`.
 */
export function schemeToCssPairs(scheme: ColorScheme, scope: CssEmitScope = "all"): [string, string][] {
  const { ramps, map } = scheme;
  const pairs: [string, string][] = [];

  if (scope === "all" || scope === "roles") {
    pairs.push(
      ["--zd-bg", resolveRampRef(map.bg, ramps)],
      ["--zd-fg", resolveRampRef(map.fg, ramps)],
      ["--zd-selection-bg", resolveRampRef(map.selectionBg, ramps)],
      ["--zd-selection-fg", resolveRampRef(map.selectionFg, ramps)],
    );
  }

  if (scope === "all" || scope === "palette") {
    ramps.base.forEach((color, i) => pairs.push([`--palette-base-${i}`, color]));
    ramps.accent.forEach((color, i) => pairs.push([`--palette-accent-${i}`, color]));
    for (const role of STATE_ROLES) {
      pairs.push([`--palette-state-${role}`, ramps.state[role]]);
    }
  }

  if (scope === "all" || scope === "roles") {
    const sem = resolveSemanticColors(scheme);
    for (const key of SEMANTIC_KEYS) {
      pairs.push([SEMANTIC_CSS_NAMES[key], sem[key]]);
    }
  }

  return pairs;
}

/**
 * Generate the `:root { … }` CSS block for a single active color scheme.
 *
 * The caller passes in the active `ColorScheme` object — resolved from the
 * project's `colorSchemes` map and `settings.colorScheme`. This function is
 * DATA-free: it performs no settings lookup itself.
 */
export function generateCssCustomProperties(scheme: ColorScheme): string {
  const pairs = schemeToCssPairs(scheme);
  const lines = [":root {", ...pairs.map(([prop, value]) => `  ${prop}: ${value};`), "}"];
  return lines.join("\n");
}

/**
 * Generate the `:root { … }` CSS block for a light/dark pair.
 *
 * Tier-1 `--palette-*` properties are shared across modes (the ramps carry the
 * same values in both schemes), so they are emitted ONCE, bare. The per-mode
 * `--zd-*` roles (base roles + semantic) are wrapped in `light-dark(L, D)`.
 *
 * The caller passes in the `light` and `dark` `ColorScheme` objects — resolved
 * from the project's `colorSchemes` map and `settings.colorMode`. This function
 * is DATA-free.
 */
export function generateLightDarkCssProperties(light: ColorScheme, dark: ColorScheme): string {
  // Shared Tier-1 ramps: emit once, bare, from the light scheme.
  const palettePairs = schemeToCssPairs(light, "palette");
  const lightRoles = schemeToCssPairs(light, "roles");
  const darkRoles = schemeToCssPairs(dark, "roles");

  if (lightRoles.length !== darkRoles.length) {
    throw new Error(`Light scheme has ${lightRoles.length} role properties but dark scheme has ${darkRoles.length}`);
  }

  const lines = [":root {", "  color-scheme: light dark;"];
  for (const [prop, value] of palettePairs) {
    lines.push(`  ${prop}: ${value};`);
  }
  for (let i = 0; i < lightRoles.length; i++) {
    const lightPair = lightRoles[i];
    const darkPair = darkRoles[i];
    if (!lightPair || !darkPair) continue;
    const [prop, lightVal] = lightPair;
    const darkVal = darkPair[1];
    lines.push(`  ${prop}: light-dark(${lightVal}, ${darkVal});`);
  }
  lines.push("}");
  return lines.join("\n");
}
