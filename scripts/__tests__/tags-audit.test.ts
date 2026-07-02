import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  audit,
  computeRewrites,
  findNearDuplicates,
  hasHardIssues,
  rewriteAliasesByteStable,
} from "../tags-audit";
import { settings } from "@/config/settings";
import { tagVocabulary } from "@/config/tag-vocabulary";
import type { TagVocabularyEntry } from "@/config/tag-vocabulary-types";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "tags-audit.ts");
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");

const FIXTURE_VOCAB: readonly TagVocabularyEntry[] = [
  { id: "ai", group: "topic" },
  {
    id: "type:tutorial",
    group: "type",
    aliases: ["tutorial", "tutorials"],
  },
  {
    id: "content",
    group: "topic",
    aliases: ["contents"],
  },
  {
    id: "legacy-topic",
    group: "topic",
    deprecated: { redirect: "content" },
  },
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

  it("flags deprecated tags with redirect", async () => {
    writeDoc("docs/a.mdx", "title: A\ntags:\n  - legacy-topic");
    const report = await audit({
      rootDir: tmpDir,
      contentDirs: [join(tmpDir, "docs")],
      vocabulary: FIXTURE_VOCAB,
      governance: "warn",
      vocabularyActive: true,
    });
    expect(report.deprecated).toHaveLength(1);
    expect(report.deprecated[0]?.redirect).toBe("content");
    // Deprecated-with-redirect counts the canonical target in frequency.
    expect(report.frequency["content"]).toBe(1);
  });

  it("flags alias usage so --fix can rewrite them", async () => {
    writeDoc("docs/a.mdx", "title: A\ntags:\n  - tutorials");
    const report = await audit({
      rootDir: tmpDir,
      contentDirs: [join(tmpDir, "docs")],
      vocabulary: FIXTURE_VOCAB,
      governance: "warn",
      vocabularyActive: true,
    });
    expect(report.aliases).toHaveLength(1);
    expect(report.aliases[0]?.raw).toBe("tutorials");
    expect(report.aliases[0]?.canonical).toBe("type:tutorial");
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

describe("tags-audit — --fix byte-stable rewrite", () => {
  it("rewrites a block-style alias and leaves the rest of the file byte-stable", () => {
    const original =
      "---\n" +
      "title: My page\n" +
      "description: Something — with em-dash.\n" +
      "sidebar_position: 2\n" +
      "tags:\n" +
      "  - tutorials\n" +
      "  - ai\n" +
      "---\n" +
      "\n" +
      "## Heading\n" +
      "\n" +
      "Body text with `code` and **bold**.\n";
    const rewrites = new Map([
      ["tutorials", "type:tutorial"],
      ["tutorial", "type:tutorial"],
    ]);
    const { content, changed } = rewriteAliasesByteStable(original, rewrites);
    expect(changed).toBe(true);

    // Only the `tutorials` line should differ.
    const origLines = original.split("\n");
    const newLines = content.split("\n");
    expect(newLines).toHaveLength(origLines.length);
    const diffIndexes = origLines
      .map((line, i) => (line === newLines[i] ? -1 : i))
      .filter((i) => i !== -1);
    expect(diffIndexes).toHaveLength(1);
    expect(origLines[diffIndexes[0]!]).toBe("  - tutorials");
    expect(newLines[diffIndexes[0]!]).toBe("  - type:tutorial");
  });

  it("rewrites flow-style aliases in place", () => {
    const original =
      "---\n" + "title: X\n" + "tags: [tutorials, ai]\n" + "---\n" + "\n" + "Body.\n";
    const rewrites = new Map([["tutorials", "type:tutorial"]]);
    const { content, changed } = rewriteAliasesByteStable(original, rewrites);
    expect(changed).toBe(true);
    expect(content).toContain("tags: [type:tutorial, ai]");
  });

  it("rewrites aliases while preserving CRLF line endings", () => {
    const original =
      "---\r\n" +
      "title: X\r\n" +
      "tags:\r\n" +
      "  - tutorials\r\n" +
      "  - ai\r\n" +
      "---\r\n" +
      "\r\n" +
      "Body.\r\n";
    const rewrites = new Map([["tutorials", "type:tutorial"]]);
    const { content, changed } = rewriteAliasesByteStable(original, rewrites);
    expect(changed).toBe(true);
    expect(content).toContain("  - type:tutorial\r\n");
    // Every original line ending must stay CRLF; we never want to silently
    // collapse to LF when editing a Windows-authored file.
    expect(content.match(/\r\n/g)?.length).toBe(original.match(/\r\n/g)?.length);
  });

  it("rewrites quoted block-style aliases and preserves the quote style", () => {
    const original = "---\n" + 'title: X\n' + "tags:\n" + '  - "tutorials"\n' + "---\n";
    const { content, changed } = rewriteAliasesByteStable(
      original,
      new Map([["tutorials", "type:tutorial"]]),
    );
    expect(changed).toBe(true);
    expect(content).toContain('  - "type:tutorial"');
  });

  it("is a no-op on an empty flow-style tags array", () => {
    const original = "---\ntitle: X\ntags: []\n---\n\nBody.\n";
    const { content, changed } = rewriteAliasesByteStable(
      original,
      new Map([["tutorials", "type:tutorial"]]),
    );
    expect(changed).toBe(false);
    expect(content).toBe(original);
  });

  it("is a no-op when no alias matches", () => {
    const original =
      "---\n" + "title: X\n" + "tags:\n  - ai\n" + "---\n" + "\n" + "Body.\n";
    const rewrites = new Map([["tutorials", "type:tutorial"]]);
    const { content, changed } = rewriteAliasesByteStable(original, rewrites);
    expect(changed).toBe(false);
    expect(content).toBe(original);
  });

  it("computeRewrites returns alias→canonical map for a vocabulary", () => {
    const map = computeRewrites(FIXTURE_VOCAB);
    expect(map.get("tutorial")).toBe("type:tutorial");
    expect(map.get("tutorials")).toBe("type:tutorial");
    expect(map.get("contents")).toBe("content");
    // Deprecated-with-redirect: the deprecated id itself becomes a rewrite source.
    expect(map.get("legacy-topic")).toBe("content");
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
