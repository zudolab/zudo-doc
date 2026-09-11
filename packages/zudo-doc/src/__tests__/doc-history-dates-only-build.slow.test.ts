// Build-level proof for dates-only generated doc-history metadata (#4143).
//
// The fixture is copied to a temporary, git-initialized project and its single
// document is committed before zfb runs. This makes the preBuild manifest
// generation part of the proof: a hand-authored `.zfb/doc-history-meta.json`
// would only test rendering. The host chrome binding imports the generated
// manifest through `#doc-history-meta`, while `docHistoryUi: false` keeps the
// visible Updated metadata and suppresses the history island and JSON output.

import { afterAll, describe, expect, it } from "vitest";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const FIXTURE_SRC = resolve(__dirname, "fixtures/doc-history-dates-only");
const WORKSPACE_ROOT = resolve(__dirname, "../../../..");
const BUILD_TIMEOUT_MS = 150_000;
const ARTIFACT_DIR_ENV = "ZUDO_DOC_DATES_ONLY_ARTIFACT_DIR";
const tempDirs: string[] = [];

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: "Dates Only Fixture",
    GIT_AUTHOR_EMAIL: "dates-only@example.test",
    GIT_AUTHOR_DATE: "2024-06-01T00:00:00Z",
    GIT_COMMITTER_NAME: "Dates Only Fixture",
    GIT_COMMITTER_EMAIL: "dates-only@example.test",
    GIT_COMMITTER_DATE: "2024-06-01T00:00:00Z",
  };
}

function setupFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-doc-dates-only-"));
  tempDirs.push(dir);
  cpSync(FIXTURE_SRC, dir, { recursive: true });

  // Commit the source before adding local dependency links. The generated
  // manifest must come from this fixture's own git history, not the worktree.
  execFileSync("git", ["init", "--quiet"], { cwd: dir });
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "--quiet", "-m", "fixture"], {
    cwd: dir,
    env: gitEnv(),
  });

  symlinkSync(join(WORKSPACE_ROOT, "node_modules"), join(dir, "node_modules"));
  mkdirSync(join(dir, "pages"));
  return dir;
}

function buildFixture(dir: string): { status: number; output: string } {
  const env = { ...process.env };
  delete env.SKIP_DOC_HISTORY;
  env.GEN_DOC_HISTORY = "1";
  const result = spawnSync(
    join(dir, "node_modules/.bin/zfb"),
    ["build", "--outdir", "dist"],
    {
      cwd: dir,
      env,
      encoding: "utf8",
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`,
  };
}

function readBuiltHtml(dir: string): string {
  return readFileSync(
    join(dir, "dist/docs/getting-started/index.html"),
    "utf8",
  );
}

function preserveBuildArtifact(dir: string): void {
  const artifactDir = process.env[ARTIFACT_DIR_ENV];
  if (!artifactDir) return;
  mkdirSync(artifactDir, { recursive: true });
  cpSync(join(dir, "dist"), artifactDir, { recursive: true });
}

function readIslandMarkerValues(html: string): string[] {
  return [...html.matchAll(
    /\bdata-zfb-island(?:-[\w-]+)?\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
  )].flatMap((match) => [match[1], match[2], match[3]].filter((value): value is string => value !== undefined));
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? listJsonFiles(path)
      : entry.isFile() && entry.name.endsWith(".json")
        ? [path]
        : [];
  });
}

afterAll(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("doc-history dates-only build integration", () => {
  it("renders generated Updated metadata without the history UI artifacts", { timeout: 180_000 }, () => {
    const dir = setupFixture();
    const result = buildFixture(dir);
    expect(result.status, result.output).toBe(0);
    preserveBuildArtifact(dir);

    const html = readBuiltHtml(dir);
    const manifest = JSON.parse(
      readFileSync(join(dir, ".zfb/doc-history-meta.json"), "utf8"),
    ) as Record<string, Record<string, string>>;
    // The manifest's updatedDate is a producer-normalized ISO instant. The
    // exact offset token git emits for UTC has changed across git versions
    // (`+00:00` on older git, `Z` on current git — see #4158), so assert the
    // parsed instant rather than pinning either spelling as a literal string.
    expect(manifest["getting-started"]).toMatchObject({
      author: "Dates Only Fixture",
      ext: ".mdx",
    });
    expect(new Date(manifest["getting-started"]?.updatedDate ?? "").getTime()).toBe(
      new Date("2024-06-01T00:00:00Z").getTime(),
    );
    expect(html).toContain("Updated Jun 1, 2024");
    expect(html).not.toContain("Created");
    expect(html).not.toContain("Dates Only Fixture");
    expect(readIslandMarkerValues(html)).not.toContain("DocHistory");

    expect(listJsonFiles(join(dir, "dist/doc-history"))).toEqual([]);
  });
});
