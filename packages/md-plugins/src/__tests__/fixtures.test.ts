/**
 * Fixture corpus driver — captures reference HTML produced by the current
 * JS md-plugins pipeline so the upcoming Rust (zfb) port can be diffed
 * against it.
 *
 * After zfb #104, the four "shape" rehype plugins (heading-links, code-title,
 * mermaid, image-enlarge) reached byte-for-byte parity with their Rust ports
 * and were retired. The remaining JS-side coverage in this fixture corpus is
 * for behaviour that is either still on the JS side or not yet covered by zfb
 * (admonitions, math, CJK emphasis, GFM tables/strikethrough, blockquotes,
 * markdown-link rewriting incl. the .md → / cleanup).
 *
 * Pipeline composition mirrors zfb.config.ts as closely as possible without
 * booting zfb itself. Notable differences from the live site (documented in
 * AUDIT.md):
 *
 *   - Shiki is not run; the captured HTML therefore does not include
 *     syntax-highlighted spans.
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

import { remarkAdmonitions } from "../remark-admonitions";
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

function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkAdmonitions)
    .use(remarkMath)
    .use(remarkCjkFriendly)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    // Plugin order mirrors zfb.config.ts: only strip-md and katex remain on
    // the JS side post zfb #104. The four "shape" rehype plugins (code-title,
    // heading-links, image-enlarge, mermaid) ship natively from the zfb Rust
    // pipeline now.
    .use(rehypeStripMdExtension)
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

  it("has 8–12 fixtures", () => {
    // After zfb #104 retired heading-links/code-title/mermaid/image-enlarge,
    // their dedicated fixtures (02/05/06/07) were dropped. The corpus now
    // covers admonitions, math, CJK, GFM tables/strikethrough, blockquotes,
    // and md-link rewriting only.
    expect(fixtures.length).toBeGreaterThanOrEqual(8);
    expect(fixtures.length).toBeLessThanOrEqual(12);
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
