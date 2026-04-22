import { colorSchemes, type ColorRef, type ColorScheme } from "@/config/color-schemes";
import { SEMANTIC_DEFAULTS, SEMANTIC_CSS_NAMES } from "@/config/color-scheme-utils";
import { settings } from "@/config/settings";

/**
 * Storage keys
 *
 * - `STORAGE_KEY_V1` is the original flat-state format (Color-only).
 * - `STORAGE_KEY_V2` is the new namespaced format (`{ color: ..., ... }`) that
 *   lets other tabs (Spacing, Font, Size) add their own sub-states in later
 *   sub-issues without colliding with Color.
 *
 * On first load at v2 we migrate v1 → v2, write the new key, and delete v1.
 */
export const STORAGE_KEY_V1 = "zudo-doc-tweak-state";
export const STORAGE_KEY_V2 = "zudo-doc-tweak-state-v2";
export const OPEN_KEY = "zudo-doc-tweak-open";
export const POSITION_KEY = "zudo-doc-tweak-position";

export interface PanelPosition {
  top: number;
  right: number;
}

export const DEFAULT_POSITION: PanelPosition = { top: 60, right: 20 };

export function loadPosition(): PanelPosition {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as PanelPosition;
      if (typeof parsed.top === "number" && typeof parsed.right === "number") {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_POSITION;
}

export function savePosition(pos: PanelPosition) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch { /* ignore */ }
}

/** Keep at least VISIBLE_MIN px of the panel on-screen so the user can grab it back. */
export const VISIBLE_MIN = 60;

export function clampPosition(top: number, right: number, panelWidth: number, panelHeight: number): PanelPosition {
  // Horizontal: allow panel to extend past left/right edges
  const minRight = -(panelWidth - VISIBLE_MIN);
  const maxRight = window.innerWidth - VISIBLE_MIN;
  // Vertical: allow panel to extend past top/bottom edges, but keep a grip visible
  const minTop = -(VISIBLE_MIN / 2);
  const maxTop = Math.max(window.innerHeight - VISIBLE_MIN, panelHeight > 0 ? 0 : 0);
  return {
    top: Math.max(minTop, Math.min(top, maxTop)),
    right: Math.max(minRight, Math.min(right, maxRight)),
  };
}

/** Re-highlight all code blocks on the page with a new Shiki theme (lazy-loaded) */
export async function applyShikiTheme(themeName: string): Promise<void> {
  const codeBlocks = document.querySelectorAll<HTMLPreElement>("pre.astro-code[data-language]");
  if (codeBlocks.length === 0) return;

  const langs = new Set<string>();
  for (const pre of codeBlocks) {
    const lang = pre.getAttribute("data-language");
    if (lang) langs.add(lang);
  }

  let highlighter: Awaited<ReturnType<typeof import("shiki")["createHighlighter"]>>;
  try {
    const { createHighlighter } = await import("shiki");
    highlighter = await createHighlighter({
      themes: [themeName],
      langs: [...langs],
    });
  } catch (err) {
    console.warn(`[tweak] Failed to load Shiki theme "${themeName}":`, err);
    return;
  }

  for (const pre of codeBlocks) {
    const lang = pre.getAttribute("data-language") || "text";
    const codeEl = pre.querySelector("code");
    if (!codeEl) continue;
    const text = codeEl.textContent || "";

    try {
      // Generate dual-theme output (same theme for both) so existing
      // light-dark() CSS picks up the new colors automatically
      const html = highlighter.codeToHtml(text, {
        lang,
        themes: { light: themeName, dark: themeName },
        defaultColor: false,
      });
      const temp = document.createElement("div");
      temp.innerHTML = html;
      const newPre = temp.querySelector("pre");
      if (!newPre) continue;

      const newCode = newPre.querySelector("code");
      if (newCode) codeEl.innerHTML = newCode.innerHTML;
      // Update CSS custom properties on the <pre> for background
      const newStyle = newPre.getAttribute("style") || "";
      for (const prop of ["--shiki-light", "--shiki-dark", "--shiki-light-bg", "--shiki-dark-bg"]) {
        const match = newStyle.match(new RegExp(`${prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:([^;]+)`));
        if (match) pre.style.setProperty(prop, match[1].trim());
      }
    } catch {
      // Skip blocks with unsupported languages
    }
  }
  highlighter.dispose();
}

export const SHIKI_THEMES = [
  "ayu-light",
  "catppuccin-latte",
  "catppuccin-mocha",
  "dracula",
  "everforest-dark",
  "everforest-light",
  "github-dark",
  "github-dark-dimmed",
  "github-light",
  "gruvbox-dark-medium",
  "gruvbox-light-medium",
  "kanagawa-dragon",
  "kanagawa-wave",
  "material-theme-darker",
  "material-theme-lighter",
  "material-theme-ocean",
  "min-dark",
  "min-light",
  "monokai",
  "night-owl",
  "nord",
  "one-dark-pro",
  "one-light",
  "poimandres",
  "rose-pine",
  "rose-pine-dawn",
  "rose-pine-moon",
  "snazzy-light",
  "solarized-dark",
  "solarized-light",
  "tokyo-night",
  "vesper",
  "vitesse-dark",
  "vitesse-light",
];

/**
 * ColorTweakState models the 3-tier color strategy:
 * - palette: 16 editable raw colors
 * - background/foreground: independent base colors (color pickers)
 * - cursor/selectionBg/selectionFg: palette index references
 * - semanticMappings: palette index (or "bg"/"fg") references for each semantic token
 *
 * In v2 this lives under `TweakState.color`; other tabs will add sibling fields.
 */
export interface ColorTweakState {
  palette: string[];
  background: number;
  foreground: number;
  cursor: number;
  selectionBg: number;
  selectionFg: number;
  semanticMappings: Record<string, number | "bg" | "fg">;
  shikiTheme: string;
}

/**
 * Unified panel state. Currently only the Color tab has a sub-state; future
 * tabs (Sub 2/3/4) will extend this.
 */
export interface TweakState {
  color: ColorTweakState;
}

/** Convert any CSS color to hex using a canvas (cached context) */
let _canvasCtx: CanvasRenderingContext2D | null = null;
export function cssColorToHex(color: string): string {
  if (!color || color === "initial" || color === "inherit") return "#000000";
  if (/^#[0-9a-fA-F]{6}$/.test(color.trim())) return color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(color.trim())) {
    const c = color.trim();
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  try {
    if (!_canvasCtx) _canvasCtx = document.createElement("canvas").getContext("2d");
    if (!_canvasCtx) return "#000000";
    _canvasCtx.fillStyle = color;
    const resolved = _canvasCtx.fillStyle;
    if (resolved.startsWith("#")) return resolved;
    const match = resolved.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    }
    return "#000000";
  } catch {
    return "#000000";
  }
}

export function setCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

/** Resolve a ColorRef to a palette index. If it's already a number, use it.
 *  If it's a string, find matching palette color or nearest match by color distance. */
export function colorRefToIndex(ref: ColorRef | undefined, palette: string[], fallback: number): number {
  if (ref === undefined) return fallback;
  if (typeof ref === "number") return ref;
  // String: try exact match in palette
  const idx = palette.indexOf(ref);
  if (idx >= 0) return idx;
  // No exact match — find nearest palette color by RGB distance
  const refHex = cssColorToHex(ref);
  const refRgb = hexToRgb(refHex);
  let bestIdx = fallback;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const pHex = cssColorToHex(palette[i]);
    const pRgb = hexToRgb(pHex);
    const dist = (refRgb.r - pRgb.r) ** 2 + (refRgb.g - pRgb.g) ** 2 + (refRgb.b - pRgb.b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Parse hex color string to RGB components */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

/** Resolve the active scheme name, considering light/dark mode */
export function getActiveSchemeName(): string {
  // Check light/dark mode
  if (settings.colorMode) {
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "light") return settings.colorMode.lightScheme;
    if (theme === "dark") return settings.colorMode.darkScheme;
  }
  return settings.colorScheme;
}

/** Initialize state from the active color scheme data (not computed styles) */
export function initColorFromScheme(): ColorTweakState {
  const schemeName = getActiveSchemeName();
  const scheme = colorSchemes[schemeName];
  if (!scheme) {
    const first = Object.values(colorSchemes)[0];
    return initColorFromSchemeData(first);
  }
  return initColorFromSchemeData(scheme);
}

export function initColorFromSchemeData(scheme: ColorScheme): ColorTweakState {
  const palette = scheme.palette.map((c) => cssColorToHex(c));
  const semanticMappings: Record<string, number | "bg" | "fg"> = {};
  for (const [key, defaultVal] of Object.entries(SEMANTIC_DEFAULTS)) {
    const schemeVal = scheme.semantic?.[key as keyof typeof scheme.semantic];
    if (schemeVal === undefined) {
      semanticMappings[key] = defaultVal;
    } else if (typeof schemeVal === "number") {
      semanticMappings[key] = schemeVal;
    } else {
      // String value — find in palette or nearest match
      semanticMappings[key] = colorRefToIndex(schemeVal, scheme.palette, defaultVal);
    }
  }

  return {
    palette,
    background: colorRefToIndex(scheme.background, scheme.palette, 0),
    foreground: colorRefToIndex(scheme.foreground, scheme.palette, 15),
    cursor: colorRefToIndex(scheme.cursor, scheme.palette, 6),
    selectionBg: colorRefToIndex(scheme.selectionBg, scheme.palette, 0),
    selectionFg: colorRefToIndex(scheme.selectionFg, scheme.palette, 15),
    semanticMappings,
    shikiTheme: String(scheme.shikiTheme ?? "dracula"),
  };
}

/** Resolve a semantic mapping to an actual color (bounds-checked) */
export function resolveMapping(
  mapping: number | "bg" | "fg",
  palette: string[],
  bgIndex: number,
  fgIndex: number,
): string {
  const len = palette.length;
  if (mapping === "bg") return palette[safeIndex(bgIndex, len)] ?? "#000000";
  if (mapping === "fg") return palette[safeIndex(fgIndex, len)] ?? "#ffffff";
  return palette[safeIndex(mapping, len)] ?? "#000000";
}

export function safeIndex(index: number, len: number): number {
  return index >= 0 && index < len ? index : 0;
}

export function applyColorState(state: ColorTweakState) {
  const len = state.palette.length;
  // Apply palette
  for (let i = 0; i < len; i++) {
    setCssVar(`--zd-${i}`, state.palette[i]);
  }
  // Apply base colors (all reference palette, bounds-checked)
  setCssVar("--zd-bg", state.palette[safeIndex(state.background, len)]);
  setCssVar("--zd-fg", state.palette[safeIndex(state.foreground, len)]);
  setCssVar("--zd-cursor", state.palette[safeIndex(state.cursor, len)]);
  setCssVar("--zd-sel-bg", state.palette[safeIndex(state.selectionBg, len)]);
  setCssVar("--zd-sel-fg", state.palette[safeIndex(state.selectionFg, len)]);
  // Apply semantic
  for (const [key, cssName] of Object.entries(SEMANTIC_CSS_NAMES)) {
    const mapping = state.semanticMappings[key] ?? SEMANTIC_DEFAULTS[key];
    setCssVar(cssName, resolveMapping(mapping, state.palette, state.background, state.foreground));
  }
}

/** Apply full unified TweakState (currently only color sub-state exists). */
export function applyFullState(state: TweakState) {
  applyColorState(state.color);
}

/** Strip all tweak-applied inline CSS variables so the stylesheet-provided
 *  colors from the active scheme take effect again. */
export function clearAppliedStyles() {
  for (let i = 0; i < 16; i++) {
    document.documentElement.style.removeProperty(`--zd-${i}`);
  }
  for (const prop of ["--zd-bg", "--zd-fg", "--zd-cursor", "--zd-sel-bg", "--zd-sel-fg"]) {
    document.documentElement.style.removeProperty(prop);
  }
  for (const cssName of Object.values(SEMANTIC_CSS_NAMES)) {
    document.documentElement.style.removeProperty(cssName);
  }
}

/** Validate a parsed v1 object has the minimum fields to be a ColorTweakState. */
function isValidColorShape(s: unknown): s is Partial<ColorTweakState> {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    Array.isArray(o.palette) &&
    (o.palette as unknown[]).length === 16 &&
    typeof o.background === "number" &&
    typeof o.foreground === "number" &&
    typeof o.cursor === "number" &&
    typeof o.selectionBg === "number" &&
    typeof o.selectionFg === "number" &&
    typeof o.semanticMappings === "object" &&
    o.semanticMappings !== null
  );
}

/** Fill missing fields on a ColorTweakState-shaped object using defaults. */
function hydrateColorState(
  partial: Partial<ColorTweakState>,
  defaults: ColorTweakState,
): ColorTweakState {
  return {
    palette: Array.isArray(partial.palette) && partial.palette.length === 16
      ? (partial.palette as string[])
      : defaults.palette,
    background: typeof partial.background === "number" ? partial.background : defaults.background,
    foreground: typeof partial.foreground === "number" ? partial.foreground : defaults.foreground,
    cursor: typeof partial.cursor === "number" ? partial.cursor : defaults.cursor,
    selectionBg: typeof partial.selectionBg === "number" ? partial.selectionBg : defaults.selectionBg,
    selectionFg: typeof partial.selectionFg === "number" ? partial.selectionFg : defaults.selectionFg,
    semanticMappings:
      partial.semanticMappings && typeof partial.semanticMappings === "object"
        ? { ...defaults.semanticMappings, ...partial.semanticMappings }
        : defaults.semanticMappings,
    shikiTheme:
      typeof partial.shikiTheme === "string" && partial.shikiTheme.length > 0
        ? partial.shikiTheme
        : defaults.shikiTheme,
  };
}

/**
 * Test-friendly migration entry point. Reads from a provided storage (defaults
 * to `localStorage`) and returns the loaded+migrated `TweakState`, or `null`
 * when no usable state exists.
 *
 * Rules:
 *  1. If v2 key exists and parses → use it (v2 wins).
 *  2. Else if v1 key exists → parse with safe defaults, lift into `state.color`,
 *     write v2, delete v1.
 *  3. Else → return null (caller initialises from the active scheme).
 *
 * Malformed JSON is caught with `console.warn` and returns null (caller falls
 * back to fresh defaults).
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadPersistedState(
  storage: StorageLike = localStorage,
  colorDefaults?: ColorTweakState,
): TweakState | null {
  // 1. v2 wins
  const rawV2 = safeGet(storage, STORAGE_KEY_V2);
  if (rawV2 !== null) {
    const parsed = safeParse(rawV2);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as { color?: unknown };
      if (obj.color && isValidColorShape(obj.color)) {
        const defaults = colorDefaults ?? tryInitColorFromScheme();
        return { color: hydrateColorState(obj.color as Partial<ColorTweakState>, defaults) };
      }
    }
    // v2 present but malformed — warn and fall through to v1 check
    console.warn(`[tweak] Malformed ${STORAGE_KEY_V2}, attempting v1 migration`);
  }

  // 2. v1 migration
  const rawV1 = safeGet(storage, STORAGE_KEY_V1);
  if (rawV1 !== null) {
    const parsed = safeParse(rawV1);
    if (parsed && typeof parsed === "object" && isValidColorShape(parsed)) {
      const defaults = colorDefaults ?? tryInitColorFromScheme();
      // Backfill shikiTheme like the legacy loader did.
      const partial = parsed as Partial<ColorTweakState>;
      if (!partial.shikiTheme) {
        partial.shikiTheme = defaults.shikiTheme;
      }
      const color = hydrateColorState(partial, defaults);
      const migrated: TweakState = { color };
      try {
        storage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
        storage.removeItem(STORAGE_KEY_V1);
      } catch { /* storage full; still return migrated state for this session */ }
      return migrated;
    }
    // v1 unreadable — warn and drop it
    console.warn(`[tweak] Malformed ${STORAGE_KEY_V1}; discarding and using fresh defaults`);
    try { storage.removeItem(STORAGE_KEY_V1); } catch { /* ignore */ }
  }

  // 3. Fresh defaults
  return null;
}

/** Persist the full TweakState to v2. */
export function savePersistedState(state: TweakState, storage: StorageLike = localStorage) {
  try {
    storage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
  } catch {
    // storage full
  }
}

/** Remove v2 (and lingering v1) keys. */
export function clearPersistedState(storage: StorageLike = localStorage) {
  try { storage.removeItem(STORAGE_KEY_V2); } catch { /* ignore */ }
  try { storage.removeItem(STORAGE_KEY_V1); } catch { /* ignore */ }
}

function safeGet(storage: StorageLike, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function safeParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return null; }
}

/** initColorFromScheme wrapper that survives JSDOM / node environments where
 *  `document` may not be fully scheme-aware. Used as a last-resort default. */
function tryInitColorFromScheme(): ColorTweakState {
  try {
    return initColorFromScheme();
  } catch {
    // Fallback: a minimal black/white palette so migration stays deterministic
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
      semanticMappings: { ...SEMANTIC_DEFAULTS },
      shikiTheme: "dracula",
    };
  }
}
