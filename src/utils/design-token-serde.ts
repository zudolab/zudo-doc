/**
 * Design-token SerDe — unified JSON export / import for the design-token panel.
 *
 * Supersedes the legacy TypeScript-object export in `export-code.ts`. The JSON
 * format is a single document covering all four token categories (color,
 * spacing, font, size) so an AI assistant can consume or emit a whole
 * design-token tweak in one round-trip.
 *
 * Format: `$schema = "zudo-doc-design-tokens/v1"`.
 *
 * Diff-only by default
 * --------------------
 * `serialize()` only emits tokens the user has actually changed relative to
 * the provided `colorDefaults` (for the color block) and the manifest defaults
 * (for spacing / font / size). Pass `includeDefaults: true` to dump the full
 * state instead. The whole-category keys (`color`, `spacing`, `font`, `size`)
 * are omitted entirely when nothing in them differs.
 *
 * Spacing / font / size keys use CSS variable names (`"--spacing-hsp-md"`) —
 * the external schema — rather than the internal token id (`"hsp-md"`). This
 * keeps the file human-readable and agnostic of our internal manifest.
 * `deserialize()` maps them back; unknown CSS vars are reported via
 * `unknownTokens` so the UI can surface them.
 *
 * Read-only manifest tokens (e.g. `--spacing-0`, `--zd-sidebar-w` with
 * `clamp()`) are skipped in both directions.
 */

import {
  FONT_TOKENS,
  SIZE_TOKENS,
  SPACING_TOKENS,
  type TokenDef,
} from "@/components/design-token-tweak/tokens/manifest";
import {
  emptyOverrides,
  type ColorTweakState,
  type TokenOverrides,
  type TweakState,
} from "@/components/design-token-tweak/state/tweak-state";

export const DESIGN_TOKEN_SCHEMA = "zudo-doc-design-tokens/v1" as const;

/** External JSON value for a base-color / semantic-color entry. */
type ColorSlotValue = number | "bg" | "fg";

export interface DesignTokenJsonColorBase {
  bg?: number;
  fg?: number;
  cursor?: number;
  /** Dashed keys mirror the external docs; they are quoted in source. */
  "sel-bg"?: number;
  "sel-fg"?: number;
}

export interface DesignTokenJsonColor {
  palette?: string[];
  base?: DesignTokenJsonColorBase;
  /** Palette-index (or "bg"/"fg") mappings, same keys as `SEMANTIC_DEFAULTS`. */
  semantic?: Record<string, ColorSlotValue>;
  shikiTheme?: string;
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

export interface SerializeOptions {
  /** When true, dump full state (all palette entries, all token manifest
   *  defaults merged in). Default: diff-only. */
  includeDefaults?: boolean;
  /** Color baseline to diff against — typically the current scheme's initial
   *  state. Required for meaningful color-diff output; callers that don't have
   *  it available (e.g. tests without DOM) can omit it and we'll treat the
   *  whole color block as changed. */
  colorDefaults?: ColorTweakState;
  /** Override the `exportedAt` stamp (test-only). */
  now?: () => Date;
}

export interface DeserializeResult {
  /** The reconstructed tweak state, with unknown-token values dropped. */
  state: TweakState;
  /** CSS var names present in the payload that don't match any known token. */
  unknownTokens: string[];
  /** Human-readable errors that did not prevent a state from being produced
   *  (e.g. "semantic mapping dropped because value isn't a number"). */
  warnings: string[];
}

export interface DeserializeOptions {
  /** Color baseline used to fill in fields absent from the payload (diff-only
   *  exports are missing most fields by design). Typically the current
   *  scheme's initial state. */
  colorDefaults?: ColorTweakState;
}

/** Thrown when the payload is not a v1 schema object. The error `.reason`
 *  helps the UI render a precise inline message. */
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
  opts: SerializeOptions = {},
): DesignTokenJson {
  const now = opts.now ? opts.now() : new Date();
  const out: DesignTokenJson = {
    $schema: DESIGN_TOKEN_SCHEMA,
    exportedAt: now.toISOString(),
  };

  const color = serializeColor(state.color, opts);
  if (color) out.color = color;

  const spacing = serializeOverrides(SPACING_TOKENS, state.spacing, opts);
  if (spacing) out.spacing = spacing;

  const font = serializeOverrides(FONT_TOKENS, state.font, opts);
  if (font) out.font = font;

  const size = serializeOverrides(SIZE_TOKENS, state.size, opts);
  if (size) out.size = size;

  return out;
}

function serializeColor(
  color: ColorTweakState,
  opts: SerializeOptions,
): DesignTokenJsonColor | undefined {
  const baseline = opts.colorDefaults;
  const full = opts.includeDefaults === true;

  const out: DesignTokenJsonColor = {};
  let changed = false;

  // Palette — include the full 16-array if any slot differs (or always when
  // showing defaults). Keeping the array length stable preserves index stability.
  const paletteChanged =
    full ||
    !baseline ||
    baseline.palette.length !== color.palette.length ||
    color.palette.some((c, i) => c !== baseline.palette[i]);
  if (paletteChanged) {
    out.palette = [...color.palette];
    changed = true;
  }

  // Base — include only differing fields (or all, in full mode).
  const base: DesignTokenJsonColorBase = {};
  let baseChanged = false;
  const baseEntries: ReadonlyArray<readonly [keyof DesignTokenJsonColorBase, number, number | undefined]> = [
    ["bg", color.background, baseline?.background],
    ["fg", color.foreground, baseline?.foreground],
    ["cursor", color.cursor, baseline?.cursor],
    ["sel-bg", color.selectionBg, baseline?.selectionBg],
    ["sel-fg", color.selectionFg, baseline?.selectionFg],
  ];
  for (const [key, value, baselineValue] of baseEntries) {
    if (full || baseline === undefined || value !== baselineValue) {
      base[key] = value;
      baseChanged = true;
    }
  }
  if (baseChanged) {
    out.base = base;
    changed = true;
  }

  // Semantic — include only differing mappings.
  const semantic: Record<string, ColorSlotValue> = {};
  let semanticChanged = false;
  const semKeys = new Set<string>([
    ...Object.keys(color.semanticMappings),
    ...(baseline ? Object.keys(baseline.semanticMappings) : []),
  ]);
  for (const key of semKeys) {
    const cur = color.semanticMappings[key];
    if (cur === undefined) continue;
    const base = baseline?.semanticMappings[key];
    if (full || base === undefined || cur !== base) {
      semantic[key] = cur;
      semanticChanged = true;
    }
  }
  if (semanticChanged) {
    out.semantic = semantic;
    changed = true;
  }

  // Shiki theme — include only when different.
  if (full || !baseline || color.shikiTheme !== baseline.shikiTheme) {
    out.shikiTheme = color.shikiTheme;
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
 * Throws `DesignTokenSchemaError` on schema mismatch / non-object input. Any
 * CSS var name that doesn't match a known manifest entry is collected into
 * `unknownTokens` (the caller can surface these as a warning).
 *
 * Missing fields fall back to `opts.colorDefaults` (or, absent that, a
 * minimal neutral default) so the result is always a valid `TweakState`.
 */
export function deserialize(
  input: unknown,
  opts: DeserializeOptions = {},
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
  if (schema !== DESIGN_TOKEN_SCHEMA) {
    throw new DesignTokenSchemaError(
      "schema-mismatch",
      `Unsupported "$schema" value: ${JSON.stringify(schema)}. Expected "${DESIGN_TOKEN_SCHEMA}".`,
      schema,
    );
  }

  const warnings: string[] = [];
  const unknownTokens: string[] = [];
  const baseline = opts.colorDefaults ?? neutralColorDefaults();

  const color = deserializeColor(obj.color, baseline, warnings);
  const spacing = deserializeOverrides(
    obj.spacing,
    SPACING_TOKENS,
    "spacing",
    unknownTokens,
    warnings,
  );
  const font = deserializeOverrides(
    obj.font,
    FONT_TOKENS,
    "font",
    unknownTokens,
    warnings,
  );
  const size = deserializeOverrides(
    obj.size,
    SIZE_TOKENS,
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

function deserializeColor(
  raw: unknown,
  baseline: ColorTweakState,
  warnings: string[],
): ColorTweakState {
  if (!raw || typeof raw !== "object") {
    // No color block at all — user probably diffed only spacing/font/size.
    return { ...baseline, palette: [...baseline.palette], semanticMappings: { ...baseline.semanticMappings } };
  }
  const c = raw as Record<string, unknown>;

  // Palette
  let palette = [...baseline.palette];
  if (Array.isArray(c.palette)) {
    const parsed = c.palette.filter((v): v is string => typeof v === "string");
    if (parsed.length === 16 && parsed.length === c.palette.length) {
      palette = parsed;
    } else if (c.palette.length > 0) {
      // Either the wrong array length OR 16 entries but some weren't strings.
      const detail =
        parsed.length < c.palette.length
          ? `${c.palette.length - parsed.length} non-string entries dropped, leaving ${parsed.length}`
          : `${c.palette.length} entries`;
      warnings.push(
        `color.palette: expected 16 string entries; got ${detail}. Palette ignored.`,
      );
    }
  }

  // Base colors
  const base = (c.base && typeof c.base === "object")
    ? (c.base as Record<string, unknown>)
    : {};
  const background = numOr(base.bg, baseline.background);
  const foreground = numOr(base.fg, baseline.foreground);
  const cursor = numOr(base.cursor, baseline.cursor);
  const selectionBg = numOr(base["sel-bg"], baseline.selectionBg);
  const selectionFg = numOr(base["sel-fg"], baseline.selectionFg);

  // Semantic mappings — merge over baseline so diff-only exports still produce
  // a complete map.
  const semanticMappings: Record<string, number | "bg" | "fg"> = {
    ...baseline.semanticMappings,
  };
  if (c.semantic && typeof c.semantic === "object") {
    for (const [key, val] of Object.entries(c.semantic as Record<string, unknown>)) {
      if (typeof val === "number") {
        semanticMappings[key] = val;
      } else if (val === "bg" || val === "fg") {
        semanticMappings[key] = val;
      } else {
        warnings.push(
          `color.semantic.${key} has unsupported value ${JSON.stringify(val)}; kept baseline.`,
        );
      }
    }
  }

  const shikiTheme =
    typeof c.shikiTheme === "string" && c.shikiTheme.length > 0
      ? c.shikiTheme
      : baseline.shikiTheme;

  return {
    palette,
    background,
    foreground,
    cursor,
    selectionBg,
    selectionFg,
    semanticMappings,
    shikiTheme,
  };
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

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Minimal color state used as the last-resort baseline when the caller can't
 * provide one (e.g. unit tests without a DOM). Matches the default palette
 * fallback in `tweak-state.ts`.
 */
function neutralColorDefaults(): ColorTweakState {
  const palette = Array.from({ length: 16 }, (_, i) =>
    i === 0 ? "#000000" : i === 15 ? "#ffffff" : "#808080",
  );
  return {
    palette,
    background: 0,
    foreground: 15,
    cursor: 6,
    selectionBg: 0,
    selectionFg: 15,
    semanticMappings: {},
    shikiTheme: "dracula",
  };
}
