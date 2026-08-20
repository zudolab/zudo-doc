import fs from "node:fs";
import path from "node:path";
import { cleanDir, ensureDir } from "../resource-docs-shared/index.js";
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
    `---\ntitle: "Codex"\ndescription: "OpenAI Codex configuration reference."\nsidebar_position: 904\ngenerated: true\n---\n\n## Resources\n\n<CategoryNav categories={${JSON.stringify(slugs)}} />\n`,
  );
}
