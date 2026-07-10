/**
 * Preset-swap acceptance test (Sub #423 of epic #419).
 *
 * Regression guard for the locale-layout refactor (Subs #421, #422),
 * re-targeted for the minimal-scaffold cutover (epic zudolab/zudo-doc#2651,
 * Wave 7 #2662) — the "one configuration knob" is now `zfb.config.ts`'s
 * `zudoDoc({...})` call, not a separate `src/config/settings.ts` (deleted in
 * Wave 6 #2660). The scenario:
 *
 *   1. Scaffold a project with `defaultLang: "ja"` and the i18n feature on.
 *      The scaffolder writes JA primary content under `src/content/docs/`,
 *      EN secondary content under `src/content/docs-en/`, and emits
 *      `zudoDoc({ defaultLocale: "ja", locales: { en: {...} }, ... })` in
 *      `zfb.config.ts`.
 *   2. Programmatically flip the *configuration knob only* — change
 *      `defaultLocale` to `"en"` and rewrite `locales` to
 *      `{ ja: { label: "JA", dir: "src/content/docs-ja" } }` inside
 *      `zfb.config.ts`. (We rename the secondary content directory to keep
 *      `dir` honest, but no `pages/**` files are touched — the locked
 *      manifest's self-contained doc-route stubs read locale/route data at
 *      request time from `virtual:zudo-doc-route-context`, which is itself
 *      derived from `zfb.config.ts` at build time.)
 *   3. Run `pnpm install` + `pnpm build`.
 *   4. Assert the emitted URLs are `/docs/<slug>/` (new EN default, no
 *      prefix) and `/ja/docs/<slug>/` (JA, additional locale) — proving the
 *      package-owned locale routing picks up the new default with zero
 *      hand-edits to the scaffolded `pages/**` stubs.
 *
 * ## Tier
 *
 * This test scaffolds a real project, runs `pnpm install` against the public
 * registry (with hard-link cache), and runs a full zfb build. Local
 * runtime is on the order of 60–120 seconds, well past the default unit
 * test budget. It therefore lives in the **slow tier** (`pnpm test:slow`)
 * and is excluded from `pnpm test` and `pnpm b4push`. Run it manually
 * before merging changes that touch locale routing or config wiring.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";
// Robust scaffold→install→build plumbing (with transient-flake install retry)
// is shared with barebone-build.slow.test.ts — see ./slow-build-helpers.ts.
import {
  runOrThrow,
  installScaffoldedDeps,
  overrideWithLocalZudoDoc,
} from "./slow-build-helpers.js";

const TEMP_PREFIX = "create-zudo-doc-preset-swap-";

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

  // 2. Sanity-check the as-scaffolded state (defaultLocale=ja, locales=en)
  //    inside zfb.config.ts — the ONE config file in the locked manifest.
  const configPath = path.join(projectDir, "zfb.config.ts");
  const configBefore = await fs.readFile(configPath, "utf-8");
  if (!/defaultLocale:\s*"ja"/.test(configBefore)) {
    throw new Error(
      "Pre-flip sanity check failed: zfb.config.ts's defaultLocale was not 'ja'",
    );
  }
  if (
    !/en:\s*\{\s*label:\s*"EN",\s*dir:\s*"src\/content\/docs-en",?\s*\}/.test(
      configBefore,
    )
  ) {
    throw new Error(
      "Pre-flip sanity check failed: zfb.config.ts's locales did not contain the expected en entry",
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

  // 4. Flip zfb.config.ts — the *only* configuration knob the user touches:
  //      defaultLocale: "ja" -> "en"
  //      locales: { en: {...docs-en} } -> { ja: {...docs-ja} }
  //    No edits to pages/**. The self-contained doc-route stubs
  //    (pages/docs/[[...slug]].tsx, pages/[locale]/docs/[[...slug]].tsx) read
  //    locale/route data from virtual:zudo-doc-route-context at request
  //    time, which is derived from this same zfb.config.ts at build time —
  //    so the swap propagates with zero page-level hand-edits.
  const configAfter = configBefore
    .replace(/defaultLocale:\s*"ja"/, 'defaultLocale: "en"')
    .replace(
      /en:\s*\{\s*label:\s*"EN",\s*dir:\s*"src\/content\/docs-en",?\s*\}/,
      'ja: { label: "JA", dir: "src/content/docs-ja" }',
    );
  if (configAfter === configBefore) {
    throw new Error(
      "Flip step failed: zfb.config.ts content did not change after substitutions",
    );
  }
  await fs.writeFile(configPath, configAfter);

  // 5. Install + build. We use pnpm because that is the package manager the
  //    scaffolder defaults to and the dev environment guarantees.
  //    `installScaffoldedDeps` tries `--prefer-offline` first (fast on a warm
  //    store) and retries online on failure, so a transient registry flake on
  //    a freshly-released patch version does not fail the slow tier
  //    (zudolab/zudo-doc#2123). We capture stdout/stderr and surface them on
  //    the final failure so diagnosing a broken scaffold/build does not
  //    require re-running.
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

  it("did not require any hand-edits to the locked-manifest pages/** stubs", async () => {
    // Compare the post-build page stubs with a freshly scaffolded reference
    // copy: they must be byte-identical, proving the swap was config-only.
    const referenceDir = path.join(tempDir, `${PROJECT_NAME}-reference`);
    await scaffold({ ...choices, projectName: `${PROJECT_NAME}-reference` });

    const checkPaths = [
      "pages/index.tsx",
      "pages/docs/[[...slug]].tsx",
      "pages/[locale]/docs/[[...slug]].tsx",
    ];

    for (const rel of checkPaths) {
      const ours = path.join(projectDir, rel);
      const ref = path.join(referenceDir, rel);
      expect(await fs.pathExists(ref), `reference is missing ${rel}`).toBe(
        true,
      );
      const oursContent = await fs.readFile(ours, "utf-8");
      const refContent = await fs.readFile(ref, "utf-8");
      expect(
        oursContent,
        `${rel} differs from reference scaffold — preset swap should be config-only`,
      ).toBe(refContent);
    }
  });
});
