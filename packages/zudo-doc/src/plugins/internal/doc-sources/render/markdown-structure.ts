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

/** Render one Markdown table row with structurally safe cells. */
export function renderTableRow(values: unknown[]): string {
  return `| ${values.map(escapeMarkdownTableCell).join(" | ")} |`;
}

/** Fence language for a source file name; empty when unknown. */
export function languageForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf(".") + 1);
  switch (ext) {
    case "sh":
    case "bash":
    case "zsh":
      return "bash";
    case "py":
      return "python";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "mts":
    case "cts":
      return "typescript";
    case "json":
      return "json";
    case "toml":
      return "toml";
    case "yaml":
    case "yml":
      return "yaml";
    case "rules":
      return "python";
    default:
      return "";
  }
}
