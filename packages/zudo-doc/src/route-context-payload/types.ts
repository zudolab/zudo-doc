// Browser-safe data contract for the serializable route-context payload.
//
// Keep this module types-only and deliberately narrow. Browser consumers use
// its emitted declaration without traversing the broader factory-context or
// the node-backed theme-pack registry barrel.

import type { Settings } from "../settings.js";

/** A color literal — an `oklch(...)` (or any valid CSS color) string. */
export type OKLCH = string;

/** The four semantic state colors that live on their own ramp. */
export type StateRole = "danger" | "success" | "warning" | "info";

/**
 * A reference into the shared ramps:
 * `{ base: n }`, `{ accent: n }`, `{ state: role }`, or a literal color.
 */
export type RampRef = { base: number } | { accent: number } | { state: StateRole } | OKLCH;

/** The shared Tier-1 color ramps. */
export interface Ramps {
  base: OKLCH[];
  accent: OKLCH[];
  state: Record<StateRole, OKLCH>;
}

/** The semantic UI roles mapped by a color scheme. */
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

/** The syntax-specific semantic roles mapped by a color scheme. */
export type SyntaxSemanticKey =
  | "syntaxComment"
  | "syntaxString"
  | "syntaxNumber"
  | "syntaxKeyword"
  | "syntaxCallable"
  | "syntaxType"
  | "syntaxName"
  | "syntaxInserted"
  | "syntaxDeleted";

/** The per-mode wiring from UI roles to ramp stops or literal colors. */
export interface ModeMap {
  bg: RampRef;
  fg: RampRef;
  selectionBg: RampRef;
  selectionFg: RampRef;
  semantic: Record<SemanticKey, RampRef>;
  syntax?: Partial<Record<SyntaxSemanticKey, RampRef>>;
}

/** A complete color scheme — shared Tier-1 ramps + per-mode Tier-2 wiring. */
export interface ColorScheme {
  ramps: Ramps;
  map: ModeMap;
}

/**
 * A single tag-vocabulary entry. Content uses `id` exactly; the optional
 * display metadata does not introduce alias or deprecation semantics.
 */
export interface TagVocabularyEntry {
  id: string;
  label?: string;
  description?: string;
  group?: string;
}

/** Resolved preview swatches for one theme-pack mode. */
export interface ThemePackSwatches {
  bg: string;
  fg: string;
  accent: string;
  syntax: {
    keyword: string;
    string: string;
    comment: string;
    callable: string;
  };
}

/**
 * A theme pack's schema-validated metadata. `mode` is its designed-primary
 * badge; each pack still supplies both light and dark preview swatches.
 */
export interface ThemePackMeta {
  schemaVersion: 1;
  slug: string;
  name: string;
  description: string;
  mode: "light" | "dark";
  version: string;
  fonts: {
    sans: string;
    mono: string;
    display?: string;
    loaded: string[];
  };
  preview: {
    light: ThemePackSwatches;
    dark: ThemePackSwatches;
  };
}

/** One entry in the aggregated, canonically ordered bundled registry. */
export interface ThemePackRegistryEntry {
  /** The pack directory name, equal to `meta.slug`. */
  slug: string;
  /** The pack's schema-validated metadata. */
  meta: ThemePackMeta;
  /** Whether the pack ships `pack.css` (`false` for the stock default pack). */
  hasStylesheet: boolean;
}

/** The full bundled registry, or an enabled ordered subset of it. */
export type ThemePackRegistry = ThemePackRegistryEntry[];

/** Preview/rendering category inferred from an asset's extension and bytes. */
export type AssetKind = "code" | "text" | "image" | "video" | "pdf" | "other";

/** Browser-facing metadata for one scanned public asset. */
export interface AssetIndexEntry {
  path: string;
  name: string;
  /** POSIX parent path relative to the asset root; empty for root files. */
  dir: string;
  kind: AssetKind;
  mime: string;
  language?: string;
  bytes: number;
  lines?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  description?: string;
}

/** Highlighted, line-addressed excerpt embedded in the route manifest. */
export interface AssetExcerpt {
  html: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  truncated: boolean;
}

/** Serializable index plus requested excerpts consumed by asset routes. */
export interface AssetManifest {
  dir: string;
  routePrefix: string;
  entries: AssetIndexEntry[];
  excerpts: Record<string, AssetExcerpt>;
}

/**
 * Serializable data carried by `virtual:zudo-doc-route-context`.
 * `createRouteContext` reconstructs all runtime callables from this payload.
 */
export interface RouteContextPayload<S = Settings> {
  /** The host's resolved settings object. */
  settings: S;
  /** Per-locale UI-string tables (`translations[locale][key]`). */
  translations: Record<string, Record<string, string>>;
  /** The tag vocabulary (used only when `settings.tagVocabulary` is on). */
  tagVocabulary: readonly TagVocabularyEntry[];
  /** Host color-scheme palette map, or `null` when the host passed none. */
  colorSchemes: Record<string, ColorScheme> | null;
  /**
   * Resolved, enabled, ordered theme-pack registry. Optional for compatibility
   * with hosts that constructed the payload before registry threading shipped;
   * `createRouteContext` normalizes omission to `null` (feature inert).
   */
  themePackRegistry?: ThemePackRegistry | null;
}
