import type { Root, Code } from "mdast";
import { visit } from "unist-util-visit";
import { colorSchemes } from "../config/color-schemes";
import { settings } from "../config/settings";
import { resolveSemanticColors, resolveColor } from "../config/color-scheme-utils";

/**
 * Remark plugin that injects D2 theme-overrides into code blocks at build time.
 *
 * Resolves the site's semantic D2 color tokens from the active color scheme
 * and prepends a `vars { d2-config { theme-overrides { ... } } }` block to
 * each D2 code block. This ensures astro-d2 generates SVGs that match the
 * site's palette.
 *
 * When colorMode (light/dark) is configured, both theme-overrides and
 * dark-theme-overrides are injected.
 */

interface D2ColorMapping {
  N1: string; // node background
  N7: string; // text color
  B1: string; // primary stroke
  N4: string; // lines/connectors
  B2: string; // accent
}

function resolveD2Colors(schemeName: string): D2ColorMapping {
  const scheme = colorSchemes[schemeName];
  if (!scheme) {
    throw new Error(`Unknown color scheme: "${schemeName}"`);
  }
  const sem = resolveSemanticColors(scheme);
  return {
    N1: sem.d2NodeBg,
    N7: sem.d2Text,
    B1: sem.d2Stroke,
    N4: sem.d2Line,
    B2: sem.d2Accent,
  };
}

function buildOverridesBlock(colors: D2ColorMapping): string {
  return Object.entries(colors)
    .map(([key, val]) => `      ${key}: "${val}"`)
    .join("\n");
}

function buildVarsBlock(themeId: number, darkThemeId: number | false, overrides: string, darkOverrides?: string): string {
  const lines = [
    "vars: {",
    "  d2-config: {",
    `    theme-id: ${themeId}`,
  ];

  if (darkThemeId !== false) {
    lines.push(`    dark-theme-id: ${darkThemeId}`);
  }

  lines.push("    theme-overrides: {");
  lines.push(overrides);
  lines.push("    }");

  if (darkOverrides) {
    lines.push("    dark-theme-overrides: {");
    lines.push(darkOverrides);
    lines.push("    }");
  }

  lines.push("  }");
  lines.push("}");
  return lines.join("\n");
}

export function remarkD2ThemeInject() {
  // Resolve colors once at plugin init (build time)
  let varsBlock: string;

  if (settings.colorMode) {
    // Light/dark mode: inject both overrides
    const lightColors = resolveD2Colors(settings.colorMode.lightScheme);
    const darkColors = resolveD2Colors(settings.colorMode.darkScheme);
    varsBlock = buildVarsBlock(
      0, // light theme base
      200, // dark theme base
      buildOverridesBlock(lightColors),
      buildOverridesBlock(darkColors),
    );
  } else {
    // Single scheme
    const colors = resolveD2Colors(settings.colorScheme);
    // Detect if scheme is dark by checking background luminance
    const scheme = colorSchemes[settings.colorScheme]!;
    const bgColor = resolveColor(scheme.background, scheme.palette, scheme.palette[0]);
    const isDark = isColorDark(bgColor);
    varsBlock = buildVarsBlock(
      isDark ? 200 : 0,
      false,
      buildOverridesBlock(colors),
    );
  }

  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {
      if (node.lang !== "d2") return;

      // Skip if the code already has a vars block (user-defined overrides take precedence)
      if (/^\s*vars\s*:\s*\{/m.test(node.value)) return;

      // Prepend the theme vars block
      node.value = varsBlock + "\n\n" + node.value;
    });
  };
}

function isColorDark(hex: string): boolean {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.5;
}
