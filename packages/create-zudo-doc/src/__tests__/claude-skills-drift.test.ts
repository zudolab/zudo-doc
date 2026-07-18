// Monorepo-side drift guard (#2921): the 3 user-facing zudo-doc-* skills
// ship to consumers as committed mirrors under templates/features/claudeSkills/
// (npm `files` cannot reach outside the package dir, so scaffold.ts can no
// longer read the monorepo's root .claude/skills/ at generate time — see
// scaffold.ts's claudeSkills copy step). This test is the only thing keeping
// those two copies in sync; nothing else re-derives the template copy from
// the source of truth.
//
// Compares content AFTER running it through @takazudo/mdx-formatter, not
// raw bytes: lefthook's pre-commit hook formats staged *.md files, so a
// same-commit copy of an unformatted source would otherwise fail this test
// on the very commit that adds it. Both sides are formatted in the same
// temp dir with a single `pnpm dlx` invocation to keep this fast-tier-sized.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "../..");
const MONOREPO_ROOT = path.resolve(PKG_ROOT, "../..");

const SKILLS = [
  "zudo-doc-design-system",
  "zudo-doc-translate",
  "zudo-doc-version-bump",
];

function sourcePath(skill: string): string {
  return path.join(MONOREPO_ROOT, ".claude/skills", skill, "SKILL.md");
}

function templatePath(skill: string): string {
  return path.join(
    PKG_ROOT,
    "templates/features/claudeSkills/files/.claude/skills",
    skill,
    "SKILL.md",
  );
}

describe("claudeSkills template copies match their .claude/skills/ source (#2921)", () => {
  let formatted: Record<string, { source: string; template: string }>;

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "claude-skills-drift-"),
    );
    try {
      const files: { skill: string; side: "source" | "template"; tempFile: string }[] = [];
      for (const skill of SKILLS) {
        for (const side of ["source", "template"] as const) {
          const src = side === "source" ? sourcePath(skill) : templatePath(skill);
          const tempFile = path.join(tempDir, `${skill}-${side}.md`);
          await fs.copy(src, tempFile);
          files.push({ skill, side, tempFile });
        }
      }

      execFileSync(
        "pnpm",
        ["dlx", "@takazudo/mdx-formatter", "--write", ...files.map((f) => f.tempFile)],
        { cwd: tempDir, encoding: "utf8" },
      );

      formatted = {};
      for (const { skill, side, tempFile } of files) {
        formatted[skill] ??= { source: "", template: "" };
        formatted[skill]![side] = await fs.readFile(tempFile, "utf8");
      }
    } finally {
      await fs.remove(tempDir);
    }
  }, 60_000);

  it.each(SKILLS)("%s template matches its monorepo source", (skill) => {
    expect(formatted[skill]!.template).toBe(formatted[skill]!.source);
  });
});
