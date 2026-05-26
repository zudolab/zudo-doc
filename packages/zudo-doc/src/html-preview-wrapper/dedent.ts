/**
 * Strip common leading whitespace from all lines of a template literal string.
 * Similar to Python's textwrap.dedent().
 *
 * Copied from src/utils/dedent.ts so the v2 package has no upward dependency
 * on the host project's source.
 */
export function dedent(text: string): string {
  const lines = text.split("\n");

  // Find minimum indentation (ignoring empty/whitespace-only lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent < minIndent) minIndent = indent;
  }

  if (minIndent === 0 || minIndent === Infinity) {
    return text.trim();
  }

  return lines
    .map((line) => (line.trim().length === 0 ? "" : line.slice(minIndent)))
    .join("\n")
    .trim();
}
