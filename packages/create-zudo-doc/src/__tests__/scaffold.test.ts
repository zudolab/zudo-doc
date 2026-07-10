import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";
import { validateProjectName } from "../utils.js";
import { createZudoDoc } from "../api.js";

// Minimal-scaffold cutover (epic zudolab/zudo-doc#2651). Rewritten from
// scratch for Wave 7 (#2662) against the locked ~12-file manifest landed by
// Wave 6 (#2660) — see that issue's completion comment for the deleted-file
// set and the documented deviations (tagGovernance's src/config/ pair, the
// unwired tauri find-in-page island, the unconditional @takazudo/zdtp dep).
// The old suite asserted a 64-file project shape (settings.ts, pages/lib/*,
// src/components/*, per-page anchor injections) that no longer exists.

const TEMP_PREFIX = "create-zudo-doc-test-";

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

/** Absolute path inside the scaffolded project. */
function projectPath(...segments: string[]): string {
  return path.join(tempDir, segments[0]!, ...segments.slice(1));
}

/** Recursively list every file under `dir` as POSIX-style paths relative to `dir`. */
async function listFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(d: string, rel: string): Promise<void> {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(d, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, relPath);
      } else {
        results.push(relPath);
      }
    }
  }
  await walk(dir, "");
  return results.sort();
}

const baseChoices: UserChoices = {
  projectName: "test-doc",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: [],
  packageManager: "pnpm",
};

// ---------------------------------------------------------------------------
// The locked manifest (#2653 Decision 4 / #2660 completion comment).
// ---------------------------------------------------------------------------

/** The locked ~12-file barebone (EN-only) manifest. */
const BAREBONE_MANIFEST = [
  ".gitignore",
  ".npmrc",
  "CLAUDE.md",
  "package.json",
  "pages/docs/[[...slug]].tsx",
  "pages/index.tsx",
  "src/content/docs/getting-started/index.mdx",
  "src/content/docs/getting-started/installation.mdx",
  "src/content/docs/getting-started/introduction.mdx",
  "src/styles/global.css",
  "tsconfig.json",
  "zfb.config.ts",
].sort();

/** All 24 feature values wired to a real (non-pseudo, non-scaffold.ts-only) module. */
const ALL_FEATURES = [
  "i18n",
  "search",
  "sidebarFilter",
  "claudeResources",
  "claudeSkills",
  "designTokenPanel",
  "sidebarResizer",
  "sidebarToggle",
  "versioning",
  "docHistory",
  "bodyFootUtil",
  "llmsTxt",
  "skillSymlinker",
  "tauri",
  "tauriDev",
  "footerNavGroup",
  "imageEnlarge",
  "dynamicPageTransition",
  "footerCopyright",
  "changelog",
  "tagGovernance",
  "docTags",
  "footerTaglist",
  "noindex",
];

describe("scaffold — barebone manifest (locked 12-file shape, #2653 Decision 4)", () => {
  let files: string[];

  beforeAll(async () => {
    const cwdBefore = process.cwd();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(dir);
    await scaffold(baseChoices);
    process.chdir(cwdBefore);
    files = await listFiles(path.join(dir, baseChoices.projectName));
    await fs.remove(dir);
  });

  it("emits EXACTLY the 12 locked-manifest files — no more, no less", () => {
    expect(files).toEqual(BAREBONE_MANIFEST);
  });
});

describe("scaffold — i18n manifest (+1 file, #2653 i18n addendum)", () => {
  let files: string[];

  beforeAll(async () => {
    const cwdBefore = process.cwd();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(dir);
    await scaffold({ ...baseChoices, features: ["i18n"] });
    process.chdir(cwdBefore);
    files = await listFiles(path.join(dir, baseChoices.projectName));
    await fs.remove(dir);
  });

  it("adds pages/[locale]/docs/[[...slug]].tsx and the secondary content dir — nothing else", () => {
    const expected = [
      ...BAREBONE_MANIFEST,
      "pages/[locale]/docs/[[...slug]].tsx",
      "src/content/docs-ja/getting-started/index.mdx",
      "src/content/docs-ja/getting-started/installation.mdx",
      "src/content/docs-ja/getting-started/introduction.mdx",
    ].sort();
    expect(files).toEqual(expected);
  });

  it("does NOT emit the old pages/[locale]/index.tsx home-route template", () => {
    expect(files).not.toContain("pages/[locale]/index.tsx");
  });
});

describe("scaffold — absence assertions (deleted legacy files never resurrected)", () => {
  // Enumerated from the #2653 locked spec + the #2660 completion comment's
  // delete list. Exercised against a barebone AND an every-feature-except-
  // tauri/tagGovernance scaffold (those two have a documented, narrow
  // exception covered in their own describe blocks below) so no feature
  // combination silently resurrects a deleted path family.
  const NEVER_RESURRECTED = [
    // pages/lib/* — the ~15 chrome/data/route-context host stubs, now
    // entirely package-owned.
    "pages/lib/_body-end-islands.tsx",
    "pages/lib/_chrome.ts",
    "pages/lib/_details.tsx",
    "pages/lib/_doc-route-entries.ts",
    "pages/lib/_extract-headings.ts",
    "pages/lib/_frontmatter-preview-data.ts",
    "pages/lib/_nav-source-cache.ts",
    "pages/lib/_nav-source-docs.ts",
    "pages/lib/_preset-generator.tsx",
    "pages/lib/_route-context.ts",
    "pages/lib/_search-widget.tsx",
    "pages/lib/doc-page-props.ts",
    "pages/lib/locale-merge.ts",
    "pages/lib/_head-with-defaults.tsx",
    "pages/_data.ts",
    // package-injected routes — never emitted as files (locked spec).
    "pages/404.tsx",
    "pages/sitemap.xml.tsx",
    "pages/docs/tags/index.tsx",
    "pages/docs/tags/[tag].tsx",
    "pages/v/[version]/docs/[[...slug]].tsx",
    "pages/api/ai-chat.tsx",
    // src/components/* (the tauri find-bar/find-in-page-init exception is
    // covered separately below).
    "src/components/ai-chat-modal.tsx",
    "src/components/content/code-group.tsx",
    "src/components/content/content-admonition.tsx",
    "src/components/desktop-sidebar-toggle.tsx",
    "src/components/doc-history.tsx",
    "src/components/image-enlarge.tsx",
    "src/components/preset-generator.tsx",
    "src/components/sidebar-toggle.tsx",
    "src/components/sidebar-tree.tsx",
    // src/utils/* (the tauri find-in-page.ts exception is covered separately).
    "src/utils/base.ts",
    "src/utils/docs.ts",
    "src/utils/git-info.ts",
    "src/utils/github.ts",
    "src/utils/nav-scope.ts",
    "src/utils/sidebar.ts",
    "src/utils/slug.ts",
    "src/utils/smart-break.tsx",
    "src/utils/tags.ts",
    // src/types/*
    "src/types/docs-entry.ts",
    "src/types/heading.ts",
    "src/types/locale.ts",
    // src/config/* (the tagGovernance settings.ts/tag-vocabulary.ts pair
    // exception is covered separately below).
    "src/config/color-scheme-utils.ts",
    "src/config/color-schemes.ts",
    "src/config/docs-schema.ts",
    "src/config/frontmatter-preview-defaults.ts",
    "src/config/frontmatter-preview-renderers.tsx",
    "src/config/i18n.ts",
    "src/config/settings-types.ts",
    "src/config/sidebars.ts",
    "src/config/tag-vocabulary-types.ts",
    "src/config/z-index-tokens.ts",
    // Standalone deleted files.
    "zfb-shim.d.ts",
    ".htmlvalidate.json",
    ".zfb/doc-history-meta.json",
    ".zudo-doc.json",
    "scripts/run-b4push.sh",
    "src/content.config.ts",
  ];

  let barebone: string;
  let allOn: string;

  beforeAll(async () => {
    const cwdBefore = process.cwd();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(dir);
    await scaffold({ ...baseChoices, projectName: "abs-barebone" });
    // Every feature EXCEPT tauri/tauriDev — those have their own narrow
    // file-copy exceptions and are asserted separately so a regression in
    // the general absence rule isn't masked by them. tagGovernance is KEPT
    // here (footerTaglist declares a hard dependency on it) — its own
    // narrow src/config/ exception is also asserted separately, and none of
    // the paths below overlap with the two files it legitimately writes.
    await scaffold({
      ...baseChoices,
      projectName: "abs-allon",
      features: ALL_FEATURES.filter((f) => !["tauri", "tauriDev"].includes(f)),
    });
    process.chdir(cwdBefore);
    barebone = path.join(dir, "abs-barebone");
    allOn = path.join(dir, "abs-allon");
  });

  afterAll(async () => {
    if (barebone) await fs.remove(path.dirname(barebone));
  });

  it.each(NEVER_RESURRECTED)("barebone never emits %s", async (rel) => {
    expect(await fs.pathExists(path.join(barebone, rel))).toBe(false);
  });

  it.each(NEVER_RESURRECTED)(
    "no feature combination (minus the documented exceptions) emits %s",
    async (rel) => {
      expect(await fs.pathExists(path.join(allOn, rel))).toBe(false);
    },
  );

  it("barebone has no pages/lib, src/components, src/utils, src/types, or src/config directory at all", async () => {
    for (const dir of [
      "pages/lib",
      "src/components",
      "src/utils",
      "src/types",
      "src/config",
      ".zfb",
    ]) {
      expect(await fs.pathExists(path.join(barebone, dir))).toBe(false);
    }
  });
});

describe("scaffold — .zudo-doc.json is never seeded (lazy-create, locked decision #2653 #6)", () => {
  it("is absent from a barebone scaffold", async () => {
    await scaffold(baseChoices);
    expect(
      await fs.pathExists(projectPath("test-doc", ".zudo-doc.json")),
    ).toBe(false);
  });

  it("is absent even from an every-feature scaffold", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-doc-full",
      features: ALL_FEATURES,
    });
    expect(
      await fs.pathExists(projectPath("test-doc-full", ".zudo-doc.json")),
    ).toBe(false);
  });
});

describe("scaffold — documented deviation: tauri ships an unwired find-in-page island", () => {
  // #2660 completion comment deviation: the Rust shell (src-tauri/**) is a
  // genuine unconditional copy, AND the FindInPageInit island files are
  // still copied (kept per the sub-issue's original survivor list) even
  // though their old auto-mount point (pages/lib/_body-end-islands.tsx) no
  // longer exists — the island ships unwired. This is intentional, not a
  // gap this wave should paper over with a wrong absence assertion.
  it("copies src-tauri/** and the 3 find-in-page files when tauri is selected", async () => {
    await scaffold({ ...baseChoices, projectName: "test-tauri", features: ["tauri"] });
    const project = projectPath("test-tauri");
    for (const rel of [
      "src-tauri/.gitignore",
      "src-tauri/Cargo.toml",
      "src-tauri/build.rs",
      "src-tauri/capabilities/default.json",
      "src-tauri/src/main.rs",
      "src-tauri/tauri.conf.json",
      "src/components/find-bar.tsx",
      "src/components/find-in-page-init.tsx",
      "src/utils/find-in-page.ts",
    ]) {
      expect(await fs.pathExists(path.join(project, rel)), rel).toBe(true);
    }
  });

  it("does NOT copy any other src/components or src/utils file when only tauri is selected", async () => {
    await scaffold({ ...baseChoices, projectName: "test-tauri-2", features: ["tauri"] });
    const project = projectPath("test-tauri-2");
    expect((await listFiles(path.join(project, "src/components"))).sort()).toEqual(
      ["find-bar.tsx", "find-in-page-init.tsx"].sort(),
    );
    expect((await listFiles(path.join(project, "src/utils"))).sort()).toEqual([
      "find-in-page.ts",
    ]);
  });

  it("tauriDev ships src-tauri-dev/** only (no src/components or src/utils files)", async () => {
    await scaffold({ ...baseChoices, projectName: "test-tauri-dev", features: ["tauriDev"] });
    const project = projectPath("test-tauri-dev");
    expect(await fs.pathExists(path.join(project, "src-tauri-dev/Cargo.toml"))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(project, "src/components"))).toBe(false);
    expect(await fs.pathExists(path.join(project, "src/utils"))).toBe(false);
  });
});

describe("scaffold — documented deviation: tagGovernance's src/config/ pair (legacy tags-audit bin coupling)", () => {
  // #2660 completion comment deviation: @takazudo/zudo-doc's tags-audit bin
  // still dynamically imports src/config/settings.ts + tag-vocabulary.ts BY
  // PATH — a legacy coupling out of this generator's scope to fix. This is
  // the ONE feature that still needs a tiny src/config/ pair.
  it("writes src/config/settings.ts and src/config/tag-vocabulary.ts when tagGovernance is selected", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tag-gov",
      features: ["tagGovernance"],
    });
    const project = projectPath("test-tag-gov");
    expect(await fs.pathExists(path.join(project, "src/config/settings.ts"))).toBe(
      true,
    );
    expect(
      await fs.pathExists(path.join(project, "src/config/tag-vocabulary.ts")),
    ).toBe(true);

    const settings = await fs.readFile(
      path.join(project, "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain('tagGovernance: "warn" as const');
    expect(settings).toContain("tagVocabulary: true");

    const vocab = await fs.readFile(
      path.join(project, "src/config/tag-vocabulary.ts"),
      "utf-8",
    );
    expect(vocab).toContain("export const tagVocabulary");
  });

  it("does NOT write src/config/ at all when tagGovernance is disabled", async () => {
    await scaffold({ ...baseChoices, projectName: "test-no-tag-gov" });
    expect(
      await fs.pathExists(projectPath("test-no-tag-gov", "src/config")),
    ).toBe(false);
  });

  it("does NOT write settings-types.ts, docs-schema.ts, or any other src/config/* file", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tag-gov-2",
      features: ["tagGovernance"],
    });
    const files = (
      await listFiles(projectPath("test-tag-gov-2", "src/config"))
    ).sort();
    expect(files).toEqual(["settings.ts", "tag-vocabulary.ts"]);
  });
});

describe("scaffold — skillSymlinker feature", () => {
  it("copies scripts/setup-doc-skill.sh and emits the .gitignore skill block", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-skill-sym",
      features: ["skillSymlinker"],
    });
    const project = projectPath("test-skill-sym");
    expect(await fs.pathExists(path.join(project, "scripts/setup-doc-skill.sh"))).toBe(
      true,
    );
    const gitignore = await fs.readFile(path.join(project, ".gitignore"), "utf-8");
    expect(gitignore).toContain(
      ".claude/skills/test-skill-sym-wisdom/SKILL.md",
    );
    expect(gitignore).toContain(".codex/skills/test-skill-sym-wisdom/SKILL.md");
    // No i18n → no docs-ja ignore entry.
    expect(gitignore).not.toContain("docs-ja");
  });

  it("adds docs-ja ignore entries only when i18n is also enabled", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-skill-sym-i18n",
      features: ["skillSymlinker", "i18n"],
    });
    const gitignore = await fs.readFile(
      projectPath("test-skill-sym-i18n", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain(".claude/skills/test-skill-sym-i18n-wisdom/docs-ja");
  });

  it("emits no skill block and no script when skillSymlinker is off", async () => {
    await scaffold(baseChoices);
    const gitignore = await fs.readFile(projectPath("test-doc", ".gitignore"), "utf-8");
    expect(gitignore).not.toContain("# Generated doc-lookup skill");
    expect(
      await fs.pathExists(projectPath("test-doc", "scripts/setup-doc-skill.sh")),
    ).toBe(false);
  });

  it("emits setup:doc-skill* scripts in package.json only when enabled", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-skill-sym-scripts",
      features: ["skillSymlinker"],
    });
    const pkg = await fs.readJson(
      projectPath("test-skill-sym-scripts", "package.json"),
    );
    expect(pkg.scripts["setup:doc-skill"]).toBe("bash scripts/setup-doc-skill.sh");
    expect(pkg.scripts["setup:doc-skill:both"]).toBeDefined();

    await scaffold({ ...baseChoices, projectName: "test-skill-sym-off" });
    const off = await fs.readJson(
      projectPath("test-skill-sym-off", "package.json"),
    );
    expect(off.scripts["setup:doc-skill"]).toBeUndefined();
  });
});

describe("scaffold — claudeSkills feature", () => {
  it("copies the 3 user-facing zudo-doc-* skills and emits a b4push stub", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-claude-skills",
      features: ["claudeSkills"],
    });
    const project = projectPath("test-claude-skills");
    for (const skill of [
      "zudo-doc-design-system",
      "zudo-doc-translate",
      "zudo-doc-version-bump",
    ]) {
      expect(
        await fs.pathExists(path.join(project, `.claude/skills/${skill}/SKILL.md`)),
      ).toBe(true);
    }
    const pkg = await fs.readJson(path.join(project, "package.json"));
    expect(pkg.scripts.b4push).toBe("pnpm check && pnpm build");
  });

  it.each([
    ["npm", "npm run check && npm run build"],
    ["yarn", "yarn check && yarn build"],
    ["bun", "bun run check && bun run build"],
  ])("b4push uses %s's run convention", async (pm, expected) => {
    await scaffold({
      ...baseChoices,
      projectName: `test-b4push-${pm}`,
      features: ["claudeSkills"],
      packageManager: pm as UserChoices["packageManager"],
    });
    const pkg = await fs.readJson(projectPath(`test-b4push-${pm}`, "package.json"));
    expect(pkg.scripts.b4push).toBe(expected);
  });

  it("ships nothing and emits no b4push script when disabled", async () => {
    await scaffold(baseChoices);
    expect(
      await fs.pathExists(projectPath("test-doc", ".claude/skills")),
    ).toBe(false);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.scripts.b4push).toBeUndefined();
  });
});

describe("scaffold — changelog feature", () => {
  it("writes a starter src/content/docs/changelog/index.mdx", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-changelog",
      features: ["changelog"],
    });
    expect(
      await fs.pathExists(
        projectPath("test-changelog", "src/content/docs/changelog/index.mdx"),
      ),
    ).toBe(true);
  });

  it("also seeds the secondary-language changelog when i18n is on", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-changelog-i18n",
      features: ["changelog", "i18n"],
    });
    expect(
      await fs.pathExists(
        projectPath(
          "test-changelog-i18n",
          "src/content/docs-ja/changelog/index.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("does not write a changelog directory when disabled", async () => {
    await scaffold(baseChoices);
    expect(
      await fs.pathExists(projectPath("test-doc", "src/content/docs/changelog")),
    ).toBe(false);
  });
});

describe("scaffold — every-feature manifest is exactly base + the documented per-feature deltas", () => {
  it("all-on scaffold emits exactly the expected 44-file set", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-all-on",
      features: ALL_FEATURES,
    });
    const files = await listFiles(projectPath("test-all-on"));
    const expected = [
      ".claude/skills/zudo-doc-design-system/SKILL.md",
      ".claude/skills/zudo-doc-translate/SKILL.md",
      ".claude/skills/zudo-doc-version-bump/SKILL.md",
      ".gitignore",
      ".npmrc",
      "CLAUDE.md",
      "package.json",
      "pages/[locale]/docs/[[...slug]].tsx",
      "pages/docs/[[...slug]].tsx",
      "pages/index.tsx",
      "scripts/setup-doc-skill.sh",
      "scripts/tags-audit.ts",
      "scripts/tags-suggest.ts",
      "src-tauri-dev/.gitignore",
      "src-tauri-dev/Cargo.toml",
      "src-tauri-dev/build.rs",
      "src-tauri-dev/capabilities/default.json",
      "src-tauri-dev/frontend/index.html",
      "src-tauri-dev/icons/icon.png",
      "src-tauri-dev/src/main.rs",
      "src-tauri-dev/tauri.conf.json",
      "src-tauri-dev/test-launch.sh",
      "src-tauri/.gitignore",
      "src-tauri/Cargo.toml",
      "src-tauri/build.rs",
      "src-tauri/capabilities/default.json",
      "src-tauri/src/main.rs",
      "src-tauri/tauri.conf.json",
      "src/components/find-bar.tsx",
      "src/components/find-in-page-init.tsx",
      "src/config/settings.ts",
      "src/config/tag-vocabulary.ts",
      "src/content/docs-ja/changelog/index.mdx",
      "src/content/docs-ja/getting-started/index.mdx",
      "src/content/docs-ja/getting-started/installation.mdx",
      "src/content/docs-ja/getting-started/introduction.mdx",
      "src/content/docs/changelog/index.mdx",
      "src/content/docs/getting-started/index.mdx",
      "src/content/docs/getting-started/installation.mdx",
      "src/content/docs/getting-started/introduction.mdx",
      "src/styles/global.css",
      "src/utils/find-in-page.ts",
      "tsconfig.json",
      "zfb.config.ts",
    ].sort();
    expect(files).toEqual(expected);
  });
});

describe("scaffold — zfb.config.ts content shape (integration with generateZfbConfig)", () => {
  // Deep field-mapping coverage lives in zfb-config-gen.test.ts (a pure-
  // function unit test against generateZfbConfig() directly). These tests
  // only check that scaffold() writes exactly what that function returns,
  // plus the top-level shape guarantees the locked spec calls out.
  it("barebone emits a near-empty zudoDoc({...}) — only siteName + always-different nav/header fields", async () => {
    await scaffold(baseChoices);
    const config = await fs.readFile(projectPath("test-doc", "zfb.config.ts"), "utf-8");
    expect(config).toMatch(/^import \{ defineConfig \} from "zfb\/config";$/m);
    expect(config).toMatch(/^import \{ zudoDoc \} from "@takazudo\/zudo-doc\/config";$/m);
    expect(config).toContain("export default defineConfig(");
    expect(config).toContain("zudoDoc({");
    expect(config).toContain('siteName: "Test Doc"');
    // Nothing feature-specific should appear in a zero-feature scaffold.
    for (const token of [
      "docHistory",
      "llmsTxt",
      "claudeResources",
      "designTokenPanel",
      "tagGovernance",
      "footer:",
      "versions:",
    ]) {
      expect(config).not.toContain(token);
    }
  });

  it("does NOT emit inline plugins, collections, or zod (all delegated to the package)", async () => {
    await scaffold({ ...baseChoices, projectName: "test-no-inline", features: ALL_FEATURES });
    const config = await fs.readFile(
      projectPath("test-no-inline", "zfb.config.ts"),
      "utf-8",
    );
    expect(config).not.toContain("collections:");
    expect(config).not.toContain("plugins:");
    expect(config).not.toContain('from "zod"');
    expect(config).not.toContain("directiveVocabulary");
  });

  it("only user-chosen (diff-from-default) fields appear — e.g. docHistory selected but sidebarResizer not", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-partial",
      features: ["docHistory"],
    });
    const config = await fs.readFile(
      projectPath("test-partial", "zfb.config.ts"),
      "utf-8",
    );
    expect(config).toContain("docHistory: true");
    expect(config).not.toContain("sidebarResizer");
    expect(config).not.toContain("sidebarToggle");
    expect(config).not.toContain("designTokenPanel");
  });

  it("src/content.config.ts is NOT emitted (content config lives in zfb.config.ts)", async () => {
    await scaffold(baseChoices);
    expect(
      await fs.pathExists(projectPath("test-doc", "src/content.config.ts")),
    ).toBe(false);
  });
});

describe("scaffold — package-injected routes are never emitted as project files", () => {
  it.each([
    "pages/404.tsx",
    "pages/sitemap.xml.tsx",
    "pages/docs/tags/index.tsx",
    "pages/docs/tags/[tag].tsx",
    "pages/v/[version]/docs/[[...slug]].tsx",
    "pages/api/ai-chat.tsx",
  ])(
    "%s is absent even with every route-affecting feature on (docTags, versioning, tagGovernance)",
    async (rel) => {
      await scaffold({
        ...baseChoices,
        projectName: "test-injected-routes",
        features: ["docTags", "versioning", "tagGovernance", "search"],
      });
      expect(
        await fs.pathExists(projectPath("test-injected-routes", rel)),
      ).toBe(false);
    },
  );
});

describe("scaffold — .gitignore base blocks", () => {
  it("always ignores node_modules, dist, .zfb, .env*, and .zudo-doc/ build artifacts", async () => {
    await scaffold(baseChoices);
    const gitignore = await fs.readFile(projectPath("test-doc", ".gitignore"), "utf-8");
    for (const line of ["node_modules", "dist", ".zfb", ".env", ".wrangler/", ".zudo-doc/"]) {
      expect(gitignore).toContain(line);
    }
  });

  it("tauri appends src-tauri/target and src-tauri/gen", async () => {
    await scaffold({ ...baseChoices, projectName: "test-tauri-gi", features: ["tauri"] });
    const gitignore = await fs.readFile(
      projectPath("test-tauri-gi", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain("src-tauri/target");
    expect(gitignore).toContain("src-tauri/gen");
  });

  it("tauriDev appends src-tauri-dev/target and src-tauri-dev/gen", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tauri-dev-gi",
      features: ["tauriDev"],
    });
    const gitignore = await fs.readFile(
      projectPath("test-tauri-dev-gi", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain("src-tauri-dev/target");
    expect(gitignore).toContain("src-tauri-dev/gen");
  });
});

describe("scaffold — .npmrc", () => {
  it("exempts undici-types from the pnpm trust-downgrade policy", async () => {
    await scaffold(baseChoices);
    const npmrc = await fs.readFile(projectPath("test-doc", ".npmrc"), "utf-8");
    expect(npmrc).toBe("trust-policy-exclude[]=undici-types@6.21.0\n");
  });
});

describe("scaffold — tsconfig.json extends the package base config", () => {
  it("extends @takazudo/zudo-doc/tsconfig.base.json and declares the preact-compat paths block", async () => {
    await scaffold(baseChoices);
    const tsconfig = await fs.readJson(projectPath("test-doc", "tsconfig.json"));
    expect(tsconfig.extends).toBe("@takazudo/zudo-doc/tsconfig.base.json");
    expect(tsconfig.include).toEqual(["src", "pages", "zfb.config.ts"]);
    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["src/*"]);
    expect(tsconfig.compilerOptions.paths["react"]).toBeDefined();
  });

  it("does NOT carry the old 183-line inline zfb/config ambient shim block", async () => {
    await scaffold(baseChoices);
    const tsconfig = await fs.readFile(projectPath("test-doc", "tsconfig.json"), "utf-8");
    expect(tsconfig).not.toContain("declare module");
    expect(tsconfig).not.toContain("#doc-history-meta");
  });
});

describe("scaffold — global.css", () => {
  it("imports the 5 package-shipped stylesheets in the documented order and scans project source", async () => {
    await scaffold(baseChoices);
    const css = await fs.readFile(projectPath("test-doc", "src/styles/global.css"), "utf-8");
    const importOrder = [
      "@takazudo/zudo-doc/theme.css",
      "@takazudo/zudo-doc/safelist.css",
      "@takazudo/zudo-doc/content.css",
      "@takazudo/zudo-doc/page-loading.css",
      "@takazudo/zudo-doc/features.css",
    ];
    let lastIndex = -1;
    for (const imp of importOrder) {
      const idx = css.indexOf(imp);
      expect(idx, `${imp} must appear`).toBeGreaterThan(-1);
      expect(idx, `${imp} must appear in order`).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
    expect(css).toContain("@layer zd-preflight, zd-flow;");
    expect(css).toContain('@source "src/content/**/*.{mdx,md}"');
  });

  it("does NOT import @takazudo/zdtp/styles.css when designTokenPanel is off", async () => {
    // The base template's header comment DOCUMENTS the conditional import
    // (mentions the literal string in prose) even when the feature is off —
    // assert on the actual `@import` statement, not a bare substring match.
    await scaffold(baseChoices);
    const css = await fs.readFile(projectPath("test-doc", "src/styles/global.css"), "utf-8");
    expect(css).not.toContain('@import "@takazudo/zdtp/styles.css";');
  });

  it("inserts the @takazudo/zdtp/styles.css import right after the @layer line when designTokenPanel is on", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-zdtp-css",
      features: ["designTokenPanel"],
    });
    const css = await fs.readFile(
      projectPath("test-zdtp-css", "src/styles/global.css"),
      "utf-8",
    );
    expect(css).toContain(
      '@layer zd-preflight, zd-flow;\n@import "@takazudo/zdtp/styles.css";',
    );
  });
});

describe("scaffold — the doc-route stub is patched (not duplicated) when docHistory is selected", () => {
  it("statically imports DocHistory and threads it into createChrome", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-doc-history-stub",
      features: ["docHistory"],
    });
    const stub = await fs.readFile(
      projectPath("test-doc-history-stub", "pages/docs/[[...slug]].tsx"),
      "utf-8",
    );
    expect(stub).toContain(
      'import { DocHistory } from "@takazudo/zudo-doc/doc-history";',
    );
    expect(stub).toContain("DocHistory: DocHistory as unknown as ChromeHostBindings[\"DocHistory\"]");
  });

  it("also patches the i18n locale stub when both i18n and docHistory are selected", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-doc-history-i18n",
      features: ["docHistory", "i18n"],
    });
    const stub = await fs.readFile(
      projectPath(
        "test-doc-history-i18n",
        "pages/[locale]/docs/[[...slug]].tsx",
      ),
      "utf-8",
    );
    expect(stub).toContain(
      'import { DocHistory } from "@takazudo/zudo-doc/doc-history";',
    );
  });

  it("leaves the stub unpatched when docHistory is off", async () => {
    // The stub's own header comment explains the docHistory patch in prose
    // (mentions "DocHistory" even when unpatched) — assert on the actual
    // inserted import statement, not a bare substring match.
    await scaffold(baseChoices);
    const stub = await fs.readFile(
      projectPath("test-doc", "pages/docs/[[...slug]].tsx"),
      "utf-8",
    );
    expect(stub).not.toContain(
      'import { DocHistory } from "@takazudo/zudo-doc/doc-history";',
    );
  });
});

describe("scaffold — bodyFootUtil auto-enables docHistory (#1795 behavior, re-targeted to zfb.config.ts)", () => {
  it("silently enables docHistory when bodyFootUtil is selected without it", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-body-foot",
      features: ["bodyFootUtil"],
    });
    const config = await fs.readFile(
      projectPath("test-body-foot", "zfb.config.ts"),
      "utf-8",
    );
    expect(config).toContain("docHistory: true");
    expect(config).toContain("bodyFootUtilArea: {");
  });
});

describe("scaffold — CLAUDE.md generation", () => {
  it("creates CLAUDE.md with project name, tech stack, and commands", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-claudemd",
      features: ["search"],
    });
    const content = await fs.readFile(projectPath("test-claudemd", "CLAUDE.md"), "utf-8");
    expect(content).toContain("# Test Claudemd");
    expect(content).toContain("zudo-doc");
    expect(content).toContain("**zfb**");
    expect(content).toContain("pnpm dev");
    expect(content).toContain("pnpm build");
    expect(content).toContain("MDX content");
  });

  it("describes the minimal shape: one config file, package owns the rest", async () => {
    await scaffold(baseChoices);
    const content = await fs.readFile(projectPath("test-doc", "CLAUDE.md"), "utf-8");
    expect(content).toContain("zfb.config.ts");
    expect(content).toContain("node_modules/@takazudo/zudo-doc");
    expect(content).toContain("zudo-doc eject");
  });

  it("does NOT reference deleted directories (src/components/, pages/lib/*, src/layouts/)", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-claudemd-2",
      features: ALL_FEATURES,
    });
    const content = await fs.readFile(
      projectPath("test-claudemd-2", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).not.toContain("src/components/admonitions");
    expect(content).not.toContain("pages/lib/");
    expect(content).not.toContain("src/layouts/");
  });

  it("includes an i18n section (with the two self-contained-stub note) only when i18n is enabled", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-claudemd-i18n",
      features: ["i18n", "search"],
    });
    const withI18n = await fs.readFile(
      projectPath("test-claudemd-i18n", "CLAUDE.md"),
      "utf-8",
    );
    expect(withI18n).toContain("## i18n");
    expect(withI18n).toContain("docs-ja");

    await scaffold({
      ...baseChoices,
      projectName: "test-claudemd-no-i18n",
      features: ["search"],
    });
    const without = await fs.readFile(
      projectPath("test-claudemd-no-i18n", "CLAUDE.md"),
      "utf-8",
    );
    expect(without).not.toContain("## i18n");
  });

  it("lists enabled features by name", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-claudemd-features",
      features: ["search", "docHistory", "llmsTxt"],
    });
    const content = await fs.readFile(
      projectPath("test-claudemd-features", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("## Enabled Features");
    expect(content).toContain("**search**");
    expect(content).toContain("**docHistory**");
    expect(content).toContain("**llmsTxt**");
  });

  it("uses the correct package manager in commands", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-claudemd-npm",
      features: ["search"],
      packageManager: "npm",
    });
    const content = await fs.readFile(
      projectPath("test-claudemd-npm", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("npm run dev");
    expect(content).toContain("npm run build");
    expect(content).not.toContain("pnpm");
  });
});

describe("scaffold — generated package.json", () => {
  it("scripts: only dev/build/preview/check by default — no check:html, gen:z-index, or check:z-index", async () => {
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.scripts).toEqual({
      dev: "zfb dev",
      build: "zfb build",
      preview: "zfb preview",
      check: "zfb check",
    });
  });

  it("does NOT include html-validate in devDependencies", async () => {
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.devDependencies["html-validate"]).toBeUndefined();
  });

  it("includes @takazudo/zfb, @takazudo/zudo-doc, and @takazudo/zdtp unconditionally (build-time couplings)", async () => {
    // diff and @takazudo/zdtp are unconditional dependencies regardless of
    // docHistory/designTokenPanel selection — see the #2660 completion
    // comment: packageOwnedRoutes always bundles the doc-history-area path
    // and the chrome-derive seam always imports DesignTokenPanelBootstrap.
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.dependencies["@takazudo/zfb"]).toBeDefined();
    expect(pkg.dependencies["@takazudo/zfb-runtime"]).toBeDefined();
    expect(pkg.dependencies["@takazudo/zudo-doc"]).toMatch(/^\^\d+\.\d+\.\d+/);
    expect(pkg.dependencies["diff"]).toBeDefined();
    expect(pkg.dependencies["@takazudo/zdtp"]).toBeDefined();
    expect(pkg.dependencies["astro"]).toBeUndefined();
  });

  it("includes zod, preact-render-to-string, and katex as always-on runtime deps", async () => {
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.dependencies["zod"]).toBe("^4.3.6");
    expect(pkg.dependencies["preact-render-to-string"]).toBeDefined();
    expect(pkg.dependencies["katex"]).toBeDefined();
  });

  it("adds pagefind to devDependencies only when search is enabled", async () => {
    await scaffold({ ...baseChoices, projectName: "test-search", features: ["search"] });
    const withSearch = await fs.readJson(
      projectPath("test-search", "package.json"),
    );
    expect(withSearch.devDependencies["pagefind"]).toBeDefined();

    await scaffold(baseChoices);
    const without = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(without.devDependencies["pagefind"]).toBeUndefined();
  });

  it("adds @takazudo/zudo-doc-history-server only when docHistory is enabled", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-history-dep",
      features: ["docHistory"],
    });
    const pkg = await fs.readJson(projectPath("test-history-dep", "package.json"));
    expect(pkg.dependencies["@takazudo/zudo-doc-history-server"]).toBeDefined();
  });

  it("adds tag-governance tooling devDeps and the tags:audit/tags:suggest scripts only when tagGovernance is enabled", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tag-gov-deps",
      features: ["tagGovernance"],
    });
    const pkg = await fs.readJson(
      projectPath("test-tag-gov-deps", "package.json"),
    );
    expect(pkg.devDependencies["string-similarity"]).toBeDefined();
    expect(pkg.devDependencies["pluralize"]).toBeDefined();
    expect(pkg.devDependencies["tsx"]).toBeDefined();
    expect(pkg.scripts["tags:audit"]).toBe("tags-audit");
    expect(pkg.scripts["tags:suggest"]).toBe("tsx scripts/tags-suggest.ts");
  });

  it("adds dev:tauri/build:tauri scripts only when tauri is enabled", async () => {
    await scaffold({ ...baseChoices, projectName: "test-tauri-scripts", features: ["tauri"] });
    const pkg = await fs.readJson(
      projectPath("test-tauri-scripts", "package.json"),
    );
    expect(pkg.scripts["dev:tauri"]).toBe("cargo tauri dev");
    expect(pkg.scripts["build:tauri"]).toBe("pnpm build && cargo tauri build");
  });

  it("adds dev:tauri-dev/build:tauri-dev scripts only when tauriDev is enabled", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tauri-dev-scripts",
      features: ["tauriDev"],
    });
    const pkg = await fs.readJson(
      projectPath("test-tauri-dev-scripts", "package.json"),
    );
    expect(pkg.scripts["dev:tauri-dev"]).toBe("cd src-tauri-dev && cargo tauri dev");
  });
});

describe("scaffold — settings-drift guard: generator-known fields must cover every ZudoDocConfig field", () => {
  // Rewritten per Wave 7 (#2662) item 2. The OLD guard compared the
  // generator's output against `src/config/settings.ts` (the host's own
  // showcase settings file) — that file no longer exists as a census
  // source. The NEW census is `ZudoDocConfig` in
  // `packages/zudo-doc/src/config.ts` — the single user-facing settings
  // type every `zfb.config.ts` (generated or hand-written) is validated
  // against. "generator-known" means: either zfb-config-gen.ts's
  // FIELD_ORDER can emit it, OR it's on the explicit ALLOWLIST below with a
  // documented reason the generator intentionally never sets it (escape
  // hatch, shell passthrough, or a field with no CLI/prompt surface yet).
  // A new ZudoDocConfig field that lands in neither bucket fails this test
  // — forcing whoever added it to either wire it up or justify the gap.
  it("every ZudoDocConfig field is generator-known (wired OR explicitly allowlisted)", async () => {
    const configTsPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../packages/zudo-doc/src/config.ts",
    );
    const configTs = await fs.readFile(configTsPath, "utf-8");

    // Extract the ZudoDocConfig interface body.
    const startMarker = "export interface ZudoDocConfig {";
    const startIdx = configTs.indexOf(startMarker);
    expect(startIdx, "ZudoDocConfig interface not found — census source moved?").toBeGreaterThan(-1);
    // Find the matching closing brace by scanning brace depth from the
    // interface's opening `{`.
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx + startMarker.length - 1; i < configTs.length; i++) {
      if (configTs[i] === "{") depth++;
      else if (configTs[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    expect(endIdx, "could not find the end of the ZudoDocConfig interface").toBeGreaterThan(-1);
    const body = configTs.slice(startIdx + startMarker.length, endIdx);

    // Top-level field names: 2-space-indented `name?:` or `name:` lines.
    const fieldPattern = /^ {2}([A-Za-z][A-Za-z0-9]*)\??:/gm;
    const zudoDocConfigFields = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = fieldPattern.exec(body)) !== null) {
      zudoDocConfigFields.add(match[1]!);
    }
    expect(zudoDocConfigFields.size).toBeGreaterThan(30); // sanity check

    // Fields zfb-config-gen.ts's FIELD_ORDER can emit (read directly from
    // source rather than re-declared here, so this test can't drift from
    // the generator's actual capability).
    const zfbConfigGenPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../zfb-config-gen.ts",
    );
    const genSrc = await fs.readFile(zfbConfigGenPath, "utf-8");
    const fieldOrderMatch = genSrc.match(
      /const FIELD_ORDER = \[([\s\S]*?)\];/,
    );
    expect(fieldOrderMatch, "FIELD_ORDER not found in zfb-config-gen.ts").not.toBeNull();
    const generatorKnownFields = new Set(
      [...fieldOrderMatch![1]!.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]!),
    );
    expect(generatorKnownFields.size).toBeGreaterThan(20); // sanity check

    // Fields the generator intentionally never sets, with the reason each
    // is out of scope for create-zudo-doc's CLI/prompt/preset surface.
    const ALLOWLIST: Record<string, string> = {
      // Escape hatches — non-serializable data overrides. No CLI/JSON-preset
      // shape can represent a function or an arbitrary color-scheme map.
      buildDocsSchema: "non-serializable escape hatch (function value)",
      colorSchemes: "non-serializable escape hatch (arbitrary data override)",
      translations: "non-serializable escape hatch (arbitrary data override)",
      directives: "non-serializable escape hatch (arbitrary data override)",
      // Shell passthrough fields — infra concerns, not doc-site features.
      port: "shell passthrough — dev/preview server port, not a scaffold prompt",
      adapter: "shell passthrough — deploy-target wiring, project-specific",
      bundle: "shell passthrough — raw esbuild bundler options",
      chromeBindingsModule: "shell passthrough — host-callables wiring, hand-authored after scaffold",
      // Fields with no CLI/prompt surface (yet) — hand-edit zfb.config.ts
      // after scaffold, or covered by a future sub-issue.
      siteDescription: "no CLI/prompt surface yet — hand-edit post-scaffold",
      base: "no CLI/prompt surface yet — hand-edit post-scaffold (sub-path deploys)",
      trailingSlash: "no CLI/prompt surface yet — hand-edit post-scaffold",
      docsDir: "no CLI/prompt surface yet — generator always uses the default",
      mermaid: "no CLI/prompt surface yet — package default (on) is correct for all scaffolds",
      editUrl: "no CLI/prompt surface yet — hand-edit post-scaffold",
      githubAutolinksRepo: "showcase-only opt-in (zudo-doc#2321 Wave-0) — generated projects must opt in explicitly",
      siteUrl: "no CLI/prompt surface yet — hand-edit post-scaffold",
      head: "no CLI/prompt surface yet — hand-edit post-scaffold",
      sitemap: "no CLI/prompt surface yet — hand-edit post-scaffold",
      docMetainfo: "no CLI/prompt surface yet — hand-edit post-scaffold",
      tagPlacement: "no CLI/prompt surface yet — package default is correct for all scaffolds",
      changelogs: "no CLI/prompt surface yet — the `changelog` feature only seeds starter content, not this git-log-driven config",
      math: "no CLI/prompt surface yet — hand-edit post-scaffold",
      onBrokenMarkdownLinks: "no CLI/prompt surface yet — package default (warn) is correct for all scaffolds",
      aiAssistant: "no CLI/prompt surface yet — ai-chat is a showcase-only route, requires a Worker/KV binding",
      aiChatDemoMode: "no CLI/prompt surface yet — companion to aiAssistant",
      aiChatAllowedOrigins: "no CLI/prompt surface yet — companion to aiAssistant",
      aiChatGlobalDailyLimit: "no CLI/prompt surface yet — companion to aiAssistant",
      tocMinDepth: "no CLI/prompt surface yet — package default is correct for all scaffolds",
      tocMaxDepth: "no CLI/prompt surface yet — package default is correct for all scaffolds",
      headingIdStrategy: "no CLI/prompt surface yet — package default is correct for all scaffolds",
      frontmatterPreview: "no CLI/prompt surface yet — hand-edit post-scaffold",
      htmlPreview: "no CLI/prompt surface yet — hand-edit post-scaffold",
      packageOwnedRoutes: "no CLI/prompt surface — flipping this off requires shipping the project's own route stubs, an eject-time decision, not a scaffold-time one",
    };

    const missing = [...zudoDocConfigFields].filter(
      (f) => !generatorKnownFields.has(f) && !(f in ALLOWLIST),
    );
    expect(
      missing,
      `ZudoDocConfig gained field(s) the generator doesn't know about: ${missing.join(", ")}. ` +
        `Either wire them into zfb-config-gen.ts's buildDesiredConfig()/DEFAULT_MIRROR/FIELD_ORDER, ` +
        `or add them to the ALLOWLIST above with a reason.`,
    ).toEqual([]);

    // Catch the inverse drift too: an allowlist entry for a field that no
    // longer exists on ZudoDocConfig (stale allowlist, or the field was
    // renamed) — silently rots protection for whatever the field became.
    const staleAllowlistEntries = Object.keys(ALLOWLIST).filter(
      (f) => !zudoDocConfigFields.has(f),
    );
    expect(
      staleAllowlistEntries,
      `ALLOWLIST references field(s) no longer on ZudoDocConfig: ${staleAllowlistEntries.join(", ")}. Remove them.`,
    ).toEqual([]);
  });
});

describe("validateProjectName — locked grammar (F4 #2013)", () => {
  it("accepts a valid lowercase kebab name", () => {
    expect(validateProjectName("my-docs")).toBeNull();
  });

  it("accepts a single-char name", () => {
    expect(validateProjectName("a")).toBeNull();
  });

  it("accepts a name starting with a digit", () => {
    expect(validateProjectName("1my-docs")).toBeNull();
  });

  it("accepts a name with dots", () => {
    expect(validateProjectName("my.docs")).toBeNull();
  });

  it("accepts a name with underscores", () => {
    expect(validateProjectName("my_docs")).toBeNull();
  });

  it("accepts a name with hyphens", () => {
    expect(validateProjectName("my-docs-v2")).toBeNull();
  });

  it("accepts a name exactly 214 characters", () => {
    expect(validateProjectName("a".repeat(214))).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateProjectName("")).toMatch(/required/);
  });

  it("rejects a name longer than 214 characters", () => {
    expect(validateProjectName("a".repeat(215))).toMatch(/214/);
  });

  it("rejects a name with uppercase letters", () => {
    expect(validateProjectName("My-Docs")).toMatch(/lowercase/);
  });

  it("rejects a name with spaces", () => {
    expect(validateProjectName("my docs")).toMatch(/lowercase/);
  });

  it("rejects a name starting with a hyphen", () => {
    expect(validateProjectName("-my-docs")).toMatch(/lowercase/);
  });

  it("rejects a name starting with a dot", () => {
    expect(validateProjectName(".my-docs")).toMatch(/lowercase/);
  });

  it("rejects a name starting with an underscore", () => {
    expect(validateProjectName("_my-docs")).toMatch(/lowercase/);
  });

  it("rejects a name with a slash", () => {
    expect(validateProjectName("my/docs")).toMatch(/lowercase/);
  });

  it("rejects a name with a backslash", () => {
    expect(validateProjectName("my\\docs")).toMatch(/lowercase/);
  });

  it("rejects a scoped npm name", () => {
    expect(validateProjectName("@scope/my-docs")).toMatch(/lowercase/);
  });
});

describe("scaffold — programmatic API rejects invalid project names (F4 #2013)", () => {
  // Exercises the createZudoDoc() entry point directly — the validator fires
  // before scaffold() is called, so no directory is created.
  it("createZudoDoc() throws for an invalid project name with uppercase", async () => {
    await expect(
      createZudoDoc({
        projectName: "My-Invalid-Docs",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Invalid projectName/);
  });

  it("createZudoDoc() throws for a name with spaces", async () => {
    await expect(
      createZudoDoc({
        projectName: "my invalid",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Invalid projectName/);
  });

  it("createZudoDoc() throws for a name longer than 214 chars", async () => {
    await expect(
      createZudoDoc({
        projectName: "a".repeat(215),
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Invalid projectName/);
  });

  // Post-catalog-drop (#2619) only Default Light/Dark exist. The API must reject
  // a removed scheme name (e.g. "Dracula") like the CLI/preset paths do — otherwise
  // it writes the dead name into zfb.config.ts and the generated site throws
  // "Unknown color scheme" at build.
  it("createZudoDoc() throws for a removed single scheme name", async () => {
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "single",
        singleScheme: "Dracula",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Unknown color scheme "Dracula"/);
  });

  it("createZudoDoc() throws for a removed light scheme name", async () => {
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "light-dark",
        lightScheme: "GitHub Light",
        darkScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Unknown light scheme "GitHub Light"/);
  });

  it("createZudoDoc() throws for a removed dark scheme name", async () => {
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "light-dark",
        lightScheme: "Default Light",
        darkScheme: "Nord",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Unknown dark scheme "Nord"/);
  });

  it("createZudoDoc() scaffolds successfully for a valid config (integration smoke)", async () => {
    const targetDir = await createZudoDoc({
      projectName: "valid-smoke-test",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    });
    expect(await fs.pathExists(path.join(targetDir, "zfb.config.ts"))).toBe(true);
  });
});
