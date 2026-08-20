import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCodexResourcesPreStep } from "../index.js";

let repoRoot: string;
let docsSite: string;
let codexDir: string;
let outDir: string;

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function setupFixture(): void {
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-res-runner-"));
  docsSite = path.join(repoRoot, "docs-site");
  codexDir = path.join(docsSite, ".codex");
  outDir = path.join(docsSite, "src", "content", "docs");
  fs.mkdirSync(codexDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  write(path.join(repoRoot, "AGENTS.md"), "# Repo\n");
  write(path.join(repoRoot, "app", "AGENTS.md"), "# App\n");
  write(path.join(docsSite, "AGENTS.md"), "# Docs site\n");
  write(
    path.join(repoRoot, ".agents", "skills", "repo-skill", "SKILL.md"),
    "---\nname: Repo Skill\n---\n\nRepo.\n",
  );
  write(
    path.join(docsSite, ".agents", "skills", "site-skill", "SKILL.md"),
    "---\nname: Site Skill\n---\n\nSite.\n",
  );
}

function agentsTitles(): string[] {
  const dir = path.join(outDir, "codex-agents-md");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
    .map((file) => matter(fs.readFileSync(path.join(dir, file), "utf8")).data.title as string)
    .sort();
}

describe("runCodexResourcesPreStep", () => {
  beforeEach(setupFixture);
  afterEach(() => fs.rmSync(repoRoot, { recursive: true, force: true }));

  it("anchors output to projectRoot while discovering instructions and skills from scanRoot", () => {
    const counts = runCodexResourcesPreStep({
      codexDir: ".codex",
      projectRoot: docsSite,
      scanRoot: repoRoot,
    });
    expect(counts.agentsMd).toBe(3);
    expect(counts.skills).toBe(2);
    expect(fs.existsSync(path.join(outDir, "codex", "index.mdx"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "src", "content", "docs"))).toBe(false);
    expect(fs.existsSync(path.join(outDir, "codex-skills", "repo-skill", "index.mdx"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "codex-skills", "site-skill", "index.mdx"))).toBe(true);
  });

  it("resolves a relative scanRoot against projectRoot", () => {
    const counts = runCodexResourcesPreStep({
      codexDir: ".codex",
      projectRoot: docsSite,
      scanRoot: "..",
    });
    expect(counts.agentsMd).toBe(3);
    expect(counts.skills).toBe(2);
    expect(agentsTitles()).toEqual([
      "/AGENTS.md",
      "/app/AGENTS.md",
      "/docs-site/AGENTS.md",
    ]);
  });

  it("defaults scanRoot to projectRoot", () => {
    const counts = runCodexResourcesPreStep({
      codexDir: ".codex",
      projectRoot: docsSite,
    });
    expect(counts.agentsMd).toBe(1);
    expect(counts.skills).toBe(1);
    expect(agentsTitles()).toEqual(["/AGENTS.md"]);
    expect(fs.existsSync(path.join(outDir, "codex-skills", "repo-skill"))).toBe(false);
  });

  it("excludes docsDir decoys from subsequent instruction discovery", () => {
    const options = { codexDir: ".codex", projectRoot: docsSite, scanRoot: repoRoot };
    expect(runCodexResourcesPreStep(options).agentsMd).toBe(3);
    write(path.join(outDir, "AGENTS.md"), "# Decoy\n");
    expect(runCodexResourcesPreStep(options).agentsMd).toBe(3);
  });

  it("excludes nested build-output directories", () => {
    for (const dir of ["dist", "public", "out", "test-results"]) {
      write(path.join(docsSite, dir, "AGENTS.md"), `# ${dir} decoy\n`);
    }
    write(path.join(repoRoot, "app", "dist", "AGENTS.md"), "# nested decoy\n");
    const counts = runCodexResourcesPreStep({
      codexDir: ".codex",
      projectRoot: docsSite,
      scanRoot: repoRoot,
    });
    expect(counts.agentsMd).toBe(3);
  });
});
