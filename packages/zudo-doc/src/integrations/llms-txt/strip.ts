/**
 * Markdown / JSX text-stripping helpers.
 *
 * `stripImportsAndJsx` matches the legacy Astro emitter's behaviour
 * byte-for-byte, with one deliberate divergence: it also strips JSX/MDX
 * block comments (the `{/*`-delimited MDX comment form), which the legacy
 * emitter leaked (zudo-doc#2175). Any other change here is a behaviour
 * change and must be reflected in the byte-equality fixture corpus.
 *
 * `stripMarkdown` (used to derive a fallback `description` from the body
 * when frontmatter doesn't carry one) lives in the shared `md-utils`
 * module — one implementation for search-index and llms-txt
 * (zudo-doc#2024) — and is re-exported here to keep the public surface
 * unchanged.
 */

export { stripMarkdown } from "../../md-utils/index.js";

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
      // Remove JSX/MDX block comments ({/* ... */}) — they never render to
      // users in MDX, so they must not leak into the plain-text feed
      // (zudo-doc#2175). Placed before the tag rule defensively, so a comment
      // that embeds a JSX tag ({/* <Foo /> */}) is removed whole.
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      // Remove all HTML/JSX tags (both uppercase components and lowercase elements)
      .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/g, "")
      // Collapse excessive blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
