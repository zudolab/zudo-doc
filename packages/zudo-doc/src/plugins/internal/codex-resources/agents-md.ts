import fs from "node:fs";
import path from "node:path";
import {
  cleanDir,
  downgradeRepoRelativeLinks,
  ensureDir,
  escapeForMdx,
  escapeMarkdownTableCell,
  findNamedFiles,
  writeCategoryIndex,
} from "../resource-docs-shared/index.js";
import { assertUniqueSlug, writeGeneratedPage } from "./utils.js";
import type { CodexResourcesConfig } from "./generate.js";

export interface AgentsMdItem {
  relPath: string;
  slug: string;
}

export function generateAgentsMdCategory(
  config: CodexResourcesConfig,
): AgentsMdItem[] {
  const projectRoot = config.projectRoot ?? config.codexDir;
  const scanRoot = config.scanRoot ?? projectRoot;
  const outputDir = path.join(config.docsDir, "codex-agents-md");
  cleanDir(outputDir);

  const excludeDirs = [
    path.join(scanRoot, "e2e", "fixtures"),
    path.join(projectRoot, "e2e", "fixtures"),
    config.docsDir,
  ];
  const files = findNamedFiles(scanRoot, excludeDirs, [
    "AGENTS.md",
    "AGENTS.override.md",
  ]);
  if (files.length === 0) return [];

  const items = files.map((absPath) => {
    const relPath = path.relative(scanRoot, absPath);
    const dirPart = path.dirname(relPath);
    const baseSlug = dirPart === "."
      ? "root"
      : dirPart.split(path.sep).join("--");
    const slug = path.basename(absPath) === "AGENTS.override.md"
      ? `${baseSlug}--override`
      : baseSlug;
    return { absPath, relPath, slug };
  });
  items.sort((a, b) => {
    if (a.slug === "root") return -1;
    if (b.slug === "root") return 1;
    return a.relPath.localeCompare(b.relPath);
  });

  ensureDir(outputDir);
  const emitted = new Map<string, string>();
  items.forEach((item, index) => {
    assertUniqueSlug("AGENTS.md", item.slug, item.relPath, emitted);
    const content = fs.readFileSync(item.absPath, "utf8");
    writeGeneratedPage({
      outputPath: path.join(outputDir, `${item.slug}.mdx`),
      title: `/${item.relPath}`,
      description: `Codex instructions at /${item.relPath}`,
      sidebarPosition: index + 1,
      sidebarLabel: item.relPath,
      body: `**Path:** ${escapeMarkdownTableCell(item.relPath)}\n\n${escapeForMdx(
        downgradeRepoRelativeLinks(content.trim()),
      )}`,
    });
  });
  writeCategoryIndex(
    outputDir,
    "AGENTS.md",
    905,
    "Project instructions for Codex",
  );
  return items.map(({ relPath, slug }) => ({ relPath, slug }));
}
