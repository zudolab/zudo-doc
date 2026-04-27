import { describe, it, expect } from "vitest";
import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { mdxjs } from "micromark-extension-mdxjs";
import { remarkExcerpt } from "../remark-excerpt";

interface AstroVFile {
  data: {
    astro?: {
      frontmatter?: Record<string, unknown>;
    };
  };
}

function parse(md: string): Root {
  return fromMarkdown(md) as Root;
}

function parseMdx(md: string): Root {
  return fromMarkdown(md, {
    extensions: [mdxjs()],
    mdastExtensions: [mdxFromMarkdown()],
  }) as Root;
}

function makeFile(frontmatter: Record<string, unknown> = {}): AstroVFile {
  return { data: { astro: { frontmatter } } };
}

function run(tree: Root, file: AstroVFile = makeFile()): AstroVFile {
  const plugin = remarkExcerpt();
  plugin(tree, file as never);
  return file;
}

describe("remarkExcerpt", () => {
  it("splits at <!-- more --> and renders the excerpt as HTML", () => {
    const tree = parse(
      [
        "First paragraph with **bold** text.",
        "",
        "<!-- more -->",
        "",
        "Second paragraph after the marker.",
      ].join("\n"),
    );
    const file = run(tree);

    const fm = file.data.astro!.frontmatter!;
    expect(fm.hasMore).toBe(true);
    expect(fm.excerpt).toBe(
      "<p>First paragraph with <strong>bold</strong> text.</p>",
    );

    // Marker is stripped; only the two paragraphs remain.
    expect(tree.children).toHaveLength(2);
    expect(tree.children.every((n) => n.type === "paragraph")).toBe(true);
  });

  it("is a no-op when the marker is absent", () => {
    const tree = parse("Just a regular paragraph.\n\nAnother one.\n");
    const original = JSON.parse(JSON.stringify(tree));
    const file = run(tree);

    expect(file.data.astro!.frontmatter).toEqual({});
    expect(tree).toEqual(original);
  });

  it("does NOT split when the marker is inside a fenced code block", () => {
    const tree = parse(
      [
        "Intro paragraph.",
        "",
        "```html",
        "<!-- more -->",
        "```",
        "",
        "Trailing paragraph.",
      ].join("\n"),
    );
    const file = run(tree);

    expect(file.data.astro!.frontmatter).toEqual({});
    // No node was removed.
    expect(tree.children).toHaveLength(3);
    expect(tree.children[1].type).toBe("code");
  });

  it("splits when the marker is its own HTML block", () => {
    // Just the bare comment as a top-level HTML block.
    const tree = parse("Lead.\n\n<!-- more -->\n\nMore body.\n");
    const file = run(tree);

    const fm = file.data.astro!.frontmatter!;
    expect(fm.hasMore).toBe(true);
    expect(fm.excerpt).toBe("<p>Lead.</p>");
    expect(tree.children).toHaveLength(2);
  });

  it("tolerates whitespace inside and around the comment", () => {
    const tree = parse(
      "Lead.\n\n<!--   more   -->\n\nAfter.\n",
    );
    const file = run(tree);

    expect(file.data.astro!.frontmatter!.hasMore).toBe(true);
    expect(file.data.astro!.frontmatter!.excerpt).toBe("<p>Lead.</p>");
  });

  it("preserves a manual frontmatter excerpt (does not overwrite)", () => {
    const tree = parse("Lead body.\n\n<!-- more -->\n\nMore body.\n");
    const file = run(tree, makeFile({ excerpt: "Hand-written summary." }));

    const fm = file.data.astro!.frontmatter!;
    expect(fm.excerpt).toBe("Hand-written summary.");
    // hasMore is still set so a "Continue reading" link can render.
    expect(fm.hasMore).toBe(true);
  });

  it("treats an empty manual excerpt as missing and fills it", () => {
    const tree = parse("Lead body.\n\n<!-- more -->\n\nMore body.\n");
    const file = run(tree, makeFile({ excerpt: "" }));

    expect(file.data.astro!.frontmatter!.excerpt).toBe("<p>Lead body.</p>");
  });

  it("handles MDX component nodes inside the excerpt portion", () => {
    // Build a tree with a real MDX JSX flow element (parsed via mdxjs) plus
    // a top-level html marker injected manually. The MDX parser does not
    // accept `<!-- ... -->`, but the plugin operates on the mdast and must
    // tolerate MDX nodes when rendering the excerpt to HTML.
    const mdxLead = parseMdx(
      ["Lead paragraph.", "", "<MyWidget foo=\"bar\" />"].join("\n"),
    );
    const tail = parse("Detail body.\n");
    const tree: Root = {
      type: "root",
      children: [
        ...mdxLead.children,
        { type: "html", value: "<!-- more -->" },
        ...tail.children,
      ],
    };

    const file = run(tree);
    const fm = file.data.astro!.frontmatter!;
    expect(fm.hasMore).toBe(true);
    expect(typeof fm.excerpt).toBe("string");
    // The lead paragraph's text should appear in the rendered excerpt.
    expect(fm.excerpt as string).toContain("Lead paragraph.");
  });

  it("does not pass through raw HTML literals into the rendered excerpt (XSS hardening)", () => {
    // The rendered excerpt feeds straight into <BlogPostCard set:html=...>;
    // raw mdast html nodes from the body must not survive to the output.
    const tree = parse(
      [
        "Lead paragraph.",
        "",
        "<script>alert(1)</script>",
        "",
        "<!-- more -->",
        "",
        "Body.",
      ].join("\n"),
    );
    const file = run(tree);
    const excerpt = file.data.astro!.frontmatter!.excerpt as string;
    expect(excerpt).toContain("Lead paragraph.");
    // The literal <script> must NOT appear as raw HTML in the rendered
    // string — `allowDangerousHtml` is intentionally off in remark-excerpt.
    expect(excerpt).not.toContain("<script>");
    expect(excerpt).not.toContain("</script>");
  });

  it("only matches the first marker; subsequent markers stay in body", () => {
    const tree = parse(
      [
        "Lead.",
        "",
        "<!-- more -->",
        "",
        "Middle.",
        "",
        "<!-- more -->",
        "",
        "Tail.",
      ].join("\n"),
    );
    const file = run(tree);

    expect(file.data.astro!.frontmatter!.excerpt).toBe("<p>Lead.</p>");
    // First marker stripped; second one remains as html node.
    const htmlNodes = tree.children.filter((n) => n.type === "html");
    expect(htmlNodes).toHaveLength(1);
  });
});
