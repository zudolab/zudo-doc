import { execSync, execFileSync } from "child_process";
import fs from "fs-extra";
import path from "path";

// Project-name grammar (locked by F4 — S4 #2013):
// /^[a-z0-9][a-z0-9._-]*$/, max 214 chars, unscoped, used as both directory
// name and package name. Mirrors npm's unscoped-name rules + max path safety.
const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
const PROJECT_NAME_MAX = 214;

/**
 * Validate a project name against the locked grammar.
 *
 * Returns `null` when valid; a human-readable error string when invalid.
 * Apply on every input path: CLI arg, interactive prompt, preset, and
 * programmatic API.
 */
export function validateProjectName(name: string): string | null {
  if (!name || name.length === 0) {
    return "Project name is required";
  }
  if (name.length > PROJECT_NAME_MAX) {
    return `Project name must be ${PROJECT_NAME_MAX} characters or fewer`;
  }
  if (!PROJECT_NAME_RE.test(name)) {
    return (
      "Project name must start with a lowercase letter or digit and contain " +
      "only lowercase letters, digits, dots, underscores, and hyphens"
    );
  }
  return null;
}

export function installDependencies(dir: string, pm: string): void {
  const commands: Record<string, string> = {
    pnpm: "pnpm install",
    npm: "npm install",
    yarn: "yarn",
    bun: "bun install",
  };
  const cmd = commands[pm] || "npm install";
  // Use pipe to avoid garbled output when used alongside spinner
  execSync(cmd, { cwd: dir, stdio: "pipe" });
}

export type GitInitResult =
  | { status: "ok" }
  | { status: "skipped-existing-repo" }
  | { status: "skipped-no-git" }
  | { status: "failed"; message: string };

/**
 * Initialize a git repository in `dir` and create an initial commit.
 *
 * Why: zudo-doc's doc-history feature reads `git log` for each page's
 * Created/Updated/Author block. A scaffolded project with no git repo renders
 * empty history — and on older `@takazudo/zudo-doc-history-server` it crashed
 * `pnpm dev` outright (the preBuild hook ran `git rev-parse` and threw).
 * Initializing git here makes the feature work out of the box.
 *
 * Safe by construction:
 * - `skipped-no-git` when git is not installed;
 * - `skipped-existing-repo` when `dir` is already inside a git work tree (e.g.
 *   scaffolding into an existing monorepo) — never nest repositories;
 * - the initial commit only falls back to a neutral identity when the user has
 *   none configured, so a normal user's commit keeps their own identity.
 */
export function initGitRepo(dir: string): GitInitResult {
  // Is git available at all?
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    return { status: "skipped-no-git" };
  }

  // Already inside a git work tree? Don't create a nested repository.
  try {
    const inside = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (inside === "true") return { status: "skipped-existing-repo" };
  } catch {
    // git exits non-zero when `dir` is not inside a repo — the expected case.
  }

  const COMMIT_MESSAGE = "Initial commit from create-zudo-doc";
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    try {
      execFileSync("git", ["commit", "-q", "-m", COMMIT_MESSAGE], {
        cwd: dir,
        stdio: "ignore",
      });
    } catch {
      // No git identity configured on this machine — retry with a neutral
      // fallback so the initial commit still succeeds. Users with a configured
      // identity never reach this branch (their identity is used above).
      execFileSync(
        "git",
        [
          "-c",
          "user.name=create-zudo-doc",
          "-c",
          "user.email=create-zudo-doc@users.noreply.github.com",
          "commit",
          "-q",
          "-m",
          COMMIT_MESSAGE,
        ],
        { cwd: dir, stdio: "ignore" },
      );
    }
    return { status: "ok" };
  } catch (err) {
    return {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Whether an ANCESTOR of `dir` (walking up from `dir`'s parent, not `dir`
 * itself — `dir` is the fresh project root and never has one yet) already
 * has a `pnpm-workspace.yaml`. Mirrors `initGitRepo`'s "never nest"
 * precedent above: pnpm resolves the nearest `pnpm-workspace.yaml` upward
 * from cwd as the workspace root, so writing a new one inside an existing
 * pnpm monorepo (e.g. scaffolding into `apps/docs/` under a parent
 * workspace) would carve the generated project out of that parent
 * workspace's install/lockfile instead of joining it (codex-review finding,
 * #2923).
 */
export function hasAncestorPnpmWorkspace(dir: string): boolean {
  let current = path.dirname(path.resolve(dir));
  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false; // reached the filesystem root
    current = parent;
  }
}

export function capitalize(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get a short uppercase label for a language code (e.g. "en" → "EN", "zh-cn" → "ZH-CN"). */
export function getLangLabel(langCode: string): string {
  return langCode.toUpperCase();
}

/**
 * Build the command that runs a package.json script under `pm`.
 *
 * npm and bun BOTH require the `run` verb — `bun build` invokes Bun's bundler,
 * NOT the package.json `build` script (a real footgun), so bun must emit
 * `bun run build`. pnpm and yarn accept the bare script name (`pnpm build`).
 * The single source of truth for this rule across claude-md-gen.ts,
 * scaffold.ts, and features/tauri.ts.
 */
export function pmRunCommand(
  pm: "pnpm" | "npm" | "yarn" | "bun",
  script: string,
): string {
  return pm === "npm" || pm === "bun"
    ? `${pm} run ${script}`
    : `${pm} ${script}`;
}

/** Determine the secondary language code when i18n is enabled. */
export function getSecondaryLang(defaultLang: string): string {
  return defaultLang === "en" ? "ja" : "en";
}

/** Apply a list of regex replacements to a file (if it exists). */
export async function patchFile(
  filePath: string,
  replacements: [RegExp, string][],
): Promise<void> {
  if (!(await fs.pathExists(filePath))) return;
  let content = await fs.readFile(filePath, "utf-8");
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  await fs.writeFile(filePath, content);
}
