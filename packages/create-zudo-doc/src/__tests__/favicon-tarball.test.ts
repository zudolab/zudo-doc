// Fast-tier tarball assertion (#3186): "the base template dir has the
// favicon files" is NOT proof they actually ship in the npm tarball — npm
// `files` entries cannot reach outside the package dir. This asserts the
// REAL file list `npm pack --dry-run --json` reports (no tarball written to
// disk, no publish) contains every default public/ favicon file.
//
// Modeled on claude-skills-tarball.test.ts. Assumes `dist/` is already
// populated by a prior `pnpm --filter create-zudo-doc build` — this test
// only reads the tarball's computed file list, it never triggers a build
// itself.

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

describe("npm tarball ships the default public/ favicon set (#3186)", () => {
  let files: string[];
  beforeAll(() => {
    files = packFileList();
  }, 60_000);

  it("includes all 4 favicon files from templates/base/public/", () => {
    for (const favicon of [
      "favicon.svg",
      "favicon.ico",
      "favicon-32x32.png",
      "favicon-16x16.png",
    ]) {
      expect(files).toContain(`templates/base/public/${favicon}`);
    }
  });
});
