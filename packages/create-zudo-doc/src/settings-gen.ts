import type { UserChoices } from "./prompts.js";
import { capitalize } from "./utils.js";

export function generateSettingsFile(choices: UserChoices): string {
  const lines: string[] = [];

  lines.push(`export interface HeaderNavItem {`);
  lines.push(`  label: string;`);
  lines.push(`  path: string;`);
  lines.push(`  categoryMatch?: string;`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`export interface ColorModeConfig {`);
  lines.push(`  defaultMode: "light" | "dark";`);
  lines.push(`  lightScheme: string;`);
  lines.push(`  darkScheme: string;`);
  lines.push(`  respectPrefersColorScheme: boolean;`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`export interface LocaleConfig {`);
  lines.push(`  label: string;`);
  lines.push(`  dir: string;`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`export const settings = {`);

  if (choices.colorSchemeMode === "single") {
    lines.push(`  colorScheme: ${JSON.stringify(choices.singleScheme ?? "Dracula")},`);
    lines.push(`  colorMode: false as ColorModeConfig | false,`);
  } else {
    lines.push(`  colorScheme: ${JSON.stringify(choices.darkScheme ?? "GitHub Dark")},`);
    lines.push(`  colorMode: {`);
    lines.push(
      `    defaultMode: ${JSON.stringify(choices.defaultMode ?? "dark")},`,
    );
    lines.push(
      `    lightScheme: ${JSON.stringify(choices.lightScheme ?? "GitHub Light")},`,
    );
    lines.push(
      `    darkScheme: ${JSON.stringify(choices.darkScheme ?? "GitHub Dark")},`,
    );
    lines.push(
      `    respectPrefersColorScheme: ${choices.respectPrefersColorScheme ?? true},`,
    );
    lines.push(`  } satisfies ColorModeConfig,`);
  }

  lines.push(
    `  siteName: ${JSON.stringify(capitalize(choices.projectName.replace(/-/g, " ")))},`,
  );
  lines.push(`  base: "/",`);
  lines.push(`  docsDir: "src/content/docs",`);
  if (choices.features.includes("i18n")) {
    lines.push(`  locales: {`);
    lines.push(`    ja: { label: "JA", dir: "src/content/docs-ja" },`);
    lines.push(`  } as Record<string, LocaleConfig>,`);
  } else {
    lines.push(`  locales: {} as Record<string, LocaleConfig>,`);
  }

  lines.push(`  mermaid: true,`);

  if (choices.features.includes("claudeResources")) {
    lines.push(`  claudeResources: {`);
    lines.push(`    claudeDir: ".claude",`);
    lines.push(
      `  } as { claudeDir: string; projectRoot?: string } | false,`,
    );
  } else {
    lines.push(
      `  claudeResources: false as { claudeDir: string; projectRoot?: string } | false,`,
    );
  }

  lines.push(`  headerNav: [`);
  lines.push(
    `    { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },`,
  );
  lines.push(`  ] satisfies HeaderNavItem[],`);
  lines.push(`};`);

  return lines.join("\n") + "\n";
}

