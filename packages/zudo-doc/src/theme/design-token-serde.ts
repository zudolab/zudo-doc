/**
 * Design-token SerDe — unified JSON export / import for the design-token panel.
 *
 * Supersedes the legacy TypeScript-object export in `export-code.ts`. The JSON
 * format is a single document covering all four token categories (color,
 * spacing, font, size) so an AI assistant can consume or emit a whole
 * design-token tweak in one round-trip.
 *
 * Format: `$schema = "zudo-doc-design-tokens/v2"`.
 *
 * v2 color slice — ramp-native (Color Ramp Restructure, zudolab/zudo-doc#2584 /
 * #2591; minimized to 5/3 in #2602)
 * -----------------------------------------------------------------------------------
 * The color block is the ramp-native `ColorScheme` from `color-scheme-utils.ts`:
 *   - `ramps` — the shared Tier-1 source of truth (`base[5]`, `accent[3]`,
 *     `state{danger,success,warning,info}`), emitted verbatim as OKLCH strings.
 *   - `map`   — the per-mode Tier-2 wiring (`bg`/`fg`/`selectionBg`/`selectionFg`
 *     + 23 `semantic` roles), each a `RampRef` (`{base:n}` / `{accent:n}` /
 *     `{state:role}` / a literal OKLCH string).
 *
 * The legacy v1 color slice (`palette: string[16]`, numeric `base`, `cursor`,
 * `semanticMappings`) is gone. Both `ramps` and `map` are plain JSON data, so
 * the color block is essentially a serialized `ColorScheme`.
 *
 * v1 → v2 migration (RESET, not remap)
 * ------------------------------------
 * A persisted v1 payload (detected by `$schema === "…/v1"`, a `palette` array,
 * or a numeric `base` block) has NO faithful mapping to the new model: the old
 * 16-slot ghostty palette + numeric semantic indices do not correspond to the
 * 5-base / 3-accent / 4-state ramps + `RampRef` wiring. Any remap would invent
 * colors and mislead the user, so `deserialize` RESETS the color slice to the
 * caller-supplied baseline (the current default scheme) and emits a
 * `console.warn` + a `warnings[]` entry — no throw, no blank screen. The
 * spacing/font/size slices are format-compatible across v1/v2 and are preserved.
 *
 * Diff-only by default
 * --------------------
 * `serialize()` only emits tokens the user has actually changed relative to
 * the provided `colorDefaults` (for the color block) and the manifest defaults
 * (for spacing / font / size). Pass `includeDefaults: true` to dump the full
 * state instead. The whole-category keys (`color`, `spacing`, `font`, `size`)
 * are omitted entirely when nothing in them differs. For the color block the
 * `ramps` and `map` sub-blocks are each emitted whole (not per-stop / per-role
 * diffed) when they differ from the baseline — the ramp-native shape has no
 * stable per-slot index to diff against, and a whole-block emit round-trips
 * cleanly against the same baseline.
 *
 * Spacing / font / size keys use CSS variable names (`"--spacing-hsp-md"`) —
 * the external schema — rather than the internal token id (`"hsp-md"`). This
 * keeps the file human-readable and agnostic of our internal manifest.
 * `deserialize()` maps them back; unknown CSS vars are reported via
 * `unknownTokens` so the UI can surface them.
 *
 * Read-only manifest tokens (e.g. `--spacing-0`, `--zd-sidebar-w` with
 * `clamp()`) are skipped in both directions.
 *
 * W3B (#1730 — Generator Pages Migration): moved from
 * `src/utils/design-token-serde.ts` into v2. The manifest tokens
 * (`SPACING_TOKENS` / `FONT_TOKENS` / `SIZE_TOKENS`) are no longer
 * imported from the host's `@/config/design-tokens-manifest` — the
 * caller now passes them through `SerializeOptions.manifest` /
 * `DeserializeOptions.manifest`, preserving consumer override hooks.
 */

// Structural copy of @takazudo/zdtp's TokenDef — keeps the optional peer out of
// the emitted public .d.ts (#2138). Only the four fields consumed by this module
// are included (id, cssVar, default, readonly); the full upstream interface has
// additional display-only fields (label, group, step, unit, control, options, pill)
// that are irrelevant here. Structurally compatible: any real TokenDef satisfies
// this narrower shape, so callers that pass a zdtp manifest array still type-check.
interface TokenDef {
  /** Stable id used as the Record key in persisted state (e.g. `hsp-2xs`). */
  id: string;
  /** CSS custom property name written to `:root` (e.g. `--zd-spacing-hgap-2xs`). */
  cssVar: string;
  /** Default value as a CSS length string (e.g. `0.125rem`). */
  default: string;
  /** Read-only tokens are displayed but not editable. */
  readonly?: true;
}
import {
  emptyOverrides,
  type TokenOverrides,
  type TweakState,
} from "./design-token-types.js";
import {
  SEMANTIC_KEYS,
  SEMANTIC_RAMP_DEFAULTS,
  STATE_ROLES,
  type ColorScheme,
  type ModeMap,
  type OKLCH,
  type RampRef,
  type Ramps,
  type SemanticKey,
} from "../color-scheme-utils.js";

export const DESIGN_TOKEN_SCHEMA = "zudo-doc-design-tokens/v2" as const;

/** The previous (palette-based) schema version. A payload carrying this value
 *  is migrated (color reset to baseline) rather than rejected. */
const LEGACY_SCHEMA_V1 = "zudo-doc-design-tokens/v1" as const;

/** Expected ramp lengths — a v2 color block must carry exactly these
 *  (minimized to 5 base / 3 accent in #2602). */
const BASE_RAMP_LENGTH = 5;
const ACCENT_RAMP_LENGTH = 3;

/** External JSON color block — a (possibly diff-only) serialized `ColorScheme`.
 *  Both sub-blocks are optional: in diff-only output an unchanged `ramps` or
 *  `map` is omitted and filled from the baseline on deserialize. */
export interface DesignTokenJsonColor {
  ramps?: Ramps;
  map?: ModeMap;
}

/** External token map keyed by CSS var name. */
export type DesignTokenJsonOverrides = Record<string, string>;

export interface DesignTokenJson {
  $schema: typeof DESIGN_TOKEN_SCHEMA;
  exportedAt: string;
  color?: DesignTokenJsonColor;
  spacing?: DesignTokenJsonOverrides;
  font?: DesignTokenJsonOverrides;
  size?: DesignTokenJsonOverrides;
}

/**
 * Token manifest the caller hands in — the consumer's
 * `src/config/design-tokens-manifest.ts` (or generator override). v2
 * doesn't ship its own manifest; this is intentionally a caller concern
 * so each consumer keeps full control over the editable token set.
 */
export interface DesignTokenManifest {
  spacing: readonly TokenDef[];
  font: readonly TokenDef[];
  size: readonly TokenDef[];
}

export interface SerializeOptions {
  /** Token manifest (spacing / font / size arrays) used to compute
   *  diff-only output and resolve CSS-var names. Required. */
  manifest: DesignTokenManifest;
  /** When true, dump full state (whole `ramps` + `map`, all token manifest
   *  defaults merged in). Default: diff-only. */
  includeDefaults?: boolean;
  /** Color baseline to diff against — typically the active scheme's initial
   *  `ColorScheme`. Required for meaningful color-diff output; callers that
   *  don't have it available (e.g. tests without DOM) can omit it and we'll
   *  treat the whole color block as changed. */
  colorDefaults?: ColorScheme;
  /** Override the `exportedAt` stamp (test-only). */
  now?: () => Date;
}

export interface DeserializeResult {
  /** The reconstructed tweak state, with unknown-token values dropped. */
  state: TweakState;
  /** CSS var names present in the payload that don't match any known token. */
  unknownTokens: string[];
  /** Human-readable errors that did not prevent a state from being produced
   *  (e.g. "v1 payload detected; color reset to default"). */
  warnings: string[];
}

export interface DeserializeOptions {
  /** Token manifest (spacing / font / size arrays) used to resolve CSS-var
   *  names back to internal token ids. Required. */
  manifest: DesignTokenManifest;
  /** Color baseline used to fill in fields absent from the payload (diff-only
   *  exports are missing most fields by design) and as the reset target for a
   *  v1 migration. Typically the active scheme's initial `ColorScheme`. */
  colorDefaults?: ColorScheme;
}

/** Thrown when the payload is not a recognized schema object. The error
 *  `.reason` helps the UI render a precise inline message. A v1 payload is NOT
 *  thrown for — it is migrated (see `deserialize`). */
export class DesignTokenSchemaError extends Error {
  readonly reason: "not-object" | "schema-missing" | "schema-mismatch";
  readonly actualSchema?: unknown;
  constructor(
    reason: "not-object" | "schema-missing" | "schema-mismatch",
    message: string,
    actualSchema?: unknown,
  ) {
    super(message);
    this.name = "DesignTokenSchemaError";
    this.reason = reason;
    this.actualSchema = actualSchema;
  }
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Produce the external JSON document for a given tweak state.
 *
 * By default this is diff-only against `opts.colorDefaults` + manifest
 * defaults; set `opts.includeDefaults = true` to dump everything.
 */
export function serialize(
  state: TweakState,
  opts: SerializeOptions,
): DesignTokenJson {
  const now = opts.now ? opts.now() : new Date();
  const out: DesignTokenJson = {
    $schema: DESIGN_TOKEN_SCHEMA,
    exportedAt: now.toISOString(),
  };

  const color = serializeColor(state.color, opts);
  if (color) out.color = color;

  const spacing = serializeOverrides(opts.manifest.spacing, state.spacing, opts);
  if (spacing) out.spacing = spacing;

  const font = serializeOverrides(opts.manifest.font, state.font, opts);
  if (font) out.font = font;

  const size = serializeOverrides(opts.manifest.size, state.size, opts);
  if (size) out.size = size;

  return out;
}

function serializeColor(
  color: ColorScheme,
  opts: SerializeOptions,
): DesignTokenJsonColor | undefined {
  const baseline = opts.colorDefaults;
  const full = opts.includeDefaults === true;

  const out: DesignTokenJsonColor = {};
  let changed = false;

  // Ramps — emit the whole block when any stop differs (or in full mode / when
  // no baseline is available). The ramp-native shape has no stable per-slot
  // index to diff against, so a whole-block emit is both simpler and lossless.
  if (full || !baseline || !deepEqual(color.ramps, baseline.ramps)) {
    out.ramps = cloneRamps(color.ramps);
    changed = true;
  }

  // Map — same whole-block rule for the per-mode wiring.
  if (full || !baseline || !deepEqual(color.map, baseline.map)) {
    out.map = cloneMap(color.map);
    changed = true;
  }

  return changed ? out : undefined;
}

function serializeOverrides(
  manifest: readonly TokenDef[],
  overrides: TokenOverrides,
  opts: SerializeOptions,
): DesignTokenJsonOverrides | undefined {
  const full = opts.includeDefaults === true;
  const out: DesignTokenJsonOverrides = {};
  let wrote = false;

  if (full) {
    // Dump every editable token: override if set, else manifest default.
    for (const t of manifest) {
      if (t.readonly) continue;
      const v = overrides[t.id];
      out[t.cssVar] = typeof v === "string" && v.length > 0 ? v : t.default;
      wrote = true;
    }
  } else {
    // Diff-only: emit only user-modified tokens.
    for (const t of manifest) {
      if (t.readonly) continue;
      const v = overrides[t.id];
      if (typeof v === "string" && v.length > 0 && v !== t.default) {
        out[t.cssVar] = v;
        wrote = true;
      }
    }
  }

  return wrote ? out : undefined;
}

// ---------------------------------------------------------------------------
// Deserialize
// ---------------------------------------------------------------------------

/**
 * Parse a design-token JSON document and lift it back into a tweak state.
 *
 * Throws `DesignTokenSchemaError` on schema mismatch / non-object input. A v1
 * (palette-based) payload is NOT thrown for — its color slice is reset to the
 * baseline default (see the v1→v2 migration note at the top). Any CSS var name
 * that doesn't match a known manifest entry is collected into `unknownTokens`.
 *
 * Missing fields fall back to `opts.colorDefaults` (or, absent that, a
 * minimal neutral default) so the result is always a valid `TweakState`.
 */
export function deserialize(
  input: unknown,
  opts: DeserializeOptions,
): DeserializeResult {
  if (input === null || typeof input !== "object") {
    throw new DesignTokenSchemaError(
      "not-object",
      "Input is not a JSON object.",
    );
  }

  const obj = input as Record<string, unknown>;
  const schema = obj.$schema;
  if (schema === undefined) {
    throw new DesignTokenSchemaError(
      "schema-missing",
      `Missing "$schema" key. Expected "${DESIGN_TOKEN_SCHEMA}".`,
    );
  }
  // v1 is a known-but-legacy schema: accept it so its color slice can be reset
  // (migration), rather than rejecting the whole document.
  const legacyV1 = schema === LEGACY_SCHEMA_V1;
  if (schema !== DESIGN_TOKEN_SCHEMA && !legacyV1) {
    throw new DesignTokenSchemaError(
      "schema-mismatch",
      `Unsupported "$schema" value: ${JSON.stringify(schema)}. Expected "${DESIGN_TOKEN_SCHEMA}".`,
      schema,
    );
  }

  const warnings: string[] = [];
  const unknownTokens: string[] = [];
  const baseline = opts.colorDefaults ?? neutralColorDefaults();

  const color = deserializeColor(obj.color, baseline, warnings, legacyV1);
  const spacing = deserializeOverrides(
    obj.spacing,
    opts.manifest.spacing,
    "spacing",
    unknownTokens,
    warnings,
  );
  const font = deserializeOverrides(
    obj.font,
    opts.manifest.font,
    "font",
    unknownTokens,
    warnings,
  );
  const size = deserializeOverrides(
    obj.size,
    opts.manifest.size,
    "size",
    unknownTokens,
    warnings,
  );

  return {
    state: { color, spacing, font, size },
    unknownTokens,
    warnings,
  };
}

/** True when the color block carries a legacy v1 marker: a 16-slot `palette`
 *  array or the old numeric `base` block. The v2 shape has neither. */
function isLegacyColorPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const c = raw as Record<string, unknown>;
  return Array.isArray(c.palette) || c.base !== undefined;
}

function deserializeColor(
  raw: unknown,
  baseline: ColorScheme,
  warnings: string[],
  legacyV1: boolean,
): ColorScheme {
  // v1 migration: a legacy schema OR a legacy-shaped color block resets to the
  // baseline default. The old 16-slot palette / numeric semantic indices have
  // no faithful mapping onto ramps + RampRefs, so we reset rather than invent
  // colors. Warn (console + warnings[]) so the reset is visible, never silent.
  if (legacyV1 || isLegacyColorPayload(raw)) {
    const msg =
      "Legacy v1 design-token color state detected; color was reset to the " +
      "default scheme (the old 16-slot palette has no faithful ramp mapping).";
    warnings.push(msg);
    // eslint-disable-next-line no-console -- intentional user-facing migration notice
    console.warn(`[zudo-doc] ${msg}`);
    return cloneScheme(baseline);
  }

  if (!raw || typeof raw !== "object") {
    // No color block at all — user probably diffed only spacing/font/size.
    return cloneScheme(baseline);
  }
  const c = raw as Record<string, unknown>;

  const ramps = parseRamps(c.ramps, baseline.ramps, warnings);
  const map = parseMap(c.map, baseline.map, warnings);
  return { ramps, map };
}

/** Parse the `ramps` sub-block. Absent → baseline (diff-only omission). Each of
 *  `base` / `accent` / `state` falls back independently to the baseline when
 *  malformed, so a partial hand-edit never crashes. */
function parseRamps(raw: unknown, baseline: Ramps, warnings: string[]): Ramps {
  if (raw === undefined) return cloneRamps(baseline);
  if (!raw || typeof raw !== "object") {
    warnings.push("color.ramps is not an object; kept baseline ramps.");
    return cloneRamps(baseline);
  }
  const r = raw as Record<string, unknown>;
  const base = parseOklchArray(r.base, BASE_RAMP_LENGTH, "color.ramps.base", warnings) ?? [...baseline.base];
  const accent = parseOklchArray(r.accent, ACCENT_RAMP_LENGTH, "color.ramps.accent", warnings) ?? [...baseline.accent];
  const state = parseState(r.state, baseline.state, warnings);
  return { base, accent, state };
}

/** Validate a fixed-length OKLCH-string array; returns null (caller falls back
 *  to baseline) with a warning if the shape is wrong. */
function parseOklchArray(
  raw: unknown,
  expectedLength: number,
  label: string,
  warnings: string[],
): OKLCH[] | null {
  if (!Array.isArray(raw)) {
    warnings.push(`${label}: expected an array of ${expectedLength} strings; kept baseline.`);
    return null;
  }
  const strings = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (strings.length !== expectedLength || strings.length !== raw.length) {
    warnings.push(
      `${label}: expected ${expectedLength} non-empty string entries; got ${raw.length} (${strings.length} valid). Kept baseline.`,
    );
    return null;
  }
  return strings;
}

function parseState(
  raw: unknown,
  baseline: Ramps["state"],
  warnings: string[],
): Ramps["state"] {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as Ramps["state"];
  for (const role of STATE_ROLES) {
    const v = src[role];
    if (typeof v === "string" && v.length > 0) {
      out[role] = v;
    } else {
      if (v !== undefined) {
        warnings.push(`color.ramps.state.${role} is not a non-empty string; kept baseline.`);
      }
      out[role] = baseline[role];
    }
  }
  return out;
}

/** Parse the `map` sub-block. Absent → baseline. Each role is validated as a
 *  `RampRef`; an invalid or absent role falls back to the baseline value. */
function parseMap(raw: unknown, baseline: ModeMap, warnings: string[]): ModeMap {
  if (raw === undefined) return cloneMap(baseline);
  if (!raw || typeof raw !== "object") {
    warnings.push("color.map is not an object; kept baseline map.");
    return cloneMap(baseline);
  }
  const m = raw as Record<string, unknown>;
  const semRaw = m.semantic && typeof m.semantic === "object"
    ? (m.semantic as Record<string, unknown>)
    : {};
  const semantic = {} as Record<SemanticKey, RampRef>;
  for (const key of SEMANTIC_KEYS) {
    semantic[key] = parseRef(semRaw[key], baseline.semantic[key], `color.map.semantic.${key}`, warnings);
  }
  return {
    bg: parseRef(m.bg, baseline.bg, "color.map.bg", warnings),
    fg: parseRef(m.fg, baseline.fg, "color.map.fg", warnings),
    selectionBg: parseRef(m.selectionBg, baseline.selectionBg, "color.map.selectionBg", warnings),
    selectionFg: parseRef(m.selectionFg, baseline.selectionFg, "color.map.selectionFg", warnings),
    semantic,
  };
}

function parseRef(
  raw: unknown,
  fallback: RampRef,
  label: string,
  warnings: string[],
): RampRef {
  if (raw === undefined) return cloneRef(fallback);
  if (isValidRampRef(raw)) return cloneRef(raw);
  warnings.push(`${label} is not a valid RampRef (${JSON.stringify(raw)}); kept baseline.`);
  return cloneRef(fallback);
}

/** A `RampRef` is a non-empty OKLCH string, or one of `{base:n}` / `{accent:n}`
 *  (non-negative integer) / `{state:role}`. */
function isValidRampRef(v: unknown): v is RampRef {
  if (typeof v === "string") return v.length > 0;
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if ("base" in o) return isRampIndex(o.base);
  if ("accent" in o) return isRampIndex(o.accent);
  if ("state" in o) {
    return typeof o.state === "string" && (STATE_ROLES as readonly string[]).includes(o.state);
  }
  return false;
}

function isRampIndex(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function deserializeOverrides(
  raw: unknown,
  manifest: readonly TokenDef[],
  label: string,
  unknownTokens: string[],
  warnings: string[],
): TokenOverrides {
  if (!raw || typeof raw !== "object") return emptyOverrides();

  // Build cssVar → TokenDef lookup (skip readonly — they're not editable).
  const byVar = new Map<string, TokenDef>();
  for (const t of manifest) {
    if (t.readonly) continue;
    byVar.set(t.cssVar, t);
  }

  const out: TokenOverrides = {};
  for (const [cssVar, value] of Object.entries(raw as Record<string, unknown>)) {
    const t = byVar.get(cssVar);
    if (!t) {
      unknownTokens.push(cssVar);
      continue;
    }
    if (typeof value !== "string" || value.length === 0) {
      warnings.push(
        `${label}.${cssVar} is not a non-empty string; ignored.`,
      );
      continue;
    }
    out[t.id] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Clone / equality helpers (plain JSON data, no functions)
// ---------------------------------------------------------------------------

function cloneRef(ref: RampRef): RampRef {
  return typeof ref === "string" ? ref : { ...ref };
}

function cloneRamps(ramps: Ramps): Ramps {
  return {
    base: [...ramps.base],
    accent: [...ramps.accent],
    state: { ...ramps.state },
  };
}

function cloneMap(map: ModeMap): ModeMap {
  const semantic = {} as Record<SemanticKey, RampRef>;
  for (const key of SEMANTIC_KEYS) {
    semantic[key] = cloneRef(map.semantic[key]);
  }
  return {
    bg: cloneRef(map.bg),
    fg: cloneRef(map.fg),
    selectionBg: cloneRef(map.selectionBg),
    selectionFg: cloneRef(map.selectionFg),
    semantic,
  };
}

function cloneScheme(scheme: ColorScheme): ColorScheme {
  return { ramps: cloneRamps(scheme.ramps), map: cloneMap(scheme.map) };
}

/** Structural deep-equality for plain JSON values (strings, numbers, arrays,
 *  and objects). Sufficient for `Ramps` / `ModeMap` diff — key order is
 *  irrelevant since we compare by key membership, not stringified order. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const aKeys = Object.keys(ao);
    const bKeys = Object.keys(bo);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]));
  }
  return false;
}

/**
 * Minimal color scheme used as the last-resort baseline when the caller can't
 * provide one (e.g. unit tests without a DOM). A neutral warm-grey `ColorScheme`
 * with real state hues and `SEMANTIC_RAMP_DEFAULTS` wiring — structurally valid
 * so downstream resolvers never see a missing ramp stop or role.
 */
function neutralColorDefaults(): ColorScheme {
  const base: OKLCH[] = [
    "oklch(0.965 0 0)",
    "oklch(0.705 0 0)",
    "oklch(0.480 0 0)",
    "oklch(0.300 0 0)",
    "oklch(0.185 0 0)",
  ];
  const accent: OKLCH[] = [
    "oklch(0.755 0 0)",
    "oklch(0.700 0 0)",
    "oklch(0.470 0 0)",
  ];
  return {
    ramps: {
      base,
      accent,
      state: {
        danger: "oklch(0.640 0.170 25)",
        success: "oklch(0.680 0.145 145)",
        warning: "oklch(0.760 0.135 82)",
        info: "oklch(0.680 0.130 245)",
      },
    },
    map: {
      bg: { base: 4 },
      fg: { base: 0 },
      selectionBg: { base: 2 },
      selectionFg: { base: 0 },
      semantic: { ...SEMANTIC_RAMP_DEFAULTS },
    },
  };
}
