const FENCED_CODE_BLOCK_RE = /^([ \t]*```[^\n]*\n[\s\S]*?\n[ \t]*```[ \t]*)$/gm;

/**
 * Convert authored MDX-ish changelog body content into package-safe
 * CommonMark. This deliberately handles the MDX constructs that should not
 * leak into `node_modules/CHANGELOG.md` while preserving normal markdown.
 *
 * Fenced code blocks are protected from these transforms first - a changelog
 * entry documenting a code change can legitimately contain `import`/`export`/
 * JSX syntax inside an example, and that must survive verbatim.
 */
export function sanitizeChangelogMarkdown(content: string): string {
  const codeBlocks: string[] = [];
  const withPlaceholders = content.replace(FENCED_CODE_BLOCK_RE, (match) => {
    const token = `CHANGELOG_CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}`;
    codeBlocks.push(match);
    return token;
  });

  const sanitized = withPlaceholders
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
    .trim();

  return codeBlocks
    .reduce(
      (acc, block, i) => acc.replace(`CHANGELOG_CODE_BLOCK_PLACEHOLDER_${i}`, () => block),
      sanitized,
    )
    .trim();
}

function labelize(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
