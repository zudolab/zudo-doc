import type { UserChoices } from "./prompts.js";
import { getSecondaryLang } from "./scaffold.js";
import { capitalize, getLangLabel } from "./utils.js";

export function generateSettingsFile(choices: UserChoices): string {
  const lines: string[] = [];

  // Import types from settings-types (copied from template src/config/)
  lines.push(`export type {`);
  lines.push(`  HeaderNavItem,`);
  lines.push(`  ColorModeConfig,`);
  lines.push(`  HtmlPreviewConfig,`);
  lines.push(`  LocaleConfig,`);
  lines.push(`  VersionConfig,`);
  lines.push(`  FooterConfig,`);
  lines.push(`} from "./settings-types";`);
  lines.push(`import type {`);
  lines.push(`  HeaderNavItem,`);
  lines.push(`  ColorModeConfig,`);
  lines.push(`  HtmlPreviewConfig,`);
  lines.push(`  LocaleConfig,`);
  lines.push(`  VersionConfig,`);
  lines.push(`  FooterConfig,`);
  lines.push(`} from "./settings-types";`);
  lines.push(``);

  lines.push(`export const settings = {`);

  if (choices.colorSchemeMode === "single") {
    lines.push(
      `  colorScheme: ${JSON.stringify(choices.singleScheme ?? "Dracula")},`,
    );
    lines.push(`  colorMode: false as ColorModeConfig | false,`);
  } else {
    lines.push(
      `  colorScheme: ${JSON.stringify(choices.darkScheme ?? "GitHub Dark")},`,
    );
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
  lines.push(`  siteDescription: "" as string,`);
  lines.push(`  base: "/",`);
  lines.push(`  trailingSlash: false as boolean,`);
  lines.push(`  noindex: false as boolean,`);
  lines.push(`  editUrl: false as string | false,`);
  lines.push(`  siteUrl: "" as string,`);
  lines.push(`  docsDir: "src/content/docs",`);

  if (choices.features.includes("i18n")) {
    const secondaryLang = getSecondaryLang(choices.defaultLang);
    const secondaryLabel = getLangLabel(secondaryLang);
    lines.push(`  locales: {`);
    lines.push(
      `    ${secondaryLang}: { label: ${JSON.stringify(secondaryLabel)}, dir: "src/content/docs-${secondaryLang}" },`,
    );
    lines.push(`  } as Record<string, LocaleConfig>,`);
  } else {
    lines.push(`  locales: {} as Record<string, LocaleConfig>,`);
  }

  lines.push(`  mermaid: true,`);
  lines.push(`  sitemap: false,`);
  lines.push(`  docMetainfo: false,`);
  lines.push(`  docTags: false,`);
  lines.push(`  llmsTxt: false,`);
  lines.push(`  math: false,`);
  lines.push(`  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",`);
  lines.push(`  aiAssistant: false as boolean,`);
  lines.push(`  docHistory: false,`);

  if (choices.features.includes("colorTweakPanel")) {
    lines.push(`  colorTweakPanel: true as boolean,`);
  } else {
    lines.push(`  colorTweakPanel: false as boolean,`);
  }

  if (choices.features.includes("sidebarResizer")) {
    lines.push(`  sidebarResizer: true as boolean,`);
  } else {
    lines.push(`  sidebarResizer: false as boolean,`);
  }

  lines.push(
    `  htmlPreview: undefined as HtmlPreviewConfig | undefined,`,
  );
  lines.push(`  versions: false as VersionConfig[] | false,`);

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

  lines.push(`  footer: false as FooterConfig | false,`);

  lines.push(`  headerNav: [`);
  lines.push(
    `    { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },`,
  );
  lines.push(`  ] satisfies HeaderNavItem[],`);
  lines.push(`};`);

  return lines.join("\n") + "\n";
}
