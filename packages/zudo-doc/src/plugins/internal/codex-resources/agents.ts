import fs from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import {
  cleanDir,
  ensureDir,
  escapeForMdx,
  escapeMarkdownTableCell,
  renderCodeFence,
  writeCategoryIndex,
} from "../resource-docs-shared/index.js";
import {
  assertUniqueSlug,
  filenameSlug,
  isRecord,
  warn,
  writeGeneratedPage,
} from "./utils.js";
import type { CodexResourcesConfig } from "./generate.js";

export interface AgentItem {
  filename: string;
  slug: string;
  name: string;
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  filePath: string,
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  warn(filePath, `${field} must be a string; omitting it`);
  return undefined;
}

export function generateAgentsCategory(
  config: CodexResourcesConfig,
): AgentItem[] {
  const agentsDir = path.join(config.codexDir, "agents");
  const outputDir = path.join(config.docsDir, "codex-agents");
  cleanDir(outputDir);
  if (!fs.existsSync(agentsDir)) return [];

  let files: string[];
  try {
    files = fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".toml"))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    warn(agentsDir, `unable to read agents directory: ${String(error)}`);
    return [];
  }
  if (files.length === 0) return [];

  ensureDir(outputDir);
  const items: AgentItem[] = [];
  const emitted = new Map<string, string>();
  for (const filename of files) {
    const filePath = path.join(agentsDir, filename);
    let source: string;
    let parsed: unknown;
    try {
      source = fs.readFileSync(filePath, "utf8");
      parsed = parse(source);
    } catch (error) {
      warn(filePath, `unable to parse TOML, skipping file: ${String(error)}`);
      continue;
    }
    if (!isRecord(parsed)) {
      warn(filePath, "parsed TOML root was not an object, skipping file");
      continue;
    }

    const slug = filenameSlug(filename.replace(/\.toml$/, ""));
    assertUniqueSlug("agent", slug, filename, emitted);
    const name = optionalString(parsed, "name", filePath) ?? slug;
    const description = optionalString(parsed, "description", filePath) ?? "";
    const model = optionalString(parsed, "model", filePath);
    const reasoning = optionalString(parsed, "model_reasoning_effort", filePath);
    const sandbox = optionalString(parsed, "sandbox_mode", filePath);
    const instructions = optionalString(parsed, "developer_instructions", filePath);
    const badges = [
      model ? `**Model:** ${escapeMarkdownTableCell(model)}` : "",
      reasoning
        ? `**Reasoning effort:** ${escapeMarkdownTableCell(reasoning)}`
        : "",
      sandbox ? `**Sandbox:** ${escapeMarkdownTableCell(sandbox)}` : "",
    ].filter(Boolean);
    const sections = [badges.join("\n")];
    if (instructions !== undefined) {
      sections.push(
        `## Developer instructions\n\n${escapeForMdx(instructions.trim())}`,
      );
    }
    sections.push(`## Source\n\n${renderCodeFence(source, "toml")}`);

    writeGeneratedPage({
      outputPath: path.join(outputDir, `${slug}.mdx`),
      title: name,
      description,
      sidebarLabel: name,
      body: sections.filter(Boolean).join("\n\n"),
    });
    items.push({ filename, slug, name });
  }

  if (items.length > 0) {
    writeCategoryIndex(outputDir, "Agents", 907, "Custom subagents");
  }
  return items;
}
