/**
 * Color-scheme MECHANISM — palette → `--zd-*` CSS custom-property injection.
 *
 * This module ships the pure computation layer used by every project that
 * builds on @takazudo/zudo-doc. It is DATA-free: callers pass in their own
 * color-scheme manifest and settings.
 *
 * Moved from the host's `src/config/color-scheme-utils.ts` as part of the
 * package-first migration (S9a zudolab/zudo-doc#2333). The DATA (palette
 * values, scheme names, `colorMode` settings) stays project-side.
 */

/** A color reference: palette index (number) or direct color value (string) */
export type ColorRef = number | string;

export interface ColorScheme {
  background: ColorRef;
  foreground: ColorRef;
  cursor: ColorRef;
  selectionBg: ColorRef;
  selectionFg: ColorRef;
  palette: [
    string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string,
  ];
  /** Optional, vestigial — no visible effect on rendering; carried only for
   *  the zdtp design-token panel config envelope. See project CLAUDE.md. */
  shikiTheme?: string;
  /** Optional semantic overrides. When omitted, defaults from
   *  `SEMANTIC_DEFAULTS` are used (surface=p0, muted=p8, accent=p5, …). */
  semantic?: {
    surface?: ColorRef;
    muted?: ColorRef;
    accent?: ColorRef;
    accentHover?: ColorRef;
    codeBg?: ColorRef;
    codeFg?: ColorRef;
    success?: ColorRef;
    danger?: ColorRef;
    warning?: ColorRef;
    info?: ColorRef;
    mermaidNodeBg?: ColorRef;
    mermaidText?: ColorRef;
    mermaidLine?: ColorRef;
    mermaidLabelBg?: ColorRef;
    mermaidNoteBg?: ColorRef;
    chatUserBg?: ColorRef;
    chatUserText?: ColorRef;
    chatAssistantBg?: ColorRef;
    chatAssistantText?: ColorRef;
    /** UI chrome over user images — enlarge/close overlay buttons */
    imageOverlayBg?: ColorRef;
    imageOverlayFg?: ColorRef;
    /** <mark> highlight for matched keywords in search results */
    matchedKeywordBg?: ColorRef;
    matchedKeywordFg?: ColorRef;
  };
}

/** Default mapping: semantic token name → palette index */
export const SEMANTIC_DEFAULTS: Record<string, number> = {
  surface: 0,
  muted: 8,
  accent: 5,
  accentHover: 14,
  codeBg: 10,
  codeFg: 11,
  success: 2,
  danger: 1,
  warning: 3,
  info: 4,
  mermaidNodeBg: 9,
  mermaidText: 11,
  mermaidLine: 8,
  mermaidLabelBg: 10,
  mermaidNoteBg: 0,
  chatUserBg: 5,
  chatUserText: 9,
  chatAssistantBg: 9,
  chatAssistantText: 11,
  imageOverlayBg: 0,
  imageOverlayFg: 11,
  matchedKeywordBg: 3,
  matchedKeywordFg: 15,
};

export const SEMANTIC_CSS_NAMES: Record<string, string> = {
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

/** Resolve a ColorRef to a concrete color string.
 *  - number → palette[value]
 *  - string → used as-is
 *  - undefined → fallback */
export function resolveColor(
  value: ColorRef | undefined,
  palette: string[],
  fallback: string,
): string {
  if (value === undefined) return fallback;
  if (typeof value === "number") return palette[value] ?? fallback;
  return value;
}

/** Resolve semantic colors with fallbacks to default palette slots */
export function resolveSemanticColors(scheme: ColorScheme) {
  const p = scheme.palette;
  return {
    surface: resolveColor(scheme.semantic?.surface, p, p[0]),
    muted: resolveColor(scheme.semantic?.muted, p, p[8]),
    accent: resolveColor(scheme.semantic?.accent, p, p[5]),
    accentHover: resolveColor(scheme.semantic?.accentHover, p, p[14]),
    codeBg: resolveColor(scheme.semantic?.codeBg, p, p[10]),
    codeFg: resolveColor(scheme.semantic?.codeFg, p, p[11]),
    success: resolveColor(scheme.semantic?.success, p, p[2]),
    danger: resolveColor(scheme.semantic?.danger, p, p[1]),
    warning: resolveColor(scheme.semantic?.warning, p, p[3]),
    info: resolveColor(scheme.semantic?.info, p, p[4]),
    mermaidNodeBg: resolveColor(scheme.semantic?.mermaidNodeBg, p, p[9]),
    mermaidText: resolveColor(scheme.semantic?.mermaidText, p, p[11]),
    mermaidLine: resolveColor(scheme.semantic?.mermaidLine, p, p[8]),
    mermaidLabelBg: resolveColor(scheme.semantic?.mermaidLabelBg, p, p[10]),
    mermaidNoteBg: resolveColor(scheme.semantic?.mermaidNoteBg, p, p[0]),
    chatUserBg: resolveColor(scheme.semantic?.chatUserBg, p, p[5]),
    chatUserText: resolveColor(scheme.semantic?.chatUserText, p, p[9]),
    chatAssistantBg: resolveColor(scheme.semantic?.chatAssistantBg, p, p[9]),
    chatAssistantText: resolveColor(scheme.semantic?.chatAssistantText, p, p[11]),
    imageOverlayBg: resolveColor(scheme.semantic?.imageOverlayBg, p, p[0]),
    imageOverlayFg: resolveColor(scheme.semantic?.imageOverlayFg, p, p[11]),
    matchedKeywordBg: resolveColor(scheme.semantic?.matchedKeywordBg, p, p[3]),
    matchedKeywordFg: resolveColor(scheme.semantic?.matchedKeywordFg, p, p[15]),
  };
}

/** Convert a ColorScheme to a flat list of [cssProperty, value] pairs.
 *  The result is the exact set of `--zd-*` custom properties that the
 *  ColorSchemeProvider emits onto `:root`. */
export function schemeToCssPairs(scheme: ColorScheme): [string, string][] {
  const p = scheme.palette;
  const sem = resolveSemanticColors(scheme);
  return [
    ["--zd-bg", resolveColor(scheme.background, p, p[0])],
    ["--zd-fg", resolveColor(scheme.foreground, p, p[15])],
    ["--zd-cursor", resolveColor(scheme.cursor, p, p[6])], // intentionally inert/vestigial: exposed in the design-token panel but no CSS rule consumes it (no caret-color wiring); mirrors shikiTheme's status
    ["--zd-sel-bg", resolveColor(scheme.selectionBg, p, resolveColor(scheme.background, p, p[0]))],
    ["--zd-sel-fg", resolveColor(scheme.selectionFg, p, resolveColor(scheme.foreground, p, p[15]))],
    ...p.map((color, i) => [`--zd-${i}`, color] as [string, string]),
    ["--zd-surface", sem.surface],
    ["--zd-muted", sem.muted],
    ["--zd-accent", sem.accent],
    ["--zd-accent-hover", sem.accentHover],
    ["--zd-code-bg", sem.codeBg],
    ["--zd-code-fg", sem.codeFg],
    ["--zd-success", sem.success],
    ["--zd-danger", sem.danger],
    ["--zd-warning", sem.warning],
    ["--zd-info", sem.info],
    ["--zd-mermaid-node-bg", sem.mermaidNodeBg],
    ["--zd-mermaid-text", sem.mermaidText],
    ["--zd-mermaid-line", sem.mermaidLine],
    ["--zd-mermaid-label-bg", sem.mermaidLabelBg],
    ["--zd-mermaid-note-bg", sem.mermaidNoteBg],
    ["--zd-chat-user-bg", sem.chatUserBg],
    ["--zd-chat-user-text", sem.chatUserText],
    ["--zd-chat-assistant-bg", sem.chatAssistantBg],
    ["--zd-chat-assistant-text", sem.chatAssistantText],
    ["--zd-image-overlay-bg", sem.imageOverlayBg],
    ["--zd-image-overlay-fg", sem.imageOverlayFg],
    ["--zd-matched-keyword-bg", sem.matchedKeywordBg],
    ["--zd-matched-keyword-fg", sem.matchedKeywordFg],
  ];
}

/**
 * Generate the `:root { --zd-* }` CSS block for a single active color scheme.
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
 * Generate the `:root { --zd-*: light-dark(…, …); }` CSS block for a
 * light/dark pair.
 *
 * The caller passes in the `light` and `dark` `ColorScheme` objects — resolved
 * from the project's `colorSchemes` map and `settings.colorMode`. This
 * function is DATA-free.
 */
export function generateLightDarkCssProperties(
  light: ColorScheme,
  dark: ColorScheme,
): string {
  const lightPairs = schemeToCssPairs(light);
  const darkPairs = schemeToCssPairs(dark);

  if (lightPairs.length !== darkPairs.length) {
    throw new Error(`Light scheme has ${lightPairs.length} properties but dark scheme has ${darkPairs.length}`);
  }

  const lines = [":root {", "  color-scheme: light dark;"];
  for (let i = 0; i < lightPairs.length; i++) {
    const lightPair = lightPairs[i];
    const darkPair = darkPairs[i];
    if (!lightPair || !darkPair) continue;
    const [prop, lightVal] = lightPair;
    const darkVal = darkPair[1];
    lines.push(`  ${prop}: light-dark(${lightVal}, ${darkVal});`);
  }
  lines.push("}");
  return lines.join("\n");
}
