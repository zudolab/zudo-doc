import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exists, frontmatter, listTree, makeProject, read, run, write } from "./helpers.js";

const docsOf = (root: string) => path.join(root, "src/content/docs");

describe("custom sources", () => {
  it("bakes a sibling directory and a ~/ home source with mapping defaults", () => {
    const project = makeProject();
    write(path.join(project.root, "..", "handbook", "README.md"), "# Handbook\n\nSee [setup](guides/setup.md#install).\n");
    write(path.join(project.root, "..", "handbook", "guides", "setup.md"), "---\ntitle: Setup\n---\n\nBack [home](../README.md).\n");
    write(path.join(project.home, "notes", "daily.md"), "# Daily\n");
    const result = run(project, {
      sources: [
        {
          id: "handbook",
          title: "Handbook",
          mappings: [{ id: "all", root: "../handbook", include: ["**/*.md"], format: "markdown" }],
        },
        {
          id: "notes",
          title: "Notes",
          mount: "my-notes",
          mappings: [{ id: "notes", root: "~/notes", include: ["*.md"], to: "journal", format: "markdown" }],
        },
      ],
    });
    const docs = docsOf(project.root);
    expect(listTree(path.join(docs, "handbook"))).toEqual(["guides/index.mdx", "guides/setup.mdx", "index.mdx"]);
    // The README owns the mount landing: no synthesized index replaces it.
    expect(frontmatter(path.join(docs, "handbook/index.mdx")).title).toBe("Handbook");
    expect(read(path.join(docs, "handbook/index.mdx"))).toContain("[setup](./guides/setup.mdx#install)");
    expect(read(path.join(docs, "handbook/guides/setup.mdx"))).toContain("[home](../index.mdx)");
    expect(listTree(path.join(docs, "my-notes"))).toEqual(["index.mdx", "journal/daily.mdx", "journal/index.mdx"]);
    expect(frontmatter(path.join(docs, "my-notes/journal/index.mdx")).title).toBe("journal");
    expect(result.diagnostics.filter((d) => d.level === "warn")).toEqual([]);
  });

  it("demonstrates a Grok-style layout through a custom mapping", () => {
    // Synthetic fixture only; this is not a verified Grok configuration layout.
    const project = makeProject();
    write(path.join(project.root, ".grok", "GROK.md"), "# Grok rules\n\nUse [the prompt](prompts/review.md).\n");
    write(path.join(project.root, ".grok", "prompts", "review.md"), "---\ndescription: Review prompt\n---\n\nReview.\n");
    write(path.join(project.root, ".grok", "settings.json"), '{ "model": "grok" }\n');
    run(project, {
      sources: [
        {
          id: "grok",
          title: "Grok",
          mappings: [
            { id: "rules", root: ".grok", include: ["GROK.md", "prompts/**/*.md"], to: "rules", format: "markdown" },
            { id: "settings", root: ".grok", include: ["*.json"], to: "settings", format: "code" },
          ],
        },
      ],
    });
    const docs = docsOf(project.root);
    expect(listTree(path.join(docs, "grok"))).toEqual([
      "index.mdx",
      "rules/grok.mdx",
      "rules/index.mdx",
      "rules/prompts/index.mdx",
      "rules/prompts/review.mdx",
      "settings/index.mdx",
      "settings/settings-json.mdx",
    ]);
    expect(read(path.join(docs, "grok/rules/grok.mdx"))).toContain("[the prompt](./prompts/review.mdx)");
    expect(read(path.join(docs, "grok/settings/settings-json.mdx"))).toContain("```json");
    expect(frontmatter(path.join(docs, "grok/rules/prompts/review.mdx")).description).toBe("Review prompt");
  });

  it("rewrites links against the whole plan and leaves code and unmapped targets readable", () => {
    const project = makeProject();
    const src = path.join(project.root, "kb");
    write(path.join(src, "my notes", "a file.md"), "# Spaced\n");
    write(path.join(src, "img", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    write(path.join(src, "other.md"), "# Other\n");
    write(
      path.join(src, "index.md"),
      [
        "# KB",
        "",
        "[spaced](my%20notes/a%20file.md?x=1#top)",
        "[angle](<my notes/a file.md>)",
        "![logo](img/logo.png)",
        "![wrapped",
        "logo](img/logo.png)",
        "[ref link][other]",
        "[missing](nowhere.md)",
        "[external](https://example.com/a.md)",
        "[anchor](#local)",
        "",
        "`[inline](other.md)`",
        "",
        "```md",
        "[fenced](other.md)",
        "```",
        "",
        '<a href="other.md">html</a>',
        "",
        "[other]: other.md#part",
        "",
      ].join("\n"),
    );
    const result = run(project, {
      sources: [
        {
          id: "kb",
          title: "KB",
          mappings: [
            {
              id: "pages",
              root: "kb",
              include: ["**/*.md"],
              format: "markdown",
              assets: { include: ["img/**"] },
            },
          ],
        },
      ],
    });
    const docs = docsOf(project.root);
    const body = read(path.join(docs, "kb/index.mdx"));
    expect(body).toContain("[spaced](./my-notes/a-file.mdx?x=1#top)");
    expect(body).toContain("[angle](./my-notes/a-file.mdx)");
    expect(body).toContain("![logo](/doc-sources/kb/img/logo.png)");
    expect(body).toContain("![wrapped\nlogo](/doc-sources/kb/img/logo.png)");
    expect(body).toContain("[other]: ./other.mdx#part");
    expect(body).toContain("https://example.com/a.md");
    expect(body).toContain("[anchor](#local)");
    expect(body).toContain("`[inline](other.md)`");
    expect(body).toContain("[fenced](other.md)");
    expect(body).toContain('href="./other.mdx"');
    expect(body).not.toContain("](nowhere.md)");
    expect(body).toContain("missing");
    expect(read(path.join(project.root, "public/doc-sources/kb/img/logo.png"))).toBeTruthy();
    expect(result.assets).toBe(1);
    const warns = result.diagnostics.filter((d) => d.level === "warn").map((d) => d.message);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain("nowhere.md");
  });

  it.each(["LF", "CRLF"])("rewrites wrapped inline link labels with %s line endings", (lineEnding) => {
    const project = makeProject();
    const src = path.join(project.root, "kb");
    write(path.join(src, "target.md"), "# Target\n");
    write(path.join(src, "index.md"), [
      "# KB", "",
      '[single line](target.md?x=1#details "Title")',
      '[wrapped [nested',
      'label]](target.md?x=1#details "Title")',
      "[missing", "page](unpublished.md)", "",
      "[literal `code", "span`](target.md)", "",
      "`[wrapped", "literal](target.md)`", "",
      "~~~md", "[wrapped", "fenced](target.md)", "~~~", "",
      "- Nested", "  - list", "", "    ~~~md", "    [wrapped", "    nested fence](target.md)", "    ~~~", "",
      "> ~~~md", ">[wrapped", "> quoted fence](target.md)", ">~~~", "",
      "[this is a different paragraph", " \t", "not a link](unmatched.md)", "",
      "[before `code", "", "after`](unmatched.md)", "",
      "[before a heading", "## not a link](unmatched.md)", "",
      "[before a list", "- not a link](unmatched.md)", "",
      "[before a fence", "~~~md", "literal", "~~~", "not a link](unmatched.md)", "",
      "> [before quote gap", ">", "> not a link](unmatched.md)", "",
      "> [before quote heading", "> ## not a link](unmatched.md)", "",
      "[before quote", "> not a link](unmatched.md)", "",
      "[before setext", "=", "not a link](unmatched.md)", "",
      "1. [before the next item", "2. not a link](unmatched.md)", "",
      "[before [inner](target.md)", "not an outer link](unmatched.md)", "",
      "\\[escaped opening", "not a link](unmatched.md)", "",
      "[escaped \\] inside", "label](target.md)", "",
      "\\![escaped bang", "label](target.md)", "",
      "> [quoted and", "> wrapped](target.md)", "",
      "[adjacent]", "[actual", "link](target.md)", "",
      "[external", "link](https://example.com/target.md)",
      "[site", "relative](/docs/target.md)",
      "[local", "anchor](#details)",
      "", "- ~~~md", "  [literal](target.md)", "", "Outside the list [target](target.md).",
    ].join(lineEnding === "LF" ? "\n" : "\r\n"));

    const result = run(project, {
      sources: [{
        id: "kb",
        title: "KB",
        mappings: [{ id: "pages", root: "kb", include: ["*.md"], format: "markdown" }],
      }],
    });

    const body = read(path.join(docsOf(project.root), "kb/index.mdx")).replaceAll("\r\n", "\n");
    expect(body).toContain('[single line](./target.mdx?x=1#details "Title")');
    expect(body).toContain('[wrapped [nested\nlabel]](./target.mdx?x=1#details "Title")');
    expect(body).toContain("missing\npage (`unpublished.md`)");
    expect(body).toContain("[literal `code\nspan`](./target.mdx)");
    expect(body).toContain("`[wrapped\nliteral](target.md)`");
    expect(body).toContain("~~~md\n[wrapped\nfenced](target.md)\n~~~");
    expect(body).toContain("    ~~~md\n    [wrapped\n    nested fence](target.md)\n    ~~~");
    expect(body).toContain("> ~~~md\n>[wrapped\n> quoted fence](target.md)\n>~~~");
    expect(body).toMatch(/\[this is a different paragraph\n[ \t]*\nnot a link\]\(unmatched\.md\)/);
    expect(body).toContain("[before `code\n\nafter`](unmatched.md)");
    expect(body).toContain("[before a heading\n## not a link](unmatched.md)");
    expect(body).toContain("[before a list\n- not a link](unmatched.md)");
    expect(body).toContain("[before a fence\n~~~md\nliteral\n~~~\nnot a link](unmatched.md)");
    expect(body).toContain("> [before quote gap\n>\n> not a link](unmatched.md)");
    expect(body).toContain("> [before quote heading\n> ## not a link](unmatched.md)");
    expect(body).toContain("[before quote\n> not a link](unmatched.md)");
    expect(body).toContain("[before setext\n=\nnot a link](unmatched.md)");
    expect(body).toContain("1. [before the next item\n2. not a link](unmatched.md)");
    expect(body).toContain("[before [inner](./target.mdx)\nnot an outer link](unmatched.md)");
    expect(body).toContain("\\[escaped opening\nnot a link](unmatched.md)");
    expect(body).toContain("[escaped \\] inside\nlabel](./target.mdx)");
    expect(body).toContain("\\![escaped bang\nlabel](./target.mdx)");
    expect(body).toContain("> [quoted and\n> wrapped](./target.mdx)");
    expect(body).toContain("[adjacent]\n[actual\nlink](./target.mdx)");
    expect(body).toContain("[external\nlink](https://example.com/target.md)");
    expect(body).toContain("[site\nrelative](/docs/target.md)");
    expect(body).toContain("[local\nanchor](#details)");
    expect(body).toContain("- ~~~md\n  [literal](target.md)\n\nOutside the list [target](./target.mdx).");
    expect(result.diagnostics.filter((d) => d.level === "warn").map((d) => d.message)).toEqual([
      'source "kb" mapping "pages" file "index.md": unpublished link target(s) kept as text: unpublished.md',
    ]);
  });

  it("reports route collisions without writing anything", () => {
    const project = makeProject();
    write(path.join(project.root, "a", "intro.md"), "# A\n");
    write(path.join(project.root, "b", "Intro.md"), "# B\n");
    expect(() =>
      run(project, {
        sources: [
          {
            id: "dup",
            title: "Dup",
            mappings: [
              { id: "a", root: "a", include: ["*.md"], format: "markdown" },
              { id: "b", root: "b", include: ["*.md"], format: "markdown" },
            ],
          },
        ],
      }),
    ).toThrow(/route collision/);
    expect(listTree(docsOf(project.root))).toEqual([]);
  });

  it("errors on a missing root unless the mapping skips it", () => {
    const project = makeProject();
    const config = (missing: "error" | "skip") => ({
      sources: [
        {
          id: "opt",
          title: "Optional",
          mappings: [{ id: "m", root: "absent", include: ["**/*.md"], format: "markdown" as const, missing }],
        },
      ],
    });
    expect(() => run(project, config("error"))).toThrow(/absent/);
    const result = run(project, config("skip"));
    expect(result.documents).toBe(0);
    expect(listTree(docsOf(project.root))).toEqual([]);
  });

  it("emits localized indexes, keeps details in the default locale and respects prefixes", () => {
    const project = makeProject();
    fs.mkdirSync(path.join(project.root, "src/content/docs-ja"), { recursive: true });
    write(path.join(project.root, "kb", "topic", "page.md"), "# Page\n");
    const sources = [
      {
        id: "kb",
        title: "KB",
        mappings: [{ id: "m", root: "kb", include: ["**/*.md"], to: "guide", format: "markdown" as const }],
      },
    ];
    run(project, {
      sources,
      locales: { ja: { dir: "src/content/docs-ja" } },
      translations: { ja: { "custom.guide": "ガイド" } },
    });
    expect(listTree(path.join(project.root, "src/content/docs-ja/kb"))).toEqual([
      "guide/index.mdx",
      "guide/topic/index.mdx",
      "index.mdx",
    ]);
    expect(exists(path.join(project.root, "src/content/docs/kb/guide/topic/page.mdx"))).toBe(true);

    run(project, {
      sources,
      locales: { ja: { dir: "src/content/docs-ja" } },
      defaultLocaleOnlyPrefixes: ["/docs/kb/guide/"],
    });
    expect(listTree(path.join(project.root, "src/content/docs-ja/kb"))).toEqual(["index.mdx"]);
  });
});
