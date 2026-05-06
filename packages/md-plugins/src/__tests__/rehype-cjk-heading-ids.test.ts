import { describe, it, expect } from "vitest";
import { unified } from "unified";
import rehypeStringify from "rehype-stringify";
import type { Root } from "hast";
import { rehypeCjkHeadingIds } from "../rehype-cjk-heading-ids";

function makeHeading(level: 2 | 3 | 4 | 5 | 6, text: string, id?: string): Root {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: `h${level}`,
        properties: id ? { id } : {},
        children: [{ type: "text", value: text }],
      },
    ],
  };
}

function process(tree: Root): string {
  const processor = unified().use(rehypeCjkHeadingIds).use(rehypeStringify);
  const transformed = processor.runSync(tree) as Root;
  return String(processor.stringify(transformed));
}

describe("rehypeCjkHeadingIds", () => {
  it("adds id with CJK code points to a Japanese h2", () => {
    const tree = makeHeading(2, "コンポーネント構文");
    const html = process(tree);
    expect(html).toContain('<h2 id="コンポーネント構文"');
  });

  it("adds id and hash-link anchor for English h2", () => {
    const tree = makeHeading(2, "Hello World");
    const html = process(tree);
    expect(html).toContain('<h2 id="hello-world"');
    expect(html).toContain('href="#hello-world"');
    expect(html).toContain('class="hash-link"');
    expect(html).toContain('aria-label="Direct link to Hello World"');
  });

  it("preserves an existing id and does NOT add a second one", () => {
    const tree = makeHeading(2, "Some Heading", "preset-id");
    const html = process(tree);
    expect(html).toContain('<h2 id="preset-id"');
    // No anchor appended when id is already set — the upstream Rust
    // pipeline handles the ASCII path.
    expect(html).not.toContain("hash-link");
  });

  it("handles h2-h6 but leaves h1 alone", () => {
    const root: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "h1",
          properties: {},
          children: [{ type: "text", value: "ページタイトル" }],
        },
        {
          type: "element",
          tagName: "h3",
          properties: {},
          children: [{ type: "text", value: "プロップ" }],
        },
      ],
    };
    const html = process(root);
    // h1 unchanged
    expect(html).toContain("<h1>ページタイトル</h1>");
    // h3 receives id
    expect(html).toContain('<h3 id="プロップ"');
  });

  it("dedupes repeated CJK headings with -1 / -2 suffixes", () => {
    const root: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "h2",
          properties: {},
          children: [{ type: "text", value: "概要" }],
        },
        {
          type: "element",
          tagName: "h2",
          properties: {},
          children: [{ type: "text", value: "概要" }],
        },
      ],
    };
    const html = process(root);
    expect(html).toContain('<h2 id="概要"');
    expect(html).toContain('<h2 id="概要-1"');
  });

  it("skips empty-text headings", () => {
    const root: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "h2",
          properties: {},
          children: [],
        },
      ],
    };
    const html = process(root);
    expect(html).toBe("<h2></h2>");
  });
});
