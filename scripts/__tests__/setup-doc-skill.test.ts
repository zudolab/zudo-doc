import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  cpSync,
  readFileSync,
  existsSync,
  rmSync,
  realpathSync,
} from "node:fs";
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
 * Build the child env for a script run: the caller's environment with HOME
 * redirected to a fake home, and any inherited SKILL_NAME stripped.
 *
 * SKILL_NAME is the script's env-var override (see
 * `SKILL_NAME="${1:-${SKILL_NAME:-$DEFAULT_SKILL_NAME}}"`), so a value exported
 * by a developer shell or CI would silently rename the directory every
 * assertion here looks for — and would defeat the derivation the no-`$1` suites
 * exist to exercise. Tests that WANT the override pass it explicitly via
 * `extra`.
 */
function scriptEnv(
  fakeHome: string,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: fakeHome };
  delete env.SKILL_NAME;
  return { ...env, ...extra };
}

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
      env: scriptEnv(fakeHome),
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

  it("uses the main worktree project path in generated instructions", () => {
    runScript(TEST_SKILL_NAME, fakeHome);

    const skillMd = readFileSync(
      join(PROJECT_ROOT, ".claude", "skills", TEST_SKILL_NAME, "SKILL.md"),
      "utf-8",
    );

    expect(skillMd).toContain(
      `Run \`pnpm build\` from \`${MAIN_WORKTREE_ROOT}\``,
    );
    expect(skillMd).toContain(
      `(relative to the project root: \`${MAIN_WORKTREE_ROOT}\`)`,
    );
    expect(skillMd).toContain(`${MAIN_WORKTREE_ROOT}/CLAUDE.md`);
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
      env: scriptEnv(fakeHome),
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

  describe("nested-subdir project (#2918)", () => {
    // Builds a throwaway git repo where the "project" lives at <repo>/doc/
    // instead of at the repo root, then runs the real script against it.
    // This reproduces the shape a project has when it's a subdirectory of a
    // larger monorepo checkout.
    let fixtureRoot: string;
    let fixtureHome: string;
    let projectDir: string;

    beforeEach(() => {
      fixtureRoot = mkdtempSync(join(tmpdir(), "zudo-doc-nested-fixture-"));
      fixtureHome = mkdtempSync(join(tmpdir(), "zudo-doc-nested-home-"));
      projectDir = join(fixtureRoot, "doc");

      execSync("git init -q", { cwd: fixtureRoot });

      mkdirSync(join(projectDir, "scripts"), { recursive: true });
      mkdirSync(
        join(projectDir, "src", "content", "docs", "getting-started"),
        { recursive: true },
      );
      writeFileSync(
        join(projectDir, "src", "content", "docs", "getting-started", "index.mdx"),
        "---\ntitle: Test\n---\n",
      );
      cpSync(SCRIPT_PATH, join(projectDir, "scripts", "setup-doc-skill.sh"));
      writeFileSync(
        join(projectDir, "package.json"),
        JSON.stringify({ name: "nested-project", scripts: {} }),
      );
    });

    afterEach(() => {
      rmSync(fixtureRoot, { recursive: true, force: true });
      rmSync(fixtureHome, { recursive: true, force: true });
    });

    function runFixtureScript(): string {
      return execSync(
        `bash "${join(projectDir, "scripts", "setup-doc-skill.sh")}" "${TEST_SKILL_NAME}"`,
        {
          cwd: projectDir,
          encoding: "utf-8",
          timeout: 30_000,
          env: scriptEnv(fixtureHome),
        },
      );
    }

    it("resolves the docs symlink to an existing dir under <repo>/doc/", () => {
      runFixtureScript();

      const docsLink = join(projectDir, ".claude", "skills", TEST_SKILL_NAME, "docs");
      expect(existsSync(docsLink)).toBe(true);

      const resolved = realpathSync(docsLink);
      expect(resolved).toBe(realpathSync(join(projectDir, "src", "content", "docs")));
    });

    it("generates a SKILL.md with no absent-script commands and nested-correct paths", () => {
      runFixtureScript();

      const skillMd = readFileSync(
        join(projectDir, ".claude", "skills", TEST_SKILL_NAME, "SKILL.md"),
        "utf-8",
      );

      // The fixture's package.json has no format script — the step must say
      // so rather than reference a script that doesn't exist.
      expect(skillMd).not.toContain("pnpm format:md");
      expect(skillMd).not.toContain("pnpm format`");
      expect(skillMd).toContain(
        "No format script is configured for this project",
      );

      // Build/verify and doc-base-path instructions must name the nested
      // project directory explicitly, not just "repo root".
      expect(skillMd).toContain(`Run \`pnpm build\` from \`${projectDir}\``);
      expect(skillMd).toContain(
        `(relative to the project root: \`${projectDir}\`)`,
      );
      expect(skillMd).toContain(`${projectDir}/CLAUDE.md`);
    });
  });
});

describe("suffix-aware skill-name derivation (#3154)", () => {
  // Builds a throwaway fixture project (same shape as the nested-subdir
  // fixture above) with a caller-chosen package.json `name`, so the
  // no-`$1` derivation path can be exercised. runScript()/runFixtureScript()
  // above always pass the skill name explicitly as `$1`, which never invokes
  // DEFAULT_SKILL_NAME at all.
  let fixtureRoot: string;
  let fixtureHome: string;
  let projectDir: string;

  function makeFixture(projectName: string): void {
    fixtureRoot = mkdtempSync(join(tmpdir(), "zudo-doc-suffix-fixture-"));
    fixtureHome = mkdtempSync(join(tmpdir(), "zudo-doc-suffix-home-"));
    projectDir = join(fixtureRoot, "doc");

    execSync("git init -q", { cwd: fixtureRoot });

    mkdirSync(join(projectDir, "scripts"), { recursive: true });
    mkdirSync(join(projectDir, "src", "content", "docs", "getting-started"), {
      recursive: true,
    });
    writeFileSync(
      join(projectDir, "src", "content", "docs", "getting-started", "index.mdx"),
      "---\ntitle: Test\n---\n",
    );
    cpSync(SCRIPT_PATH, join(projectDir, "scripts", "setup-doc-skill.sh"));
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({ name: projectName, scripts: {} }),
    );
  }

  /**
   * Write the project's `.gitignore` with the same per-file entry shape
   * create-zudo-doc's scaffold emits (`.claude/skills/<name>/SKILL.md` etc.),
   * so the stale-ignore-rule detection is exercised against real output rather
   * than an invented format.
   */
  function writeGitignore(skillName: string): string {
    const path = join(projectDir, ".gitignore");
    writeFileSync(
      path,
      [
        "node_modules/",
        `.claude/skills/${skillName}/SKILL.md`,
        `.claude/skills/${skillName}/docs`,
        `.codex/skills/${skillName}/SKILL.md`,
        `.codex/skills/${skillName}/docs`,
        "",
      ].join("\n"),
    );
    return path;
  }

  afterEach(() => {
    if (fixtureRoot && existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
    if (fixtureHome && existsSync(fixtureHome)) {
      rmSync(fixtureHome, { recursive: true, force: true });
    }
  });

  function runFixtureScript(
    opts: { args?: string[]; skillNameArg?: string; env?: Record<string, string> } = {},
  ): string {
    const { args = [], skillNameArg, env = {} } = opts;
    const quotedFlags = args.map((arg) => `"${arg}"`).join(" ");
    const posArg = skillNameArg !== undefined ? `"${skillNameArg}"` : "";
    const cmd = `bash "${join(projectDir, "scripts", "setup-doc-skill.sh")}" ${quotedFlags} ${posArg}`.trim();
    return execSync(cmd, {
      cwd: projectDir,
      encoding: "utf-8",
      timeout: 30_000,
      env: scriptEnv(fixtureHome, env),
    });
  }

  it("uses PROJECT_NAME verbatim when it already ends in -wisdom (no doubling)", () => {
    makeFixture("zudo-test-wisdom");
    runFixtureScript();

    expect(
      existsSync(join(projectDir, ".claude", "skills", "zudo-test-wisdom", "SKILL.md")),
    ).toBe(true);
    expect(
      existsSync(join(projectDir, ".claude", "skills", "zudo-test-wisdom-wisdom")),
    ).toBe(false);
  });

  it("appends -wisdom when PROJECT_NAME does not already end in -wisdom", () => {
    makeFixture("my-docs");
    runFixtureScript();

    expect(
      existsSync(join(projectDir, ".claude", "skills", "my-docs-wisdom", "SKILL.md")),
    ).toBe(true);
  });

  it("uses 'wisdom' verbatim when PROJECT_NAME is exactly 'wisdom'", () => {
    makeFixture("wisdom");
    runFixtureScript();

    expect(existsSync(join(projectDir, ".claude", "skills", "wisdom", "SKILL.md"))).toBe(
      true,
    );
    expect(existsSync(join(projectDir, ".claude", "skills", "wisdom-wisdom"))).toBe(false);
  });

  it("an explicit $1 still overrides the derived name", () => {
    makeFixture("zudo-test-wisdom");
    runFixtureScript({ skillNameArg: "custom-override" });

    expect(
      existsSync(join(projectDir, ".claude", "skills", "custom-override", "SKILL.md")),
    ).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "skills", "zudo-test-wisdom"))).toBe(
      false,
    );
  });

  it("the SKILL_NAME env var still overrides the derived name", () => {
    makeFixture("zudo-test-wisdom");
    runFixtureScript({ env: { SKILL_NAME: "env-override" } });

    expect(
      existsSync(join(projectDir, ".claude", "skills", "env-override", "SKILL.md")),
    ).toBe(true);
    expect(existsSync(join(projectDir, ".claude", "skills", "zudo-test-wisdom"))).toBe(
      false,
    );
  });

  it("warns about a legacy doubled-suffix directory and does not delete it", () => {
    makeFixture("zudo-test-wisdom");
    const legacyDir = join(projectDir, ".claude", "skills", "zudo-test-wisdom-wisdom");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, "SKILL.md"), "stale");

    const output = runFixtureScript();

    expect(output).toContain("WARNING");
    expect(output).toContain(`legacy skill directory: ${legacyDir}`);
    expect(output).toContain("zudo-test-wisdom-wisdom");
    expect(output).toContain("rm -rf");
    // This fixture has no .gitignore at all, so the ignore-rule step does not
    // apply and must not be printed.
    expect(output).not.toContain("stale ignore rules");
    expect(output).not.toContain("Update the ignore rules");
    // Never auto-deletes the stale legacy directory.
    expect(existsSync(legacyDir)).toBe(true);
    expect(readFileSync(join(legacyDir, "SKILL.md"), "utf-8")).toBe("stale");
  });

  it("warns when only the .gitignore still names the legacy skill", () => {
    // The symptom the warning exists to prevent -- an unignored new skill
    // directory -- is caused by the stale ignore rules alone. A project whose
    // legacy directory was never generated (or has already been deleted) must
    // still be told, so the trigger cannot depend on the directory.
    makeFixture("zudo-test-wisdom");
    const gitignore = writeGitignore("zudo-test-wisdom-wisdom");
    const before = readFileSync(gitignore, "utf-8");

    const output = runFixtureScript();

    expect(output).toContain("WARNING");
    expect(output).toContain(`stale ignore rules in ${gitignore}`);
    expect(output).toContain("Update the ignore rules");
    // No legacy directory and no stale global symlink exist here, so neither
    // deletion step applies.
    expect(output).not.toContain("rm -rf");
    expect(output).not.toContain("rm -f");
    // Advisory only -- the .gitignore is never rewritten.
    expect(readFileSync(gitignore, "utf-8")).toBe(before);
  });

  it("lists both symptoms when the stale .gitignore and the legacy directory coexist", () => {
    makeFixture("zudo-test-wisdom");
    const gitignore = writeGitignore("zudo-test-wisdom-wisdom");
    const legacyDir = join(projectDir, ".claude", "skills", "zudo-test-wisdom-wisdom");
    mkdirSync(legacyDir, { recursive: true });

    const output = runFixtureScript();

    expect(output).toContain(`stale ignore rules in ${gitignore}`);
    expect(output).toContain(`legacy skill directory: ${legacyDir}`);
    expect(output).toContain("Update the ignore rules");
    expect(output).toContain("rm -rf");
  });

  it("does not warn when no stale reference to the legacy name is present", () => {
    makeFixture("zudo-test-wisdom");
    // A .gitignore already naming the CURRENT skill must not be misread as a
    // stale one.
    writeGitignore("zudo-test-wisdom");

    const output = runFixtureScript();

    expect(output).not.toContain("WARNING");
  });

  it("does not warn for a project name unaffected by the suffix-aware rule", () => {
    makeFixture("my-docs");
    // Even with a pre-existing directory and ignore rules at the
    // (never-produced-by-the-old-bug) doubled name, the rule doesn't change
    // for "my-docs" -- so there is no derivation-rule change to warn about.
    const unrelatedDir = join(projectDir, ".claude", "skills", "my-docs-wisdom-wisdom");
    mkdirSync(unrelatedDir, { recursive: true });
    writeGitignore("my-docs-wisdom-wisdom");

    const output = runFixtureScript();

    expect(output).not.toContain("WARNING");
  });

  it("does not print the migration warning when the name is explicitly overridden", () => {
    // An explicit $1/SKILL_NAME override means the script isn't about to
    // create DEFAULT_SKILL_NAME at all, so the "resolves to <new name>,
    // update the ignore rules to <DEFAULT_SKILL_NAME>" guidance would be
    // actively wrong -- the override wins, and the warning must not fire for
    // ANY of the symptoms.
    makeFixture("zudo-test-wisdom");
    const legacyDir = join(projectDir, ".claude", "skills", "zudo-test-wisdom-wisdom");
    mkdirSync(legacyDir, { recursive: true });
    writeGitignore("zudo-test-wisdom-wisdom");

    const output = runFixtureScript({ skillNameArg: "custom-override" });

    expect(output).not.toContain("WARNING");
    // Legacy directory is left untouched either way.
    expect(existsSync(legacyDir)).toBe(true);
  });

  it("mentions removing the stale global symlink in the migration steps", () => {
    makeFixture("zudo-test-wisdom");
    const legacyDir = join(projectDir, ".claude", "skills", "zudo-test-wisdom-wisdom");
    mkdirSync(legacyDir, { recursive: true });
    const legacyGlobalLink = join(fixtureHome, ".claude", "skills", "zudo-test-wisdom-wisdom");
    mkdirSync(join(fixtureHome, ".claude", "skills"), { recursive: true });
    execSync(`ln -s "${legacyDir}" "${legacyGlobalLink}"`);

    const output = runFixtureScript();

    expect(output).toContain(legacyGlobalLink);
    expect(output).toContain("rm -f");
  });

  it("warns about a stale global symlink even with no legacy directory", () => {
    makeFixture("zudo-test-wisdom");
    // Dangling on purpose: the legacy project directory is already gone, so
    // only the global link is left. `-L` still sees it.
    const legacyGlobalLink = join(fixtureHome, ".claude", "skills", "zudo-test-wisdom-wisdom");
    mkdirSync(join(fixtureHome, ".claude", "skills"), { recursive: true });
    execSync(
      `ln -s "${join(projectDir, ".claude", "skills", "zudo-test-wisdom-wisdom")}" "${legacyGlobalLink}"`,
    );

    const output = runFixtureScript();

    expect(output).toContain("WARNING");
    expect(output).toContain(`stale global symlink: ${legacyGlobalLink}`);
    expect(output).toContain("rm -f");
    expect(output).not.toContain("rm -rf");
  });

  it("ignores a real directory sitting at the legacy global skill path", () => {
    // This script only ever creates symlinks in the global skills dir, so a
    // real directory there is user-owned. Reporting it as a "stale global
    // symlink" would advise `rm -f` against someone else's files.
    makeFixture("zudo-test-wisdom");
    const userOwned = join(fixtureHome, ".claude", "skills", "zudo-test-wisdom-wisdom");
    mkdirSync(userOwned, { recursive: true });
    writeFileSync(join(userOwned, "SKILL.md"), "user-owned");

    const output = runFixtureScript();

    expect(output).not.toContain("WARNING");
    expect(existsSync(join(userOwned, "SKILL.md"))).toBe(true);
  });
});

describe("tracked-skill linking (#3156)", () => {
  // Fixture project shape mirrors the nested-subdir / suffix-aware fixtures
  // above: a throwaway git repo containing a "doc" project directory with
  // its own scripts/, src/content/docs/, package.json, and (for this suite)
  // its own .claude/skills/ / .codex/skills/ tracked-skill directories.
  // Fully hermetic -- never reads or writes the real project's own
  // .claude/skills/, even though the production script itself would.
  let fixtureRoot: string;
  let fixtureHome: string;
  let projectDir: string;

  function makeFixture(projectName: string): void {
    fixtureRoot = mkdtempSync(join(tmpdir(), "zudo-doc-tracked-fixture-"));
    fixtureHome = mkdtempSync(join(tmpdir(), "zudo-doc-tracked-home-"));
    projectDir = join(fixtureRoot, "doc");

    execSync("git init -q", { cwd: fixtureRoot });

    mkdirSync(join(projectDir, "scripts"), { recursive: true });
    mkdirSync(join(projectDir, "src", "content", "docs", "getting-started"), {
      recursive: true,
    });
    writeFileSync(
      join(projectDir, "src", "content", "docs", "getting-started", "index.mdx"),
      "---\ntitle: Test\n---\n",
    );
    cpSync(SCRIPT_PATH, join(projectDir, "scripts", "setup-doc-skill.sh"));
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify({ name: projectName, scripts: {} }),
    );
  }

  function makeTrackedSkill(
    target: "claude" | "codex",
    name: string,
    { skillMd = true }: { skillMd?: boolean } = {},
  ): string {
    const dir = join(projectDir, `.${target}`, "skills", name);
    mkdirSync(dir, { recursive: true });
    if (skillMd) {
      writeFileSync(join(dir, "SKILL.md"), `# ${name}\n`);
    } else {
      writeFileSync(join(dir, "not-a-skill.txt"), "no SKILL.md here");
    }
    return dir;
  }

  afterEach(() => {
    if (fixtureRoot && existsSync(fixtureRoot)) {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
    if (fixtureHome && existsSync(fixtureHome)) {
      rmSync(fixtureHome, { recursive: true, force: true });
    }
  });

  function runFixtureScript(
    opts: { args?: string[]; cwd?: string; skillNameArg?: string } = {},
  ): string {
    const { args = [], cwd = projectDir, skillNameArg } = opts;
    const quotedFlags = args.map((arg) => `"${arg}"`).join(" ");
    const posArg = skillNameArg !== undefined ? `"${skillNameArg}"` : "";
    const cmd =
      `bash "${join(projectDir, "scripts", "setup-doc-skill.sh")}" ${quotedFlags} ${posArg}`.trim();
    return execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 30_000,
      env: scriptEnv(fixtureHome),
    });
  }

  it("links a tracked skill dir containing SKILL.md into the global skills dir", () => {
    makeFixture("tracked-fixture");
    const skillDir = makeTrackedSkill("claude", "check-docs");

    const output = runFixtureScript();

    const link = join(fixtureHome, ".claude", "skills", "check-docs");
    expect(existsSync(link)).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(skillDir));
    expect(output).toContain("Linked tracked skill 'check-docs'");
  });

  it("skips a directory that does not contain SKILL.md", () => {
    makeFixture("tracked-fixture");
    makeTrackedSkill("claude", "not-a-skill", { skillMd: false });

    runFixtureScript();

    expect(existsSync(join(fixtureHome, ".claude", "skills", "not-a-skill"))).toBe(false);
  });

  it("skips the legacy doubled-suffix directory left over from #3154", () => {
    // The doubling bug only reproduces for a project name that already ends
    // in "-wisdom" (e.g. "foo-wisdom" -> old buggy default "foo-wisdom-wisdom").
    makeFixture("tracked-fixture-wisdom");
    makeTrackedSkill("claude", "tracked-fixture-wisdom-wisdom");

    const output = runFixtureScript();

    expect(
      existsSync(join(fixtureHome, ".claude", "skills", "tracked-fixture-wisdom-wisdom")),
    ).toBe(false);
    expect(output).not.toContain("Linked tracked skill 'tracked-fixture-wisdom-wisdom'");
  });

  it("skips the generated skill itself and links only the tracked skill", () => {
    makeFixture("tracked-fixture");
    makeTrackedSkill("claude", "check-docs");

    const output = runFixtureScript();

    // The generated skill ("tracked-fixture-wisdom") is linked exactly once,
    // via the generate_skill/ensure_symlink path -- never re-processed (and
    // re-logged) as a tracked skill.
    expect(output).not.toContain("Linked tracked skill 'tracked-fixture-wisdom'");
    expect(output).toContain("Global symlink: " + join(fixtureHome, ".claude", "skills", "tracked-fixture-wisdom"));
    expect(existsSync(join(fixtureHome, ".claude", "skills", "tracked-fixture-wisdom"))).toBe(
      true,
    );
  });

  it("is target-local only: a claude-side tracked skill does not leak into --target codex (no .claude -> .codex fallback)", () => {
    makeFixture("tracked-fixture");
    makeTrackedSkill("claude", "check-docs");
    // No .codex/skills/ tracked skill exists -- only the .claude one above.

    const output = runFixtureScript({ args: ["--target", "codex"] });

    // Silent no-op: the codex run finds nothing of its own to link, and the
    // claude-only tracked skill is never picked up as a fallback.
    expect(existsSync(join(fixtureHome, ".codex", "skills", "check-docs"))).toBe(false);
    expect(existsSync(join(fixtureHome, ".claude", "skills", "check-docs"))).toBe(false);
    expect(output).not.toContain("WARNING");
    expect(output).not.toContain("Linked tracked skill");
  });

  describe("D4 safe-link policy", () => {
    it("no-ops when the global entry already links to this project's source (idempotent)", () => {
      makeFixture("tracked-fixture");
      const skillDir = makeTrackedSkill("claude", "check-docs");
      mkdirSync(join(fixtureHome, ".claude", "skills"), { recursive: true });
      execSync(`ln -s "${skillDir}" "${join(fixtureHome, ".claude", "skills", "check-docs")}"`);

      const output = runFixtureScript();

      expect(output).not.toContain("Linked tracked skill 'check-docs'");
      expect(output).not.toContain("WARNING");
      expect(realpathSync(join(fixtureHome, ".claude", "skills", "check-docs"))).toBe(
        realpathSync(skillDir),
      );
    });

    it("creates the link when nothing exists at the global path", () => {
      makeFixture("tracked-fixture");
      const skillDir = makeTrackedSkill("claude", "check-docs");

      runFixtureScript();

      expect(
        realpathSync(join(fixtureHome, ".claude", "skills", "check-docs")),
      ).toBe(realpathSync(skillDir));
    });

    it("replaces a broken (dangling) symlink at the global path", () => {
      makeFixture("tracked-fixture");
      const skillDir = makeTrackedSkill("claude", "check-docs");
      mkdirSync(join(fixtureHome, ".claude", "skills"), { recursive: true });
      execSync(
        `ln -s "${join(fixtureRoot, "does-not-exist")}" "${join(fixtureHome, ".claude", "skills", "check-docs")}"`,
      );

      const output = runFixtureScript();

      expect(output).toContain("Linked tracked skill 'check-docs'");
      expect(realpathSync(join(fixtureHome, ".claude", "skills", "check-docs"))).toBe(
        realpathSync(skillDir),
      );
    });

    it("warns and skips -- never deletes -- a symlink pointing to another project", () => {
      makeFixture("tracked-fixture");
      makeTrackedSkill("claude", "check-docs");
      const otherProjectDir = mkdtempSync(join(tmpdir(), "zudo-doc-other-project-"));
      mkdirSync(join(fixtureHome, ".claude", "skills"), { recursive: true });
      execSync(
        `ln -s "${otherProjectDir}" "${join(fixtureHome, ".claude", "skills", "check-docs")}"`,
      );

      const output = runFixtureScript();

      expect(output).toContain("WARNING");
      expect(output).toContain("check-docs");
      expect(readlinkTarget(join(fixtureHome, ".claude", "skills", "check-docs"))).toBe(
        otherProjectDir,
      );
      rmSync(otherProjectDir, { recursive: true, force: true });
    });

    it("warns and skips -- never deletes -- a real directory at the global path", () => {
      makeFixture("tracked-fixture");
      makeTrackedSkill("claude", "check-docs");
      const realDir = join(fixtureHome, ".claude", "skills", "check-docs");
      mkdirSync(realDir, { recursive: true });
      writeFileSync(join(realDir, "sentinel.txt"), "do-not-delete-me");

      const output = runFixtureScript();

      expect(output).toContain("WARNING");
      expect(existsSync(join(realDir, "sentinel.txt"))).toBe(true);
      expect(readFileSync(join(realDir, "sentinel.txt"), "utf-8")).toBe("do-not-delete-me");
    });

    it("warns and skips -- never deletes -- a real file at the global path", () => {
      makeFixture("tracked-fixture");
      makeTrackedSkill("claude", "check-docs");
      mkdirSync(join(fixtureHome, ".claude", "skills"), { recursive: true });
      const realFile = join(fixtureHome, ".claude", "skills", "check-docs");
      writeFileSync(realFile, "do-not-delete-me");

      const output = runFixtureScript();

      expect(output).toContain("WARNING");
      expect(existsSync(realFile)).toBe(true);
      expect(readFileSync(realFile, "utf-8")).toBe("do-not-delete-me");
    });
  });

  it("running the script twice changes nothing (idempotent end-to-end)", () => {
    makeFixture("tracked-fixture");
    makeTrackedSkill("claude", "check-docs");

    runFixtureScript();
    const firstLink = realpathSync(join(fixtureHome, ".claude", "skills", "check-docs"));

    const secondOutput = runFixtureScript();
    const secondLink = realpathSync(join(fixtureHome, ".claude", "skills", "check-docs"));

    expect(secondLink).toBe(firstLink);
    expect(secondOutput).not.toContain("WARNING");
  });

  it("--no-link-tracked-skills links only the generated skill, not tracked ones", () => {
    makeFixture("tracked-fixture");
    makeTrackedSkill("claude", "check-docs");

    const output = runFixtureScript({ args: ["--no-link-tracked-skills"] });

    expect(existsSync(join(fixtureHome, ".claude", "skills", "tracked-fixture-wisdom"))).toBe(
      true,
    );
    expect(existsSync(join(fixtureHome, ".claude", "skills", "check-docs"))).toBe(false);
    expect(output).not.toContain("Linked tracked skill");
  });

  it("--target both links tracked skills for both targets, each from its own project dir", () => {
    makeFixture("tracked-fixture");
    makeTrackedSkill("claude", "check-docs");
    makeTrackedSkill("codex", "codex-only-skill");

    runFixtureScript({ args: ["--target", "both"] });

    expect(existsSync(join(fixtureHome, ".claude", "skills", "check-docs"))).toBe(true);
    expect(existsSync(join(fixtureHome, ".codex", "skills", "codex-only-skill"))).toBe(true);
    // Target-local: claude's tracked skill doesn't leak into codex's dir and
    // vice versa.
    expect(existsSync(join(fixtureHome, ".codex", "skills", "check-docs"))).toBe(false);
    expect(existsSync(join(fixtureHome, ".claude", "skills", "codex-only-skill"))).toBe(false);
  });

  describe("worktree survival (#3156)", () => {
    // Proves tracked-skill sources resolve through MAIN_PROJECT_DIR, not
    // ROOT_DIR: run the script from a linked worktree, then remove the
    // worktree and confirm the global symlink still resolves.
    it("the tracked-skill link still resolves after the worktree is removed", () => {
      makeFixture("tracked-fixture");
      makeTrackedSkill("claude", "check-docs");
      execSync('git -C "' + projectDir + '" add -A', { cwd: projectDir });
      execSync(
        'git -c user.email=test@test.com -c user.name=test -C "' +
          projectDir +
          '" commit -q -m init',
        { cwd: projectDir },
      );

      const worktreeDir = join(fixtureRoot, "wt");
      execSync(`git -C "${projectDir}" worktree add -q "${worktreeDir}" -b tracked-skill-wt`, {
        cwd: projectDir,
      });
      const worktreeProjectDir = join(worktreeDir, "doc");

      execSync(`bash "${join(worktreeProjectDir, "scripts", "setup-doc-skill.sh")}"`, {
        cwd: worktreeProjectDir,
        encoding: "utf-8",
        timeout: 30_000,
        env: scriptEnv(fixtureHome),
      });

      const link = join(fixtureHome, ".claude", "skills", "check-docs");
      expect(existsSync(link)).toBe(true);
      // The link target must be under the MAIN project dir, not the worktree.
      expect(realpathSync(link)).toBe(
        realpathSync(join(projectDir, ".claude", "skills", "check-docs")),
      );

      execSync(`git -C "${projectDir}" worktree remove --force "${worktreeDir}"`, {
        cwd: projectDir,
      });

      // The symlink target still exists and is readable after worktree removal.
      expect(existsSync(link)).toBe(true);
      expect(readFileSync(join(link, "SKILL.md"), "utf-8")).toContain("check-docs");
    });
  });
});

function readlinkTarget(linkPath: string): string {
  return execSync(`readlink "${linkPath}"`, { encoding: "utf-8" }).trim();
}
