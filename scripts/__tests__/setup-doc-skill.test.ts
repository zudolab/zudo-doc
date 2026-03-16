import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT_PATH = resolve(__dirname, "../setup-doc-skill.sh");
const PROJECT_ROOT = resolve(__dirname, "../..");

/**
 * Run setup-doc-skill.sh in the real project directory with a custom
 * HOME so the global symlink goes to a temp directory instead of ~/.claude/skills/.
 * The skill name is piped via stdin to avoid interactive prompt.
 */
function runScript(skillName: string, fakeHome: string): string {
  return execSync(
    `echo "${skillName}" | bash "${SCRIPT_PATH}"`,
    {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: fakeHome,
      },
    },
  );
}

describe("setup-doc-skill.sh", () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), "zudo-doc-test-"));
  });

  afterEach(() => {
    // Clean up the project-scoped skill dir created by the script
    const skillDir = join(PROJECT_ROOT, ".claude", "skills", "test-wisdom");
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true });
    }
    // Clean up fake home
    if (existsSync(fakeHome)) {
      rmSync(fakeHome, { recursive: true });
    }
  });

  it("creates SKILL.md with correct frontmatter", () => {
    runScript("test-wisdom", fakeHome);

    const skillMd = readFileSync(
      join(PROJECT_ROOT, ".claude", "skills", "test-wisdom", "SKILL.md"),
      "utf-8",
    );

    expect(skillMd).toContain("name: test-wisdom");
    expect(skillMd).toContain("user-invocable: true");
    expect(skillMd).toContain("zudo-doc");
  });

  it("creates docs symlink pointing to src/content/docs", () => {
    runScript("test-wisdom", fakeHome);

    const docsLink = join(PROJECT_ROOT, ".claude", "skills", "test-wisdom", "docs");
    expect(existsSync(docsLink)).toBe(true);

    const target = realpathSync(docsLink);
    expect(target).toBe(join(PROJECT_ROOT, "src", "content", "docs"));
  });

  it("creates docs-ja symlink when Japanese docs exist", () => {
    runScript("test-wisdom", fakeHome);

    const docsJaLink = join(PROJECT_ROOT, ".claude", "skills", "test-wisdom", "docs-ja");
    expect(existsSync(docsJaLink)).toBe(true);

    const target = realpathSync(docsJaLink);
    expect(target).toBe(join(PROJECT_ROOT, "src", "content", "docs-ja"));
  });

  it("creates global symlink in HOME/.claude/skills/", () => {
    runScript("test-wisdom", fakeHome);

    const globalLink = join(fakeHome, ".claude", "skills", "test-wisdom");
    expect(existsSync(globalLink)).toBe(true);
  });

  it("includes doc category tree in SKILL.md", () => {
    runScript("test-wisdom", fakeHome);

    const skillMd = readFileSync(
      join(PROJECT_ROOT, ".claude", "skills", "test-wisdom", "SKILL.md"),
      "utf-8",
    );

    // Should list actual doc categories from src/content/docs/
    expect(skillMd).toContain("- getting-started/");
    expect(skillMd).toContain("- guides/");
    expect(skillMd).toContain("- reference/");
    expect(skillMd).toContain("- components/");
  });

  it("includes Japanese documentation section", () => {
    runScript("test-wisdom", fakeHome);

    const skillMd = readFileSync(
      join(PROJECT_ROOT, ".claude", "skills", "test-wisdom", "SKILL.md"),
      "utf-8",
    );

    expect(skillMd).toContain("Japanese Documentation");
    expect(skillMd).toContain("docs-ja");
  });
});
