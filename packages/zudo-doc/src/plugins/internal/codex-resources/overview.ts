import fs from "node:fs";
import path from "node:path";
import {
  cleanDir,
  ensureDir,
  escapeForMdx,
  formatFrontmatterString,
  removeGeneratedIndex,
  resolveResourceLabel,
  shouldEmitResourceLocaleRoute,
  writeCategoryIndex,
  writeGeneratedIndex,
} from "../resource-docs-shared/index.js";
import type { CodexResourcesConfig } from "./generate.js";

export interface CodexCategoryPresence {
  agentsMd: boolean;
  config: boolean;
  agents: boolean;
  hooks: boolean;
  rules: boolean;
  skills: boolean;
}

export function generateOverview(
  config: CodexResourcesConfig,
  presence: CodexCategoryPresence,
): void {
  const outputDir = path.join(config.docsDir, "codex");
  cleanDir(outputDir);
  ensureDir(outputDir);
  const slugs: string[] = [];
  if (presence.agentsMd) slugs.push("codex-agents-md");
  if (presence.config) slugs.push("codex-config");
  if (presence.agents) slugs.push("codex-agents");
  if (presence.hooks) slugs.push("codex-hooks");
  if (presence.rules) slugs.push("codex-rules");
  if (presence.skills) slugs.push("codex-skills");

  fs.writeFileSync(
    path.join(outputDir, "index.mdx"),
    renderOverview(config, config.defaultLocale ?? "en", slugs),
  );

  for (const [locale, localeConfig] of Object.entries(config.locales ?? {})) {
    emitLocaleCategoryIndexes(config, locale, localeConfig.dir, presence);
    const overviewPath = path.join(localeConfig.dir, "codex", "index.mdx");
    if (shouldEmitResourceLocaleRoute({
      slug: "codex",
      locale,
      defaultLocale: config.defaultLocale,
      defaultLocaleOnlyPrefixes: config.defaultLocaleOnlyPrefixes,
    })) {
      writeGeneratedIndex(
        overviewPath,
        renderOverview(config, locale, slugs),
      );
    } else {
      removeGeneratedIndex(overviewPath);
    }
  }
}

function renderOverview(
  config: CodexResourcesConfig,
  locale: string,
  slugs: string[],
): string {
  return `---\ntitle: ${formatFrontmatterString(resolveResourceLabel({
    translations: config.translations,
    locale,
    defaultLocale: config.defaultLocale,
    key: "resource.codex.title",
    fallbackLiteral: "Codex",
  }))}\ndescription: ${formatFrontmatterString(resolveResourceLabel({
    translations: config.translations,
    locale,
    defaultLocale: config.defaultLocale,
    key: "resource.codex.description",
    fallbackLiteral: "OpenAI Codex configuration reference.",
  }))}\nsidebar_position: 904\ngenerated: true\n---\n\n## ${escapeForMdx(resolveResourceLabel({
    translations: config.translations,
    locale,
    defaultLocale: config.defaultLocale,
    key: "resource.resources",
    fallbackLiteral: "Resources",
  }))}\n\n<CategoryNav categories={${JSON.stringify(slugs)}} />\n`;
}

function emitLocaleCategoryIndexes(
  config: CodexResourcesConfig,
  locale: string,
  localeDir: string,
  presence: CodexCategoryPresence,
): void {
  const write = (
    slug: string,
    keyPrefix: string,
    fallbackLabel: string,
    present: boolean,
    position: number,
    fallbackDescription: string,
  ) => {
    const indexPath = path.join(localeDir, slug, "index.mdx");
    if (!present || !shouldEmitResourceLocaleRoute({
      slug,
      locale,
      defaultLocale: config.defaultLocale,
      defaultLocaleOnlyPrefixes: config.defaultLocaleOnlyPrefixes,
    })) {
      removeGeneratedIndex(indexPath);
      return;
    }
    writeCategoryIndex(
      path.join(localeDir, slug),
      resolveResourceLabel({
        translations: config.translations,
        locale,
        defaultLocale: config.defaultLocale,
        key: `${keyPrefix}.label`,
        fallbackLiteral: fallbackLabel,
      }),
      position,
      resolveResourceLabel({
        translations: config.translations,
        locale,
        defaultLocale: config.defaultLocale,
        key: `${keyPrefix}.description`,
        fallbackLiteral: fallbackDescription,
      }),
      formatFrontmatterString,
      writeGeneratedIndex,
    );
  };

  write(
    "codex-agents-md",
    "resource.codexAgentsMd",
    "AGENTS.md",
    presence.agentsMd,
    905,
    "Project instructions for Codex",
  );
  write(
    "codex-config",
    "resource.codexConfig",
    "Config",
    presence.config,
    906,
    "config.toml and profiles",
  );
  write(
    "codex-agents",
    "resource.codexAgents",
    "Agents",
    presence.agents,
    907,
    "Custom subagents",
  );
  write(
    "codex-hooks",
    "resource.codexHooks",
    "Hooks",
    presence.hooks,
    908,
    "Lifecycle hooks",
  );
  write(
    "codex-rules",
    "resource.codexRules",
    "Rules",
    presence.rules,
    909,
    "Command approval rules",
  );
  write(
    "codex-skills",
    "resource.codexSkills",
    "Skills",
    presence.skills,
    910,
    "Skill packages",
  );
}
