import { generateAgentsMdCategory } from "./agents-md.js";
import { generateAgentsCategory } from "./agents.js";
import { generateConfigCategory } from "./config.js";
import { generateHooksCategory } from "./hooks.js";
import { generateOverview } from "./overview.js";
import { generateRulesCategory } from "./rules.js";
import { generateSkillsCategoryDocs } from "./skills.js";

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
}

export function generateCodexResourcesDocs(config: CodexResourcesConfig) {
  const agentsMd = generateAgentsMdCategory(config);
  const configItems = generateConfigCategory(config);
  const agents = generateAgentsCategory(config);
  const hooks = generateHooksCategory(config);
  const rules = generateRulesCategory(config);
  const skills = generateSkillsCategoryDocs(config);

  generateOverview(config, {
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
