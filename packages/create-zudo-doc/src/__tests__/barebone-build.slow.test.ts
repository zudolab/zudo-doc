/**
 * Barebone build regression test (#2342 / #2379).
 *
 * Guards the generated-project build for the **all-optional-features-OFF**
 * scaffold — the configuration that was unprotected (preset-swap covers only
 * the i18n-on case).
 *
 * ## Why this exists — do NOT weaken into a plain scaffold snapshot test
 *
 * With `packageOwnedRoutes` defaulting ON (1.0), the always-copied host base
 * template `pages/lib/_doc-history-area.tsx` statically imports the real
 * `DocHistory` from `@takazudo/zudo-doc/doc-history` (to keep zfb's island
 * scanner chain page→stub→DocHistory walkable). That pulls
 * `@takazudo/zudo-doc/dist/doc-history/index.js`'s `await import("diff")` into
 * EVERY generated bundle — even a barebone, docHistory-off project. `diff` is
 * a peerDependency of `@takazudo/zudo-doc`, so the scaffold must add it to the
 * generated `package.json` unconditionally; if it only added `diff` when the
 * docHistory feature was selected, a barebone `zfb build` would fail at esbuild
 * with `Could not resolve "diff"` (the regression this test locks down).
 *
 * The real gate is the end-to-end `zfb build` succeeding — a unit assertion
 * that `diff` is in the generated deps would NOT catch the next hidden peer
 * (we add a cheap dep-presence assertion too, but the build is the gate).
 *
 * ## Tier
 *
 * Scaffolds a real project, `pnpm install`s against the public registry, and
 * runs a full `zfb build` — minutes per run, so it lives in the slow tier
 * (`pnpm test:slow`), excluded from `pnpm test` and `pnpm b4push`.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";
import { runOrThrow, installScaffoldedDeps } from "./slow-build-helpers.js";

const TEMP_PREFIX = "create-zudo-doc-barebone-build-";
const PROJECT_NAME = "barebone-build-test";

// Barebone: every optional feature OFF. `features: []` means no i18n, no
// search, no docHistory, no designTokenPanel, etc. — the exact shape that the
// #2342 `diff`-resolution regression broke.
const choices: UserChoices = {
  projectName: PROJECT_NAME,
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [],
  packageManager: "pnpm",
};

let tempDir: string;
let projectDir: string;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);

  // 1. Scaffold the barebone project.
  await scaffold(choices);
  projectDir = path.join(tempDir, PROJECT_NAME);

  // 2. Install + build. A `Could not resolve "diff"` (or any other unresolved
  //    always-bundled peer) makes `zfb build` exit non-zero, which throws here
  //    and fails the suite — that failure IS the regression signal.
  installScaffoldedDeps(projectDir);
  runOrThrow("pnpm build", projectDir, { SKIP_DOC_HISTORY: "1" });
}, 5 * 60 * 1000);

afterAll(async () => {
  process.chdir(originalCwd);
  if (tempDir && (await fs.pathExists(tempDir))) {
    await fs.remove(tempDir);
  }
});

describe("barebone (all features off) generated project", () => {
  it("scaffolds the always-bundled `diff` peer into the generated package.json", async () => {
    // Cheap pinpoint guard for the specific #2342 regression. NOT a substitute
    // for the build gate below — it would not catch a different hidden peer.
    const pkg = await fs.readJson(path.join(projectDir, "package.json"));
    expect(pkg.dependencies?.diff).toBeDefined();
  });

  it("builds with `zfb build` (no unresolved esbuild imports)", async () => {
    // The build already ran in beforeAll; a failure there would have aborted
    // the suite. Assert the static output was emitted as the success signal.
    const indexHtml = path.join(projectDir, "dist", "index.html");
    expect(await fs.pathExists(indexHtml)).toBe(true);
  });
});
