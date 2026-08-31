/**
 * Focused end-to-end proof for the complete EN + JA + DE scaffold contract.
 *
 * This deliberately extends the existing scaffold → install → local package
 * override → zfb build plumbing instead of introducing another harness. One
 * generated project enables the features that cross the locale boundaries:
 * changelog, doc history, tag pages, skill symlinking, scaffolded Claude
 * skills, and versioned routes. The assertions below read the generated
 * source, static build, history JSON, generated skill, and packed project so a
 * green test proves the shipped artifacts rather than only the in-memory
 * generator choices.
 *
 * The test is intentionally in the package's slow tier. It performs a real
 * registry install, packs the local @takazudo/zudo-doc checkout to bridge the
 * current publish lag, and runs a production zfb build with post-build
 * doc-history generation enabled.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { scaffold } from "../scaffold.js";
import type { UserChoices } from "../prompts.js";
import { initGitRepo } from "../utils.js";
import {
  installScaffoldedDeps,
  overrideWithLocalZudoDoc,
  runOrThrow,
} from "./slow-build-helpers.js";

const TEMP_PREFIX = "create-zudo-doc-three-locale-integration-";
const PROJECT_NAME = "three-locale-proof";
const SKILL_NAME = `${PROJECT_NAME}-wisdom`;

const choices: UserChoices = {
  projectName: PROJECT_NAME,
  defaultLang: "en",
  additionalLangs: ["ja", "de"],
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [
    "i18n",
    "changelog",
    "docHistory",
    "docTags",
    "tagGovernance",
    "skillSymlinker",
    "claudeSkills",
    "claudeSkillsWriting",
    "versioning",
  ],
  changelogPackages: ["core", "cli"],
  packageManager: "pnpm",
};

let tempDir: string;
let projectDir: string;
let originalCwd: string;
let originalHome: string | undefined;
let fakeHome: string;

const VERSION_CONFIG = `    versions: [
      {
        slug: "1.0",
        label: "1.0.0",
        docsDir: "src/content/docs-v1",
        locales: {
          ja: { dir: "src/content/docs-v1-ja" },
          de: { dir: "src/content/docs-v1-de" },
        },
        banner: "unmaintained",
      },
    ],`;

function versionDoc(title: string, prose: string): string {
  return `---
title: ${title}
sidebar_position: 1
---

${prose}
`;
}

async function writeVersionContent(): Promise<void> {
  const roots = [
    ["src/content/docs-v1", "Version 1 introduction"],
    ["src/content/docs-v1-ja", "バージョン 1 の紹介"],
    ["src/content/docs-v1-de", "Version 1 Einführung"],
  ] as const;
  for (const [root, title] of roots) {
    await fs.outputFile(
      path.join(projectDir, root, "getting-started/index.mdx"),
      versionDoc(title, `This is the ${title} page.`),
    );
    await fs.outputFile(
      path.join(projectDir, root, "getting-started/introduction.mdx"),
      versionDoc(title, `This is the ${title} introduction.`),
    );
  }
}

async function addIntegrationTag(filePath: string): Promise<void> {
  const source = await fs.readFile(filePath, "utf8");
  const tagged = source.replace(
    /^(sidebar_position:\s*1\n)/m,
    "$1tags:\n  - integration\n",
  );
  if (tagged === source) {
    throw new Error(`Could not add integration tag to ${filePath}`);
  }
  await fs.writeFile(filePath, tagged);
}

async function configureVersionAndTags(): Promise<void> {
  const configPath = path.join(projectDir, "zfb.config.ts");
  const source = await fs.readFile(configPath, "utf8");
  if (!source.includes("    versions: [],")) {
    throw new Error("Generated config did not contain the versioning placeholder");
  }
  await fs.writeFile(
    configPath,
    source.replace("    versions: [],", VERSION_CONFIG),
  );

  await writeVersionContent();
  for (const locale of ["en", "ja", "de"] as const) {
    const root =
      locale === "en" ? "src/content/docs" : `src/content/docs-${locale}`;
    await addIntegrationTag(
      path.join(projectDir, root, "getting-started/introduction.mdx"),
    );
  }
}

function packedFiles(packDir: string): string[] {
  const tarballs = fs
    .readdirSync(packDir)
    .filter((entry) => entry.endsWith(".tgz"));
  expect(tarballs).toHaveLength(1);
  return execFileSync("tar", ["-tzf", path.join(packDir, tarballs[0]!)], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

beforeAll(async () => {
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), `${TEMP_PREFIX}home-`));
  process.chdir(tempDir);

  await scaffold(choices);
  projectDir = path.join(tempDir, PROJECT_NAME);
  await configureVersionAndTags();

  // Install the published dependency set first, then replace only the local
  // zudo-doc package with today's packed checkout (see shared helper docs).
  installScaffoldedDeps(projectDir);
  overrideWithLocalZudoDoc(projectDir);

  // Doc history and setup-doc-skill both intentionally operate inside a real
  // git repository. The generated .gitignore keeps generated skill output
  // untracked while source/config/content remains available to git history.
  const gitResult = initGitRepo(projectDir);
  if (gitResult.status !== "ok") {
    throw new Error(`Expected a private integration git repo, got ${gitResult.status}`);
  }

  // Keep generated global links inside a throwaway HOME. --target=claude makes
  // the assertion deterministic even when the host machine has Codex enabled.
  process.env.HOME = fakeHome;
  runOrThrow("bash scripts/setup-doc-skill.sh --target claude --silent", projectDir);

  runOrThrow("pnpm check", projectDir, { SKIP_DOC_HISTORY: "1" });
  runOrThrow("pnpm build", projectDir, { GEN_DOC_HISTORY: "1" });
}, 12 * 60 * 1000);

afterAll(async () => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (tempDir && (await fs.pathExists(tempDir))) await fs.remove(tempDir);
  if (fakeHome && (await fs.pathExists(fakeHome))) await fs.remove(fakeHome);
});

async function expectDist(relPath: string): Promise<void> {
  expect(
    await fs.pathExists(path.join(projectDir, "dist", relPath)),
    `expected dist/${relPath} to be emitted by the combined build`,
  ).toBe(true);
}

describe("three-locale generated project", () => {
  it("emits the ordered locale plan, feature config, repeated history args, and version config", async () => {
    const config = await fs.readFile(path.join(projectDir, "zfb.config.ts"), "utf8");
    // EN is the package default, so the diff-from-default config intentionally
    // omits `defaultLocale`; the unprefixed `docs` root below proves the
    // primary locale while the explicit JA/DE entries prove the additions.
    expect(config).not.toMatch(/defaultLocale:/);
    expect(config).toMatch(
      /locales:\s*\{[\s\S]*ja:\s*\{[\s\S]*dir: "src\/content\/docs-ja"[\s\S]*de:\s*\{[\s\S]*dir: "src\/content\/docs-de"/,
    );
    expect(config).toContain("docHistory: true");
    expect(config).toContain("docTags: true");
    expect(config).toContain("tagGovernance: tagCliConfig.governance");
    expect(config).toContain("tagVocabularyEntries: tagCliConfig.vocabulary");
    expect(config).toContain('component: "language-switcher"');
    expect(config).toContain('component: "version-switcher"');
    expect(config).toContain('slug: "1.0"');
    expect(config).toContain('docsDir: "src/content/docs-v1"');

    const pkg = await fs.readJson(path.join(projectDir, "package.json"));
    expect(pkg.scripts["dev:history"]).toBe(
      "doc-history-server --port 4322 --content-dir src/content/docs --locale ja:src/content/docs-ja --locale de:src/content/docs-de",
    );
    expect(pkg.dependencies["@takazudo/zudo-doc-history-server"]).toBeDefined();
    expect(await fs.pathExists(path.join(projectDir, "src/config/tag-vocabulary.ts"))).toBe(true);
  });

  it("emits latest, additional-locale, versioned, changelog, and tag routes", async () => {
    for (const locale of ["docs", "ja/docs", "de/docs"] as const) {
      await expectDist(`${locale}/getting-started/index.html`);
      await expectDist(`${locale}/changelog/core/index.html`);
      await expectDist(`${locale}/changelog/cli/index.html`);
      await expectDist(`${locale}/tags/index.html`);
      await expectDist(`${locale}/tags/integration/index.html`);
    }
    for (const locale of ["docs", "ja/docs", "de/docs"] as const) {
      const prefix = locale === "docs" ? "v/1.0/docs" : `v/1.0/${locale}`;
      await expectDist(`${prefix}/getting-started/index.html`);
      await expectDist(`${prefix}/getting-started/introduction/index.html`);
    }
  });

  it("emits current-locale metadata and per-locale doc-history JSON", async () => {
    const meta = await fs.readJson(
      path.join(projectDir, ".zfb/doc-history-meta.json"),
    );
    for (const slug of [
      "getting-started/introduction",
      "ja/getting-started/introduction",
      "de/getting-started/introduction",
    ]) {
      expect(meta[slug]).toBeDefined();
      expect(meta[slug].ext).toBe(".mdx");
    }

    for (const locale of ["", "ja/", "de/"] as const) {
      const historyPath = path.join(
        projectDir,
        "dist/doc-history",
        `${locale}getting-started/introduction.json`,
      );
      expect(await fs.pathExists(historyPath)).toBe(true);
      const history = await fs.readJson(historyPath);
      expect(history.slug).toBe("getting-started/introduction");
      expect(history.entries.length).toBeGreaterThan(0);
    }
  });

  it("generates locale-aware Claude skills, guidance, and writing skill templates", async () => {
    for (const skill of [
      "zudo-doc-design-system",
      "zudo-doc-translate",
      "zudo-doc-version-bump",
      "zudo-doc-writing",
    ]) {
      expect(
        await fs.pathExists(path.join(projectDir, ".claude/skills", skill, "SKILL.md")),
      ).toBe(true);
    }

    const generatedSkillDir = path.join(projectDir, ".claude/skills", SKILL_NAME);
    const generatedSkill = await fs.readFile(
      path.join(generatedSkillDir, "SKILL.md"),
      "utf8",
    );
    expect(generatedSkill).toContain('`en` (default)');
    expect(generatedSkill).toContain('`ja`: `src/content/docs-ja/`');
    expect(generatedSkill).toContain('`de`: `src/content/docs-de/`');
    expect(generatedSkill).toContain("English placeholder prose pending translation");
    expect(generatedSkill).toContain("/ja/docs/...");
    expect(generatedSkill).toContain("/de/docs/...");
    expect((await fs.lstat(path.join(generatedSkillDir, "docs-ja"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(generatedSkillDir, "docs-de"))).isSymbolicLink()).toBe(true);

    const writingSkill = await fs.readFile(
      path.join(projectDir, ".claude/skills/zudo-doc-writing/SKILL.md"),
      "utf8",
    );
    expect(writingSkill).toContain("sidebar_position");
    expect(writingSkill).toContain("each configured additional-locale directory");
  });

  it("packs the generated config, locale trees, and scaffolded Claude guidance", async () => {
    const packDir = await fs.mkdtemp(path.join(tempDir, "packed-project-"));
    try {
      runOrThrow(`pnpm pack --pack-destination "${packDir}"`, projectDir);
      const files = packedFiles(packDir);
      for (const file of [
        "package/zfb.config.ts",
        "package/src/content/docs/getting-started/index.mdx",
        "package/src/content/docs-ja/getting-started/index.mdx",
        "package/src/content/docs-de/getting-started/index.mdx",
        "package/src/content/docs/changelog/core/index.mdx",
        "package/src/config/tag-vocabulary.ts",
        "package/.claude/skills/zudo-doc-writing/SKILL.md",
      ]) {
        expect(files, `packed project should include ${file}`).toContain(file);
      }
    } finally {
      await fs.remove(packDir);
    }
  });
});
