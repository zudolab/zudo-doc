import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  audit,
  findNearDuplicates,
  hasHardIssues,
} from "../tags-audit";
import { settings } from "@/config/settings";
import { tagVocabulary } from "@/config/tag-vocabulary";
import type { TagVocabularyEntry } from "@takazudo/zudo-doc/settings";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "tags-audit.ts");
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");

const FIXTURE_VOCAB: readonly TagVocabularyEntry[] = [
  { id: "ai", group: "topic" },
  { id: "type:tutorial", group: "type" },
  { id: "content", group: "topic" },
];

describe("tags-audit — detection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tags-audit-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  function writeDoc(relPath: string, frontmatter: string, body = "Body.") {
    const full = join(tmpDir, relPath);
    mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true });
    writeFileSync(full, `---\n${frontmatter}\n---\n\n${body}\n`, "utf-8");
  }

  it("flags unknown tags", async () => {
    writeDoc("docs/a.mdx", "title: A\ntags:\n  - totally-made-up");
    const report = await audit({
      rootDir: tmpDir,
      contentDirs: [join(tmpDir, "docs")],
      vocabulary: FIXTURE_VOCAB,
      governance: "warn",
      vocabularyActive: true,
    });
    expect(report.unknowns).toHaveLength(1);
    expect(report.unknowns[0]?.raw).toBe("totally-made-up");
    expect(hasHardIssues(report)).toBe(true);
  });

  it("reports a retired id as unknown without rewriting its frequency", async () => {
    writeDoc("docs/a.mdx", "title: A\ntags:\n  - tutorials");
    const report = await audit({
      rootDir: tmpDir,
      contentDirs: [join(tmpDir, "docs")],
      vocabulary: FIXTURE_VOCAB,
      governance: "warn",
      vocabularyActive: true,
    });
    expect(report.unknowns).toEqual([
      expect.objectContaining({ raw: "tutorials" }),
    ]);
    expect(report.frequency).toMatchObject({ tutorials: 1 });
    expect(report.frequency["type:tutorial"]).toBeUndefined();
  });

  it("reports orphan vocabulary entries", async () => {
    writeDoc("docs/a.mdx", "title: A\ntags:\n  - ai");
    const report = await audit({
      rootDir: tmpDir,
      contentDirs: [join(tmpDir, "docs")],
      vocabulary: FIXTURE_VOCAB,
      governance: "warn",
      vocabularyActive: true,
    });
    expect(report.orphans.sort()).toEqual(["content", "type:tutorial"]);
  });

  it("detects plural-vs-singular near-duplicate pairs", () => {
    const pairs = findNearDuplicates(["tutorial", "tutorials", "ai"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reason).toBe("plural");
    expect(new Set([pairs[0]?.a, pairs[0]?.b])).toEqual(
      new Set(["tutorial", "tutorials"]),
    );
  });

  it("detects high-similarity near-duplicates", () => {
    const pairs = findNearDuplicates(["deployment", "deployments"]);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("tags-audit — CLI exit codes", () => {
  // Live-repo content dirs, mirroring the CLI runner in ../tags-audit.ts
  // (docsDir + every configured locale dir).
  const docsDir = join(REPO_ROOT, settings.docsDir);
  const localeDirs = Object.values(settings.locales ?? {}).map((l) =>
    join(REPO_ROOT, l.dir),
  );
  const contentDirs = [docsDir, ...localeDirs];
  const vocabularyActive =
    Boolean(settings.tagVocabulary) && settings.tagGovernance !== "off";

  it("finds no hard issues auditing the live repo content in-process", async () => {
    const report = await audit({
      rootDir: REPO_ROOT,
      contentDirs,
      vocabulary: tagVocabulary,
      governance: settings.tagGovernance,
      vocabularyActive,
    });
    expect(report.unknowns).toEqual([]);
    expect(hasHardIssues(report)).toBe(false);
  });

  // One out-of-process smoke test to exercise the real CLI entrypoint
  // (argv parsing, --ci/--json flags, process.exit codes) end to end.
  // Spawns the locally-installed tsx binary directly (no `pnpm exec` layer)
  // with an explicit timeout — mirrors scripts/__tests__/tags-suggest.test.ts.
  it("smoke: CLI subprocess exits 0 under --ci --json against the live repo", () => {
    const result = spawnSync(TSX_BIN, [SCRIPT, "--ci", "--json"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      env: { ...process.env },
      timeout: 30_000,
    });
    if (result.error) throw result.error;
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.unknowns).toEqual([]);
  });
});
