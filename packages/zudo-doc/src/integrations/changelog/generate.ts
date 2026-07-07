import type { ChangelogEntry, ChangelogGenerateOptions } from "./types.js";

export function generateChangelogMarkdown(
  entries: readonly ChangelogEntry[],
  options: ChangelogGenerateOptions = {},
): string {
  const title = options.title ?? "Changelog";
  const lines: string[] = [`# ${title}`, ""];

  if (options.packageName) {
    lines.push(`All notable changes to \`${options.packageName}\` are documented in this file.`);
  } else {
    lines.push("All notable changes to this project are documented in this file.");
  }
  lines.push("");
  lines.push("The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.");

  for (const entry of entries) {
    lines.push("");
    lines.push(entry.date ? `## [${entry.version}] - ${entry.date}` : `## [${entry.version}]`);
    if (entry.content) {
      lines.push("");
      lines.push(entry.content);
    }
  }

  lines.push("");
  return lines.join("\n");
}
