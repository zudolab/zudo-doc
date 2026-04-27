import type { Root, RootContent, Html } from "mdast";
import { toHast } from "mdast-util-to-hast";
import { toHtml } from "hast-util-to-html";

/**
 * Remark plugin that recognizes a `<!-- more -->` HTML comment as a blog
 * excerpt marker. When found at the top level of the mdast:
 *
 *   1. Renders the pre-marker portion of the document to HTML and exposes it
 *      as `vfile.data.astro.frontmatter.excerpt` (so Astro Content Collections
 *      surface it on `entry.data.excerpt`, provided the schema declares it).
 *   2. Sets `vfile.data.astro.frontmatter.hasMore = true` so listing pages can
 *      render a "Continue reading" affordance.
 *   3. Removes the marker node from the tree, so the rendered detail page
 *      does not show a stray HTML comment.
 *
 * A manual `excerpt:` value already in frontmatter is preserved (the plugin
 * never overwrites it). When the marker is absent, the plugin is a no-op —
 * safe to apply globally to all `remarkPlugins`.
 *
 * Note: only top-level mdast `html` nodes are considered. mdast `code`
 * (fenced code) nodes are leaves whose `value` is a string, so a marker
 * literal inside a fenced block is never an `html` node and naturally cannot
 * trigger a split.
 */

/** Match a `<!-- more -->` HTML comment, allowing surrounding whitespace. */
const MORE_MARKER_RE = /^\s*<!--\s*more\s*-->\s*$/;

/** Type guard for a top-level mdast html node containing the marker. */
function isMoreMarker(node: RootContent): node is Html {
  return node.type === "html" && MORE_MARKER_RE.test(node.value);
}

/** Minimal vfile shape Astro mutates with frontmatter under `data.astro`. */
interface AstroVFile {
  data?: {
    astro?: {
      frontmatter?: Record<string, unknown>;
    };
  };
}

export function remarkExcerpt() {
  return (tree: Root, file: AstroVFile) => {
    const markerIndex = tree.children.findIndex(isMoreMarker);
    if (markerIndex < 0) return; // no-op when marker is absent

    const excerptNodes = tree.children.slice(0, markerIndex);

    // Render the pre-marker portion to HTML.
    //
    // We deliberately do NOT pass `allowDangerousHtml: true` here. The
    // resulting string is consumed by `<BlogPostCard>` via `set:html=`,
    // which already trusts the input — letting raw mdast `html` nodes (or
    // hast `raw` nodes) bypass escaping turns the listing-page excerpt
    // into an XSS sink for any HTML literal a post body happens to
    // contain. Markdown prose, emphasis, links, lists, etc. all render
    // fine without it.
    const excerptRoot: Root = { type: "root", children: excerptNodes };
    const hast = toHast(excerptRoot);
    const html = toHtml(hast).trim();

    // Strip the marker from the tree so the detail page renders cleanly.
    tree.children.splice(markerIndex, 1);

    // Inject into Astro frontmatter, respecting any manual `excerpt:` value.
    // (Note: Astro 6 Content Collections do NOT propagate this to entry.data;
    // see extractExcerptFromMarkdown() for the listing-render-time fallback.
    // We still inject for code paths that DO read vfile frontmatter, e.g.
    // `.md` pages routed directly under src/pages/.)
    file.data ??= {};
    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    const fm = file.data.astro.frontmatter;
    if (fm.excerpt === undefined || fm.excerpt === null || fm.excerpt === "") {
      fm.excerpt = html;
    }
    fm.hasMore = true;
  };
}

/**
 * Re-parse a raw markdown body with the same `<!-- more -->` rule and return
 * the rendered excerpt HTML plus a `hasMore` flag.
 *
 * This is a fallback for callers that cannot rely on
 * `vfile.data.astro.frontmatter` injection — notably Astro 6 Content
 * Collections, where remark-time frontmatter mutations are NOT propagated
 * to `entry.data` (the loader parses frontmatter once at load time).
 *
 * Returns `undefined` when the marker is absent, so the caller can decide
 * whether to fall back to a manual `excerpt` field or render the body as-is.
 *
 * The parser used here is plain CommonMark (no MDX, no GFM, no directives).
 * That's deliberate: we only need the marker's position and a faithful HTML
 * render of the prose preceding it. If a project uses MDX components inside
 * their excerpt portion, callers should still set a manual `excerpt:` field.
 */
export async function extractExcerptFromMarkdown(
  body: string,
): Promise<{ excerpt: string; hasMore: boolean } | undefined> {
  // Defer the dynamic import so non-async callers in the build pipeline are
  // not penalized when the plugin runs as a no-op remark transform.
  const { fromMarkdown } = await import("mdast-util-from-markdown");
  const tree = fromMarkdown(body) as Root;
  const markerIndex = tree.children.findIndex(isMoreMarker);
  if (markerIndex < 0) return undefined;

  const excerptRoot: Root = {
    type: "root",
    children: tree.children.slice(0, markerIndex),
  };
  // Same XSS hardening as the remark-time path above: do NOT enable
  // `allowDangerousHtml`. The result feeds straight into `set:html=` on
  // the blog post card, so raw HTML pass-through would be a sink.
  const hast = toHast(excerptRoot);
  const html = toHtml(hast).trim();
  return { excerpt: html, hasMore: true };
}
