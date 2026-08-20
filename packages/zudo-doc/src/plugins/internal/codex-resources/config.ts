import fs from "node:fs";
import path from "node:path";
import { parse, TomlDate } from "smol-toml";
import {
  formatFrontmatterString,
  cleanDir,
  ensureDir,
  escapeMarkdownTableCell,
  renderCodeFence,
  writeCategoryIndex,
} from "../resource-docs-shared/index.js";
import {
  assertUniqueSlug,
  filenameSlug,
  isRecord,
  renderTableRow,
  warn,
  writeGeneratedPage,
} from "./utils.js";
import type { CodexResourcesConfig } from "./generate.js";

export interface ConfigItem {
  filename: string;
  slug: string;
}

function configFiles(codexDir: string): string[] {
  try {
    return fs.readdirSync(codexDir, { withFileTypes: true })
      .filter((entry) =>
        entry.isFile() &&
        (entry.name === "config.toml" ||
          entry.name === "config.toml.example" ||
          entry.name.endsWith(".config.toml"))
      )
      .map((entry) => entry.name)
      .sort((a, b) => {
        if (a === "config.toml") return -1;
        if (b === "config.toml") return 1;
        return a.localeCompare(b);
      });
  } catch (error) {
    warn(codexDir, `unable to read config files: ${String(error)}`);
    return [];
  }
}

function renderValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value instanceof TomlDate) return value.toISOString();
  return String(value);
}

export function generateConfigCategory(
  config: CodexResourcesConfig,
): ConfigItem[] {
  const outputDir = path.join(config.docsDir, "codex-config");
  cleanDir(outputDir);
  if (!fs.existsSync(config.codexDir)) return [];

  const files = configFiles(config.codexDir);
  if (files.length === 0) return [];
  ensureDir(outputDir);
  const items: ConfigItem[] = [];
  const emitted = new Map<string, string>();

  for (const filename of files) {
    const filePath = path.join(config.codexDir, filename);
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

    const slug = filenameSlug(filename);
    assertUniqueSlug("config", slug, filename, emitted);
    const settings = Object.entries(parsed)
      .filter(([, value]) => !isRecord(value) || value instanceof TomlDate)
      .map(([key, value]) => renderTableRow([key, renderValue(value)]));
    const sections = source.match(/^\s*\[\[?[^\]]+\]\]?/gm) ?? [];
    const sectionList = sections.length === 0
      ? "—"
      : sections.map((section) =>
        `- ${escapeMarkdownTableCell(section.trim())}`
      ).join("\n");
    const body = [
      "## Settings",
      "",
      "| Key | Value |",
      "| --- | --- |",
      ...(settings.length > 0
        ? settings
        : [renderTableRow([undefined, undefined])]),
      "",
      "## Sections",
      "",
      sectionList,
      "",
      "## Source",
      "",
      renderCodeFence(source, "toml"),
    ].join("\n");
    writeGeneratedPage({
      outputPath: path.join(outputDir, `${slug}.mdx`),
      title: filename,
      description: `Codex configuration from ${filename}`,
      sidebarLabel: filename,
      body,
    });
    items.push({ filename, slug });
  }

  if (items.length > 0) {
    writeCategoryIndex(
      outputDir,
      "Config",
      906,
      "config.toml and profiles",
      formatFrontmatterString,
    );
  }
  return items;
}
