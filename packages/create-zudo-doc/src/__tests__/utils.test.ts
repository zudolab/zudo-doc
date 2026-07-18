import { describe, it, expect, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { hasAncestorPnpmWorkspace, pmRunCommand } from "../utils.js";

describe("pmRunCommand — package.json script invocation per package manager", () => {
  it.each([
    ["pnpm", "build", "pnpm build"],
    ["yarn", "build", "yarn build"],
    ["npm", "build", "npm run build"],
    // The bug this helper fixes: `bun build` invokes Bun's BUNDLER, not the
    // package.json `build` script — bun must use the `run` verb.
    ["bun", "build", "bun run build"],
  ] as const)("%s → %s script emits %s", (pm, script, expected) => {
    expect(pmRunCommand(pm, script)).toBe(expected);
  });

  it("bun never emits a bare `bun <script>` (bundler footgun guard)", () => {
    for (const script of ["build", "dev", "check", "preview"]) {
      expect(pmRunCommand("bun", script)).toBe(`bun run ${script}`);
    }
  });
});

describe("hasAncestorPnpmWorkspace — never-nest guard for pnpm-workspace.yaml (#2923)", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length) {
      await fs.remove(tempDirs.pop()!);
    }
  });

  async function mkTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hasAncestorPnpmWorkspace-test-"));
    tempDirs.push(dir);
    return dir;
  }

  it("returns false when no ancestor has a pnpm-workspace.yaml", async () => {
    const root = await mkTempDir();
    const projectDir = path.join(root, "my-docs");
    await fs.ensureDir(projectDir);
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(false);
  });

  it("returns true when the immediate parent has a pnpm-workspace.yaml", async () => {
    const root = await mkTempDir();
    await fs.outputFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    const projectDir = path.join(root, "apps/docs");
    await fs.ensureDir(projectDir);
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(true);
  });

  it("returns true when a workspace root is several levels up", async () => {
    const root = await mkTempDir();
    await fs.outputFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    const projectDir = path.join(root, "a/b/c/my-docs");
    await fs.ensureDir(projectDir);
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(true);
  });

  it("does not check `dir` itself, only its ancestors", async () => {
    const root = await mkTempDir();
    const projectDir = path.join(root, "my-docs");
    await fs.ensureDir(projectDir);
    // A pnpm-workspace.yaml INSIDE the target dir itself must not count —
    // scaffold.ts calls this before writing its own, so this only matters
    // if a caller pre-seeds a target dir, which the "ancestor, not self"
    // semantics intentionally ignore.
    await fs.outputFile(path.join(projectDir, "pnpm-workspace.yaml"), "packages:\n  - x\n");
    expect(hasAncestorPnpmWorkspace(projectDir)).toBe(false);
  });
});
