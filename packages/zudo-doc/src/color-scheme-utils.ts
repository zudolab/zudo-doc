/**
 * Color-scheme MECHANISM — ramp → `--palette-*` / `--zd-*` CSS custom-property
 * injection.
 *
 * This module ships the pure computation layer used by every project that
 * builds on @takazudo/zudo-doc. It is DATA-free: callers pass in their own
 * color-scheme manifest and settings.
 *
 * Ramp-native model (Color Ramp Restructure — zudolab/zudo-doc#2584; minimized
 * to 5/3 in #2602). A `ColorScheme` is `{ ramps, map }`:
 *   - `ramps` — the shared Tier-1 source of truth: a warm-neutral `base` ramp
 *     (5 stops, index 0 = lightest), an `accent` ramp (3 stops), and 4 `state`
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
  /** Warm-neutral base ramp — 5 entries, index 0 = lightest. */
  base: OKLCH[];
  /** Accent ramp — 3 entries. */
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
  // Re-pointed for the 5-base / 3-accent minimized ramp (#2602); mirrors the
  // Default Dark reference wiring (surface/chatAssistantBg/imageOverlayBg merged
  // onto bg=b4). Every index is < 5 (base) / < 3 (accent).
  surface: { base: 4 },
  muted: { base: 1 },
  accent: { accent: 1 },
  accentHover: { accent: 0 },
  codeBg: { base: 3 },
  codeFg: { base: 0 },
  success: { state: "success" },
  danger: { state: "danger" },
  warning: { state: "warning" },
  info: { state: "info" },
  mermaidNodeBg: { base: 3 },
  mermaidText: { base: 0 },
  mermaidLine: { base: 1 },
  mermaidLabelBg: { base: 3 },
  mermaidNoteBg: { base: 2 },
  chatUserBg: { accent: 1 },
  chatUserText: { base: 4 },
  chatAssistantBg: { base: 4 },
  chatAssistantText: { base: 0 },
  imageOverlayBg: { base: 4 },
  imageOverlayFg: { base: 0 },
  // Search-result <mark> highlight — amber fill with dark text (the classic
  // highlighter look, matching the shipped schemes). Kept as raw OKLCH literals.
  matchedKeywordBg: "oklch(0.700 0.158 62)",
  matchedKeywordFg: "oklch(0.300 0.003 65)",
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

// Structural copy of @takazudo/zdtp's TierItem — keeps the optional peer out of
// the emitted public .d.ts (mirrors the TokenDef copy in
// ./theme/design-token-serde.ts, #2138). Only the fields this module emits are
// included (id, cssVar, label, default, type); the full upstream interface adds
// optional `pill`/`readonly` fields this builder never sets. Structurally
// compatible: every value returned here satisfies zdtp's real `TierItem`, so
// callers passing these into a real `TierConfig.items` still type-check.
export interface TierItem {
  /** Stable id used as the Record key in persisted state (e.g. `surface`). */
  id: string;
  /** CSS custom property name written to `:root` (e.g. `--zd-surface`). */
  cssVar: string;
  /** Display label in the panel UI. */
  label: string;
  /** Default value — a panel-encoded ramp reference or literal OKLCH string. */
  default: string;
  /** Always the OKLCH color picker for semantic-tier rows. */
  type: { kind: "color"; format: "oklch" };
}

/**
 * Encode a `RampRef` to the explicit `tierId:itemId` form the design-token
 * panel's grouped ramp picker (`referencesRamps`) expects as an item default:
 *   - `{ base: n }`   → `'base:base-n'`
 *   - `{ accent: n }` → `'accent:accent-n'`
 *   - `{ state: r }`  → `'state:state-r'`
 *   - a bare string   → returned as-is (a literal OKLCH/hex passthrough)
 *
 * Always the explicit form (independent of `referencesRamps` declaration
 * order) — see item-id contract in `buildRampTiers`
 * (`./design-token-panel-config/index.ts`): tier ids `base`/`accent`/`state`,
 * item ids `base-0..4`/`accent-0..2`/`state-{danger,success,warning,info}`.
 */
export function rampRefToPanelDefault(ref: RampRef): string {
  if (typeof ref === "string") return ref;
  if ("base" in ref) return `base:base-${ref.base}`;
  if ("accent" in ref) return `accent:accent-${ref.accent}`;
  return `state:state-${ref.state}`;
}

/**
 * Build the 27-row mode-scoped semantic tier's `items` for the design-token
 * panel, from a single (already mode-resolved) `ColorScheme`: 4 base roles
 * (`bg`, `fg`, `selection-bg`, `selection-fg`) followed by the 23
 * `SEMANTIC_KEYS` rows, in that order. Every row's `default` is
 * `rampRefToPanelDefault` of the scheme's `map` entry for that role — never a
 * resolved literal color — so the panel's grouped ramp dropdown can decode it
 * back to a ramp reference (the no-snapping guarantee: a scheme with no
 * persisted override always round-trips through the panel to the exact same
 * ramp stop, not a resolved color that happens to match).
 */
export function buildSemanticTierItems(scheme: ColorScheme): TierItem[] {
  const { map } = scheme;
  const items: TierItem[] = [
    {
      id: "bg",
      cssVar: "--zd-bg",
      label: "bg",
      default: rampRefToPanelDefault(map.bg),
      type: { kind: "color", format: "oklch" },
    },
    {
      id: "fg",
      cssVar: "--zd-fg",
      label: "fg",
      default: rampRefToPanelDefault(map.fg),
      type: { kind: "color", format: "oklch" },
    },
    {
      id: "selection-bg",
      cssVar: "--zd-selection-bg",
      label: "selection-bg",
      default: rampRefToPanelDefault(map.selectionBg),
      type: { kind: "color", format: "oklch" },
    },
    {
      id: "selection-fg",
      cssVar: "--zd-selection-fg",
      label: "selection-fg",
      default: rampRefToPanelDefault(map.selectionFg),
      type: { kind: "color", format: "oklch" },
    },
  ];
  for (const key of SEMANTIC_KEYS) {
    items.push({
      id: key,
      cssVar: SEMANTIC_CSS_NAMES[key],
      label: key,
      default: rampRefToPanelDefault(map.semantic[key]),
      type: { kind: "color", format: "oklch" },
    });
  }
  return items;
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
 *   - Tier-1 ramps: `--palette-base-0..4`, `--palette-accent-0..2`,
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
