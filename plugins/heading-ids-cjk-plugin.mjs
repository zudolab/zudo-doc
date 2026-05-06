// zfb plugin module: heading-ids-cjk.
//
// Workaround for upstream zfb gap — `crates/zfb-content/src/plugins/heading_links.rs`
// slugifies headings using `is_ascii_alphanumeric()`, which silently drops
// every non-ASCII character. CJK headings (`## コンポーネント構文`) thus
// produce an empty slug → no `id` attribute → no permalink anchor.
// English/ASCII headings work because their slug is non-empty.
//
// Effect on the deployed site: TOC `href="#コンポーネント構文"` and the
// matching deep-link URLs land on a heading with no `id`, so the browser
// cannot scroll-anchor to the section.
//
// postBuild — walks every `*.html` under `outDir`, parses each `<h2>`–`<h6>`
//             via a small regex, and for headings without an `id` attribute
//             (i.e. those the Rust pipeline left unsluggable) computes a
//             github-slugger slug from the inner text and injects:
//               - `id="<slug>"` immediately after the tag name
//               - a `<a href="#<slug>" class="hash-link"
//                  aria-label="Direct link to <text>"></a>` as the last child
//             Slug deduplication is per-page (matching the Rust pipeline's
//             per-document counter), so repeated identical CJK headings get
//             `<id>`, `<id>-1`, `<id>-2` like github-slugger normally does.
//
// Idempotency: headings that already carry a non-empty `id` are left
// untouched — this preserves the upstream Rust output for ASCII headings
// and keeps the plugin safe to re-run on partially-built outputs.
//
// Issue: zudolab/zudo-doc#1484
// Companion rehype plugin (algorithm parity, currently not wired into
// the zfb Rust pipeline): packages/md-plugins/src/rehype-cjk-heading-ids.ts.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import GithubSlugger from "github-slugger";

export default {
  name: "heading-ids-cjk",

  async postBuild(ctx) {
    const files = await collectHtmlFiles(ctx.outDir);
    let touched = 0;
    let headingsRewritten = 0;
    for (const file of files) {
      const before = await readFile(file, "utf8");
      const { html, count } = rewriteHtml(before);
      if (count > 0) {
        await writeFile(file, html);
        touched += 1;
        headingsRewritten += count;
      }
    }
    if (touched > 0) {
      ctx.logger.info(
        `heading-ids-cjk: added id to ${headingsRewritten} heading(s) across ${touched} file(s)`,
      );
    }
  },
};

async function collectHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectHtmlFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

// Match `<hN attrs>inner</hN>` for N=2..6. `[^<]*` keeps inner text simple —
// the upstream Rust HeadingLinksPlugin only operates on raw heading text and
// our problem set (CJK headings emitted directly by MDX `## …`) never carries
// nested elements before the missing-id fix runs. Headings with nested markup
// already have an `id` (anchor was emitted around the text via the Rust path),
// so they fall under the "skip if id is present" branch even if this regex
// misses them.
const HEADING_RE = /<h([2-6])([^>]*)>([^<]*)<\/h\1>/g;
const ID_ATTR_RE = /\sid\s*=\s*"([^"]*)"/i;

/**
 * Rewrite a full HTML document, adding id + hash-link anchor to any h2-h6
 * that lacks an id attribute (per-document github-slugger counter).
 *
 * Exported for unit testing.
 */
export function rewriteHtml(html) {
  const slugger = new GithubSlugger();
  let count = 0;
  // First pass: register existing ids so subsequent CJK slugs do not collide.
  for (const match of html.matchAll(HEADING_RE)) {
    const attrs = match[2] ?? "";
    const idMatch = ID_ATTR_RE.exec(attrs);
    if (idMatch && idMatch[1]) {
      slugger.slug(idMatch[1]);
    }
  }
  // Second pass: inject id + anchor where missing.
  const rewritten = html.replace(HEADING_RE, (full, level, attrs, inner) => {
    if (ID_ATTR_RE.test(attrs)) return full;
    const text = inner.trim();
    if (!text) return full;
    const slug = slugger.slug(text);
    if (!slug) return full;
    count += 1;
    const anchor =
      `<a href="#${slug}" aria-label="Direct link to ${escapeAttr(text)}"` +
      ` class="text-accent underline hover:text-accent-hover"></a>`;
    return `<h${level} id="${escapeAttr(slug)}"${attrs}>${inner}${anchor}</h${level}>`;
  });
  return { html: rewritten, count };
}

function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
