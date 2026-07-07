/**
 * Convert authored MDX-ish changelog body content into package-safe
 * CommonMark. This deliberately handles the MDX constructs that should not
 * leak into `node_modules/CHANGELOG.md` while preserving normal markdown.
 */
export function sanitizeChangelogMarkdown(content: string): string {
  return (
    content
      .replace(/^import\s+.*$/gm, "")
      .replace(/^export\s+.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/^:::\s*([A-Za-z][\w-]*).*$/gm, (_m, name: string) => {
        return `> **${labelize(name)}**`;
      })
      .replace(/^:::\s*$/gm, "")
      .replace(/^<([A-Z][A-Za-z0-9]*)\b[^>]*>\s*$/gm, (_m, name: string) => {
        return `> **${labelize(name)}**`;
      })
      .replace(/^<\/[A-Z][A-Za-z0-9]*>\s*$/gm, "")
      .replace(/<\/?[A-Z][A-Za-z0-9]*\b[^>]*>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function labelize(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
