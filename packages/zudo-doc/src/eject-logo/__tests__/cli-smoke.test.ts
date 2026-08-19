// Subprocess smoke tests for `zudo-doc eject logo` — runs the real
// `bin/zudo-doc.mjs` entry (compiled `dist/eject-logo/`) against a temp
// project dir, the same way an end user would invoke the published CLI.
// Complements config-rewriter.test.ts / site-name.test.ts / eject.test.ts,
// which exercise the pure logic and the programmatic `ejectLogo()` API
// directly.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { spawnSync } from "node:child_process";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../../..");
const SNAPSHOT_PREFIX = path.join(PACKAGE_ROOT, ".cli-snapshot-");
const REQUIRED_DIST_ENTRYPOINTS = [
  "eject/index.js",
  "eject-logo/index.js",
  "theme-cli/index.js",
];

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
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf8",
    // Explicit subprocess deadline (#3465): a hung CLI fails as "the
    // subprocess exceeded its own deadline" (SIGTERM here) rather than the
    // ambiguous "Test timed out in 5000ms." vitest previously produced.
    // Sized so that the WORST CASE — two sequential runCli() calls in one
    // test (the "second run" cases below) — still totals under the package
    // testTimeout (30_000, vitest.config.ts); a per-call 25s would have let
    // two hung runs blow the blunt test timeout first, defeating the point.
    timeout: 10_000,
  });
}

let snapshotDir: string | undefined;
let binPath: string;
let tempDir: string;
let projectDir: string;
let configPath: string;
let svgPath: string;

beforeAll(async () => {
  // Keep the snapshot inside the package so the copied bin's bare imports
  // (minimist and picocolors) still resolve through package/workspace
  // node_modules. A system-temp snapshot cannot resolve those dependencies.
  let lastCopyError: unknown;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = await fs.mkdtemp(SNAPSHOT_PREFIX);
    try {
      await fs.copy(path.join(PACKAGE_ROOT, "bin"), path.join(candidate, "bin"));
      await fs.copy(
        path.join(PACKAGE_ROOT, "dist"),
        path.join(candidate, "dist"),
      );
      for (const entrypoint of REQUIRED_DIST_ENTRYPOINTS) {
        if (!(await fs.pathExists(path.join(candidate, "dist", entrypoint)))) {
          throw new Error(`CLI snapshot is missing dist/${entrypoint}`);
        }
      }
      snapshotDir = candidate;
      binPath = path.join(candidate, "bin", "zudo-doc.mjs");
      return;
    } catch (error) {
      // A concurrent `tsup` clean may remove live dist files mid-copy. Drop
      // the partial candidate and retry until one immutable copy completes.
      lastCopyError = error;
      await fs.remove(candidate);
      await delay(50);
    }
  }
  throw lastCopyError ?? new Error("Could not create CLI snapshot");
});

afterAll(async () => {
  if (snapshotDir) {
    await fs.remove(snapshotDir);
  }
});

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
