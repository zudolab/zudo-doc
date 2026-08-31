import fs from "node:fs";
import path from "node:path";
import {
  assertNotIndexReserved,
  cleanDir,
  downgradeRepoRelativeLinks,
  ensureDir,
  escapeForMdx,
  escapeTitle,
  findNamedFiles,
  generateSkillsCategory,
  parseFrontmatter,
  resolveLocaleDirs,
  type ResourceLocaleConfig,
  type ResourceTranslations,
  writeCategoryIndex,
} from "../resource-docs-shared/index.js";

export interface ClaudeResourcesConfig {
  claudeDir: string;
  /**
   * The doc site's own root. Anchors project-specific excludes and defaults
   * `scanRoot`. Note this does NOT itself decide where the `CLAUDE.md` walk
   * runs — that is `scanRoot`.
   */
  projectRoot?: string;
  /**
   * Root of the `CLAUDE.md` walk and the base for the generated pages'
   * relative paths, titles, and slugs. Defaults to `projectRoot`, so a caller
   * that sets only `projectRoot` gets the pre-`scanRoot` behaviour.
   */
  scanRoot?: string;
  docsDir: string;
  /** Additional locale content roots, resolved by the runner when possible. */
  locales?: Record<string, ResourceLocaleConfig>;
  /** Default locale code (the unprefixed docs directory). */
  defaultLocale?: string;
  /** UI-string translation table used by localized generated indexes. */
  translations?: ResourceTranslations;
}

interface ClaudeMdItem {
  displayPath: string;
  slug: string;
  relPath: string;
  absPath: string;
}

interface CommandItem {
  name: string;
  description: string;
}

interface AgentItem {
  name: string;
  file: string;
  description: string;
  model: string;
}

// ---------------------------------------------------------------------------
// CLAUDE.md generation
// ---------------------------------------------------------------------------

function generateClaudemdDocs(
  config: ClaudeResourcesConfig,
): ClaudeMdItem[] {
  const projectRoot = config.projectRoot ?? config.claudeDir;
  const scanRoot = config.scanRoot ?? projectRoot;
  const outputDir = path.join(config.docsDir, "claude-md");

  cleanDir(outputDir);

  // Only genuinely location-specific excludes belong here — everything that is
  // really a *name* lives in EXCLUDED_DIR_NAMES and is skipped at any depth.
  // `e2e/fixtures` is anchored at both roots because when `scanRoot` sits above
  // the doc site, the site's own `e2e/fixtures` is not under the scan root's.
  const excludeDirs = [
    path.join(scanRoot, "e2e", "fixtures"),
    path.join(projectRoot, "e2e", "fixtures"),
    path.join(config.docsDir),
  ];

  const files = findNamedFiles(scanRoot, excludeDirs, ["CLAUDE.md"]);
  if (files.length === 0) return [];

  ensureDir(outputDir);
  const items: ClaudeMdItem[] = [];

  for (const filePath of files) {
    const relPath = path.relative(scanRoot, filePath);
    const displayPath = `/${relPath}`;
    const dirPart = path.dirname(relPath);
    const slug = dirPart === "." ? "root" : dirPart.replace(/\//g, "--");
    items.push({ displayPath, slug, relPath, absPath: filePath });
  }

  // Sort BEFORE writing: sidebar_position is baked into each generated .mdx,
  // so the root-first/alphabetical order must be applied first — sorting after
  // the write loop would leave positions in filesystem-walk order.
  items.sort((a, b) => {
    if (a.slug === "root") return -1;
    if (b.slug === "root") return 1;
    return a.displayPath.localeCompare(b.displayPath);
  });

  const emittedSlugs = new Map<string, string>();
  items.forEach((item, index) => {
    assertNotIndexReserved(
      item.slug,
      `claude-resources: "${item.relPath}" maps to the reserved slug "index", which is used for the category metadata file. Rename the directory to resolve the conflict.`,
    );
    const previous = emittedSlugs.get(item.slug);
    if (previous !== undefined) {
      throw new Error(
        `claude-resources: slug collision — "${item.slug}" is produced by both "${previous}" and "${item.relPath}". Rename one of the directories to resolve the conflict.`,
      );
    }
    emittedSlugs.set(item.slug, item.relPath);
    const content = fs.readFileSync(item.absPath, "utf8");
    const mdx = `---
title: "${escapeTitle(item.displayPath)}"
description: "CLAUDE.md at ${escapeTitle(item.displayPath)}"
sidebar_position: ${index + 1}
sidebar_label: "${escapeTitle(item.relPath)}"
generated: true
---

**Path:** \`${item.relPath}\`

${escapeForMdx(downgradeRepoRelativeLinks(content.trim()))}
`;
    fs.writeFileSync(path.join(outputDir, `${item.slug}.mdx`), mdx);
  });

  writeCategoryIndex(outputDir, "CLAUDE.md", 900, "Project-specific instructions");
  return items;
}

// ---------------------------------------------------------------------------
// Commands generation
// ---------------------------------------------------------------------------

function generateCommandsDocs(config: ClaudeResourcesConfig): CommandItem[] {
  const commandsDir = path.join(config.claudeDir, "commands");
  const outputDir = path.join(config.docsDir, "claude-commands");

  cleanDir(outputDir);

  if (!fs.existsSync(commandsDir)) return [];

  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return [];

  ensureDir(outputDir);
  const items: CommandItem[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsDir, file), "utf8");
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const name = file.replace(/\.md$/, "");
    assertNotIndexReserved(
      name,
      `claude-resources: ".claude/commands/index.md" uses the reserved name "index", which is used for the category metadata file. Rename the command file to resolve the conflict.`,
    );
    const description = (parsed.data.description as string) || "";

    items.push({ name, description });

    const mdx = `---
title: "${escapeTitle(name)}"
description: "${escapeTitle(description)}"
sidebar_label: "${escapeTitle(name)}"
generated: true
---

${escapeForMdx(parsed.content.trim())}
`;
    fs.writeFileSync(path.join(outputDir, `${name}.mdx`), mdx);
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  writeCategoryIndex(outputDir, "Commands", 901, "Custom slash commands");
  return items;
}

// ---------------------------------------------------------------------------
// Skills generation
// ---------------------------------------------------------------------------

function generateSkillsDocs(
  config: ClaudeResourcesConfig,
): ReturnType<typeof generateSkillsCategory> {
  return generateSkillsCategory({
    skillsDirs: [path.join(config.claudeDir, "skills")],
    outputDir: path.join(config.docsDir, "claude-skills"),
    label: "Skills",
    position: 902,
    description: "Skill packages",
    sourceLabel: ".claude/skills",
  });
}

// ---------------------------------------------------------------------------
// Agents generation
// ---------------------------------------------------------------------------

function generateAgentsDocs(config: ClaudeResourcesConfig): AgentItem[] {
  const agentsDir = path.join(config.claudeDir, "agents");
  const outputDir = path.join(config.docsDir, "claude-agents");

  cleanDir(outputDir);

  if (!fs.existsSync(agentsDir)) return [];

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return [];

  ensureDir(outputDir);
  const items: AgentItem[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const name = (parsed.data.name as string) || file.replace(/\.md$/, "");
    const description = (parsed.data.description as string) || "";
    const model = (parsed.data.model as string) || "";
    const fileSlug = file.replace(/\.md$/, "");
    assertNotIndexReserved(
      fileSlug,
      `claude-resources: ".claude/agents/index.md" uses the reserved name "index", which is used for the category metadata file. Rename the agent file to resolve the conflict.`,
    );

    items.push({ name, file: fileSlug, description, model });

    const modelBadge = model ? `**Model:** \`${model}\`\n` : "";

    const mdx = `---
title: "${escapeTitle(name)}"
description: "${escapeTitle(description)}"
sidebar_label: "${escapeTitle(name)}"
generated: true
---

${modelBadge}
${escapeForMdx(parsed.content.trim())}
`;
    fs.writeFileSync(path.join(outputDir, `${fileSlug}.mdx`), mdx);
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  writeCategoryIndex(outputDir, "Agents", 903, "Custom subagents");
  return items;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function generateOverviewIndex(
  config: ClaudeResourcesConfig,
  {
    hasCommands,
    hasSkills,
    hasAgents,
    hasClaudemd,
  }: { hasCommands: boolean; hasSkills: boolean; hasAgents: boolean; hasClaudemd: boolean },
) {
  const outputDir = path.join(config.docsDir, "claude");
  cleanDir(outputDir);
  ensureDir(outputDir);

  // Build the explicit slug list from whichever sub-categories were generated.
  // CategoryNav with `categories` renders cards for each slug by resolving
  // the node in the nav tree (including noPage auto-index categories) and
  // falling back to docsUrl(slug, locale) for the href when noPage=true.
  const categorySlugs: string[] = [];
  if (hasClaudemd) categorySlugs.push("claude-md");
  if (hasSkills) categorySlugs.push("claude-skills");
  if (hasAgents) categorySlugs.push("claude-agents");
  if (hasCommands) categorySlugs.push("claude-commands");

  const categoriesAttr = JSON.stringify(categorySlugs);

  const index = `---
title: "Claude"
description: "Claude Code configuration reference."
sidebar_position: 899
generated: true
---

## Resources

<CategoryNav categories={${categoriesAttr}} />
`;
  fs.writeFileSync(path.join(outputDir, "index.mdx"), index);
}

export function generateClaudeResourcesDocs(config: ClaudeResourcesConfig) {
  // Direct callers can use the internal generator without going through the
  // plugin runner. Normalize locale roots here too so the same overlap guard
  // applies to both entry points. Existing default-locale generation is left
  // untouched when `locales` is omitted.
  const normalizedConfig = config.locales === undefined
    ? config
    : {
        ...config,
        locales: resolveLocaleDirs({
          projectRoot: path.resolve(config.projectRoot ?? config.claudeDir),
          docsDir: config.docsDir,
          locales: config.locales,
        }),
      };

  const claudemds = generateClaudemdDocs(normalizedConfig);
  const commands = generateCommandsDocs(normalizedConfig);
  const skills = generateSkillsDocs(normalizedConfig);
  const agents = generateAgentsDocs(normalizedConfig);

  generateOverviewIndex(normalizedConfig, {
    hasClaudemd: claudemds.length > 0,
    hasCommands: commands.length > 0,
    hasSkills: skills.length > 0,
    hasAgents: agents.length > 0,
  });

  return {
    claudemd: claudemds.length,
    commands: commands.length,
    skills: skills.length,
    agents: agents.length,
  };
}
