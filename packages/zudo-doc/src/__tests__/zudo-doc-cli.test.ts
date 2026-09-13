// Subprocess coverage for the published `zudo-doc check images` command.
//
// The bin is intentionally copied together with dist/ into an immutable
// snapshot: the command runs on plain Node and must resolve the compiled
// scanner, not the package's TypeScript source.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PACKAGE_ROOT = resolve(__dirname, "../..");
const SNAPSHOT_PREFIX = join(PACKAGE_ROOT, ".check-images-cli-snapshot-");
const TEMP_PREFIX = "zudo-doc-check-images-cli-";
const tempDirs: string[] = [];

let snapshotDir: string;
let binPath: string;

function makeFixture(html: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
  tempDirs.push(dir);
  const dist = join(dir, "dist");
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = join(dist, relativePath);
    const parent = resolve(filePath, "..");
    // `mkdirSync` with recursive=true is intentionally used here rather than
    // shelling out, so fixture paths remain confined to this fresh directory.
    mkdirSync(parent, { recursive: true });
    writeFileSync(filePath, contents);
  }
  const pagePath = join(dist, "docs", "index.html");
  mkdirSync(resolve(pagePath, ".."), { recursive: true });
  writeFileSync(pagePath, html);
  return dir;
}

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: 10_000,
  });
}

beforeAll(() => {
  snapshotDir = mkdtempSync(SNAPSHOT_PREFIX);
  cpSync(join(PACKAGE_ROOT, "bin"), join(snapshotDir, "bin"), { recursive: true });
  cpSync(join(PACKAGE_ROOT, "dist"), join(snapshotDir, "dist"), { recursive: true });
  binPath = join(snapshotDir, "bin", "zudo-doc.mjs");
  if (!existsSync(join(snapshotDir, "dist", "plugins/internal/img-src-check/index.js"))) {
    throw new Error("CLI snapshot is missing the compiled image scanner");
  }
});

afterAll(() => {
  if (snapshotDir) rmSync(snapshotDir, { recursive: true, force: true });
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("zudo-doc check images", () => {
  it("fails for a broken relative image and names its page, element, and URL", () => {
    const dir = makeFixture('<img src="../assets/missing.png">');
    const result = runCli(["check", "images"], dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "docs/index.html: img[src] ../assets/missing.png (file does not exist)",
    );
    expect(result.stdout).toContain("Found 1 broken image reference in 1 HTML file after allowlist.");
  });

  it("fails for a broken srcset candidate", () => {
    const dir = makeFixture(
      '<img srcset="/ok.png 1x, /assets/missing.png 2x">',
      { "ok.png": "image" },
    );
    const result = runCli(["check", "images"], dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "docs/index.html: img[srcset] /assets/missing.png (file does not exist)",
    );
  });

  it("returns zero with a one-line summary for clean output", () => {
    const dir = makeFixture('<img src="/assets/ok.png">', { "assets/ok.png": "image" });
    const result = runCli(["check", "images"], dir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n")).toEqual([
      "No broken image references found (1 HTML file, 1 local reference).",
    ]);
  });

  it("ignores blank and comment lines in an allowlist", () => {
    const dir = makeFixture('<img src="../assets/missing.png">');
    const allowlist = join(dir, "allowlist.txt");
    writeFileSync(
      allowlist,
      "\n# known generated fixture\r\ndocs/index.html:../assets/missing.png\n",
    );
    const result = runCli(["check", "images", "--allowlist", allowlist], dir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      "No broken image references found (1 HTML file, 1 local reference; 1 allowlisted).",
    );
    expect(result.stdout).not.toContain("missing.png (file does not exist)");
  });

  it("resolves the configured non-root base", () => {
    const dir = makeFixture('<img src="/docs/assets/ok.png">', { "assets/ok.png": "image" });
    const result = runCli(["check", "images", "--base", "/docs/"], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No broken image references found");
  });

  it("rejects a missing dist directory with a build-first message", () => {
    const dir = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
    tempDirs.push(dir);
    const result = runCli(["check", "images"], dir);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/run the build first/i);
  });

  it("rejects options outside the check-images contract", () => {
    const dir = makeFixture("");
    const result = runCli(["check", "images", "--unknown"], dir);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Unknown option "--unknown".');
  });

  it("documents the check command in top-level and command help", () => {
    const dir = mkdtempSync(join(tmpdir(), TEMP_PREFIX));
    tempDirs.push(dir);

    const top = runCli(["--help"], dir);
    expect(top.status).toBe(0);
    expect(top.stdout).toContain("check images");

    const nested = runCli(["check", "images", "--help"], dir);
    expect(nested.status).toBe(0);
    expect(nested.stdout).toContain("Usage: zudo-doc check images [options]");
  });

  it("accepts the pnpm argument separator before command options", () => {
    const dir = makeFixture('<img src="/assets/ok.png">', { "assets/ok.png": "image" });
    const result = runCli(["check", "images", "--", "--dist", "dist", "--base", "/"], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No broken image references found");
  });
});
