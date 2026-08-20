import fs from "node:fs";
import path from "node:path";
import {
  assertNotIndexReserved,
  escapeMarkdownTableCell,
  formatFrontmatterString,
} from "../resource-docs-shared/index.js";

export function warn(filePath: string, message: string): void {
  console.warn(`${filePath}: ${message}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function filenameSlug(filename: string): string {
  return filename.replace(/\./g, "-");
}

export function renderTableRow(values: unknown[]): string {
  return `| ${values.map(escapeMarkdownTableCell).join(" | ")} |`;
}

export function assertUniqueSlug(
  resource: string,
  slug: string,
  filePath: string,
  emitted: Map<string, string>,
): void {
  assertNotIndexReserved(
    slug,
    `codex-resources: "${filePath}" maps to the reserved slug "index", which is used for the category metadata file. Rename the file or directory to resolve the conflict.`,
  );
  const previous = emitted.get(slug);
  if (previous !== undefined) {
    throw new Error(
      `codex-resources: ${resource} slug collision — "${slug}" is produced by both "${previous}" and "${filePath}". Rename one of the files to resolve the conflict.`,
    );
  }
  emitted.set(slug, filePath);
}

export function writeGeneratedPage({
  outputPath,
  title,
  description,
  sidebarLabel,
  sidebarPosition,
  body,
}: {
  outputPath: string;
  title: string;
  description: string;
  sidebarLabel?: string;
  sidebarPosition?: number;
  body: string;
}): void {
  const position = sidebarPosition === undefined
    ? ""
    : `sidebar_position: ${sidebarPosition}\n`;
  const label = sidebarLabel === undefined
    ? ""
    : `sidebar_label: ${formatFrontmatterString(sidebarLabel)}\n`;
  fs.writeFileSync(
    outputPath,
    `---\ntitle: ${formatFrontmatterString(title)}\ndescription: ${formatFrontmatterString(description)}\n${position}${label}generated: true\n---\n\n${body.trim()}\n`,
  );
}

export function languageForFilename(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case ".sh":
      return "bash";
    case ".py":
      return "python";
    case ".js":
    case ".mjs":
      return "javascript";
    case ".ts":
      return "typescript";
    default:
      return "";
  }
}
