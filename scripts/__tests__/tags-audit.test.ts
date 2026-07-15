import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pluralize from "pluralize";
import stringSimilarity from "string-similarity";

import {
  audit,
  findNearDuplicates,
  hasHardIssues,
} from "@takazudo/zudo-doc/tags-audit";
import { settings } from "@/config/settings";
import { tagVocabulary } from "@/config/tag-vocabulary";
import type { TagVocabularyEntry } from "@takazudo/zudo-doc/settings";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const CLI = join(REPO_ROOT, "packages", "zudo-doc", "bin", "tags-audit.mjs");
const CONFIG = "src/config/tag-vocabulary.ts";
const NEAR_DUP_HELPERS = {
  singular: pluralize.singular,
  compareTwoStrings: stringSimilarity.compareTwoStrings,
};

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
    const pairs = findNearDuplicates(
      ["tutorial", "tutorials", "ai"],
      NEAR_DUP_HELPERS,
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reason).toBe("plural");
    expect(new Set([pairs[0]?.a, pairs[0]?.b])).toEqual(
      new Set(["tutorial", "tutorials"]),
    );
  });

  it("detects high-similarity near-duplicates", () => {
    const pairs = findNearDuplicates(
      ["deployment", "deployments"],
      NEAR_DUP_HELPERS,
    );
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

  it("smoke: explicit config and forwarded flags audit the live repo", () => {
    const result = spawnSync(
      process.execPath,
      [CLI, "--config", CONFIG, "--", "--ci", "--json"],
      {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        env: { ...process.env },
        timeout: 30_000,
      },
    );
    if (result.error) throw result.error;
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.unknowns).toEqual([]);
  });

  it("fails clearly when the explicit config input is missing", () => {
    const result = spawnSync(process.execPath, [CLI, "--ci"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1" },
      timeout: 30_000,
    });
    if (result.error) throw result.error;
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing required tag CLI config");
    expect(result.stderr).toContain("--config <path>");
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });

  it("fails clearly when the explicit config module has an invalid shape", () => {
    const invalidConfig = join(tmpdir(), `invalid-tag-config-${process.pid}.ts`);
    writeFileSync(invalidConfig, "export default { vocabulary: [] };\n", "utf-8");
    try {
      const result = spawnSync(
        process.execPath,
        [CLI, "--config", invalidConfig, "--json"],
        {
          cwd: REPO_ROOT,
          encoding: "utf-8",
          env: { ...process.env, NO_COLOR: "1" },
          timeout: 30_000,
        },
      );
      if (result.error) throw result.error;
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`Invalid tag CLI config "${invalidConfig}"`);
      expect(result.stderr).toContain("`contentDirs`");
      expect(result.stderr).not.toMatch(/\n\s+at /);
    } finally {
      rmSync(invalidConfig, { force: true });
    }
  });
});
