// Regression test for #1793: generated projects must not import
// SidebarResizerRestore from @takazudo/zudo-doc/sidebar-resizer because the
// published 0.1.0 dist does not export it. The fix inlines the restore
// script as a local constant (SIDEBAR_RESIZER_RESTORE_SCRIPT) instead.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

const TEMP_PREFIX = "create-zudo-doc-bugfix-1793-";

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

describe("bugfix #1793 — sidebar restore script inlined, not imported", () => {
  const choices: UserChoices = {
    projectName: "test-bugfix-1793",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };

  it("generated _head-with-defaults.tsx does NOT import SidebarResizerRestore", async () => {
    await scaffold(choices);
    const content = await fs.readFile(
      path.join(tempDir, "test-bugfix-1793", "pages/lib/_head-with-defaults.tsx"),
      "utf-8",
    );
    expect(content).not.toContain("import { SidebarResizerRestore }");
  });

  it("generated _head-with-defaults.tsx DOES contain inlined SIDEBAR_RESIZER_RESTORE_SCRIPT constant", async () => {
    await scaffold(choices);
    const content = await fs.readFile(
      path.join(tempDir, "test-bugfix-1793", "pages/lib/_head-with-defaults.tsx"),
      "utf-8",
    );
    expect(content).toContain("SIDEBAR_RESIZER_RESTORE_SCRIPT");
  });
});
