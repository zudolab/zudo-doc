import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  emitChangelogs,
  generateChangelogMarkdown,
  loadChangelogEntries,
  sanitizeChangelogMarkdown,
} from "../index.js";

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-changelog-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeEntry(root: string, rel: string, body: string): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

describe("changelog integration", () => {
  it("loads changelog pages newest-first with stable semver/prerelease sorting", () => {
    const root = tempProject();
    writeEntry(root, "src/changelog/1.0.0.mdx", "---\ntitle: 1.0.0\n---\nReleased: 2025-01-01\n");
    writeEntry(root, "src/changelog/1.0.0-next.2.mdx", "---\ntitle: 1.0.0-next.2\n---\n");
    writeEntry(root, "src/changelog/1.0.0-next.10.mdx", "---\ntitle: 1.0.0-next.10\n---\n");
    writeEntry(root, "src/changelog/2.0.0.mdx", "---\ntitle: 2.0.0\n---\n");
    writeEntry(root, "src/changelog/index.mdx", "---\ntitle: Changelog\n---\n");

    const entries = loadChangelogEntries({ sourceDir: join(root, "src/changelog") });

    expect(entries.map((entry) => entry.version)).toEqual([
      "2.0.0",
      "1.0.0",
      "1.0.0-next.10",
      "1.0.0-next.2",
    ]);
    expect(entries[1]?.date).toBe("2025-01-01");
  });

  it("sanitizes MDX-only syntax while preserving useful markdown", () => {
    const sanitized = sanitizeChangelogMarkdown(`import Foo from "./foo";\nexport const x = 1;\n{/* hidden */}\n\n<Tip>\nHelpful **tip**.\n</Tip>\n\n:::warning\nCareful.\n:::\n\n<Foo value=\"x\" />\n\n### Added\n\n- \`thing\`\n`);

    expect(sanitized).toContain("> **Tip**");
    expect(sanitized).toContain("Helpful **tip**.");
    expect(sanitized).toContain("> **Warning**");
    expect(sanitized).toContain("### Added");
    expect(sanitized).toContain("- `thing`");
    expect(sanitized).not.toContain("import Foo");
    expect(sanitized).not.toContain("<Foo");
    expect(sanitized).not.toContain("{/*");
  });

  it("preserves import/export/JSX syntax inside fenced code blocks", () => {
    const sanitized = sanitizeChangelogMarkdown(
      [
        "Wrap the toggle so the scanner sees a local binding:",
        "",
        "```tsx",
        'import { ThemeToggle as PackageThemeToggle } from "@takazudo/zudo-doc/theme-toggle";',
        "",
        "export function ThemeToggle(props) {",
        "  return <PackageThemeToggle {...props} />;",
        "}",
        "```",
        "",
        "### Fixed",
        "",
        "- A bug.",
      ].join("\n"),
    );

    expect(sanitized).toContain(
      'import { ThemeToggle as PackageThemeToggle } from "@takazudo/zudo-doc/theme-toggle";',
    );
    expect(sanitized).toContain("export function ThemeToggle(props) {");
    expect(sanitized).toContain("return <PackageThemeToggle {...props} />;");
    expect(sanitized).toContain("### Fixed");
  });

  it("generates Keep a Changelog-style markdown with date headings", () => {
    const markdown = generateChangelogMarkdown(
      [
        {
          version: "1.2.3",
          date: "2026-07-07",
          content: "### Fixed\n\n- A bug.",
          sourcePath: "/tmp/1.2.3.mdx",
        },
      ],
      { packageName: "@takazudo/zudo-doc" },
    );

    expect(markdown).toContain("# Changelog");
    expect(markdown).toContain("`@takazudo/zudo-doc`");
    expect(markdown).toContain("## [1.2.3] - 2026-07-07");
    expect(markdown).toContain("### Fixed");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("emits configured changelog files deterministically", () => {
    const root = tempProject();
    writeEntry(root, "docs/changelog/0.1.0.mdx", "---\ntitle: 0.1.0\n---\nReleased: 2024-01-01\n\n### Added\n\n- First release.\n");

    const result = emitChangelogs({
      projectRoot: root,
      changelogs: [
        {
          sourceDir: "docs/changelog",
          outputFile: "packages/pkg/CHANGELOG.md",
          packageName: "pkg",
        },
      ],
    });

    expect(result.written).toEqual([join(root, "packages/pkg/CHANGELOG.md")]);
    const first = readFileSync(result.written[0]!, "utf-8");
    emitChangelogs({
      projectRoot: root,
      changelogs: [{ sourceDir: "docs/changelog", outputFile: "packages/pkg/CHANGELOG.md" }],
    });
    const second = readFileSync(result.written[0]!, "utf-8");
    expect(first).toContain("First release.");
    expect(second).toContain("First release.");
  });

  it("warns when a landing directory contains per-package changelogs", () => {
    const root = tempProject();
    writeEntry(root, "changelog/index.mdx", "---\ntitle: Changelog\n---\n");
    writeEntry(root, "changelog/pkg-a/1.0.0.mdx", "---\ntitle: 1.0.0\n---\n");
    writeEntry(root, "changelog/img/x.png", "not a changelog");

    const warnings: string[] = [];
    const logger = {
      info: () => undefined,
      warn: (message: string) => warnings.push(message),
    };
    const landingResult = emitChangelogs({
      projectRoot: root,
      changelogs: [{ sourceDir: "changelog", outputFile: "CHANGELOG.md" }],
      logger,
    });

    expect(readFileSync(landingResult.written[0]!, "utf-8")).toContain("# Changelog");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("changelog");
    expect(warnings[0]).toContain("pkg-a");
    expect(warnings[0]).not.toContain("img");

    emitChangelogs({
      projectRoot: root,
      changelogs: [{ sourceDir: "changelog/pkg-a", outputFile: "packages/pkg-a/CHANGELOG.md" }],
      logger,
    });
    expect(warnings).toHaveLength(1);
  });

  it("fails clearly when a configured source directory is missing", () => {
    const root = tempProject();

    expect(() =>
      emitChangelogs({
        projectRoot: root,
        changelogs: [{ sourceDir: "missing/changelog", outputFile: "CHANGELOG.md" }],
      }),
    ).toThrow(/ENOENT/);
  });
});

describe("changelog link rewrite", () => {
  it("computes dated, dateless, and prerelease anchors and rewrites same-directory links to them", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content:
          "- See [5.15.0](./5.15.0.mdx)\n- See [Unreleased](./unreleased.mdx)\n- See [prerelease](./0.2.0-next.5.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
      {
        version: "5.15.0",
        date: "2026-09-01",
        content: "Dated release.",
        sourcePath: "/tmp/5.15.0.mdx",
      },
      { version: "Unreleased", content: "Dateless release.", sourcePath: "/tmp/unreleased.mdx" },
      {
        version: "0.2.0-next.5",
        content: "Prerelease.",
        sourcePath: "/tmp/0.2.0-next.5.mdx",
      },
    ]);

    expect(markdown).toContain("## [5.15.0] - 2026-09-01");
    expect(markdown).toContain("[5.15.0](#5150---2026-09-01)");
    expect(markdown).toContain("## [Unreleased]");
    expect(markdown).toContain("[Unreleased](#unreleased)");
    expect(markdown).toContain("## [0.2.0-next.5]");
    expect(markdown).toContain("[prerelease](#020-next5)");
  });

  it("resolves a link by filename even when the target entry's title differs from its filename", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content: "[Actual File](./actual-file.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
      {
        version: "CustomTitle",
        date: "2026-01-01",
        content: "Body.",
        sourcePath: "/tmp/actual-file.mdx",
      },
    ]);

    expect(markdown).toContain("## [CustomTitle] - 2026-01-01");
    expect(markdown).toContain("[Actual File](#customtitle---2026-01-01)");
  });

  it("resolves ./foo.mdx and ./foo.md to their own entries when both are emitted", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content: "- [md link](./foo.md)\n- [mdx link](./foo.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
      { version: "FooMd", date: "2026-02-01", content: "md entry.", sourcePath: "/tmp/foo.md" },
      { version: "FooMdx", date: "2026-02-02", content: "mdx entry.", sourcePath: "/tmp/foo.mdx" },
    ]);

    expect(markdown).toContain("[md link](#foomd---2026-02-01)");
    expect(markdown).toContain("[mdx link](#foomdx---2026-02-02)");
  });

  it("unlinks unknown targets, parent-directory links, and index files", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content:
          "[Unknown](./nope.mdx)\n[Parent](../pkg/index.mdx)\n[Index](./index.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
    ]);

    expect(markdown).toContain("Unknown\nParent\nIndex");
    expect(markdown).not.toContain("](./nope.mdx)");
    expect(markdown).not.toContain("](../pkg/index.mdx)");
    expect(markdown).not.toContain("](./index.mdx)");
  });

  it("unlinks uppercase extensions instead of resolving filenames case-insensitively", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content: "[Uppercase](./5.15.0.MDX)\n[Lowercase](./5.15.0.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
      { version: "5.15.0", content: "", sourcePath: "/tmp/5.15.0.mdx" },
    ]);

    expect(markdown).toContain("Uppercase\n[Lowercase](#5150)");
    expect(markdown).not.toContain("./5.15.0.MDX");
  });

  it("leaves absolute, protocol-relative, root-absolute, fragment, image, non-md, and reference-style links byte-unchanged", () => {
    const lines = [
      "[Absolute](https://example.com/some.mdx)",
      "[ProtoRel](//example.com/some.mdx)",
      "[RootAbs](/docs/some.mdx)",
      "[Frag](#frag)",
      "![Image](./whatever.mdx)",
      "[Png](./pic.png)",
      "[Ref][refid]",
    ];
    const markdown = generateChangelogMarkdown([
      { version: "Referencer", content: lines.join("\n"), sourcePath: "/tmp/referencer.mdx" },
    ]);

    for (const line of lines) {
      expect(markdown).toContain(line);
    }
  });

  it("drops an original fragment and keeps a link title", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content:
          '- [FragTest](./5.15.0.mdx#bug-fixes)\n- [TitleTest](./5.15.0.mdx "cool title")',
        sourcePath: "/tmp/referencer.mdx",
      },
      {
        version: "5.15.0",
        date: "2026-09-01",
        content: "Dated release.",
        sourcePath: "/tmp/5.15.0.mdx",
      },
    ]);

    expect(markdown).toContain("[FragTest](#5150---2026-09-01)");
    expect(markdown).toContain('[TitleTest](#5150---2026-09-01 "cool title")');
  });

  it.each([
    "(cool title)",
    "()",
    "(keep \\(escaped\\) parens)",
    "(closing \\) paren)",
    "(opening \\( paren)",
  ])("preserves a parenthesized title verbatim when rewriting: %s", (title) => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content: `[Target](./5.15.0.mdx#fixes ${title})\n[Angle](<./5.15.0.mdx> ${title})`,
        sourcePath: "/tmp/referencer.mdx",
      },
      { version: "5.15.0", content: "", sourcePath: "/tmp/5.15.0.mdx" },
    ]);

    expect(markdown).toContain(`[Target](#5150 ${title})`);
    expect(markdown).toContain(`[Angle](#5150 ${title})`);
  });

  it("drops parenthesized titles when unlinking relative links to non-entries", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content:
          "[Unknown](./nope.mdx (unknown title))\n[Parent](../pkg/index.mdx (parent title))\n[Index](./index.mdx (index title))",
        sourcePath: "/tmp/referencer.mdx",
      },
    ]);

    expect(markdown).toContain("Unknown\nParent\nIndex");
    expect(markdown).not.toContain(" title)");
    expect(markdown).not.toContain(".mdx");
  });

  it.each([
    "[Target](./5.15.0.mdx (unclosed)",
    "[Target](./5.15.0.mdx (title) extra)",
    "[Target](./5.15.0.mdx (first) (second))",
    "[Target](./5.15.0.mdx (unbalanced (nested))",
    "[Target](./5.15.0.mdx (escaped close\\))",
  ])("leaves a malformed parenthesized title untouched: %s", (content) => {
    const markdown = generateChangelogMarkdown([
      { version: "Referencer", content, sourcePath: "/tmp/referencer.mdx" },
      { version: "5.15.0", content: "", sourcePath: "/tmp/5.15.0.mdx" },
    ]);

    expect(markdown).toContain(content);
  });

  it("does not rewrite link-shaped text inside fenced or inline code", () => {
    const content = [
      "Text before.",
      "",
      "```js",
      'const link = "[Foo](./5.15.0.mdx)";',
      "```",
      "",
      "````",
      "[Bar](./5.15.0.mdx) inside a 4-backtick fence",
      "````",
      "",
      "~~~",
      "[Baz](./5.15.0.mdx) inside a tilde fence",
      "~~~",
      "",
      "Inline: `[Qux](./5.15.0.mdx)` and ``[Quux](./5.15.0.mdx)`` should stay.",
    ].join("\n");

    const markdown = generateChangelogMarkdown([
      { version: "Referencer", content, sourcePath: "/tmp/referencer.mdx" },
      {
        version: "5.15.0",
        date: "2026-09-01",
        content: "Dated release.",
        sourcePath: "/tmp/5.15.0.mdx",
      },
    ]);

    expect(markdown).toContain('const link = "[Foo](./5.15.0.mdx)";');
    expect(markdown).toContain("[Bar](./5.15.0.mdx) inside a 4-backtick fence");
    expect(markdown).toContain("[Baz](./5.15.0.mdx) inside a tilde fence");
    expect(markdown).toContain(
      "Inline: `[Qux](./5.15.0.mdx)` and ``[Quux](./5.15.0.mdx)`` should stay.",
    );
  });

  it("preserves nested brackets and inline code in a link label", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Referencer",
        content: "[Label [nested] text](./nope.mdx)\n\n[`5.15.0`](./5.15.0.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
      {
        version: "5.15.0",
        date: "2026-09-01",
        content: "Dated release.",
        sourcePath: "/tmp/5.15.0.mdx",
      },
    ]);

    expect(markdown).toContain("Label [nested] text");
    expect(markdown).not.toContain("](./nope.mdx)");
    expect(markdown).toContain("[`5.15.0`](#5150---2026-09-01)");
  });

  it("de-duplicates identical headings and keeps distinct anchors for the same version at different dates", () => {
    const markdown = generateChangelogMarkdown([
      { version: "1.0.0", date: "2026-01-01", content: "First.", sourcePath: "/tmp/a.mdx" },
      { version: "1.0.0", date: "2026-01-01", content: "Second.", sourcePath: "/tmp/b.mdx" },
      { version: "1.0.0", date: "2026-02-01", content: "Third.", sourcePath: "/tmp/c.mdx" },
      {
        version: "Referencer",
        content: "[A](./a.mdx)\n[B](./b.mdx)\n[C](./c.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
    ]);

    expect(markdown).toContain("[A](#100---2026-01-01)");
    expect(markdown).toContain("[B](#100---2026-01-01-1)");
    expect(markdown).toContain("[C](#100---2026-02-01)");
  });

  it("lets an entry-body heading earlier in the document consume a slug a later version heading would otherwise use", () => {
    const markdown = generateChangelogMarkdown([
      {
        version: "Alpha",
        content: "### [Steal Me]\n\nBody text.",
        sourcePath: "/tmp/alpha.mdx",
      },
      { version: "Steal Me", content: "", sourcePath: "/tmp/steal-me.mdx" },
      {
        version: "Referencer",
        content: "[Link to B](./steal-me.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
    ]);

    expect(markdown).toContain("### [Steal Me]");
    expect(markdown).toContain("## [Steal Me]");
    expect(markdown).toContain("[Link to B](#steal-me-1)");
  });

  it.each(["=", "---", "   === \t", "   -\t "])(
    "counts setext and ATX headings before later duplicate version anchors: %j",
    (underline) => {
      const markdown = generateChangelogMarkdown([
        {
          version: "Alpha",
          content: [
            "### [Steal Me]",
            "",
            "  [Steal Me](https://example.com/release)  ",
            underline,
            "",
            "[Steal Me]",
            underline,
          ].join("\n"),
          sourcePath: "/tmp/alpha.mdx",
        },
        { version: "Steal Me", content: "", sourcePath: "/tmp/first.mdx" },
        { version: "Steal Me", content: "", sourcePath: "/tmp/second.mdx" },
        {
          version: "Referencer",
          content: "[First](./first.mdx)\n[Second](./second.mdx)",
          sourcePath: "/tmp/referencer.mdx",
        },
      ]);

      expect(markdown).toContain("[First](#steal-me-3)");
      expect(markdown).toContain("[Second](#steal-me-4)");
    },
  );

  it.each([
    { name: "blank line before a thematic break", content: "[Steal Me]\n\n---", version: "Steal Me", anchor: "steal-me" },
    { name: "whitespace before a thematic break", content: "[Steal Me]\n \t\n---", version: "Steal Me", anchor: "steal-me" },
    { name: "consecutive thematic breaks", content: "---\n---", version: "---", anchor: "---" },
    { name: "consumed setext underline", content: "Other\n---\n---", version: "---", anchor: "---" },
    { name: "ATX heading", content: "### [Steal Me]\n---", version: "Steal Me", anchor: "steal-me-1" },
    { name: "dash list item", content: "- [Steal Me]\n---", version: "--Steal Me", anchor: "--steal-me" },
    { name: "plus list item", content: "+ [Steal Me]\n---", version: " Steal Me", anchor: "-steal-me" },
    { name: "star list item", content: "* [Steal Me]\n---", version: " Steal Me", anchor: "-steal-me" },
    { name: "numbered list item", content: "1. [Steal Me]\n---", version: "1 Steal Me", anchor: "1-steal-me" },
    { name: "parenthesized list marker", content: "1) [Steal Me]\n---", version: "1 Steal Me", anchor: "1-steal-me" },
    { name: "blockquote", content: "> [Steal Me]\n---", version: " Steal Me", anchor: "-steal-me" },
    { name: "table row", content: "| [Steal Me] |\n---", version: " Steal Me ", anchor: "-steal-me-" },
    { name: "table row without outer pipes", content: "Steal | Me\n---", version: "Steal  Me", anchor: "steal--me" },
    { name: "star thematic break", content: "* * *\n---", version: "--", anchor: "--" },
    { name: "underscore thematic break", content: "___\n---", version: "___", anchor: "___" },
    { name: "indented code", content: "    [Steal Me]\n---", version: "Steal Me", anchor: "steal-me" },
    { name: "tab-indented code", content: "\t[Steal Me]\n---", version: "Steal Me", anchor: "steal-me" },
    { name: "indented underline", content: "[Steal Me]\n    ---", version: "Steal Me", anchor: "steal-me" },
    { name: "spaced underline", content: "[Steal Me]\n- - -", version: "Steal Me", anchor: "steal-me" },
    { name: "multiline paragraph", content: "Earlier line\n[Steal Me]\n---", version: "Steal Me", anchor: "steal-me" },
  ])("does not invent a setext slug from a $name", ({ content, version, anchor }) => {
    const markdown = generateChangelogMarkdown([
      { version: "Alpha", content, sourcePath: "/tmp/alpha.mdx" },
      { version, content: "", sourcePath: "/tmp/target.mdx" },
      {
        version: "Referencer",
        content: "[Target](./target.mdx)",
        sourcePath: "/tmp/referencer.mdx",
      },
    ]);

    expect(markdown).toContain(`[Target](#${anchor})`);
  });

  it.each(["```", "````", "~~~"])(
    "does not allocate setext slugs inside or across a %s fence",
    (fence) => {
      const markdown = generateChangelogMarkdown([
        {
          version: "Alpha",
          content: `[Steal Me]\n${fence}\n[Steal Me]\n---\n${fence}\n===`,
          sourcePath: "/tmp/alpha.mdx",
        },
        { version: "Steal Me", content: "", sourcePath: "/tmp/target.mdx" },
        {
          version: "Referencer",
          content: "[Target](./target.mdx)",
          sourcePath: "/tmp/referencer.mdx",
        },
      ]);

      expect(markdown).toContain("[Target](#steal-me)");
    },
  );
});
