import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PROJECT_ROOT = resolve(__dirname, "../..");
const SCRIPT_PATH = resolve(PROJECT_ROOT, "scripts/tags-suggest.ts");

/**
 * Invoke the CLI out-of-process via the locally-installed `tsx` binary so
 * we exercise the exact entrypoint users run through `pnpm tags:suggest`.
 * These tests never hit a real Ollama — the script is opt-in and running
 * an LLM in unit tests would be too slow and nondeterministic.
 */
function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  const tsxBin = resolve(PROJECT_ROOT, "node_modules/.bin/tsx");
  const result = spawnSync(tsxBin, [SCRIPT_PATH, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe("tags:suggest CLI", () => {
  it("--help prints usage including the Ollama setup note", () => {
    const { status, stdout } = runCli(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("Ollama setup:");
    expect(stdout).toContain("ollama pull");
    expect(stdout).toContain("--batch");
    expect(stdout).toContain("--host");
    expect(stdout).toContain("--model");
  });

  it("exits 2 with a clean single-line error when Ollama is unreachable (no stack trace)", () => {
    // Create a minimal fixture file so we get past the usage-error path
    // and into the Ollama call.
    const dir = mkdtempSync(join(tmpdir(), "tags-suggest-"));
    const fixture = join(dir, "sample.mdx");
    writeFileSync(
      fixture,
      "---\ntitle: Sample\ntags: []\n---\n\n## Body\n\nHello.\n",
      "utf-8",
    );
    try {
      // 127.0.0.1:1 is guaranteed-unusable on every platform: port 1 is
      // reserved and won't have an Ollama daemon on it.
      const { status, stderr, stdout } = runCli([
        "--host",
        "http://127.0.0.1:1",
        fixture,
      ]);
      expect(status).toBe(2);
      expect(stderr).toContain("Ollama not reachable at http://127.0.0.1:1");
      expect(stderr).toContain("https://ollama.com/");
      // No stack trace — no "at " frames, no filepath:line markers.
      expect(stderr).not.toMatch(/\n\s+at /);
      expect(stdout).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits 1 with a usage error when no files are passed", () => {
    const { status, stderr } = runCli([]);
    expect(status).toBe(1);
    expect(stderr).toContain("no input files");
  });
});
