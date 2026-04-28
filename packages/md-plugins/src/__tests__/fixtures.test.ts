/**
 * Fixture corpus driver — captures reference HTML produced by the current
 * JS md-plugins pipeline so the upcoming Rust (zfb) port can be diffed
 * against it.
 *
 * Pipeline composition mirrors astro.config.ts as closely as possible
 * WITHOUT booting Astro itself. Notable differences from the live site
 * (documented in AUDIT.md):
 *
 *   - Shiki is not run; a small "rehypeShimShiki" pass mimics the two
 *     attributes the JS rehype plugins depend on (data-language on <pre>
 *     and meta on <code>).
 *   - remarkResolveMarkdownLinks is NOT run — it needs a real filesystem
 *     source map, which the fixtures do not have. rehypeStripMdExtension
 *     does run, so the .md/.mdx → / cleanup is still exercised.
 *   - MDX JSX (e.g. <Note>...</Note>) is parsed as raw HTML via rehype-raw,
 *     not as MDX components. JSX-form admonitions are an MDX-runtime
 *     concern, not an md-plugins concern.
 *
 * Set UPDATE_FIXTURES=1 to (re)write expected-html/*.html. Otherwise the
 * test asserts each fixture's pipeline output matches the on-disk file.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot, Element } from "hast";

import { remarkAdmonitions } from "../remark-admonitions";
import { rehypeCodeTitle } from "../rehype-code-title";
import { rehypeHeadingLinks } from "../rehype-heading-links";
import { rehypeImageEnlarge } from "../rehype-image-enlarge";
import { rehypeMermaid } from "../rehype-mermaid";
import { rehypeStripMdExtension } from "../rehype-strip-md-extension";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../../__fixtures__");
const expectedDir = resolve(fixturesDir, "expected-html");
const updateMode = process.env.UPDATE_FIXTURES === "1";

/** Strip YAML frontmatter so remark-parse does not produce a thematicBreak. */
function stripFrontmatter(src: string): string {
  if (!src.startsWith("---\n")) return src;
  const end = src.indexOf("\n---\n", 4);
  if (end < 0) return src;
  return src.slice(end + 5);
}

/**
 * Attach fenced-code-block meta to mdast so it survives remark-rehype.
 * mdast-util-to-hast merges `node.data.hProperties` into the resulting
 * <code> element's properties — that is how rehypeCodeTitle finds the
 * `title="..."` substring at runtime in the live build.
 */
function remarkAttachCodeMeta() {
  return (tree: MdastRoot) => {
    visit(tree, "code", (node) => {
      if (!node.meta) return;
      const data = (node.data ??= {});
      data.hProperties = { ...(data.hProperties ?? {}), meta: node.meta };
    });
  };
}

/**
 * Mimic the two Shiki-set attributes the rehype plugins depend on:
 *   - <pre data-language="X">  (rehypeMermaid checks this)
 *   - <code meta="...">        (rehypeCodeTitle uses this — already
 *                               attached by remarkAttachCodeMeta, but
 *                               this normalises both sources).
 */
function rehypeShimShiki() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const codeEl = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!codeEl) return;
      const cls = codeEl.properties?.className;
      if (Array.isArray(cls)) {
        const langCls = cls.find(
          (c): c is string => typeof c === "string" && c.startsWith("language-"),
        );
        if (langCls) {
          node.properties = node.properties ?? {};
          node.properties.dataLanguage = langCls.replace(/^language-/, "");
        }
      }
    });
  };
}

function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkAdmonitions)
    .use(remarkMath)
    .use(remarkCjkFriendly)
    .use(remarkAttachCodeMeta)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeShimShiki)
    // Plugin order mirrors astro.config.ts: code-title → heading-links →
    // strip-md → image-enlarge → mermaid → katex.
    .use(rehypeCodeTitle)
    .use(rehypeHeadingLinks)
    .use(rehypeStripMdExtension)
    .use(rehypeImageEnlarge)
    .use(rehypeMermaid)
    .use(rehypeKatex)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

function listFixtures(): string[] {
  return readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".mdx"))
    .sort();
}

/**
 * Collapse runs of 2+ blank lines down to a single blank line. rehype-raw
 * leaves a number of whitespace-only text nodes around block-level
 * GFM tables; the rendered HTML is identical to a browser, but the
 * extra blank lines are noisy when humans diff the fixtures.
 */
function normaliseBlanks(html: string): string {
  return html.replace(/\n{2,}/g, "\n\n");
}

async function renderFixture(file: string): Promise<string> {
  const src = readFileSync(resolve(fixturesDir, file), "utf8");
  const body = stripFrontmatter(src);
  const out = await buildProcessor().process(body);
  return normaliseBlanks(String(out)).replace(/\s+$/, "") + "\n";
}

describe("md-plugins fixture corpus", () => {
  const fixtures = listFixtures();

  it("has 10–15 fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    expect(fixtures.length).toBeLessThanOrEqual(15);
  });

  for (const file of fixtures) {
    const name = basename(file, ".mdx");
    const expectedPath = resolve(expectedDir, `${name}.html`);

    it(`renders ${file}`, async () => {
      const html = await renderFixture(file);

      if (updateMode || !existsSync(expectedPath)) {
        writeFileSync(expectedPath, html, "utf8");
      }

      const expected = readFileSync(expectedPath, "utf8");
      expect(html).toBe(expected);
    });
  }
});
