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
