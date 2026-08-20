/** Render source inside a Markdown fence that cannot be closed by the source. */
export function renderCodeFence(source: string, language = ""): string {
  const runs = source.match(/`+/g) ?? [];
  const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  const trailingNewline = source.endsWith("\n") ? "" : "\n";
  return `${fence}${language}\n${source}${trailingNewline}${fence}`;
}

/**
 * Render an arbitrary value as a structurally safe Markdown table cell.
 *
 * Code-span delimiters are chosen from the value itself. Pipes are escaped
 * for the surrounding table and physical newlines are collapsed to spaces.
 */
export function escapeMarkdownTableCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";

  const content = String(value)
    .replace(/\r\n?|\n/g, " ")
    .replace(/\|/g, "\\|");
  if (content === "") return "—";

  const runs = content.match(/`+/g) ?? [];
  const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const delimiter = "`".repeat(Math.max(1, longestRun + 1));
  const needsPadding = /^[` ]|[` ]$/.test(content);
  return needsPadding
    ? `${delimiter} ${content} ${delimiter}`
    : `${delimiter}${content}${delimiter}`;
}
