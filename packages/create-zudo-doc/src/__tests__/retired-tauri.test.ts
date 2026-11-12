// Retired Tauri inputs must fail before anything is written, on every entry
// point, and the legacy negative CLI spellings must stay harmless no-ops.
//
// The CLI cases spawn the built bin, so (like the tarball tests) this assumes
// `dist/` is populated by a prior `pnpm --filter create-zudo-doc build`.

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { createZudoDoc } from "../api.js";
import { FEATURES } from "../constants.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BIN = path.join(PKG_ROOT, "bin/create-zudo-doc.js");
const RETIRED_RE = /Tauri desktop app support was retired/;

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "create-zudo-doc-retired-"));
});

afterEach(async () => {
  await fs.remove(tempDir);
});

async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const entry of await fs.readdir(dir, { recursive: true })) {
    const abs = path.join(dir, String(entry));
    if ((await fs.stat(abs)).isFile()) {
      out[String(entry)] = await fs.readFile(abs, "utf-8");
    }
  }
  return out;
}

async function seedExisting(name: string): Promise<string> {
  const dir = path.join(tempDir, name);
  await fs.outputFile(path.join(dir, "keep.txt"), "untouched\n");
  await fs.outputFile(path.join(dir, "nested/notes.md"), "# notes\n");
  return dir;
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: tempDir,
    encoding: "utf-8",
    env: { ...process.env, CI: "1" },
  });
}

describe("createZudoDoc — retired Tauri features touch no files", () => {
  const options = (projectName: string, feature: string) => ({
    projectName,
    colorSchemeMode: "single" as const,
    singleScheme: "Default Dark",
    features: ["search", feature],
    packageManager: "pnpm" as const,
  });

  let cwdBefore: string;
  beforeEach(() => {
    cwdBefore = process.cwd();
    process.chdir(tempDir);
  });
  afterEach(() => {
    process.chdir(cwdBefore);
  });

  it.each([["tauri"], ["tauriDev"]])("leaves a nonexistent destination uncreated (%s)", async (feature) => {
    await expect(createZudoDoc(options("api-new", feature))).rejects.toThrow(RETIRED_RE);
    expect(await fs.pathExists(path.join(tempDir, "api-new"))).toBe(false);
  });

  it.each([["tauri"], ["tauriDev"]])("leaves an existing destination unchanged (%s)", async (feature) => {
    const dir = await seedExisting("api-existing");
    const before = await snapshot(dir);
    await expect(createZudoDoc(options("api-existing", feature))).rejects.toThrow(RETIRED_RE);
    expect(await snapshot(dir)).toEqual(before);
  });

  it("leaves an existing empty destination empty", async () => {
    await fs.ensureDir(path.join(tempDir, "api-empty"));
    await expect(createZudoDoc(options("api-empty", "tauri"))).rejects.toThrow(RETIRED_RE);
    expect(await fs.readdir(path.join(tempDir, "api-empty"))).toEqual([]);
  });
});

describe("CLI — retired Tauri inputs (built bin)", () => {
  beforeAll(() => {
    if (!fs.existsSync(path.join(PKG_ROOT, "dist/index.js"))) {
      throw new Error("dist/ is missing — run `pnpm --filter create-zudo-doc build` first");
    }
  });

  it.each([
    [["--tauri"]],
    [["--tauri-dev"]],
    [["--tauri=true"]],
    [["--tauri=yes"]],
    [["--tauri="]],
    [["--tauri-dev=foo"]],
    [["--tauri", "--no-tauri"]],
    [["--no-tauri-dev", "--tauri-dev"]],
    [["--tauri", "--help"]],
  ])("%j exits non-zero and leaves a nonexistent destination uncreated", (flags) => {
    const result = runCli(["cli-new", "--yes", "--no-install", "--no-git", ...flags]);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(RETIRED_RE);
    expect(fs.existsSync(path.join(tempDir, "cli-new"))).toBe(false);
  });

  it("leaves an existing destination unchanged", async () => {
    const dir = await seedExisting("cli-existing");
    const before = await snapshot(dir);
    const result = runCli(["cli-existing", "--yes", "--no-install", "--no-git", "--tauri-dev=true"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(RETIRED_RE);
    expect(await snapshot(dir)).toEqual(before);
  });

  it("rejects a --preset listing a retired feature before writing", async () => {
    const presetFile = path.join(tempDir, "preset.json");
    await fs.writeJson(presetFile, { features: ["search", "tauri"] });
    await fs.ensureDir(path.join(tempDir, "cli-preset"));
    const result = runCli(["cli-preset", "--preset", presetFile, "--no-install", "--no-git"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(RETIRED_RE);
    expect(await fs.readdir(path.join(tempDir, "cli-preset"))).toEqual([]);
  });

  it("treats the exact legacy negative spellings as no-ops and emits no Tauri artifacts", async () => {
    const result = runCli([
      "cli-legacy",
      "--yes",
      "--no-install",
      "--no-git",
      "--no-tauri",
      "--no-tauri-dev",
      "--tauri=false",
      "--tauri-dev=false",
    ]);
    expect(result.status, result.stderr).toBe(0);
    const project = path.join(tempDir, "cli-legacy");
    expect(await fs.pathExists(path.join(project, "src-tauri"))).toBe(false);
    expect(await fs.pathExists(path.join(project, "src-tauri-dev"))).toBe(false);
    const pkg = await fs.readJson(path.join(project, "package.json"));
    expect(JSON.stringify(pkg.scripts)).not.toMatch(/tauri/i);
    const config = await fs.readFile(path.join(project, "zfb.config.ts"), "utf-8");
    expect(config).not.toContain("findInPage");
  });

  it("an every-supported-feature preset scaffolds with no Tauri artifacts", async () => {
    const presetFile = path.join(tempDir, "all.json");
    await fs.writeJson(presetFile, {
      features: FEATURES.map((f) => f.value),
      mcpDeploy: "cloudflare",
    });
    const result = runCli(["cli-all", "--preset", presetFile, "--no-install", "--no-git"]);
    expect(result.status, result.stderr).toBe(0);
    const project = path.join(tempDir, "cli-all");
    const files = Object.keys(await snapshot(project));
    expect(files.filter((f) => /tauri|find-in-page|find-bar/i.test(f))).toEqual([]);
    const pkg = await fs.readJson(path.join(project, "package.json"));
    expect(JSON.stringify(pkg.scripts)).not.toMatch(/tauri/i);
    const config = await fs.readFile(path.join(project, "zfb.config.ts"), "utf-8");
    expect(config).not.toContain("findInPage");
    expect(await fs.readFile(path.join(project, "CLAUDE.md"), "utf-8")).not.toMatch(/tauri/i);
  });
});
