// Regression test for #1793 / #2029: generated projects must source the
// sidebar-resize restore script from @takazudo/zudo-doc/sidebar-resizer rather
// than inlining it as a local constant. The inline workaround was required when
// 0.1.0 didn't export it yet; it was replaced with a proper dist import in #2029.
//
// Post-relocation (epic #2344, S5): the restore-script emission moved OFF the
// generated `_head-with-defaults.tsx` stub and INTO the package factory
// `@takazudo/zudo-doc/head-with-defaults` (`createHeadWithDefaults`). The
// generated stub is now a thin wrapper that calls that factory. So the
// SIDEBAR_RESIZER_RESTORE_SCRIPT import that this test guarded now lives in the
// package factory source, not in the generated file — we assert it there. The
// generated stub must still delegate to the factory (and must NOT re-inline the
// script as a local constant), which is what keeps the #1793/#2029 behavior
// guaranteed end-to-end.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

// Package factory source that now owns the restore-script emission. Resolved
// relative to this test file: src/__tests__ → repo root → packages/zudo-doc/...
const HEAD_FACTORY_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/zudo-doc/src/head-with-defaults/index.tsx",
);

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

  it("package head-with-defaults factory imports SIDEBAR_RESIZER_RESTORE_SCRIPT from the package", async () => {
    // Behavior moved into the package factory (epic #2344, S5): the restore
    // script is imported + emitted there, gated on settings.sidebarResizer.
    const factory = await fs.readFile(HEAD_FACTORY_SRC, "utf-8");
    expect(factory).toContain(
      'import { SIDEBAR_RESIZER_RESTORE_SCRIPT } from "../sidebar-resizer/index.js"',
    );
    // The script must still be emitted (dangerouslySetInnerHTML), not just imported.
    expect(factory).toContain("SIDEBAR_RESIZER_RESTORE_SCRIPT }} />");
  });

  it("generated _head-with-defaults.tsx delegates to the package factory and does NOT inline the restore script", async () => {
    await scaffold(choices);
    const content = await fs.readFile(
      path.join(tempDir, "test-bugfix-1793", "pages/lib/_head-with-defaults.tsx"),
      "utf-8",
    );
    // The generated stub wires the package factory rather than emitting the
    // script itself — so the restore behavior comes from the package.
    expect(content).toContain(
      'import { createHeadWithDefaults } from "@takazudo/zudo-doc/head-with-defaults"',
    );
    expect(content).toContain("createHeadWithDefaults({");
    // No re-inlined constant, and no re-imported script: the stub must not
    // reintroduce the pre-0.2.0 workaround the original test guarded against.
    expect(content).not.toContain("const SIDEBAR_RESIZER_RESTORE_SCRIPT");
    expect(content).not.toContain("SIDEBAR_RESIZER_RESTORE_SCRIPT");
  });
});
