import { colorSchemes, type ColorScheme, type ColorRef } from "./color-schemes";
import { settings } from "./settings";

export const lightDarkPairings = [
  { light: "Default Light", dark: "Default Dark", label: "Default" },
];

export function getActiveScheme(): ColorScheme {
  const scheme = colorSchemes[settings.colorScheme];
  if (!scheme) {
    throw new Error(`Unknown color scheme: "${settings.colorScheme}". Available: ${Object.keys(colorSchemes).join(", ")}`);
  }
  return scheme;
}

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
  if (typeof value === "number") return palette[value];
  return value;
}

/** Resolve semantic colors with fallbacks to default palette slots */
export function resolveSemanticColors(scheme: ColorScheme) {
  const p = scheme.palette;
  return {
    surface: resolveColor(scheme.semantic?.surface, p, p[0]),
    muted: resolveColor(scheme.semantic?.muted, p, p[8]),
    accent: resolveColor(scheme.semantic?.accent, p, p[6]),
    accentHover: resolveColor(scheme.semantic?.accentHover, p, p[14]),
    codeBg: resolveColor(scheme.semantic?.codeBg, p, scheme.foreground),
    codeFg: resolveColor(scheme.semantic?.codeFg, p, scheme.background),
    success: resolveColor(scheme.semantic?.success, p, p[2]),
    danger: resolveColor(scheme.semantic?.danger, p, p[1]),
    warning: resolveColor(scheme.semantic?.warning, p, p[3]),
    info: resolveColor(scheme.semantic?.info, p, p[4]),
  };
}

export function schemeToCssPairs(scheme: ColorScheme): [string, string][] {
  const p = scheme.palette;
  const sem = resolveSemanticColors(scheme);
  return [
    ["--zd-bg", scheme.background],
    ["--zd-fg", scheme.foreground],
    ["--zd-cursor", resolveColor(scheme.cursor, p, p[6])],
    ["--zd-sel-bg", resolveColor(scheme.selectionBg, p, scheme.background)],
    ["--zd-sel-fg", resolveColor(scheme.selectionFg, p, scheme.foreground)],
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
  ];
}

export function generateCssCustomProperties(): string {
  const scheme = getActiveScheme();
  const pairs = schemeToCssPairs(scheme);
  const lines = [":root {", ...pairs.map(([prop, value]) => `  ${prop}: ${value};`), "}"];
  return lines.join("\n");
}

export function generateLightDarkCssProperties(): string {
  if (!settings.colorMode) {
    throw new Error("colorMode is not configured");
  }
  const { lightScheme, darkScheme } = settings.colorMode;
  const light = colorSchemes[lightScheme];
  const dark = colorSchemes[darkScheme];
  if (!light) throw new Error(`Unknown light scheme: "${lightScheme}"`);
  if (!dark) throw new Error(`Unknown dark scheme: "${darkScheme}"`);

  const lightPairs = schemeToCssPairs(light);
  const darkPairs = schemeToCssPairs(dark);

  if (lightPairs.length !== darkPairs.length) {
    throw new Error(`Light scheme has ${lightPairs.length} properties but dark scheme has ${darkPairs.length}`);
  }

  const lines = [":root {", "  color-scheme: light dark;"];
  for (let i = 0; i < lightPairs.length; i++) {
    const prop = lightPairs[i][0];
    const lightVal = lightPairs[i][1];
    const darkVal = darkPairs[i][1];
    lines.push(`  ${prop}: light-dark(${lightVal}, ${darkVal});`);
  }
  lines.push("}");
  return lines.join("\n");
}
