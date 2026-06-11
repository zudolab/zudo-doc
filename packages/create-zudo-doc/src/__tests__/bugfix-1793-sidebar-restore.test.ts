// Regression test for #1793 / #2029: generated projects must import
// SIDEBAR_RESIZER_RESTORE_SCRIPT from @takazudo/zudo-doc/sidebar-resizer
// (exported since 0.2.0) rather than inlining it as a local constant.
// The inline workaround was required when 0.1.0 didn't export it yet; it
// was replaced with a proper dist import in #2029.
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

describe("bugfix #1793 / #2029 — sidebar restore script imported from dist", () => {
  const choices: UserChoices = {
    projectName: "test-bugfix-1793",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search"],
    packageManager: "pnpm",
  };

  it("generated _head-with-defaults.tsx imports SIDEBAR_RESIZER_RESTORE_SCRIPT from the package", async () => {
    await scaffold(choices);
    const content = await fs.readFile(
      path.join(tempDir, "test-bugfix-1793", "pages/lib/_head-with-defaults.tsx"),
      "utf-8",
    );
    expect(content).toContain(
      'import { SIDEBAR_RESIZER_RESTORE_SCRIPT } from "@takazudo/zudo-doc/sidebar-resizer"',
    );
  });

  it("generated _head-with-defaults.tsx does NOT inline the restore script as a local constant", async () => {
    await scaffold(choices);
    const content = await fs.readFile(
      path.join(tempDir, "test-bugfix-1793", "pages/lib/_head-with-defaults.tsx"),
      "utf-8",
    );
    expect(content).not.toContain("const SIDEBAR_RESIZER_RESTORE_SCRIPT");
  });
});
