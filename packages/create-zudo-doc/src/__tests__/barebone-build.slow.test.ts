/**
 * Barebone build regression test (#2342 / #2379).
 *
 * Guards the generated-project build for the **all-optional-features-OFF**
 * scaffold — the configuration that was unprotected (preset-swap covers only
 * the i18n-on case).
 *
 * ## Why this exists — do NOT weaken into a plain scaffold snapshot test
 *
 * `diff` is gated on the `docHistory` feature, not unconditional
 * (`c778ca989`, refs #4206 / #4209): `@takazudo/zudo-doc`'s doc-history route
 * loads it via a rejection-handled `await import("diff")` that is NOT
 * build-fatal when the package is absent, so a barebone (docHistory-off)
 * scaffold correctly omits it from the generated `package.json`. The
 * historical regression this file guards (#2342) was a barebone `zfb build`
 * failing at esbuild with `Could not resolve "diff"` — that is still the
 * failure mode to watch for if the dynamic-import gating ever regresses back
 * to a static import.
 *
 * Tier split: the fast-tier `packages/create-zudo-doc/src/__tests__/scaffold.test.ts`
 * owns the dependency-SHAPE contract (which deps appear under which feature
 * flags — see its `"includes the required zfb packages and @takazudo/zudo-doc
 * unconditionally, but NOT @takazudo/zdtp or diff"` and `"includes diff when
 * docHistory is enabled..."` cases). This slow test owns a different question:
 * does a barebone generated project actually `zfb build` end-to-end. Do NOT
 * re-add a dependency-presence assertion here — asserting the same
 * dependency-shape contract in both tiers is exactly what caused #4249 (the
 * fast tier's gating change left this file's `diff`-must-be-defined assertion
 * stale, and it broke nightly CI on its own schedule instead of at review
 * time). If the shape contract needs a new case, add it to `scaffold.test.ts`.
 *
 * ## Minimal-scaffold addendum (epic zudolab/zudo-doc#2651, Wave 7 #2662)
 *
 * Also asserts that `dist/docs/getting-started/index.html` renders — proof
 * that the locked manifest's self-contained doc-route stub
 * (`pages/docs/[[...slug]].tsx`) actually builds the doc route, not just the
 * home page. This is a BUILD-time check only. The authoritative `zfb dev`
 * `/docs/*` 200 assertion lives in #2659's confirm gate
 * (`target-manifest` slow test) — do not duplicate that heavy dev-server
 * probe here. Keep this stub as the explicit host-owned route seam even though
 * zfb 2.13.1 also renders package-injected dynamic routes in dev.
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
import {
  runOrThrow,
  installScaffoldedDeps,
  overrideWithLocalZudoDoc,
} from "./slow-build-helpers.js";

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
  // Publish-lag workaround — see overrideWithLocalZudoDoc()'s doc comment:
  // the published @takazudo/zudo-doc doesn't ship ./config /
  // ./tsconfig.base.json yet (epic zudolab/zudo-doc#2651 waves not released).
  overrideWithLocalZudoDoc(projectDir);
  runOrThrow("pnpm build", projectDir, { SKIP_DOC_HISTORY: "1" });
}, 5 * 60 * 1000);

afterAll(async () => {
  process.chdir(originalCwd);
  if (tempDir && (await fs.pathExists(tempDir))) {
    await fs.remove(tempDir);
  }
});

describe("barebone (all features off) generated project", () => {
  it("builds with `zfb build` (no unresolved esbuild imports)", async () => {
    // The build already ran in beforeAll; a failure there would have aborted
    // the suite. Assert the static output was emitted as the success signal.
    const indexHtml = path.join(projectDir, "dist", "index.html");
    expect(await fs.pathExists(indexHtml)).toBe(true);
  });

  it("renders the doc route via the locked-manifest self-contained stub (dist/docs/getting-started/index.html)", async () => {
    // Proves pages/docs/[[...slug]].tsx actually builds the doc route — see
    // the file header's "Minimal-scaffold addendum" for why this is a
    // build-only check, not a substitute for the #2659 dev-mode 200 gate.
    const docHtml = path.join(
      projectDir,
      "dist",
      "docs",
      "getting-started",
      "index.html",
    );
    expect(await fs.pathExists(docHtml)).toBe(true);
  });
});
