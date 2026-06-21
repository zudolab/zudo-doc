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
 * registry (with hard-link cache), and runs a full zfb build. Local
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

/**
 * Resilient `pnpm install` for the network-dependent install step.
 *
 * This test resolves the scaffolded project's deps against the public npm
 * registry. The generated `package.json` pins ranges (e.g. `@types/node`
 * `^22.0.0`), so a fresh patch release can land in the range that is not yet
 * in the local pnpm store — pnpm then has to fetch it, and that fetch can
 * transiently fail (registry hiccup, network blip). This is exactly the
 * nightly-exam failure tracked in zudolab/zudo-doc#2123: a one-off
 * `--prefer-offline` install of `@types/node@22.19.21`'s transitive
 * `undici-types` failed to download, even though the version range itself is
 * healthy and installs fine on a warm store.
 *
 * Strategy: try `--prefer-offline` first (fast once the store is warm). If
 * it fails with a transient network/registry error, retry with full online
 * resolution using exponential backoff. Only after all attempts are exhausted
 * do we surface the captured diagnostics. Non-transient failures (e.g. a
 * genuinely bad version pin that 404s every time) are re-thrown immediately
 * once we have confirmed it is not a transient error class, since repeated
 * retries would only add latency.
 *
 * Why broader error matching (zudolab/zudo-doc#2123, zudolab/zudo-doc#2270):
 * The original narrow retry caught some undici fetch failures but missed
 * ECONNRESET, ETIMEDOUT, registry 5xx responses surfaced as non-zero exit
 * without a recognisable pnpm error code, and mid-stream undici drops that
 * pnpm formats as "fetch failed" / "UND_ERR_SOCKET" in stderr. The revised
 * heuristic treats any of those patterns as transient and worth retrying,
 * while still letting genuine resolution failures (missing package, version
 * constraint impossible) propagate after the final attempt.
 */

/** Patterns that indicate a transient network / registry error worth retrying. */
const TRANSIENT_ERROR_PATTERNS = [
  /ECONNRESET/,
  /ETIMEDOUT/,
  /ECONNREFUSED/,
  /ENOTFOUND/,
  /EAI_AGAIN/,
  /fetch failed/i,
  /UND_ERR/,
  /undici/i,
  /network\s+error/i,
  /socket\s+hang\s+up/i,
  // Registry 5xx responses: pnpm prints the status line in stderr
  /50[0-9]\s/,
  // pnpm's own "GET https://registry…" fetch-failure lines
  /GET https?:\/\/.+\s+5\d{2}/,
];

function isTransientInstallError(err: unknown): boolean {
  const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
  const combined = [
    e.message ?? "",
    e.stdout?.toString() ?? "",
    e.stderr?.toString() ?? "",
  ].join("\n");
  return TRANSIENT_ERROR_PATTERNS.some((re) => re.test(combined));
}

function installScaffoldedDeps(cwd: string): void {
  // Attempt 0: prefer-offline (fast when store is warm).
  // Attempts 1-4: full online resolution with exponential backoff.
  // Total: 5 attempts, backoff ceiling ~16s per inter-attempt gap.
  // Rationale for 5 attempts: zudolab/zudo-doc#2123 shows single-attempt
  // flakes; zudolab/zudo-doc#2270 observed two back-to-back hiccups before
  // recovery, so 2 retries were still not enough in the worst case.
  const attempts = [
    "pnpm install --prefer-offline --ignore-workspace",
    "pnpm install --ignore-workspace",
    "pnpm install --ignore-workspace",
    "pnpm install --ignore-workspace",
    "pnpm install --ignore-workspace",
  ];
  let lastErr: unknown;
  for (const [i, cmd] of attempts.entries()) {
    try {
      runOrThrow(cmd, cwd);
      return;
    } catch (err) {
      lastErr = err;
      const isLast = i === attempts.length - 1;
      if (!isLast) {
        // Only retry if the error looks transient. A genuine resolution
        // failure (bad pin, impossible constraint) fails identically on every
        // attempt — retrying only wastes nightly-exam minutes.
        if (!isTransientInstallError(err)) {
          throw err;
        }
        // Synchronous exponential backoff: 2s, 4s, 8s, 16s. The surrounding
        // execSync is already blocking, so a blocking sleep here is fine and
        // avoids turning beforeAll async-racy. Atomics.wait is the standard
        // no-busy-loop synchronous sleep idiom.
        const waitMs = 2000 * Math.pow(2, i);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
      }
    }
  }
  throw lastErr;
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
  // The runtime-driven [locale]/ catch-all and the derived i18n block in zfb.config.ts pick up the change automatically.
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
  //    `installScaffoldedDeps` tries `--prefer-offline` first (fast on a warm
  //    store) and retries online on failure, so a transient registry flake on
  //    a freshly-released patch version does not fail the slow tier
  //    (zudolab/zudo-doc#2123). We capture stdout/stderr and surface them on
  //    the final failure so diagnosing a broken scaffold/build does not
  //    require re-running.
  installScaffoldedDeps(projectDir);
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
      "pages/index.tsx",
      "pages/404.tsx",
      "pages/docs/[...slug].tsx",
      "pages/[locale]/index.tsx",
      "pages/[locale]/docs/[...slug].tsx",
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
