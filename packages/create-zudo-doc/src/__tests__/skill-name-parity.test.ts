import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { deriveDocSkillName, scaffold } from "../scaffold.js";
import { initGitRepo } from "../utils.js";

// #3158 — committed cross-artifact regression test coupling the two
// hand-mirrored skill-name-derivation implementations:
//   - deriveDocSkillName() in scaffold.ts (TypeScript — drives the
//     .gitignore entries the generator emits)
//   - DEFAULT_SKILL_NAME in scripts/setup-doc-skill.sh (bash — drives the
//     directory name the script actually creates at runtime)
// The generator cannot import the shell script, so these are mirrored by
// hand (#3155) and do NOT agree "by construction" — a passing
// deriveDocSkillName() unit test alone would not catch the two drifting
// apart on a future edit to only one side. This test exercises the real
// cross-artifact path end to end: scaffold a project with skillSymlinker,
// run its setup-doc-skill.sh with no explicit name override (so the bash
// derivation decides the name), and assert the directory the script
// actually created is matched by the generator's .gitignore via
// `git check-ignore` — the only assertion that proves both derivations
// still agree.

const TEMP_PREFIX = "create-zudo-doc-skill-name-parity-test-";

const baseChoices: UserChoices = {
  projectName: "test-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: ["skillSymlinker"],
  packageManager: "pnpm",
};

let scaffoldDir: string;
let fakeHome: string;
let originalCwd: string;
let originalHome: string | undefined;

beforeEach(async () => {
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  scaffoldDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), `${TEMP_PREFIX}home-`));
  process.chdir(scaffoldDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  await fs.remove(scaffoldDir);
  await fs.remove(fakeHome);
});

/**
 * Scaffold `projectName` with skillSymlinker enabled, initialize a real git
 * repo over it, and run `scripts/setup-doc-skill.sh` with no `$1` so the
 * bash-side derivation (not a test-supplied override) picks the name.
 *
 * `setup-doc-skill.sh` calls `git -C "$ROOT_DIR" worktree list` and
 * `git rev-parse --show-prefix`, so it is not runnable against a bare
 * directory — it needs a real git repo (see init-git-repo.test.ts for the
 * same `initGitRepo` usage). Both `initGitRepo` and the script itself run
 * under `fakeHome` — never the developer's real `$HOME`, which would
 * otherwise write real symlinks into `~/.claude/skills` or `~/.codex/skills`.
 */
async function scaffoldAndRunSetupScript(projectName: string): Promise<string> {
  await scaffold({ ...baseChoices, projectName });
  const projectDir = path.join(scaffoldDir, projectName);

  process.env.HOME = fakeHome;
  const gitResult = initGitRepo(projectDir);
  expect(gitResult.status).toBe("ok");

  execFileSync("bash", ["scripts/setup-doc-skill.sh"], {
    cwd: projectDir,
    env: { ...process.env, HOME: fakeHome },
    stdio: "pipe",
    timeout: 30_000,
  });

  return projectDir;
}

/**
 * Assert that the skill artifacts the script created under
 * `.claude/skills/<skillName>/` are matched by the generator-emitted
 * `.gitignore` — the coupling point between the two hand-mirrored
 * derivations. If either implementation's name derivation drifts, the
 * script creates a directory the .gitignore does not mention, and
 * `git check-ignore` fails (throws, since it's a non-zero exit).
 */
function expectSkillIgnored(projectDir: string, skillName: string): void {
  const skillDir = path.join(projectDir, ".claude", "skills", skillName);
  expect(fs.existsSync(skillDir)).toBe(true);
  expect(fs.existsSync(path.join(skillDir, "SKILL.md"))).toBe(true);
  expect(fs.existsSync(path.join(skillDir, "docs"))).toBe(true);

  for (const relPath of [
    path.join(".claude", "skills", skillName, "SKILL.md"),
    path.join(".claude", "skills", skillName, "docs"),
  ]) {
    expect(() =>
      execFileSync("git", ["check-ignore", "-q", relPath], {
        cwd: projectDir,
        stdio: "ignore",
      }),
    ).not.toThrow();
  }
}

describe("skill-name derivation parity — deriveDocSkillName() vs setup-doc-skill.sh's DEFAULT_SKILL_NAME (#3158)", () => {
  it("git-ignores the script-created skill dir for a normal project name (unchanged-path regression guard)", async () => {
    const projectName = "test-parity-normal";
    const projectDir = await scaffoldAndRunSetupScript(projectName);

    const expectedSkillName = deriveDocSkillName(projectName);
    expect(expectedSkillName).toBe(`${projectName}-wisdom`);
    expectSkillIgnored(projectDir, expectedSkillName);
  });

  it("git-ignores the script-created skill dir for a -wisdom-suffixed project name (#3152 regression guard)", async () => {
    const projectName = "test-parity-wisdom";
    const projectDir = await scaffoldAndRunSetupScript(projectName);

    // Confirms the suffix is not doubled by either implementation — the
    // exact bug #3152 reported (zudo-test-wisdom -> zudo-test-wisdom-wisdom).
    const expectedSkillName = deriveDocSkillName(projectName);
    expect(expectedSkillName).toBe(projectName);
    expectSkillIgnored(projectDir, expectedSkillName);
  });
});
