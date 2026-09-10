// Build-level proof for the raw HTML image-source check (#4139).
//
// The fast scanner tests cover parsing and path semantics. These three small
// fixture builds prove the zfb lifecycle boundary: error fails the build,
// warn succeeds with diagnostics, and ignore does not scan. This file stays
// in the slow tier because each case starts a real zfb build.

import { afterAll, describe, expect, it } from "vitest";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const FIXTURE_SRC = resolve(__dirname, "fixtures/route-injection");
const WORKSPACE_ROOT = resolve(__dirname, "../../../..");
const BUILD_TIMEOUT_MS = 150_000;
const tempDirs: string[] = [];

function setupFixture(severity: "warn" | "error" | "ignore"): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-img-src-build-"));
  tempDirs.push(dir);
  cpSync(FIXTURE_SRC, dir, { recursive: true });
  symlinkSync(join(WORKSPACE_ROOT, "node_modules"), join(dir, "node_modules"));
  mkdirSync(join(dir, "pages"));
  mkdirSync(join(dir, ".zfb"), { recursive: true });
  writeFileSync(join(dir, ".zfb/doc-history-meta.json"), "{}");

  const settingsPath = join(dir, "src/config/settings.ts");
  const settings = readFileSync(settingsPath, "utf8");
  const marker = 'onBrokenMarkdownLinks: "warn"';
  if (!settings.includes(marker)) throw new Error("image check fixture settings marker missing");
  writeFileSync(settingsPath, settings.replace(marker, `onBrokenMarkdownLinks: "${severity}"`));

  const contentPath = join(dir, "src/content/docs/getting-started/index.mdx");
  writeFileSync(contentPath, `${readFileSync(contentPath, "utf8")}\n\n<img src="/missing.png">\n`);
  return dir;
}

function buildFixture(dir: string): { status: number; output: string } {
  const result = spawnSync(
    join(dir, "node_modules/.bin/zfb"),
    ["build", "--outdir", "dist"],
    {
      cwd: dir,
      env: { ...process.env, SKIP_DOC_HISTORY: "1" },
      encoding: "utf8",
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`,
  };
}

afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("img-src-check zfb build integration", () => {
  it("fails zfb build in error mode after reporting the broken image", { timeout: 180_000 }, () => {
    const result = buildFixture(setupFixture("error"));
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("[img-src-check] Broken image source");
    expect(result.output).toContain("/missing.png");
  });

  it("succeeds and prints the warning in warn mode", { timeout: 180_000 }, () => {
    const result = buildFixture(setupFixture("warn"));
    expect(result.status).toBe(0);
    expect(result.output).toContain("[img-src-check] Broken image source");
    expect(result.output).toContain("Found 1 broken image source");
  });

  it("succeeds without an image warning in ignore mode", { timeout: 180_000 }, () => {
    const result = buildFixture(setupFixture("ignore"));
    expect(result.status).toBe(0);
    expect(result.output).not.toContain("[img-src-check]");
  });
});
