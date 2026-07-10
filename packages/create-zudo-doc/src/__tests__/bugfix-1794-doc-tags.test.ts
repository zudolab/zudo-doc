import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

// Re-targeted for the minimal-scaffold cutover (epic zudolab/zudo-doc#2651,
// Wave 7 #2662): the original regression asserted `docTags` inside
// `src/config/settings.ts`, which no longer exists. `docTags` is now a
// `zudoDoc({...})` field written straight into `zfb.config.ts` — see
// `zfb-config-gen.ts`'s `buildDesiredConfig()`. Same behavior, new home.

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

/** Helper: read zfb.config.ts content from the scaffolded project */
async function readZfbConfig(projectName: string): Promise<string> {
  return fs.readFile(
    path.join(tempDir, projectName, "zfb.config.ts"),
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
    const content = await readZfbConfig("test-doc-tags-on");
    expect(content).toContain("docTags: true");
    expect(content).not.toContain("docTags: false");
  });

  it("omits docTags entirely when docTags feature is NOT selected (diffs away against its false default)", async () => {
    const choices: UserChoices = {
      projectName: "test-doc-tags-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await readZfbConfig("test-doc-tags-off");
    // The generator is diff-from-defaults (locked decision #2653 #2) — a
    // false value that matches the package default is OMITTED, not written
    // out as `docTags: false`.
    expect(content).not.toContain("docTags: true");
    expect(content).not.toContain("docTags:");
  });
});
