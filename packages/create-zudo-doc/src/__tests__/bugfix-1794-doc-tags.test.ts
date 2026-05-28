import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

const TEMP_PREFIX = "create-zudo-doc-bugfix-1794-";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

/** Helper: read settings.ts content from the scaffolded project */
async function readSettings(projectName: string): Promise<string> {
  return fs.readFile(
    path.join(tempDir, projectName, "src/config/settings.ts"),
    "utf-8",
  );
}

describe("bugfix #1794 — docTags setting reflects feature selection", () => {
  it("emits docTags: true when docTags feature is selected", async () => {
    const choices: UserChoices = {
      projectName: "test-doc-tags-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docTags"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await readSettings("test-doc-tags-on");
    expect(content).toContain("docTags: true");
    expect(content).not.toContain("docTags: false");
  });

  it("emits docTags: false when docTags feature is NOT selected", async () => {
    const choices: UserChoices = {
      projectName: "test-doc-tags-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await readSettings("test-doc-tags-off");
    expect(content).toContain("docTags: false");
    expect(content).not.toContain("docTags: true");
  });
});
