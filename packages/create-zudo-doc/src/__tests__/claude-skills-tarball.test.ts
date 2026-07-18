// Fast-tier tarball assertion (#2921): "the package builds" is NOT proof
// that the claudeSkills feature's 3 skill files actually ship in the npm
// tarball. npm `files` entries cannot reach outside the package dir, so the
// old scaffold.ts logic (reading from the monorepo's root .claude/skills/)
// silently no-op'd under a real npm install — nothing in that path was ever
// part of the tarball. This asserts the REAL file list `npm pack --dry-run
// --json` reports (no tarball written to disk, no publish) contains every
// committed skill template file.
//
// Modeled on packages/zudo-doc/src/__tests__/theme-packs-tarball.test.ts.
// Assumes `dist/` is already populated by a prior
// `pnpm --filter create-zudo-doc build` — this test only reads the
// tarball's computed file list, it never triggers a build itself.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");

interface NpmPackDryRunFile {
  path: string;
}
interface NpmPackDryRunEntry {
  files: NpmPackDryRunFile[];
}

// See theme-packs-tarball.test.ts for why this scans every `[` instead of
// naively parsing from the first bracket — some npm/CI combinations leak a
// lifecycle log line ahead of the JSON array.
function parsePackJson(stdout: string): NpmPackDryRunEntry[] {
  for (let i = stdout.indexOf("["); i !== -1; i = stdout.indexOf("[", i + 1)) {
    try {
      const value = JSON.parse(stdout.slice(i));
      if (Array.isArray(value)) return value as NpmPackDryRunEntry[];
    } catch {
      // Not the JSON array (e.g. a leaked log line) — keep scanning.
    }
  }
  throw new Error(
    `npm pack --dry-run --json produced no parseable JSON array. stdout:\n${stdout}`,
  );
}

function packFileList(): string[] {
  const stdout = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: PKG_ROOT, encoding: "utf8" },
  );
  const parsed = parsePackJson(stdout);
  const entry = parsed[0];
  if (!entry) throw new Error("npm pack --dry-run --json produced no entries");
  return entry.files.map((f) => f.path);
}

describe("npm tarball ships claudeSkills template files (#2921)", () => {
  let files: string[];
  beforeAll(() => {
    files = packFileList();
  }, 60_000);

  it("includes the 3 user-facing zudo-doc-* skill templates", () => {
    for (const skill of [
      "zudo-doc-design-system",
      "zudo-doc-translate",
      "zudo-doc-version-bump",
    ]) {
      expect(files).toContain(
        `templates/features/claudeSkills/files/.claude/skills/${skill}/SKILL.md`,
      );
    }
  });
});
