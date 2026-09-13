// Published-package proof for `zudo-doc check images` (#4185).
//
// This deliberately packs and installs the package into a fresh consumer. A
// workspace test that invokes the live bin can accidentally pass with a stale
// dist/ tree; this test runs the tarball's bin with no package source present.

import { afterAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PACKAGE_ROOT = resolve(__dirname, "../..");
const tempDirs: string[] = [];

function run(command: string, args: string[], cwd: string, timeout: number) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout,
  });
}

function packPackage(): string {
  const packDir = mkdtempSync(join(tmpdir(), "zudo-doc-cli-pack-"));
  tempDirs.push(packDir);
  const result = run("npm", ["pack", "--pack-destination", packDir], PACKAGE_ROOT, 180_000);
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  const tarball = readdirSync(packDir).find((entry) => entry.endsWith(".tgz"));
  if (!tarball) throw new Error(`npm pack produced no tarball in ${packDir}`);
  return join(packDir, tarball);
}

describe("installed zudo-doc check images bin", () => {
  it("runs the compiled scanner from an installed package tarball", { timeout: 240_000 }, () => {
    const tarball = packPackage();
    const consumer = mkdtempSync(join(tmpdir(), "zudo-doc-cli-consumer-"));
    tempDirs.push(consumer);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({ name: "zudo-doc-cli-consumer", private: true, version: "1.0.0" }) + "\n",
    );

    const install = run(
      "npm",
      ["install", "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarball],
      consumer,
      180_000,
    );
    expect(install.status, `${install.stdout}\n${install.stderr}`).toBe(0);

    const installedPackage = join(consumer, "node_modules", "@takazudo", "zudo-doc");
    expect(existsSync(join(installedPackage, "src"))).toBe(false);
    expect(existsSync(join(installedPackage, "dist", "plugins/internal/img-src-check/index.js"))).toBe(true);

    const dist = join(consumer, "fixture-dist");
    mkdirSync(join(dist, "docs"), { recursive: true });
    writeFileSync(join(dist, "docs", "index.html"), '<img src="/assets/missing.png">\n');

    const binPath = join(consumer, "node_modules", ".bin", "zudo-doc");
    const cli = run("node", [binPath, "check", "images", "--dist", "fixture-dist"], consumer, 10_000);
    expect(cli.status).toBe(1);
    expect(cli.stdout).toContain(
      "docs/index.html: img[src] /assets/missing.png (file does not exist)",
    );
    expect(cli.stdout).toContain("Found 1 broken image reference");
  });
});

afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
