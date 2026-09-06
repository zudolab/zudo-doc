import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// This is the dynamic regression test for #3996: e2e/setup-fixtures.sh copies
// every top-level root public/* entry into a fixture's public/ unless the
// fixture already owns a real (git-tracked) entry of that name
// (e2e/setup-fixtures.sh:453). `.gitignore` must ignore the copied-through
// paths in non-owning fixtures without masking the real files that owning
// fixtures track under the same top-level name. Rather than hardcoding the
// current root public/ entries and fixture list, this test enumerates both
// live so a future root public/ addition is covered without editing this file.

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const ROOT_PUBLIC_DIR = resolve(REPO_ROOT, "public");
const FIXTURES_DIR = resolve(REPO_ROOT, "e2e", "fixtures");
const SETUP_FIXTURES = resolve(REPO_ROOT, "e2e", "setup-fixtures.sh");

/** Recursively collect file paths under `dir`, relative to `dir`, POSIX-joined. */
function listFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) {
      const nestedFiles = listFilesRecursive(full);
      if (nestedFiles.length === 0) {
        // An empty directory yields no files; without this the whole root
        // entry could contribute zero paths and the copy-through assertions
        // below would pass vacuously. The directory path itself is still a
        // copy-through target, so assert on it.
        files.push(name);
        continue;
      }
      for (const nested of nestedFiles) {
        files.push(`${name}/${nested}`);
      }
    } else {
      files.push(name);
    }
  }
  return files;
}

/**
 * git check-ignore --no-index is mandatory here, not a style choice: plain
 * `git check-ignore` treats an already-tracked path as exempt and reports it
 * "not ignored" regardless of whether a pattern matches it, which would make
 * the negative assertions below pass vacuously even under an over-broad rule
 * that masks smoke/i18n's tracked assets. --no-index checks the pattern
 * match itself, independent of the index (git-check-ignore(1)).
 */
function isIgnored(relativePath: string): boolean {
  const result = spawnSync(
    "git",
    ["check-ignore", "--no-index", "-q", relativePath],
    { cwd: REPO_ROOT },
  );
  // check-ignore exits 0 (ignored) / 1 (not ignored); anything else — or a
  // spawn failure — is a broken invocation, not an answer. Surface it rather
  // than silently reporting "not ignored", which would flip an assertion into
  // a misleading .gitignore failure.
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `git check-ignore failed for ${relativePath} (status ${String(result.status)})`,
    );
  }
  return result.status === 0;
}

function gitLsFiles(relativePath: string): string[] {
  const result = spawnSync("git", ["ls-files", "--", relativePath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  // An empty stdout is the "fixture does not own this entry" signal, so a
  // failed git call must not be allowed to masquerade as one — it would send
  // the assertions down the copy-through branch and blame .gitignore.
  if (result.error) throw result.error;
  if (result.status !== 0 || typeof result.stdout !== "string") {
    throw new Error(
      `git ls-files failed for ${relativePath} (status ${String(result.status)})`,
    );
  }
  return result.stdout.split("\n").filter((line) => line.length > 0);
}

const rootPublicEntries = readdirSync(ROOT_PUBLIC_DIR);
const fixtures = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe("fixture public/ copy-through stays gitignore-clean", () => {
  it.each(rootPublicEntries)(
    "root public/%s copy-through is covered for every fixture",
    (entryName) => {
      const entryPath = resolve(ROOT_PUBLIC_DIR, entryName);
      const relativeFilesUnderEntry = statSync(entryPath).isDirectory()
        ? listFilesRecursive(entryPath)
        : [""];

      for (const fixture of fixtures) {
        const fixtureEntryPath = `e2e/fixtures/${fixture}/public/${entryName}`;
        // Mirrors setup-fixtures.sh:453 — a fixture "owns" the entry when it
        // already has real, git-tracked files there, in which case the copy
        // is skipped entirely and the root's file layout never lands in the
        // fixture at all.
        const ownedFiles = gitLsFiles(fixtureEntryPath);

        if (ownedFiles.length > 0) {
          // Assert against the fixture's own tracked files (not root's file
          // layout, which the owning fixture need not mirror) — these must
          // stay reachable, i.e. not ignored.
          for (const ownedFile of ownedFiles) {
            expect(
              isIgnored(ownedFile),
              `${ownedFile} is owned by fixture "${fixture}" and must not be ignored`,
            ).toBe(false);
          }
        } else {
          // Non-owning: setup-fixtures.sh copies root's file layout verbatim
          // under the fixture, so those synthesized paths must be ignored.
          for (const relativeFile of relativeFilesUnderEntry) {
            const copiedPath = relativeFile
              ? `${fixtureEntryPath}/${relativeFile}`
              : fixtureEntryPath;
            expect(
              isIgnored(copiedPath),
              `${copiedPath} is a copy-through target for fixture "${fixture}" and must be ignored`,
            ).toBe(true);
          }
        }
      }
    },
  );
});

// This is the dynamic regression test for #3997: the merge predicate above
// (e2e/setup-fixtures.sh:453) must decide fixture ownership by asking git,
// not by testing on-disk existence. An on-disk `[ -e ]` check is satisfied
// just as well by a stale, untracked, empty leftover directory (e.g. from an
// earlier symlink-based fixture setup) as by a real git-tracked entry, which
// silently suppressed the copy-through on a warm tree while a fresh clone
// (which never has the leftover) behaved correctly — the bug is real but
// checkout-dependent. The suite above models the *intended* semantics
// abstractly and would pass even under the buggy shell predicate, since it
// never runs the shell script; these tests extract and execute the actual
// block so a regression to `[ -e ]` is caught.
describe("fixture public/ merge predicate asks git, not the filesystem (#3997)", () => {
  let sandboxRoot: string | undefined;

  afterEach(() => {
    if (sandboxRoot) rmSync(sandboxRoot, { recursive: true, force: true });
    sandboxRoot = undefined;
  });

  /**
   * Extract the real "merge fixture-specific files with root public/" block
   * from e2e/setup-fixtures.sh rather than re-typing its logic — a re-typed
   * copy could silently drift from the script and stop catching a regression
   * like #3997, where the predicate's own comment claimed git-tracked
   * semantics while the code tested the filesystem instead.
   */
  function extractPublicMergeBlock(): string {
    const script = readFileSync(SETUP_FIXTURES, "utf8");
    const startMarker =
      "# ----- Public dir: merge fixture-specific files with root public/ -----";
    const endMarker =
      "# ----- .zfb/doc-history-meta.json — required by the bundler -----";
    const start = script.indexOf(startMarker);
    const end = script.indexOf(endMarker, start);
    if (start < 0 || end <= start) {
      throw new Error(
        "could not locate the public/ merge block in e2e/setup-fixtures.sh — markers may have moved",
      );
    }
    const block = script.slice(start, end);
    const ifIndex = block.indexOf('if [ -d "$REPO_ROOT/public" ]; then');
    if (ifIndex < 0) {
      throw new Error(
        "could not locate the merge block's `if` statement in e2e/setup-fixtures.sh",
      );
    }
    return block.slice(ifIndex).trimEnd();
  }

  /** Run the extracted block against real REPO_ROOT/fixture_dir sandbox directories. */
  function runPublicMerge(repoRoot: string, fixtureDir: string): void {
    const block = extractPublicMergeBlock();
    const wrapped = `
set -euo pipefail
run_merge() {
  local REPO_ROOT="$1"
  local fixture_dir="$2"
${block}
}
run_merge "$1" "$2"
`;
    const result = spawnSync("bash", [
      "-c",
      wrapped,
      "bash",
      repoRoot,
      fixtureDir,
    ]);
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `extracted public/ merge block exited ${String(result.status)}: ${result.stderr.toString()}`,
      );
    }
  }

  function initSandboxRepo(): string {
    const repoRoot = mkdtempSync(join(tmpdir(), "fixture-public-merge-"));
    if (spawnSync("git", ["init", "-q"], { cwd: repoRoot }).status !== 0) {
      throw new Error(`git init failed in sandbox ${repoRoot}`);
    }
    return repoRoot;
  }

  function commitAll(
    repoRoot: string,
    pathspec: string,
    message: string,
  ): void {
    if (spawnSync("git", ["add", pathspec], { cwd: repoRoot }).status !== 0) {
      throw new Error(`git add ${pathspec} failed in sandbox ${repoRoot}`);
    }
    const commitResult = spawnSync(
      "git",
      [
        "-c",
        "user.email=test@example.com",
        "-c",
        "user.name=Test",
        "commit",
        "-q",
        "-m",
        message,
      ],
      { cwd: repoRoot },
    );
    if (commitResult.status !== 0) {
      throw new Error(`git commit failed in sandbox ${repoRoot}`);
    }
  }

  it("preserves a git-tracked fixture-owned entry instead of clobbering it", () => {
    sandboxRoot = initSandboxRepo();

    mkdirSync(resolve(sandboxRoot, "public", "assets"), { recursive: true });
    writeFileSync(
      resolve(sandboxRoot, "public", "assets", "root-file.txt"),
      "root\n",
    );

    const fixtureDir = resolve(sandboxRoot, "fixtures", "owning");
    mkdirSync(resolve(fixtureDir, "public", "assets"), { recursive: true });
    writeFileSync(
      resolve(fixtureDir, "public", "assets", "owned.txt"),
      "owned\n",
    );
    commitAll(
      sandboxRoot,
      "fixtures/owning/public/assets/owned.txt",
      "seed fixture-owned entry",
    );

    runPublicMerge(sandboxRoot, fixtureDir);

    expect(
      existsSync(resolve(fixtureDir, "public", "assets", "owned.txt")),
    ).toBe(true);
    expect(
      existsSync(resolve(fixtureDir, "public", "assets", "root-file.txt")),
    ).toBe(false);
  });

  it("does not let an untracked empty leftover directory suppress the copy-through", () => {
    sandboxRoot = initSandboxRepo();

    mkdirSync(resolve(sandboxRoot, "public", "assets"), { recursive: true });
    writeFileSync(
      resolve(sandboxRoot, "public", "assets", "root-file.txt"),
      "root\n",
    );

    // The bug: a stale, untracked, EMPTY directory of the same name (e.g. a
    // leftover from an earlier symlink-based fixture setup) satisfies `[ -e ]`
    // exactly as well as a real git-tracked entry, so the old predicate
    // treated this as "fixture-owned" and skipped the copy entirely.
    const fixtureDir = resolve(sandboxRoot, "fixtures", "leftover");
    mkdirSync(resolve(fixtureDir, "public", "assets"), { recursive: true });

    runPublicMerge(sandboxRoot, fixtureDir);

    expect(
      existsSync(resolve(fixtureDir, "public", "assets", "root-file.txt")),
    ).toBe(true);
  });
});
