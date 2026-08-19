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
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

const LIFECYCLE_OUTPUT_RE =
  /(?:^> .*\b(?:prepare|prepack)\b|\[(?:copy-theme-css|copy-content-css|copy-page-loading-css|copy-features-css|copy-eject-sources|copy-routes-src|copy-virtual-modules|copy-theme-packs|gen-catalog|gen-search-widget-script)\]|^gen-safelist:)/m;

// See theme-packs-tarball.test.ts for why this scans every `[` instead of
// naively parsing from the first bracket. Lifecycle output is rejected below;
// this remains as defence-in-depth for unrelated npm output.
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
  // npm 10 can run `prepare` despite both ignore-scripts forms. Removing npm
  // pack's lifecycle hooks from a throwaway snapshot makes the live package
  // structurally unreachable by any script while preserving its file list.
  const snapshotRoot = mkdtempSync(resolve(tmpdir(), "create-zudo-doc-pack-"));
  try {
    cpSync(PKG_ROOT, snapshotRoot, {
      recursive: true,
      filter: (source) => source !== resolve(PKG_ROOT, "node_modules"),
    });
    const packageJsonPath = resolve(snapshotRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    if (packageJson.scripts) {
      delete packageJson.scripts.prepare;
      delete packageJson.scripts.prepack;
      delete packageJson.scripts.postpack;
    }
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

    const result = spawnSync(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: snapshotRoot,
        encoding: "utf8",
        env: { ...process.env, npm_config_ignore_scripts: "true" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.error) throw result.error;
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    expect(
      `${stdout}\n${stderr}`,
      "npm pack must not run prepare, prepack, or the tsup onSuccess chain",
    ).not.toMatch(LIFECYCLE_OUTPUT_RE);
    if (result.status !== 0) {
      throw new Error(
        `npm pack --dry-run --json exited with status ${result.status}. stderr:\n${stderr}`,
      );
    }
    const parsed = parsePackJson(stdout);
    const entry = parsed[0];
    if (!entry) throw new Error("npm pack --dry-run --json produced no entries");
    return entry.files.map((f) => f.path);
  } finally {
    rmSync(snapshotRoot, { recursive: true, force: true });
  }
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

  it("includes the claudeSkillsWriting zudo-doc-writing skill template", () => {
    expect(files).toContain(
      "templates/features/claudeSkillsWriting/files/.claude/skills/zudo-doc-writing/SKILL.md",
    );
  });
});
