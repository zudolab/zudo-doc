import path from "node:path";
import { generateAgentsMdCategory } from "./agents-md.js";
import { generateAgentsCategory } from "./agents.js";
import { generateConfigCategory } from "./config.js";
import { generateHooksCategory } from "./hooks.js";
import { generateOverview } from "./overview.js";
import { generateRulesCategory } from "./rules.js";
import { generateSkillsCategoryDocs } from "./skills.js";
import {
  resolveLocaleDirs,
  type ResourceLocaleConfig,
  type ResourceTranslations,
} from "../resource-docs-shared/index.js";

export interface CodexResourcesConfig {
  codexDir: string;
  /** The doc site's own root and the default value of `scanRoot`. */
  projectRoot?: string;
  /**
   * Repo-wide discovery root for both the AGENTS.md walk and the repo-level
   * `.agents/skills/` root. Also serves as the relative-path base for the
   * generated AGENTS.md titles and slugs. Defaults to `projectRoot`.
   */
  scanRoot?: string;
  docsDir: string;
  /** Additional locale content roots, resolved by the runner when possible. */
  locales?: Record<string, ResourceLocaleConfig>;
  /** Default locale code (the unprefixed docs directory). */
  defaultLocale?: string;
  /** UI-string translation table used by localized generated indexes. */
  translations?: ResourceTranslations;
  /** Route prefixes that must not receive non-default-locale indexes. */
  defaultLocaleOnlyPrefixes?: string[];
}

export function generateCodexResourcesDocs(config: CodexResourcesConfig) {
  // Direct callers can use the internal generator without going through the
  // plugin runner. Normalize locale roots here too so the same overlap guard
  // applies to both entry points. Existing default-locale generation is left
  // untouched when `locales` is omitted.
  const normalizedConfig = config.locales === undefined
    ? config
    : {
        ...config,
        locales: resolveLocaleDirs({
          projectRoot: path.resolve(config.projectRoot ?? config.codexDir),
          docsDir: config.docsDir,
          locales: config.locales,
        }),
      };

  const agentsMd = generateAgentsMdCategory(normalizedConfig);
  const configItems = generateConfigCategory(normalizedConfig);
  const agents = generateAgentsCategory(normalizedConfig);
  const hooks = generateHooksCategory(normalizedConfig);
  const rules = generateRulesCategory(normalizedConfig);
  const skills = generateSkillsCategoryDocs(normalizedConfig);

  generateOverview(normalizedConfig, {
    agentsMd: agentsMd.length > 0,
    config: configItems.length > 0,
    agents: agents.length > 0,
    hooks: hooks.length > 0,
    rules: rules.length > 0,
    skills: skills.length > 0,
  });

  return {
    agentsMd: agentsMd.length,
    config: configItems.length,
    agents: agents.length,
    hooks: hooks.length,
    rules: rules.length,
    skills: skills.length,
  };
}
