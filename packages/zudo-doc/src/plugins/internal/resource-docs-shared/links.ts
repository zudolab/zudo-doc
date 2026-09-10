/**
 * Whether a markdown link target is a repo-relative file reference
 * (`./wrangler.toml`, `../../schema/photos.sql`, `foo/bar.md`) rather than
 * something the doc site can resolve: an absolute URL (`https://…`), a
 * protocol-relative URL (`//…`), a site-absolute path (`/docs/…`), a pure
 * anchor (`#…`), or a scheme (`mailto:`, `tel:`).
 */
export function isRepoRelativeLink(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === "") return false;
  if (trimmed.startsWith("#")) return false; // anchor
  if (trimmed.startsWith("/")) return false; // site-absolute or protocol-relative (//host)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false; // has a scheme (http:, mailto:, …)
  return true;
}

type MarkdownLinkTransformer = (
  match: string,
  text: string,
  url: string,
) => string;

/**
 * Transform markdown links while leaving fenced and inline code untouched.
 * Keeping this scan shared makes link rewrites and link downgrades obey the
 * same code-span boundaries.
 */
function transformMarkdownLinks(
  content: string,
  transform: MarkdownLinkTransformer,
): string {
  const blockPlaceholder = "\x00CRLINK_BLOCK_";
  const inlinePlaceholder = "\x00CRLINK_INLINE_";

  // Extract fenced code blocks so their contents are untouched. Both backtick
  // (```) and tilde (~~~) fences are recognised; the `\1` backreference makes
  // the closing fence match the same delimiter the block opened with.
  const codeBlocks: string[] = [];
  const withBlocks = content.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/g, (match) => {
    codeBlocks.push(match);
    return `${blockPlaceholder}${codeBlocks.length - 1}\x00`;
  });

  const transformed = withBlocks
    .split(new RegExp(`(${blockPlaceholder}\\d+\x00)`, "g"))
    .map((part) => {
      if (new RegExp(`^${blockPlaceholder}\\d+\x00$`).test(part)) return part;

      // Preserve inline-code spans, then transform links in the remaining text.
      const inlineCodes: string[] = [];
      const withInline = part.replace(
        /(`{1,3})(?!`)([\s\S]*?[^`])\1(?!`)/g,
        (match) => {
          inlineCodes.push(match);
          return `${inlinePlaceholder}${inlineCodes.length - 1}\x00`;
        },
      );

      const rewritten = withInline.replace(
        /!?\[([^\]]*)\]\(([^)]+)\)/g,
        (match, text: string, url: string) => transform(match, text, url),
      );

      return rewritten.replace(
        new RegExp(`${inlinePlaceholder}(\\d+)\x00`, "g"),
        (_, idx: string) => inlineCodes[Number(idx)] ?? "",
      );
    })
    .join("");

  return transformed.replace(
    new RegExp(`${blockPlaceholder}(\\d+)\x00`, "g"),
    (_, idx: string) => codeBlocks[Number(idx)] ?? "",
  );
}

/**
 * Rewrite markdown link destinations outside fenced and inline code.
 * Returning `undefined` from `rewrite` leaves that link unchanged.
 */
export function rewriteMarkdownLinks(
  content: string,
  rewrite: (url: string) => string | undefined,
): string {
  return transformMarkdownLinks(content, (match, _text, url) => {
    const replacement = rewrite(url);
    if (replacement === undefined) return match;
    // The link regex captures everything between `](` and the closing `)`,
    // so the destination is the final `url.length` bytes before that `)`.
    // Using the final occurrence also handles labels that repeat the URL.
    const urlStart = match.length - url.length - 1;
    if (urlStart < 0 || match.slice(urlStart, urlStart + url.length) !== url) {
      return match;
    }
    return `${match.slice(0, urlStart)}${replacement}${match.slice(urlStart + url.length)}`;
  });
}

/**
 * Downgrade repo-relative markdown links in a mirrored `CLAUDE.md` body to
 * inline code so they don't dangle in the flattened mirror tree (#2411).
 *
 * A `CLAUDE.md`'s relative links point at real repo files (correct for an
 * in-repo reader), but the mirror flattens each file into a single
 * `claude-md/<name>.mdx` page with no counterpart for those targets — left as
 * links they surface as `broken link:` warnings on every affected page. Inline
 * code keeps the reference legible (`` `wrangler.toml` ``) without a href.
 *
 * Code spans are preserved verbatim: a `[x](./y)` inside a fenced block or an
 * inline-code span is literal text, not a link, and must not be rewritten.
 */
export function downgradeRepoRelativeLinks(
  content: string,
  keep?: (url: string) => boolean,
): string {
  return transformMarkdownLinks(content, (match, text, url) =>
    isRepoRelativeLink(url) && !(keep?.(url) ?? false) ? `\`${text}\`` : match,
  );
}
