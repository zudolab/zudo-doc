import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT_PATH = resolve(__dirname, "../setup-doc-skill.sh");
const PROJECT_ROOT = resolve(__dirname, "../..");
const TEST_SKILL_NAME = "test-wisdom";

// The script uses `git worktree list | head -1` to get the main worktree path
// so that symlinks survive worktree removal. In a worktree session this differs
// from PROJECT_ROOT; in the main repo they are identical.
// Module-level eval runs before vitest's per-test timeout applies, so this
// needs its own explicit child-level timeout (#2563).
const MAIN_WORKTREE_ROOT = execSync(
  "git worktree list | head -1 | awk '{print $1}'",
  { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 30_000 },
).trim();

/**
 * Run setup-doc-skill.sh in the real project directory with a custom
 * HOME so the global symlink goes to a temp directory instead of ~/.claude/skills/.
 * The skill name is passed as the first CLI arg — the script is non-interactive
 * (deterministic name) since #2173, so it no longer reads the name from stdin.
 */
function runScript(skillName: string, fakeHome: string, args: string[] = []): string {
  const quotedArgs = args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(" ");
  return execSync(
    `bash "${SCRIPT_PATH}" ${quotedArgs} "${skillName}"`,
    {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 30_000,
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
    for (const agentDir of [".claude", ".codex"]) {
      const skillDir = join(PROJECT_ROOT, agentDir, "skills", TEST_SKILL_NAME);
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true });
      }
    }
    if (existsSync(fakeHome)) {
      rmSync(fakeHome, { recursive: true });
    }
  });

  it("creates SKILL.md with correct frontmatter", () => {
    runScript(TEST_SKILL_NAME, fakeHome);

    const skillMd = readFileSync(
      join(PROJECT_ROOT, ".claude", "skills", TEST_SKILL_NAME, "SKILL.md"),
      "utf-8",
    );

    expect(skillMd).toContain("name: test-wisdom");
    expect(skillMd).toContain("user-invocable: true");
    expect(skillMd).toContain("zudo-doc");
  });

  it("creates docs symlink pointing to src/content/docs", () => {
    runScript(TEST_SKILL_NAME, fakeHome);

    const docsLink = join(PROJECT_ROOT, ".claude", "skills", TEST_SKILL_NAME, "docs");
    expect(existsSync(docsLink)).toBe(true);

    const target = realpathSync(docsLink);
    // The script points at the main worktree so symlinks survive worktree removal.
    // MAIN_WORKTREE_ROOT == PROJECT_ROOT in the primary checkout; they differ in a worktree.
    expect(target).toBe(join(MAIN_WORKTREE_ROOT, "src", "content", "docs"));
  });

  it("creates docs-ja symlink when Japanese docs exist", () => {
    runScript(TEST_SKILL_NAME, fakeHome);

    const docsJaLink = join(PROJECT_ROOT, ".claude", "skills", TEST_SKILL_NAME, "docs-ja");
    expect(existsSync(docsJaLink)).toBe(true);

    const target = realpathSync(docsJaLink);
    // Same main-worktree logic as the docs symlink above.
    expect(target).toBe(join(MAIN_WORKTREE_ROOT, "src", "content", "docs-ja"));
  });

  it("creates global symlink in HOME/.claude/skills/ pointing to project skill", () => {
    runScript(TEST_SKILL_NAME, fakeHome);

    const globalLink = join(fakeHome, ".claude", "skills", TEST_SKILL_NAME);
    expect(existsSync(globalLink)).toBe(true);

    const target = realpathSync(globalLink);
    const projectSkill = join(PROJECT_ROOT, ".claude", "skills", TEST_SKILL_NAME);
    expect(target).toBe(realpathSync(projectSkill));
  });

  it("auto-selects Codex when HOME has .codex but no .claude", () => {
    execSync(`mkdir -p "${join(fakeHome, ".codex")}"`);

    const output = runScript(TEST_SKILL_NAME, fakeHome);

    expect(output).toContain("Target: auto -> codex");
    const globalLink = join(fakeHome, ".codex", "skills", TEST_SKILL_NAME);
    expect(existsSync(globalLink)).toBe(true);
    expect(
      existsSync(join(fakeHome, ".claude", "skills", TEST_SKILL_NAME)),
    ).toBe(false);

    const target = realpathSync(globalLink);
    const projectSkill = join(PROJECT_ROOT, ".codex", "skills", TEST_SKILL_NAME);
    expect(target).toBe(realpathSync(projectSkill));
  });

  it("auto-selects both when HOME has both agent directories", () => {
    execSync(`mkdir -p "${join(fakeHome, ".claude")}" "${join(fakeHome, ".codex")}"`);

    const output = runScript(TEST_SKILL_NAME, fakeHome);

    expect(output).toContain("Target: auto -> claude codex");
    expect(
      existsSync(join(fakeHome, ".claude", "skills", TEST_SKILL_NAME)),
    ).toBe(true);
    expect(
      existsSync(join(fakeHome, ".codex", "skills", TEST_SKILL_NAME)),
    ).toBe(true);
  });

  it("creates both Claude and Codex symlinks when explicitly requested", () => {
    const output = runScript(TEST_SKILL_NAME, fakeHome, ["--target", "both"]);

    expect(output).toContain("Target: both -> claude codex");
    for (const agentDir of [".claude", ".codex"]) {
      const globalLink = join(fakeHome, agentDir, "skills", TEST_SKILL_NAME);
      expect(existsSync(globalLink)).toBe(true);
      expect(realpathSync(globalLink)).toBe(
        realpathSync(join(PROJECT_ROOT, agentDir, "skills", TEST_SKILL_NAME)),
      );
    }
  });

  it("includes doc category tree in SKILL.md", () => {
    runScript(TEST_SKILL_NAME, fakeHome);

    const skillMd = readFileSync(
      join(PROJECT_ROOT, ".claude", "skills", TEST_SKILL_NAME, "SKILL.md"),
      "utf-8",
    );

    expect(skillMd).toContain("- getting-started/");
    expect(skillMd).toContain("- guides/");
    expect(skillMd).toContain("- reference/");
    expect(skillMd).toContain("- components/");
  });

  it("includes Japanese documentation section", () => {
    runScript(TEST_SKILL_NAME, fakeHome);

    const skillMd = readFileSync(
      join(PROJECT_ROOT, ".claude", "skills", TEST_SKILL_NAME, "SKILL.md"),
      "utf-8",
    );

    expect(skillMd).toContain("Japanese Documentation");
    expect(skillMd).toContain("docs-ja");
  });

  it("accepts the --silent flag without treating it as the skill name", () => {
    // Scaffolded sites expose `setup:doc-skill-silent` =
    // `bash scripts/setup-doc-skill.sh --silent`. The flag must be consumed,
    // never mistaken for the positional skill-name override.
    execSync(`bash "${SCRIPT_PATH}" --silent "${TEST_SKILL_NAME}"`, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env, HOME: fakeHome },
    });

    // Skill is created under the real name, not a skill literally named "--silent".
    expect(
      existsSync(join(fakeHome, ".claude", "skills", TEST_SKILL_NAME)),
    ).toBe(true);
    expect(
      existsSync(join(PROJECT_ROOT, ".claude", "skills", "--silent")),
    ).toBe(false);
  });

  it("accepts --target=codex", () => {
    runScript(TEST_SKILL_NAME, fakeHome, ["--target=codex"]);

    expect(
      existsSync(join(fakeHome, ".codex", "skills", TEST_SKILL_NAME)),
    ).toBe(true);
    expect(
      existsSync(join(fakeHome, ".claude", "skills", TEST_SKILL_NAME)),
    ).toBe(false);
  });
});
