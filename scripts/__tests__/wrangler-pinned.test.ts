import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveWranglerVersion } from "../wrangler-pinned.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRIPT = resolve(ROOT, "scripts/wrangler-pinned.mjs");
const ARGS = [
  "versions",
  "upload",
  "--config",
  "a b.toml",
  "--preview-alias",
  "pr-1",
  "--message=Preview: x @ abc",
];

let tmp: string;
let invocationLog: string;

function writeManifest(contents: string | null) {
  const path = join(tmp, "package.json");
  if (contents === null) rmSync(path, { force: true });
  else writeFileSync(path, contents);
}

function pinManifest(wrangler: unknown) {
  writeManifest(JSON.stringify({ name: "tmp", devDependencies: { wrangler } }));
}

function run(args: string[], fakeExit = 0) {
  return spawnSync(process.execPath, [join(tmp, "scripts/wrangler-pinned.mjs"), ...args], {
    cwd: tmp,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${join(tmp, "bin")}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_NPX_LOG: invocationLog,
      FAKE_NPX_EXIT: String(fakeExit),
    },
  });
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "wrangler-pinned-"));
  invocationLog = join(tmp, "npx-argv.json");
  mkdirSync(join(tmp, "scripts"));
  mkdirSync(join(tmp, "bin"));
  copyFileSync(SCRIPT, join(tmp, "scripts/wrangler-pinned.mjs"));
  const fakeNpx = join(tmp, "bin/npx");
  writeFileSync(
    fakeNpx,
    [
      `#!${process.execPath}`,
      'const { writeFileSync } = require("node:fs");',
      "writeFileSync(process.env.FAKE_NPX_LOG, JSON.stringify(process.argv.slice(2)));",
      'process.stdout.write("fake-stdout https://pr-1-zudo-doc.example.workers.dev\\n");',
      'process.stderr.write("fake-stderr\\n");',
      "process.exit(Number(process.env.FAKE_NPX_EXIT));",
      "",
    ].join("\n"),
  );
  chmodSync(fakeNpx, 0o755);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("wrangler-pinned", () => {
  it("runs without any node_modules in its tree", () => {
    pinManifest("4.149.0");
    expect(existsSync(join(tmp, "node_modules"))).toBe(false);
    expect(run(["--print-version"]).status).toBe(0);
  });

  it("invokes npx with the exact pin and the original args verbatim", () => {
    pinManifest("4.149.0");
    const result = run(ARGS);

    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(invocationLog, "utf8"))).toEqual([
      "--yes",
      "wrangler@4.149.0",
      ...ARGS,
    ]);
    expect(result.stdout).toBe("fake-stdout https://pr-1-zudo-doc.example.workers.dev\n");
    expect(result.stderr).toContain("fake-stderr\n");
    expect(result.stderr).toContain(
      "wrangler-pinned: using wrangler@4.149.0 (exact pin from package.json devDependencies.wrangler)",
    );
  });

  it("accepts prerelease/build-metadata exact versions", () => {
    pinManifest("4.150.0-beta.1+build.5");
    run(["deploy"]);
    expect(JSON.parse(readFileSync(invocationLog, "utf8"))).toEqual([
      "--yes",
      "wrangler@4.150.0-beta.1+build.5",
      "deploy",
    ]);
  });

  it("propagates a non-zero child exit status exactly", () => {
    pinManifest("4.149.0");
    const result = run(["deploy"], 7);
    expect(result.status).toBe(7);
    expect(existsSync(invocationLog)).toBe(true);
  });

  it("prints the resolved version without invoking npx", () => {
    pinManifest("4.149.0");
    const result = run(["--print-version"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("4.149.0\n");
    expect(existsSync(invocationLog)).toBe(false);
  });

  const rejected: [string, () => void][] = [
    ["missing manifest", () => writeManifest(null)],
    ["invalid JSON", () => writeManifest("{ not json")],
    ["missing devDependencies", () => writeManifest(JSON.stringify({ name: "tmp" }))],
    ["missing wrangler field", () => writeManifest(JSON.stringify({ devDependencies: {} }))],
    ...["^4.149.0", "~4.149.0", ">=4", "latest", "4.x", "workspace:*", "npm:wrangler@4.149.0", " 4.149.0", "4.149", ""].map(
      (value) => [`ranged/unusable ${JSON.stringify(value)}`, () => pinManifest(value)] as [string, () => void],
    ),
    ["non-string value", () => pinManifest(4)],
  ];

  for (const [label, setup] of rejected) {
    it(`fails without invoking npx on ${label}`, () => {
      setup();
      for (const args of [ARGS, ["--print-version"]]) {
        const result = run(args);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("::error::wrangler-pinned:");
        expect(result.stdout).toBe("");
        expect(existsSync(invocationLog)).toBe(false);
      }
    });
  }

  it("resolves the repository's own pin from the root manifest", () => {
    const manifestPath = resolve(ROOT, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(resolveWranglerVersion(manifestPath)).toBe(manifest.devDependencies.wrangler);
    expect(resolveWranglerVersion()).toBe(manifest.devDependencies.wrangler);
  });
});
