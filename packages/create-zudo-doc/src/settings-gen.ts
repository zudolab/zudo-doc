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
  lines.push(`  LocaleConfig,`);
  lines.push(`  VersionConfig,`);
  lines.push(`  FooterConfig,`);
  lines.push(`  FrontmatterPreviewConfig,`);
  lines.push(`  BodyFootUtilAreaConfig,`);
  lines.push(`  TagPlacement,`);
  lines.push(`  TagGovernanceMode,`);
  lines.push(`  TagVocabularyEntry,`);
  lines.push(`  MetaTagsConfig,`);
  lines.push(`} from "./settings-types";`);
  lines.push(`import type {`);
  lines.push(`  HeaderNavItem,`);
  lines.push(`  HeaderRightItem,`);
  lines.push(`  ColorModeConfig,`);
  lines.push(`  HtmlPreviewConfig,`);
  lines.push(`  LocaleConfig,`);
  lines.push(`  VersionConfig,`);
  lines.push(`  FooterConfig,`);
  lines.push(`  FrontmatterPreviewConfig,`);
  lines.push(`  BodyFootUtilAreaConfig,`);
  lines.push(`  TagPlacement,`);
  lines.push(`  TagGovernanceMode,`);
  lines.push(`  MetaTagsConfig,`);
  lines.push(`} from "./settings-types";`);
  lines.push(``);

  lines.push(`export const settings = {`);

  if (choices.colorSchemeMode === "single") {
    lines.push(
      `  colorScheme: ${JSON.stringify(choices.singleScheme ?? "Default Dark")},`,
    );
    lines.push(`  colorMode: false as ColorModeConfig | false,`);
  } else {
    lines.push(
      `  colorScheme: ${JSON.stringify(choices.darkScheme ?? "Default Dark")},`,
    );
    lines.push(`  colorMode: {`);
    lines.push(
      `    defaultMode: ${JSON.stringify(choices.defaultMode ?? "dark")},`,
    );
    lines.push(
      `    lightScheme: ${JSON.stringify(choices.lightScheme ?? "Default Light")},`,
    );
    lines.push(
      `    darkScheme: ${JSON.stringify(choices.darkScheme ?? "Default Dark")},`,
    );
    lines.push(
      `    respectPrefersColorScheme: ${choices.respectPrefersColorScheme ?? true},`,
    );
    lines.push(`  } satisfies ColorModeConfig as ColorModeConfig | false,`);
  }

  lines.push(
    `  siteName: ${JSON.stringify(capitalize(choices.projectName.replace(/-/g, " ")))},`,
  );
  lines.push(`  siteDescription: "" as string,`);
  lines.push(`  base: "/",`);
  lines.push(`  trailingSlash: false as boolean,`);
  lines.push(`  noindex: ${choices.features.includes("noindex")} as boolean,`);
  lines.push(`  editUrl: false as string | false,`);
  const rawGithubUrl = (choices.githubUrl ?? "").trim();
  if (rawGithubUrl) {
    lines.push(`  githubUrl: ${JSON.stringify(rawGithubUrl)} as string | false,`);
  } else {
    lines.push(`  githubUrl: false as string | false,`);
  }
  lines.push(`  siteUrl: "" as string,`);
  lines.push(`  metaTags: {`);
  if (choices.metaTags) {
    const mt = choices.metaTags;
    lines.push(`    description: ${mt.description !== undefined ? mt.description : true},`);
    lines.push(
      `    keywords: ${mt.keywords !== undefined ? JSON.stringify(mt.keywords) : false},`,
    );
    lines.push(
      `    ogImage: ${mt.ogImage !== undefined ? JSON.stringify(mt.ogImage) : false},`,
    );
    lines.push(`    ogSiteName: ${mt.ogSiteName !== undefined ? mt.ogSiteName : true},`);
    if (mt.twitterCard) {
      lines.push(`    twitterCard: ${JSON.stringify(mt.twitterCard)},`);
      if (mt.twitterSite) {
        lines.push(`    twitterSite: ${JSON.stringify(mt.twitterSite)},`);
      }
      if (mt.twitterCreator) {
        lines.push(`    twitterCreator: ${JSON.stringify(mt.twitterCreator)},`);
      }
    } else {
      lines.push(`    twitterCard: false,`);
    }
  } else {
    lines.push(`    description: true,`);
    lines.push(`    keywords: false,`);
    lines.push(`    ogImage: false,`);
    lines.push(`    ogSiteName: true,`);
    lines.push(`    twitterCard: false,`);
  }
  lines.push(`  } satisfies MetaTagsConfig as MetaTagsConfig,`);
  lines.push(`  docsDir: "src/content/docs",`);
  lines.push(
    `  defaultLocale: ${JSON.stringify(choices.defaultLang ?? "en")} as const,`,
  );

  if (choices.features.includes("i18n")) {
    const secondaryLang = getSecondaryLang(choices.defaultLang);
    const secondaryLabel = getLangLabel(secondaryLang);
    lines.push(`  locales: {`);
    lines.push(
      `    ${secondaryLang}: { label: ${JSON.stringify(secondaryLabel)}, dir: "src/content/docs-${secondaryLang}" },`,
    );
    lines.push(`  } satisfies Record<string, LocaleConfig>,`);
  } else {
    // `as`, not `satisfies`: satisfies keeps the inferred type at literal {},
    // so Object.entries(settings.locales) in the generated zfb.config.ts
    // yields unknown values and `zfb check` fails with TS18046 (#2053).
    lines.push(`  locales: {} as Record<string, LocaleConfig>,`);
  }

  // mermaid is controlled by the markdown.features block in zfb.config.ts
  // (zfb next.12+). This field is retained for compatibility with framework
  // components that still read settings.mermaid. See the markdown.features
  // block in the generated zfb.config.ts for the canonical opt-in.
  lines.push(`  mermaid: true,`);
  lines.push(`  sitemap: false,`);
  lines.push(`  docMetainfo: false,`);
  lines.push(`  docTags: ${choices.features.includes("docTags")},`);
  lines.push(`  tagPlacement: "after-title" as TagPlacement,`);
  if (choices.features.includes("tagGovernance")) {
    lines.push(`  tagGovernance: "warn" as TagGovernanceMode,`);
    lines.push(`  tagVocabulary: true as boolean,`);
  } else {
    lines.push(`  tagGovernance: "off" as TagGovernanceMode,`);
    lines.push(`  tagVocabulary: false as boolean,`);
  }
  // Default false — fresh scaffolds typically don't need live frontmatter preview;
  // users opt in once they're ready to wire up the preview panel.
  lines.push(
    `  frontmatterPreview: false as FrontmatterPreviewConfig | false,`,
  );
  if (choices.features.includes("llmsTxt")) {
    lines.push(`  llmsTxt: true,`);
  } else {
    lines.push(`  llmsTxt: false,`);
  }
  lines.push(`  changelogs: false,`);
  lines.push(`  math: false,`);
  lines.push(`  cjkFriendly: ${choices.cjkFriendly ?? false} as boolean,`);
  lines.push(`  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",`);
  lines.push(`  aiAssistant: false as boolean,`);
  // When the user wires up `pages/api/ai-chat.tsx` (not shipped in any
  // scaffold variant — W6A spec-lock Decision 5), this toggle short-circuits
  // the endpoint with a fixed "disabled" reply. Default `false` here — the
  // showcase ships with `true` because it deploys without an Anthropic key,
  // but a fresh scaffold has `aiAssistant: false` and the user only enables
  // the chat once they're wiring up a real `ANTHROPIC_API_KEY`. Defaulting
  // demo mode off avoids silently disabling chat for them.
  lines.push(`  aiChatDemoMode: false as boolean,`);
  lines.push(`  aiChatAllowedOrigins: [] as string[],`);
  lines.push(`  aiChatGlobalDailyLimit: false as number | false,`);
  if (choices.features.includes("docHistory")) {
    lines.push(`  docHistory: true,`);
  } else {
    lines.push(`  docHistory: false,`);
  }
  // Package-owned route injection is on by default since the fast-follow (#2372).
  // Generated projects include the field explicitly so settings.ts stays in sync
  // with src/config/settings.ts (checked by check-fixture-settings-drift.mjs).
  lines.push(`  packageOwnedRoutes: true,`);
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

  lines.push(`  tocMinDepth: 2 as number,`);
  lines.push(`  tocMaxDepth: 4 as number,`);
  // Heading-ID (anchor) strategy — single source of truth shared by
  // zfb.config.ts (markdown.features.headingIds) and the host TOC builder
  // (pages/lib/_extract-headings.ts). "hierarchical" emits ancestor-prefixed
  // anchors (foo / foo-moo / foo-moo-mew); "flat" is zfb's legacy scheme.
  // Default to "hierarchical": safe for greenfield (no existing deep links to
  // break) and the recommended scheme (upstream zfb#871).
  lines.push(`  headingIdStrategy: "hierarchical" as "flat" | "hierarchical",`);

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

  if (choices.features.includes("dynamicPageTransition")) {
    lines.push(`  dynamicPageTransition: true as boolean,`);
  } else {
    lines.push(`  dynamicPageTransition: false as boolean,`);
  }

  lines.push(
    `  htmlPreview: undefined as HtmlPreviewConfig | undefined,`,
  );

  if (choices.features.includes("versioning")) {
    lines.push(`  versions: [] satisfies VersionConfig[] as VersionConfig[] | false,`);
  } else {
    lines.push(`  versions: false as VersionConfig[] | false,`);
  }

  if (choices.features.includes("claudeResources")) {
    lines.push(`  claudeResources: {`);
    lines.push(`    claudeDir: ".claude",`);
    lines.push(
      `  } as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,`,
    );
  } else {
    lines.push(
      `  claudeResources: false as { claudeDir: string; projectRoot?: string; scanRoot?: string } | false,`,
    );
  }

  if (choices.features.includes("claudeResources")) {
    lines.push(`  defaultLocaleOnlyPrefixes: [`);
    lines.push(`    "/docs/claude-md/",`);
    lines.push(`    "/docs/claude-skills/",`);
    lines.push(`    "/docs/claude-agents/",`);
    lines.push(`    "/docs/claude-commands/",`);
    lines.push(`  ] as string[],`);
  } else {
    lines.push(`  defaultLocaleOnlyPrefixes: [] as string[],`);
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
  // The "claude" categoryMatch is load-bearing beyond the header link: getCategoryOrder()
  // derives the satellite-grouping prefixes from headerNav, so without this entry
  // groupSatelliteNodes() never nests claude-md/claude-skills/... under the "claude"
  // overview node and they spread out as separate top-level cards on the index sitemap.
  if (choices.features.includes("claudeResources")) {
    lines.push(
      `    { label: "Claude", path: "/docs/claude", categoryMatch: "claude" },`,
    );
  }
  if (choices.features.includes("changelog")) {
    lines.push(
      `    { label: "Changelog", path: "/docs/changelog", categoryMatch: "changelog" },`,
    );
  }
  lines.push(`  ] satisfies HeaderNavItem[] as HeaderNavItem[],`);
  lines.push(`  headerRightItems: [`);
  if (choices.headerRightItems !== undefined) {
    // User-supplied override (including empty array): emit each entry verbatim,
    // in the chosen order. An empty array means "no header-right items" — honor it.
    // DEFENSIVE STRIP: drop any "design-token-panel" trigger when the
    // designTokenPanel feature is off — the type "design-token-panel" is absent
    // from HeaderRightTriggerName in a feature-off scaffold (gated via
    // @slot:settings-types:trigger-names), so emitting it would cause a TS error
    // (zudolab/zudo-doc#2162).
    for (const item of choices.headerRightItems) {
      if (
        item.type === "trigger" &&
        item.trigger === "design-token-panel" &&
        !choices.features.includes("designTokenPanel")
      ) {
        continue;
      }
      if (item.type === "trigger") {
        lines.push(
          `    { type: "trigger", trigger: ${JSON.stringify(item.trigger)} },`,
        );
      } else {
        lines.push(
          `    { type: "component", component: ${JSON.stringify(item.component)} },`,
        );
      }
    }
  } else {
    // Default fallback: hardcoded order, gated on selected features.
    if (choices.features.includes("designTokenPanel")) {
      lines.push(`    { type: "trigger", trigger: "design-token-panel" },`);
    }
    if (choices.features.includes("versioning")) {
      lines.push(`    { type: "component", component: "version-switcher" },`);
    }
    lines.push(`    { type: "component", component: "github-link" },`);
    lines.push(`    { type: "component", component: "theme-toggle" },`);
    if (choices.features.includes("search")) {
      lines.push(`    { type: "component", component: "search" },`);
    }
    if (choices.features.includes("i18n")) {
      lines.push(`    { type: "component", component: "language-switcher" },`);
    }
  }
  lines.push(`  ] satisfies HeaderRightItem[] as HeaderRightItem[],`);
  lines.push(`};`);

  return lines.join("\n") + "\n";
}
