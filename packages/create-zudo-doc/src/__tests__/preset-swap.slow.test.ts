/**
 * Preset-swap acceptance test (Sub #423 of epic #419).
 *
 * Regression guard for the locale-layout refactor (Subs #421, #422). The
 * scenario:
 *
 *   1. Scaffold a project with `defaultLang: "ja"` and the i18n feature on.
 *      The scaffolder writes JA primary content under `src/content/docs/`,
 *      EN secondary content under `src/content/docs-en/`, and emits
 *      `settings.defaultLocale = "ja"` + `settings.locales = { en: ... }`.
 *   2. Programmatically flip the *configuration knob only* — change
 *      `settings.defaultLocale` to `"en"` and rewrite `settings.locales` to
 *      `{ ja: { dir: "src/content/docs-ja" } }`. (We rename the secondary
 *      content directory to keep `dir` honest, but no `src/pages/` files and
 *      no `src/utils/docs.ts` files are touched.)
 *   3. Run `pnpm install` + `pnpm build`.
 *   4. Assert the emitted URLs are `/docs/<slug>/` (new EN default, no
 *      prefix) and `/ja/docs/<slug>/` (JA, additional locale) — proving the
 *      runtime-driven `[locale]/` catch-all picks up the new default with
 *      zero hand-edits to page templates.
 *
 * ## Tier
 *
 * This test scaffolds a real project, runs `pnpm install` against the public
 * registry (with hard-link cache), and runs a full Astro build. Local
 * runtime is on the order of 60–120 seconds, well past the default unit
 * test budget. It therefore lives in the **slow tier** (`pnpm test:slow`)
 * and is excluded from `pnpm test` and `pnpm b4push`. Run it manually
 * before merging changes that touch locale routing or settings wiring.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";

const TEMP_PREFIX = "create-zudo-doc-preset-swap-";

/**
 * Wrapper around execSync that captures combined stdout/stderr and re-throws
 * with the captured output appended to the error message. Without this, a
 * failed `pnpm install` or `pnpm build` inside `beforeAll` surfaces only
 * vitest's generic "command failed" error and the actual diagnostic output
 * is lost.
 */
function runOrThrow(
  cmd: string,
  cwd: string,
  extraEnv: NodeJS.ProcessEnv = {},
): void {
  try {
    execSync(cmd, {
      cwd,
      stdio: "pipe",
      env: { ...process.env, ...extraEnv },
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    throw new Error(
      `Command failed: ${cmd}\n  cwd: ${cwd}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
    );
  }
}

let tempDir: string;
let projectDir: string;
let originalCwd: string;

const PROJECT_NAME = "preset-swap-test";

const choices: UserChoices = {
  projectName: PROJECT_NAME,
  defaultLang: "ja",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  // Keep the feature surface minimal: i18n is the only one we need for the
  // routing assertion. Skipping search/docHistory/etc. cuts install + build
  // time dramatically.
  features: ["i18n"],
  packageManager: "pnpm",
};

beforeAll(async () => {
  originalCwd = process.cwd();
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  process.chdir(tempDir);

  // 1. Scaffold the project.
  await scaffold(choices);
  projectDir = path.join(tempDir, PROJECT_NAME);

  // 2. Sanity-check the as-scaffolded state (defaultLang=ja, locales=en).
  const settingsPath = path.join(projectDir, "src/config/settings.ts");
  const settingsBefore = await fs.readFile(settingsPath, "utf-8");
  if (!/defaultLocale:\s*"ja"/.test(settingsBefore)) {
    throw new Error(
      "Pre-flip sanity check failed: settings.defaultLocale was not 'ja'",
    );
  }
  if (!/en:\s*\{\s*label:\s*"EN",\s*dir:\s*"src\/content\/docs-en"/.test(
    settingsBefore,
  )) {
    throw new Error(
      "Pre-flip sanity check failed: settings.locales did not contain expected en entry",
    );
  }

  // 3. Rename the secondary content dir so the new `ja` locale entry's `dir`
  //    points at real content. The contents under `docs-en/` are EN starter
  //    text; we are testing URL emission, not content-language correctness.
  const oldSecondary = path.join(projectDir, "src/content/docs-en");
  const newSecondary = path.join(projectDir, "src/content/docs-ja");
  if (await fs.pathExists(oldSecondary)) {
    await fs.move(oldSecondary, newSecondary);
  }

  // 4. Flip settings.ts — the *only* configuration knob the user touches:
  //      defaultLocale: "ja" -> "en"
  //      locales: { en: {...docs-en} } -> { ja: {...docs-ja} }
  //    No edits to src/pages/ or src/utils/docs.ts. The runtime-driven
  //    [locale]/ catch-all and the derived `i18n` block in astro.config.ts
  //    pick up the change automatically.
  const settingsAfter = settingsBefore
    .replace(/defaultLocale:\s*"ja"/, 'defaultLocale: "en"')
    .replace(
      /en:\s*\{\s*label:\s*"EN",\s*dir:\s*"src\/content\/docs-en"\s*\}/,
      'ja: { label: "JA", dir: "src/content/docs-ja" }',
    );
  if (settingsAfter === settingsBefore) {
    throw new Error(
      "Flip step failed: settings.ts content did not change after substitutions",
    );
  }
  await fs.writeFile(settingsPath, settingsAfter);

  // 5. Install + build. We use pnpm because that is the package manager the
  //    scaffolder defaults to and the dev environment guarantees.
  //    `--prefer-offline` keeps repeated local runs fast once the store is
  //    warm. We capture stdout/stderr and surface them on failure so
  //    diagnosing a broken scaffold/build does not require re-running.
  runOrThrow("pnpm install --prefer-offline --ignore-workspace", projectDir);
  runOrThrow("pnpm build", projectDir, { SKIP_DOC_HISTORY: "1" });
}, 5 * 60 * 1000);

afterAll(async () => {
  process.chdir(originalCwd);
  if (tempDir && (await fs.pathExists(tempDir))) {
    await fs.remove(tempDir);
  }
});

/** Helper: assert a path inside `dist/` exists. */
async function expectDist(relPath: string): Promise<void> {
  const full = path.join(projectDir, "dist", relPath);
  const exists = await fs.pathExists(full);
  expect(
    exists,
    `expected dist/${relPath} to exist after build (full path: ${full})`,
  ).toBe(true);
}

describe("preset-swap: scaffold ja then flip defaultLocale to en", () => {
  it("emits the new default-locale URL at /docs/<slug>/index.html (no prefix)", async () => {
    await expectDist("docs/getting-started/index.html");
  });

  it("emits the (now-secondary) ja locale URL at /ja/docs/<slug>/index.html", async () => {
    await expectDist("ja/docs/getting-started/index.html");
  });

  it("does NOT emit /en/docs/* — en is the default and must be unprefixed", async () => {
    const enPrefixed = path.join(
      projectDir,
      "dist/en/docs/getting-started/index.html",
    );
    expect(await fs.pathExists(enPrefixed)).toBe(false);
  });

  it("did not require any hand-edits to src/pages/ or src/utils/docs.ts", async () => {
    // Compare the post-build pages and utils with a freshly scaffolded copy:
    // they must be byte-identical, proving the swap was config-only.
    const referenceDir = path.join(tempDir, `${PROJECT_NAME}-reference`);
    await scaffold({ ...choices, projectName: `${PROJECT_NAME}-reference` });

    const checkPaths = [
      "src/pages/index.astro",
      "src/pages/404.astro",
      "src/pages/docs/[...slug].astro",
      "src/pages/[locale]/index.astro",
      "src/pages/[locale]/docs/[...slug].astro",
    ];

    for (const rel of checkPaths) {
      const ours = path.join(projectDir, rel);
      const ref = path.join(referenceDir, rel);
      if (!(await fs.pathExists(ref))) continue;
      const oursContent = await fs.readFile(ours, "utf-8");
      const refContent = await fs.readFile(ref, "utf-8");
      expect(
        oursContent,
        `${rel} differs from reference scaffold — preset swap should be config-only`,
      ).toBe(refContent);
    }

    // src/utils/docs.ts may live under a different name; check the common one.
    const utilsCandidates = ["src/utils/docs.ts"];
    for (const rel of utilsCandidates) {
      const ours = path.join(projectDir, rel);
      const ref = path.join(referenceDir, rel);
      if (!(await fs.pathExists(ref))) continue;
      const oursContent = await fs.readFile(ours, "utf-8");
      const refContent = await fs.readFile(ref, "utf-8");
      expect(
        oursContent,
        `${rel} differs from reference scaffold — preset swap should be config-only`,
      ).toBe(refContent);
    }
  });
});
