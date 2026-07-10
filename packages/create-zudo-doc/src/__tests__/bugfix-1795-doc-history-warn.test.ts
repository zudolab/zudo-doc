import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

// Re-targeted for the minimal-scaffold cutover (epic zudolab/zudo-doc#2651,
// Wave 7 #2662): the original regression asserted `docHistory: true` inside
// `src/config/settings.ts`, which no longer exists. `docHistory` is now a
// `zudoDoc({...})` field written straight into `zfb.config.ts`. The
// auto-enable + warn behavior itself (in scaffold.ts, ahead of any file
// generation) is unchanged by the minimal-scaffold cutover — only the
// assertion target moved.

const TEMP_PREFIX = "create-zudo-doc-test-1795-";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

describe("bugfix #1795 — body-foot-util warns when --no-doc-history was explicit", () => {
  it("emits console.warn and still enables docHistory when explicitlyDisabledFeatures includes docHistory", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const choices: UserChoices = {
      projectName: "test-1795-warn",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "bodyFootUtil"],
      // bodyFootUtil is enabled but user explicitly passed --no-doc-history
      explicitlyDisabledFeatures: ["docHistory"],
      packageManager: "pnpm",
    };

    await scaffold(choices);

    // Warning must be emitted
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain(
      "body-foot-util requires doc-history",
    );

    // Auto-enable must still be applied — docHistory ends up in the
    // generated zfb.config.ts (zudoDoc({...}) field, not settings.ts).
    const content = await fs.readFile(
      path.join(tempDir, "test-1795-warn", "zfb.config.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: true");
  });

  it("does NOT emit console.warn when docHistory was not explicitly disabled", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const choices: UserChoices = {
      projectName: "test-1795-no-warn",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "bodyFootUtil"],
      // explicitlyDisabledFeatures omitted — user never passed --no-doc-history
      packageManager: "pnpm",
    };

    await scaffold(choices);

    // No warning expected
    expect(warnSpy).not.toHaveBeenCalled();

    // Auto-enable still applied silently
    const content = await fs.readFile(
      path.join(tempDir, "test-1795-no-warn", "zfb.config.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: true");
  });
});
