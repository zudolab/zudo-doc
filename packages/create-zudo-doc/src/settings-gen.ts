import type { UserChoices } from "./prompts.js";
import { capitalize, getLangLabel, getSecondaryLang } from "./utils.js";

export function generateSettingsFile(choices: UserChoices): string {
  const lines: string[] = [];

  // Import types from settings-types (copied from template src/config/)
  lines.push(`export type {`);
  lines.push(`  HeaderNavChildItem,`);
  lines.push(`  HeaderNavItem,`);
  lines.push(`  HeaderRightItem,`);
  lines.push(`  ColorModeConfig,`);
  lines.push(`  HtmlPreviewConfig,`);
  lines.push(`  FrontmatterPreviewConfig,`);
  lines.push(`  LocaleConfig,`);
  lines.push(`  VersionConfig,`);
  lines.push(`  FooterConfig,`);
  lines.push(`  BodyFootUtilAreaConfig,`);
  lines.push(`  TagPlacement,`);
  lines.push(`  TagGovernanceMode,`);
  lines.push(`  TagVocabularyEntry,`);
  lines.push(`} from "./settings-types";`);
  lines.push(`import type {`);
  lines.push(`  HeaderNavItem,`);
  lines.push(`  HeaderRightItem,`);
  lines.push(`  ColorModeConfig,`);
  lines.push(`  HtmlPreviewConfig,`);
  lines.push(`  FrontmatterPreviewConfig,`);
  lines.push(`  LocaleConfig,`);
  lines.push(`  VersionConfig,`);
  lines.push(`  FooterConfig,`);
  lines.push(`  BodyFootUtilAreaConfig,`);
  lines.push(`  TagPlacement,`);
  lines.push(`  TagGovernanceMode,`);
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
  const rawGithubUrl = (choices.githubUrl ?? "").trim();
  if (rawGithubUrl) {
    lines.push(`  githubUrl: ${JSON.stringify(rawGithubUrl)} as string | false,`);
  } else {
    lines.push(`  githubUrl: false as string | false,`);
  }
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
  lines.push(`  tagPlacement: "after-title" as TagPlacement,`);
  if (choices.features.includes("tagGovernance")) {
    lines.push(`  tagGovernance: "warn" as TagGovernanceMode,`);
    lines.push(`  tagVocabulary: true as boolean,`);
  } else {
    lines.push(`  tagGovernance: "off" as TagGovernanceMode,`);
    lines.push(`  tagVocabulary: false as boolean,`);
  }
  lines.push(
    `  frontmatterPreview: false as FrontmatterPreviewConfig | false,`,
  );
  if (choices.features.includes("llmsTxt")) {
    lines.push(`  llmsTxt: true,`);
  } else {
    lines.push(`  llmsTxt: false,`);
  }
  lines.push(`  math: false,`);
  lines.push(`  cjkFriendly: false as boolean,`);
  lines.push(`  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",`);
  lines.push(`  aiAssistant: false as boolean,`);
  if (choices.features.includes("docHistory")) {
    lines.push(`  docHistory: true,`);
  } else {
    lines.push(`  docHistory: false,`);
  }
  if (choices.features.includes("bodyFootUtil")) {
    lines.push(`  bodyFootUtilArea: {`);
    lines.push(`    docHistory: ${choices.features.includes("docHistory")},`);
    lines.push(`    viewSourceLink: ${Boolean(rawGithubUrl)},`);
    lines.push(
      `  } satisfies BodyFootUtilAreaConfig as BodyFootUtilAreaConfig | false,`,
    );
  } else {
    lines.push(
      `  bodyFootUtilArea: false as BodyFootUtilAreaConfig | false,`,
    );
  }

  if (choices.features.includes("designTokenPanel")) {
    lines.push(`  designTokenPanel: true as boolean,`);
  } else {
    lines.push(`  designTokenPanel: false as boolean,`);
  }
  // Deprecated alias — kept for one release so existing user projects keep
  // working. Prefer `designTokenPanel` above; when this alias is unset, only
  // the new flag is consulted.
  lines.push(`  colorTweakPanel: undefined as boolean | undefined,`);

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

  if (choices.features.includes("imageEnlarge")) {
    lines.push(`  imageEnlarge: true as boolean,`);
  } else {
    lines.push(`  imageEnlarge: false as boolean,`);
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
    choices.features.includes("footerCopyright") ||
    choices.features.includes("footerTaglist")
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
    if (choices.features.includes("footerTaglist")) {
      lines.push(`    taglist: {`);
      lines.push(`      enabled: true,`);
      lines.push(`      groupBy: "group",`);
      lines.push(`    },`);
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
  lines.push(`  headerRightItems: [`);
  if (choices.features.includes("designTokenPanel")) {
    lines.push(`    { type: "trigger", trigger: "design-token-panel" },`);
  }
  if (choices.features.includes("versioning")) {
    lines.push(`    { type: "component", component: "version-switcher" },`);
  }
  lines.push(`    { type: "component", component: "github-link" },`);
  lines.push(`    { type: "component", component: "theme-toggle" },`);
  if (choices.features.includes("i18n")) {
    lines.push(`    { type: "component", component: "language-switcher" },`);
  }
  lines.push(`  ] as HeaderRightItem[],`);
  lines.push(`};`);

  return lines.join("\n") + "\n";
}
