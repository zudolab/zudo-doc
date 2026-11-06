// The editorial policy contract: every scaffold carries one real policy file
// (AUTHORING.md) and three entry points (README.md, CLAUDE.md, AGENTS.md) that
// reach it, with every optional feature off. Detailed category rules live in
// the policy only, and no entry point references a skill that may not exist.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "create-zudo-doc-authoring-"));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

const baseChoices: UserChoices = {
  projectName: "policy-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [],
  packageManager: "pnpm",
};

async function generate(
  overrides: Partial<UserChoices> = {},
): Promise<(rel: string) => Promise<string>> {
  const choices = { ...baseChoices, ...overrides };
  await scaffold(choices);
  const root = path.join(tempDir, choices.projectName);
  return (rel: string) => fs.readFile(path.join(root, rel), "utf-8");
}

const ENTRY_POINTS = ["README.md", "CLAUDE.md", "AGENTS.md"] as const;
const FOUR_QUESTIONS = [
  "Who can do what with this content?",
  "Does an existing page already serve that role?",
  "Why this category, and is there a competing destination?",
  "Does this addition change what the category means?",
];

describe("editorial policy — skills off", () => {
  it("every entry point names the one AUTHORING.md that exists", async () => {
    const read = await generate();
    const policy = await read("AUTHORING.md");
    expect(policy).toContain("single editorial policy");
    for (const file of ENTRY_POINTS) {
      expect(await read(file)).toContain("`AUTHORING.md`");
    }
  });

  it("keeps the minimal procedure local and offline in the policy", async () => {
    const policy = await (await generate())("AUTHORING.md");
    for (const question of FOUR_QUESTIONS) expect(policy).toContain(question);
    expect(policy).toContain("Typo, wording, or formatting fix only");
    expect(policy).toContain("Write the concrete reader problem first");
    expect(policy).toContain("Keeping the structure is a valid outcome");
    expect(policy).toContain("TBD");
    expect(policy).toMatch(/\[decision\][\s\S]*\[fact\][\s\S]*\[hypothesis\]/);
  });

  it("agent entry points carry the three checks and the typo skip", async () => {
    const read = await generate();
    for (const file of ["CLAUDE.md", "AGENTS.md"]) {
      const text = await read(file);
      expect(text).toContain("## Documentation structure");
      expect(text).toContain("existing page with the same role");
      expect(text).toContain("alters what a category means");
      expect(text).toContain("Typo, wording, and formatting fixes skip");
    }
  });

  it("keeps category rules in the policy only and references no optional skill", async () => {
    const read = await generate();
    expect(await read("AUTHORING.md")).toContain("| `getting-started/` |");
    for (const file of ENTRY_POINTS) {
      const text = await read(file);
      expect(text).not.toContain("| `getting-started/` |");
      expect(text).not.toMatch(/zudo-doc-writing|-wisdom|setup:doc-skill/);
    }
    expect(await read("AUTHORING.md")).not.toMatch(
      /zudo-doc-writing|-wisdom|setup:doc-skill/,
    );
  });

  it("records single-locale and generated-content constraints as facts", async () => {
    const policy = await (await generate())("AUTHORING.md");
    expect(policy).toContain("single locale `en`");
    expect(policy).toContain("`generated: true`");
    expect(policy).not.toContain("docs-v*");
  });
});

describe("editorial policy — features on", () => {
  it("lists the configured locale directories, not a glob", async () => {
    const policy = await (
      await generate({ features: ["i18n"], additionalLangs: ["ja", "de"] })
    )("AUTHORING.md");
    expect(policy).toContain("`src/content/docs-ja/` (`ja`)");
    expect(policy).toContain("`src/content/docs-de/` (`de`)");
  });

  it("the writing skill reads the same policy and AUTHORING.md names the skill", async () => {
    const read = await generate({ features: ["claudeSkillsWriting"] });
    const skill = await read(".claude/skills/zudo-doc-writing/SKILL.md");
    expect(skill).toContain("`AUTHORING.md`");
    for (const question of FOUR_QUESTIONS) expect(skill).toContain(question);
    expect(skill).toContain("note-tray");
    expect(await read("AUTHORING.md")).toContain(
      "`.claude/skills/zudo-doc-writing/SKILL.md`",
    );
  });

  it("MCP appends its deployment section to the base README exactly once", async () => {
    const readme = await (
      await generate({ features: ["agentExport", "mcp"], mcpDeploy: "cloudflare" })
    )("README.md");
    expect(readme).toContain("## Adding or reorganizing docs");
    expect(readme.match(/## Cloudflare MCP deployment/g)).toHaveLength(1);
    expect(readme.match(/^# /gm)).toHaveLength(1);
    expect(readme.indexOf("## Adding or reorganizing docs")).toBeLessThan(
      readme.indexOf("## Cloudflare MCP deployment"),
    );
  });

  it("records versioning and resource-generator constraints only when enabled", async () => {
    const policy = await (
      await generate({ features: ["versioning", "claudeResources"] })
    )("AUTHORING.md");
    expect(policy).toContain("frozen snapshots, not locales");
    expect(policy).not.toContain("docs-v*");
    expect(policy).toContain("Do not hand-edit or move those pages");
  });
});
