import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { initGitRepo } from "../utils.js";

const TEMP_PREFIX = "create-zudo-doc-git-test-";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
});

afterEach(async () => {
  await fs.remove(tempDir);
});

/** Number of commits on HEAD, or 0 when there is no commit yet. */
function commitCount(dir: string): number {
  try {
    return Number(
      execFileSync("git", ["rev-list", "--count", "HEAD"], {
        cwd: dir,
        encoding: "utf-8",
      }).trim(),
    );
  } catch {
    return 0;
  }
}

/** Repo-relative paths git is tracking after the initial commit. */
function trackedFiles(dir: string): string[] {
  return execFileSync("git", ["ls-files"], { cwd: dir, encoding: "utf-8" })
    .split("\n")
    .filter(Boolean);
}

describe("initGitRepo", () => {
  it("initializes a repo and creates a single initial commit", async () => {
    await fs.writeFile(path.join(tempDir, "README.md"), "# hi\n");

    const result = initGitRepo(tempDir);

    expect(result.status).toBe("ok");
    expect(fs.existsSync(path.join(tempDir, ".git"))).toBe(true);
    expect(commitCount(tempDir)).toBe(1);
    expect(trackedFiles(tempDir)).toContain("README.md");
  });

  it("honours .gitignore (does not commit node_modules)", async () => {
    await fs.writeFile(path.join(tempDir, ".gitignore"), "node_modules\n");
    await fs.ensureDir(path.join(tempDir, "node_modules"));
    await fs.writeFile(path.join(tempDir, "node_modules", "junk.js"), "x");
    await fs.writeFile(path.join(tempDir, "src.ts"), "export const a = 1;\n");

    const result = initGitRepo(tempDir);

    expect(result.status).toBe("ok");
    const tracked = trackedFiles(tempDir);
    expect(tracked).toContain("src.ts");
    expect(tracked.some((f) => f.startsWith("node_modules/"))).toBe(false);
  });

  it("skips (no nested repo) when the target is already inside a git work tree", async () => {
    // Make tempDir itself a git repo, then scaffold into a subdirectory.
    execFileSync("git", ["init", "-q"], { cwd: tempDir });
    const child = path.join(tempDir, "nested-project");
    await fs.ensureDir(child);
    await fs.writeFile(path.join(child, "README.md"), "# nested\n");

    const result = initGitRepo(child);

    expect(result.status).toBe("skipped-existing-repo");
    // No nested .git was created inside the child directory.
    expect(fs.existsSync(path.join(child, ".git"))).toBe(false);
  });
});
