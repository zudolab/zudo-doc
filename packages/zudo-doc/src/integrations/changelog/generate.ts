import {
  buildChangelogAnchorMap,
  formatChangelogEntryHeadingText,
  rewriteChangelogEntryLinks,
} from "./links.js";
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

  // Built up-front from the full entry list (and the title/body headings
  // that precede each entry in the document), so a same-directory .md/.mdx
  // link anywhere in the corpus can be rewritten to the right in-file anchor.
  const anchorsByFilename = buildChangelogAnchorMap(title, entries);

  for (const entry of entries) {
    lines.push("");
    lines.push(`## ${formatChangelogEntryHeadingText(entry)}`);
    if (entry.content) {
      lines.push("");
      lines.push(rewriteChangelogEntryLinks(entry.content, anchorsByFilename));
    }
  }

  lines.push("");
  return lines.join("\n");
}
