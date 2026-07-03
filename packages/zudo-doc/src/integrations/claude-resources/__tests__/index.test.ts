import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import { runClaudeResourcesPreStep } from "../index.js";

// Exercises the imperative runner `runClaudeResourcesPreStep` — in particular
// the `scanRoot` option that decouples CLAUDE.md discovery from the generated-
// output base (#2558). The fixture models a subdirectory-monorepo doc site:
//
//   REPO_ROOT/
//   ├─ CLAUDE.md                 (repo-root guidance)
//   ├─ app/CLAUDE.md             (sibling-package guidance)
//   ├─ .claude/commands/…        (commands source — follows claudeDir, not scanRoot)
//   └─ docs-site/
//      ├─ CLAUDE.md              (the doc package's own guidance)
//      └─ src/content/docs/      (output base — docsDir default)

let repoRoot: string;
let docsSite: string;
let claudeDir: string;
let outDir: string;

function createMonorepoFixture() {
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "claude-res-runner-"));
  docsSite = path.join(repoRoot, "docs-site");
  claudeDir = path.join(repoRoot, ".claude");
  outDir = path.join(docsSite, "src", "content", "docs");

  fs.mkdirSync(docsSite, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Three CLAUDE.md files at different depths.
  fs.writeFileSync(path.join(repoRoot, "CLAUDE.md"), "# Repo root\n\nRoot guidance.");
  fs.mkdirSync(path.join(repoRoot, "app"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "app", "CLAUDE.md"), "# App\n\nApp guidance.");
  fs.writeFileSync(path.join(docsSite, "CLAUDE.md"), "# Docs site\n\nDoc-site guidance.");

  // A command so we can assert claudeDir-sourced resources are unaffected by scanRoot.
  const commandsDir = path.join(claudeDir, "commands");
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.writeFileSync(
    path.join(commandsDir, "test-cmd.md"),
    '---\ndescription: "A test command"\n---\n\nBody.',
  );
}

/** Titles of the generated claude-md pages (frontmatter `title` = `/relPath`). */
function claudeMdTitles(): string[] {
  const dir = path.join(outDir, "claude-md");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") && f !== "index.mdx")
    .map((f) => matter(fs.readFileSync(path.join(dir, f), "utf8")).data.title as string)
    .sort();
}

describe("runClaudeResourcesPreStep — scanRoot decoupling", () => {
  beforeEach(() => {
    createMonorepoFixture();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("(a) writes output under projectRoot's docsDir while scanning from scanRoot", () => {
    const counts = runClaudeResourcesPreStep({
      claudeDir,
      projectRoot: docsSite,
      scanRoot: repoRoot,
    });

    // Output base = projectRoot (docs-site), NOT scanRoot (repo root).
    expect(fs.existsSync(path.join(outDir, "claude-md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "src", "content", "docs"))).toBe(false);

    // Scan root = scanRoot: all three CLAUDE.md files discovered.
    expect(counts.claudemd).toBe(3);
    // claudeDir-sourced resources are independent of scanRoot.
    expect(counts.commands).toBe(1);
  });

  it("(b)+(c) discovers repo-wide CLAUDE.md and titles them relative to scanRoot", () => {
    runClaudeResourcesPreStep({ claudeDir, projectRoot: docsSite, scanRoot: repoRoot });

    // Slugs are file-named; titles are `/relPath` relative to scanRoot.
    expect(fs.existsSync(path.join(outDir, "claude-md", "root.mdx"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "claude-md", "app.mdx"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "claude-md", "docs-site.mdx"))).toBe(true);

    expect(claudeMdTitles()).toEqual([
      "/CLAUDE.md",
      "/app/CLAUDE.md",
      "/docs-site/CLAUDE.md",
    ]);
  });

  it("resolves a relative scanRoot against projectRoot", () => {
    const counts = runClaudeResourcesPreStep({
      claudeDir,
      projectRoot: docsSite,
      scanRoot: "..", // relative to projectRoot (docs-site) => repo root
    });

    expect(counts.claudemd).toBe(3);
    expect(claudeMdTitles()).toEqual([
      "/CLAUDE.md",
      "/app/CLAUDE.md",
      "/docs-site/CLAUDE.md",
    ]);
  });

  it("(d) backward compat: unset scanRoot confines discovery to projectRoot", () => {
    const counts = runClaudeResourcesPreStep({
      claudeDir,
      projectRoot: docsSite,
      // scanRoot omitted => defaults to projectRoot (docs-site)
    });

    // Only the doc-site's own CLAUDE.md is found; repo-root and app are outside.
    expect(counts.claudemd).toBe(1);
    expect(fs.existsSync(path.join(outDir, "claude-md", "root.mdx"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "claude-md", "app.mdx"))).toBe(false);
    expect(fs.existsSync(path.join(outDir, "claude-md", "docs-site.mdx"))).toBe(false);
    // The doc-site CLAUDE.md is now "root" (relPath base = projectRoot).
    expect(claudeMdTitles()).toEqual(["/CLAUDE.md"]);
    // claudeDir still resolved independently.
    expect(counts.commands).toBe(1);
  });

  it("(e) excludes its own output dir from the scan even when it lives under scanRoot", () => {
    const first = runClaudeResourcesPreStep({
      claudeDir,
      projectRoot: docsSite,
      scanRoot: repoRoot,
    });
    expect(first.claudemd).toBe(3);

    // Drop a decoy file literally named CLAUDE.md INSIDE the output dir (which
    // lives under scanRoot). It must NOT be collected — the walk excludes
    // docsDir — so generated output can never feed back into the next run.
    // Without the docsDir exclude this decoy would push the count to 4.
    fs.writeFileSync(path.join(outDir, "CLAUDE.md"), "# Decoy\n\nShould be excluded.");

    const second = runClaudeResourcesPreStep({
      claudeDir,
      projectRoot: docsSite,
      scanRoot: repoRoot,
    });

    expect(second.claudemd).toBe(3);
    expect(claudeMdTitles()).toEqual([
      "/CLAUDE.md",
      "/app/CLAUDE.md",
      "/docs-site/CLAUDE.md",
    ]);
  });
});
