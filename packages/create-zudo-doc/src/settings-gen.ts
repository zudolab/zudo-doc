import type { UserChoices } from "./prompts.js";
import { capitalize, getLangLabel, getSecondaryLang } from "./utils.js";

export function generateSettingsFile(choices: UserChoices): string {
  const lines: string[] = [];

  // Import types from settings-types (copied from template src/config/)
  lines.push(`export type {`);
  lines.push(`  HeaderNavChildItem,`);
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
  lines.push(`  d2: false,`);
  lines.push(`  d2BuildMode: "wasm" as "wasm" | "cli",`);
  lines.push(`  sitemap: false,`);
  lines.push(`  docMetainfo: false,`);
  lines.push(`  docTags: false,`);
  if (choices.features.includes("llmsTxt")) {
    lines.push(`  llmsTxt: true,`);
  } else {
    lines.push(`  llmsTxt: false,`);
  }
  lines.push(`  math: false,`);
  lines.push(`  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",`);
  lines.push(`  aiAssistant: false as boolean,`);
  if (choices.features.includes("docHistory")) {
    lines.push(`  docHistory: true,`);
  } else {
    lines.push(`  docHistory: false,`);
  }

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

  if (choices.features.includes("sidebarToggle")) {
    lines.push(`  sidebarToggle: true as boolean,`);
  } else {
    lines.push(`  sidebarToggle: false as boolean,`);
  }

  lines.push(
    `  htmlPreview: undefined as HtmlPreviewConfig | undefined,`,
  );

  if (choices.features.includes("versioning")) {
    lines.push(`  versions: [] as VersionConfig[],`);
  } else {
    lines.push(`  versions: false as VersionConfig[] | false,`);
  }

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

  if (
    choices.features.includes("footerNavGroup") ||
    choices.features.includes("footerCopyright")
  ) {
    lines.push(`  footer: {`);
    if (choices.features.includes("footerNavGroup")) {
      lines.push(`    links: [`);
      lines.push(`      {`);
      lines.push(`        title: "Docs",`);
      lines.push(`        items: [`);
      lines.push(
        `          { label: "Getting Started", href: "/docs/getting-started" },`,
      );
      lines.push(`        ],`);
      lines.push(`      },`);
      lines.push(`    ],`);
    } else {
      lines.push(`    links: [],`);
    }
    if (choices.features.includes("footerCopyright")) {
      lines.push(
        `    copyright: "Copyright © ${new Date().getFullYear()} Your Name. Built with zudo-doc.",`,
      );
    }
    lines.push(`  } satisfies FooterConfig as FooterConfig | false,`);
  } else {
    lines.push(`  footer: false as FooterConfig | false,`);
  }

  lines.push(`  headerNav: [`);
  lines.push(
    `    { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },`,
  );
  if (choices.features.includes("changelog")) {
    lines.push(
      `    { label: "Changelog", path: "/docs/changelog", categoryMatch: "changelog" },`,
    );
  }
  lines.push(`  ] as HeaderNavItem[],`);
  lines.push(`};`);

  return lines.join("\n") + "\n";
}
