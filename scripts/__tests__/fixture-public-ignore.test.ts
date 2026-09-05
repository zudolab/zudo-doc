import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

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

/** Recursively collect file paths under `dir`, relative to `dir`, POSIX-joined. */
function listFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) {
      for (const nested of listFilesRecursive(full)) {
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
  return result.status === 0;
}

function gitLsFiles(relativePath: string): string[] {
  const result = spawnSync("git", ["ls-files", "--", relativePath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
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
