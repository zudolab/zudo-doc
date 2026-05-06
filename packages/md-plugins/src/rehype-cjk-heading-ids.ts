import type { Root, Element, ElementContent } from "hast";
import { visit } from "unist-util-visit";
import GithubSlugger from "github-slugger";
import { extractText } from "./hast-utils";

/**
 * Rehype plugin that ensures every `<h2>`–`<h6>` carries an `id` attribute
 * derived from the heading text and an appended `hash-link` anchor.
 *
 * Why this exists alongside zfb's built-in `HeadingLinksPlugin`:
 * the upstream Rust slugifier in
 * `crates/zfb-content/src/plugins/heading_links.rs` keeps only
 * `is_ascii_alphanumeric()` characters, so a heading like `## コンポーネント構文`
 * slugs to the empty string and the heading is left without `id` /
 * permalink. `github-slugger`, like every JS-side slugger this repo has
 * historically used (`pages/lib/_extract-headings.ts`, etc.), preserves
 * CJK code points — keeping the rendered `<h2 id="コンポーネント構文">`
 * aligned with the TOC `href="#コンポーネント構文"` produced from the
 * same slugger.
 *
 * The plugin is idempotent: a heading that already has a non-empty `id`
 * is left untouched (we do not duplicate IDs or anchors that the Rust
 * pipeline may have produced for ASCII headings). It is therefore safe
 * to run after zfb's own pipeline.
 *
 * NOTE: zfb's TS config currently exposes no remark/rehype plugin slot
 * (the MDX pipeline is Rust). This plugin is exported so consumers can
 * reuse the algorithm from a JS pipeline (e.g. tests) and to encode the
 * canonical CJK-safe slugging behaviour in one place. The matching
 * dist-HTML rewrite step lives at `plugins/heading-ids-cjk-plugin.mjs`,
 * which uses the same `github-slugger` library on the rendered output.
 *
 * Issue: zudolab/zudo-doc#1484
 */
export function rehypeCjkHeadingIds() {
  return (tree: Root) => {
    const slugger = new GithubSlugger();
    visit(tree, "element", (node: Element) => {
      if (!isTargetHeading(node.tagName)) return;

      const existingId = node.properties?.id;
      if (typeof existingId === "string" && existingId.length > 0) {
        // Track the existing id with the slugger so subsequent siblings
        // with the same base text don't collide on the same slug.
        slugger.slug(existingId);
        return;
      }

      const text = extractText(node);
      if (!text) return;

      const slug = slugger.slug(text);
      if (!slug) return;

      node.properties = node.properties ?? {};
      node.properties.id = slug;

      const anchor: Element = {
        type: "element",
        tagName: "a",
        properties: {
          href: `#${slug}`,
          className: ["hash-link"],
          ariaLabel: `Direct link to ${text}`,
        },
        children: [],
      };
      (node.children as ElementContent[]).push(anchor);
    });
  };
}

function isTargetHeading(tag: string): boolean {
  return tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6";
}
