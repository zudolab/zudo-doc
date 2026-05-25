/**
 * Markdown / JSX text-stripping helpers.
 *
 * The two functions below match the legacy Astro emitter's behaviour
 * byte-for-byte. Any change here is a behaviour change and must be
 * reflected in the byte-equality fixture corpus.
 */

/**
 * Strip imports, exports, and HTML/JSX tags from MDX/MD content while
 * keeping the prose layout (headings, lists, blockquotes) intact for
 * LLM consumption. Used by `llms-full.txt`.
 */
export function stripImportsAndJsx(content: string): string {
  return (
    content
      // Remove import statements
      .replace(/^import\s+.*$/gm, "")
      // Remove export statements
      .replace(/^export\s+.*$/gm, "")
      // Remove all HTML/JSX tags (both uppercase components and lowercase elements)
      .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/g, "")
      // Collapse excessive blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Strip markdown formatting and produce plain prose. Used to derive a
 * fallback `description` from the body when frontmatter doesn't carry
 * one. The regex sequence matches the legacy `stripMarkdown` helper in
 * `src/utils/content-files.ts` — keep them in sync.
 */
export function stripMarkdown(md: string): string {
  return (
    md
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove emphasis/bold markers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
      // Remove images (must run before link removal)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove blockquote markers
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Remove import statements
      .replace(/^import\s+.*$/gm, "")
      // Remove export statements
      .replace(/^export\s+.*$/gm, "")
      // Collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
