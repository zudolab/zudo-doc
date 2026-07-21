// Subprocess smoke tests for `zudo-doc eject logo` — runs the real
// `bin/zudo-doc.mjs` entry (compiled `dist/eject-logo/`) against a temp
// project dir, the same way an end user would invoke the published CLI.
// Complements config-rewriter.test.ts / site-name.test.ts / eject.test.ts,
// which exercise the pure logic and the programmatic `ejectLogo()` API
// directly.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.resolve(__dirname, "../../../bin/zudo-doc.mjs");

const TEMP_PREFIX = "eject-logo-cli-smoke-";

const CANONICAL_CONFIG = `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
  }),
);
`;

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], { cwd, encoding: "utf8" });
}

let tempDir: string;
let projectDir: string;
let configPath: string;
let svgPath: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  projectDir = path.join(tempDir, "project");
  await fs.ensureDir(projectDir);
  configPath = path.join(projectDir, "zfb.config.ts");
  svgPath = path.join(projectDir, "public", "img", "logo.svg");
});

afterEach(async () => {
  await fs.remove(tempDir);
});

describe("zudo-doc eject logo — subprocess smoke", () => {
  it("succeeds and writes both files", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    const result = runCli(["eject", "logo", "--seed", "Docs"], projectDir);
    expect(result.status).toBe(0);
    expect(await fs.pathExists(svgPath)).toBe(true);
    expect(await fs.readFile(configPath, "utf8")).toContain('logo: "/img/logo.svg",');
  });

  it("exits nonzero on a second run without --force", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    runCli(["eject", "logo", "--seed", "Docs"], projectDir);

    const second = runCli(["eject", "logo", "--seed", "Docs"], projectDir);
    expect(second.status).not.toBe(0);
    expect(second.stderr).toMatch(/already exists/);
  });

  it("--force overwrites on a second run", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    runCli(["eject", "logo", "--seed", "Docs"], projectDir);

    const second = runCli(["eject", "logo", "--seed", "Docs", "--force"], projectDir);
    expect(second.status).toBe(0);
  });

  it("a missing --seed value is a usage error", async () => {
    await fs.writeFile(configPath, CANONICAL_CONFIG, "utf8");
    const result = runCli(["eject", "logo", "--seed"], projectDir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Missing value for --seed/);
    expect(await fs.pathExists(svgPath)).toBe(false);
  });

  it("top-level --help mentions eject logo", () => {
    const result = runCli(["--help"], projectDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("eject logo");
  });

  it("eject --help (the eject help path) mentions eject logo", () => {
    const result = runCli(["eject", "--help"], projectDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("eject logo");
  });

  it("a duplicate logo member refusal still writes the SVG and exits nonzero", async () => {
    await fs.writeFile(
      configPath,
      `import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";

export default defineConfig(
  zudoDoc({
    siteName: "Docs",
    logo: "/a.svg",
    logo: "/b.svg",
  }),
);
`,
      "utf8",
    );
    const result = runCli(["eject", "logo"], projectDir);
    expect(result.status).not.toBe(0);
    expect(await fs.pathExists(svgPath)).toBe(true);
    expect(result.stderr).toContain('logo: "/img/logo.svg",');
  });
});
