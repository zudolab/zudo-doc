import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";
import { validateProjectName } from "../utils.js";
import { createZudoDoc } from "../api.js";
import type { PresetHeaderRightItem, PresetMetaTagsConfig } from "../preset.js";
import { validatePreset } from "../preset.js";

// Minimal-scaffold cutover (epic zudolab/zudo-doc#2651). Rewritten from
// scratch for Wave 7 (#2662) against the locked ~12-file manifest landed by
// Wave 6 (#2660) — see that issue's completion comment for the deleted-file
// set and the documented deviations (tagGovernance's tag config module, the
// unconditional @takazudo/zdtp dep). The tauri feature's find-in-page island
// used to be a documented "ships unwired" file-copy deviation; #2690 retired
// it — find-in-page is now package-owned and emitted via `findInPage: true`
// (see the "tauri no longer ships find-in-page template files" describe
// block below). The old suite asserted a 64-file project shape (settings.ts,
// pages/lib/*, src/components/*, per-page anchor injections) that no longer
// exists.

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

/** The locked ~13-file barebone (EN-only) manifest. Grew from 12 to 13 with
 *  pnpm-workspace.yaml (#2923 — disables pnpm 11's minimumReleaseAge gate). */
const BAREBONE_MANIFEST = [
  ".gitignore",
  ".npmrc",
  "CLAUDE.md",
  "package.json",
  "pages/docs/[[...slug]].tsx",
  "pages/index.tsx",
  "pnpm-workspace.yaml",
  "src/content/docs/getting-started/index.mdx",
  "src/content/docs/getting-started/installation.mdx",
  "src/content/docs/getting-started/introduction.mdx",
  "src/styles/global.css",
  "tsconfig.json",
  "zfb.config.ts",
].sort();

/** All 25 feature values wired to a real (non-pseudo, non-scaffold.ts-only) module. */
const ALL_FEATURES = [
  "i18n",
  "search",
  "sidebarFilter",
  "claudeResources",
  "claudeSkills",
  "designTokenPanel",
  "themePackSwitcher",
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

describe("scaffold — barebone manifest (locked 13-file shape, #2653 Decision 4)", () => {
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

  it("emits EXACTLY the 13 locked-manifest files — no more, no less", () => {
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

describe("scaffold — i18n locale doc stub threads isFallback + per-locale content dir (#2651 review fix)", () => {
  // Regression guard for two real bugs in the emitted locale stub: (1) it
  // never threaded `isFallback` into renderDocPage, so untranslated fallback
  // pages lost the "not translated yet" notice; (2) it hardcoded the EN
  // docsDir as `docHistoryContentDir` for EVERY locale, so translated pages
  // read doc-history from the wrong directory. The correct logic is ported
  // from packages/zudo-doc/src/routes/locale-docs-slug.tsx and the showcase's
  // own migrated stub.
  let stub: string;

  beforeAll(async () => {
    const cwdBefore = process.cwd();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    process.chdir(dir);
    await scaffold({ ...baseChoices, projectName: "i18n-stub", features: ["i18n"] });
    process.chdir(cwdBefore);
    stub = await fs.readFile(
      path.join(dir, "i18n-stub", "pages/[locale]/docs/[[...slug]].tsx"),
      "utf-8",
    );
    await fs.remove(dir);
  });

  it("threads isFallback into renderDocPage", () => {
    expect(stub).toContain("isFallback: props.isFallback");
  });

  it("threads the per-locale content dir (not a hardcoded docsDir) into docHistoryContentDir", () => {
    expect(stub).toContain("docHistoryContentDir: props.contentDir");
    // Must resolve the locale's own dir, falling back to docsDir only for
    // fallback pages — NOT hardcode docsDir for every locale.
    expect(stub).toContain("routeCtx.getLocaleConfig(locale)?.dir");
    expect(stub).toContain(
      "item.isFallback ? routeCtx.settings.docsDir : contentDir",
    );
    // The old bug: docHistoryContentDir hardcoded to routeCtx.settings.docsDir
    // in the default export. That exact hardcode must be gone.
    expect(stub).not.toContain(
      "docHistoryContentDir: routeCtx.settings.docsDir",
    );
  });

  it("keeps the two docHistory-patch anchor lines intact (so the docHistory postProcess still applies)", () => {
    expect(stub).toContain(
      'import { createChrome } from "@takazudo/zudo-doc/chrome";',
    );
    expect(stub).toContain(
      'import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";',
    );
    expect(stub).toContain(
      "const { renderDocPage } = createChrome(routeCtx, chromeBindings);",
    );
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
    // src/components/* (tauri's find-bar.tsx/find-in-page-init.tsx used to be
    // a documented exception here — #2690 deleted those template files
    // entirely, so tauri no longer writes anything under src/components/
    // either; see the dedicated tauri describe block below for the absence
    // assertion).
    "src/components/ai-chat-modal.tsx",
    "src/components/content/code-group.tsx",
    "src/components/content/content-admonition.tsx",
    "src/components/desktop-sidebar-toggle.tsx",
    "src/components/doc-history.tsx",
    "src/components/design-token-panel-bootstrap.tsx",
    "src/components/image-enlarge.tsx",
    "src/components/preset-generator.tsx",
    "src/components/sidebar-toggle.tsx",
    "src/components/sidebar-tree.tsx",
    // src/utils/* (tauri's find-in-page.ts used to be a documented exception
    // here — #2690 deleted it too; see the dedicated tauri describe block).
    "src/utils/base.ts",
    "src/utils/docs.ts",
    "src/utils/git-info.ts",
    "src/utils/github.ts",
    "src/utils/nav-scope.ts",
    "src/utils/sidebar.ts",
    "src/utils/slug.ts",
    "src/utils/smart-break.tsx",
    "src/utils/tags.ts",
    "src/lib/design-token-panel-bootstrap.ts",
    // src/types/*
    "src/types/docs-entry.ts",
    "src/types/heading.ts",
    "src/types/locale.ts",
    // src/config/* (the tagGovernance tag-vocabulary.ts exception is covered
    // separately below).
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
    "src/config/settings.ts",
    // Standalone deleted files.
    "zfb-shim.d.ts",
    ".htmlvalidate.json",
    ".zfb/doc-history-meta.json",
    ".zudo-doc.json",
    "scripts/run-b4push.sh",
    "scripts/tags-audit.ts",
    "scripts/tags-suggest.ts",
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

describe("scaffold — tauri no longer ships find-in-page template files (package-owned, #2690)", () => {
  // #2689 moved the FindInPageInit island (Cmd/Ctrl+F find bar) into
  // @takazudo/zudo-doc as a package-owned, settings-gated island. #2690
  // retired the old "ships unwired" deviation: the generator no longer
  // copies src/components/find-bar.tsx, src/components/find-in-page-init.tsx,
  // or src/utils/find-in-page.ts — it emits `findInPage: true` in
  // zfb.config.ts instead (see the zfb.config.ts content-shape describe
  // block below), and `zudoDocPreset()` mounts the island from there. tauri
  // now copies ONLY the Rust shell (src-tauri/**), which still has no
  // package equivalent.
  it("copies src-tauri/** only when tauri is selected — no find-in-page files", async () => {
    await scaffold({ ...baseChoices, projectName: "test-tauri", features: ["tauri"] });
    const project = projectPath("test-tauri");
    for (const rel of [
      "src-tauri/.gitignore",
      "src-tauri/Cargo.toml",
      "src-tauri/build.rs",
      "src-tauri/capabilities/default.json",
      "src-tauri/src/main.rs",
      "src-tauri/tauri.conf.json",
    ]) {
      expect(await fs.pathExists(path.join(project, rel)), rel).toBe(true);
    }
    for (const rel of [
      "src/components/find-bar.tsx",
      "src/components/find-in-page-init.tsx",
      "src/utils/find-in-page.ts",
    ]) {
      expect(await fs.pathExists(path.join(project, rel)), rel).toBe(false);
    }
  });

  it("does NOT create a src/components or src/utils directory at all when only tauri is selected", async () => {
    await scaffold({ ...baseChoices, projectName: "test-tauri-2", features: ["tauri"] });
    const project = projectPath("test-tauri-2");
    expect(await fs.pathExists(path.join(project, "src/components"))).toBe(false);
    expect(await fs.pathExists(path.join(project, "src/utils"))).toBe(false);
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

describe("scaffold — tagGovernance explicit CLI config", () => {
  it("writes one tag vocabulary/config module and no duplicate settings module", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tag-gov",
      features: ["tagGovernance"],
    });
    const project = projectPath("test-tag-gov");
    expect(await fs.pathExists(path.join(project, "src/config/settings.ts"))).toBe(
      false,
    );
    expect(
      await fs.pathExists(path.join(project, "src/config/tag-vocabulary.ts")),
    ).toBe(true);

    const vocab = await fs.readFile(
      path.join(project, "src/config/tag-vocabulary.ts"),
      "utf-8",
    );
    expect(vocab).toContain("export const tagVocabulary");
    expect(vocab).toContain("satisfies TagCliConfig");
    expect(vocab).toContain("export default tagCliConfig");
  });

  it("does NOT write src/config/ at all when tagGovernance is disabled", async () => {
    await scaffold({ ...baseChoices, projectName: "test-no-tag-gov" });
    expect(
      await fs.pathExists(projectPath("test-no-tag-gov", "src/config")),
    ).toBe(false);
  });

  it("includes the generated locale directory in the shared CLI config", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tag-gov-i18n",
      features: ["tagGovernance", "i18n"],
    });
    const vocab = await fs.readFile(
      projectPath(
        "test-tag-gov-i18n",
        "src/config/tag-vocabulary.ts",
      ),
      "utf-8",
    );
    expect(vocab).toContain('"src/content/docs"');
    expect(vocab).toContain('"src/content/docs-ja"');
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
    expect(files).toEqual(["tag-vocabulary.ts"]);
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

  // Unreachable in a healthy checkout — the template sources are committed
  // alongside scaffold.ts. Simulated by making fs.pathExists lie about one
  // skill's TEMPLATE SOURCE path specifically, so the other 2 skills still
  // take the real (non-mocked) code path. The match is scoped to
  // "templates/features/claudeSkills" so it can never accidentally match the
  // generated project's destination path (which lives under a tempDir with
  // no such segment) — a looser substring match would make the destination
  // assertion below pass vacuously (the mock lying, not scaffold's own
  // skip-on-missing behavior).
  it("warns and skips a skill whose template source is missing", async () => {
    const realPathExists = fs.pathExists;
    const pathExistsSpy = vi
      .spyOn(fs, "pathExists")
      .mockImplementation(async (p: string) => {
        if (
          p.includes(path.join("templates/features/claudeSkills")) &&
          p.includes("zudo-doc-translate")
        ) {
          return false;
        }
        return realPathExists(p);
      });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await scaffold({
        ...baseChoices,
        projectName: "test-claude-skills-missing",
        features: ["claudeSkills"],
      });
    } finally {
      // Restore before the assertions below so the destination-existence
      // checks hit the real filesystem, not the mock.
      pathExistsSpy.mockRestore();
    }

    try {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'missing template source for "zudo-doc-translate"',
        ),
      );
      const project = projectPath("test-claude-skills-missing");
      expect(
        await fs.pathExists(
          path.join(project, ".claude/skills/zudo-doc-translate/SKILL.md"),
        ),
      ).toBe(false);
      // The other 2 skills are unaffected by the one missing source.
      for (const skill of ["zudo-doc-design-system", "zudo-doc-version-bump"]) {
        expect(
          await fs.pathExists(
            path.join(project, `.claude/skills/${skill}/SKILL.md`),
          ),
        ).toBe(true);
      }
    } finally {
      warnSpy.mockRestore();
    }
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

  it("seeds the JA starter (## 未リリース) into the primary changelog page for a ja-default project (i18n off)", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-changelog-ja-default",
      defaultLang: "ja",
      features: ["changelog"],
    });
    const changelogPath = projectPath(
      "test-changelog-ja-default",
      "src/content/docs/changelog/index.mdx",
    );
    expect(await fs.pathExists(changelogPath)).toBe(true);
    const content = await fs.readFile(changelogPath, "utf-8");
    expect(content.includes("## 未リリース")).toBe(true);
  });
});

describe("scaffold — every-feature manifest is exactly base + the documented per-feature deltas", () => {
  it("all-on scaffold emits exactly the expected 39-file set", async () => {
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
      "pnpm-workspace.yaml",
      "scripts/setup-doc-skill.sh",
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
  it("barebone emits a near-empty zudoDoc({...}) without an inert GitHub header item", async () => {
    await scaffold(baseChoices);
    const config = await fs.readFile(projectPath("test-doc", "zfb.config.ts"), "utf-8");
    expect(config).toMatch(/^import \{ defineConfig \} from "zfb\/config";$/m);
    expect(config).toMatch(/^import \{ zudoDoc \} from "@takazudo\/zudo-doc\/config";$/m);
    expect(config).toContain("export default defineConfig(");
    expect(config).toContain("zudoDoc({");
    expect(config).toContain('siteName: "Test Doc"');
    expect(config).not.toContain('component: "github-link"');
    expect(config).not.toContain("headerRightItems:");
    // Highlighting is package-preset-owned. The generated project delegates to
    // zudoDoc() and must not freeze an inline/dual-theme renderer config.
    for (const token of [
      "codeHighlight",
      "themeLight",
      "themeDark",
      "themesDir",
      "base16-ocean.light",
      "base16-ocean.dark",
    ]) {
      expect(config).not.toContain(token);
    }
    // Nothing feature-specific should appear in a zero-feature scaffold.
    for (const token of [
      "docHistory",
      "llmsTxt",
      "claudeResources",
      "designTokenPanel",
      "tagGovernance",
      "footer:",
      "versions:",
      "findInPage",
    ]) {
      expect(config).not.toContain(token);
    }
  });

  it("scaffolds the GitHub header item when a usable GitHub URL is configured", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-github-header",
      githubUrl: "  https://github.com/x/y  ",
    });
    const config = await fs.readFile(
      projectPath("test-github-header", "zfb.config.ts"),
      "utf-8",
    );
    expect(config).toContain('githubUrl: "https://github.com/x/y"');
    expect(config).toContain('component: "github-link"');
  });

  it("emits findInPage: true when tauri is selected (#2690 — rides the tauri feature, package-owned island)", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tauri-config",
      features: ["tauri"],
    });
    const config = await fs.readFile(
      projectPath("test-tauri-config", "zfb.config.ts"),
      "utf-8",
    );
    expect(config).toContain("findInPage: true");
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
  it("always ignores node_modules, dist, .zfb, .zfb-build/, .env*, and .zudo-doc/ build artifacts", async () => {
    await scaffold(baseChoices);
    const gitignore = await fs.readFile(projectPath("test-doc", ".gitignore"), "utf-8");
    for (const line of [
      "node_modules",
      "dist",
      ".zfb",
      ".zfb-build/",
      ".env",
      ".wrangler/",
      ".zudo-doc/",
    ]) {
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

describe("scaffold — pnpm-workspace.yaml (#2923)", () => {
  it("disables pnpm 11's minimumReleaseAge gate", async () => {
    await scaffold(baseChoices);
    const workspaceYaml = await fs.readFile(
      projectPath("test-doc", "pnpm-workspace.yaml"),
      "utf-8",
    );
    expect(workspaceYaml).toContain("minimumReleaseAge: 0");
  });

  it("is emitted regardless of the chosen package manager (matches the .npmrc block's unconditional emission)", async () => {
    await scaffold({ ...baseChoices, projectName: "test-npm-pm", packageManager: "npm" });
    const workspaceYaml = await fs.readFile(
      projectPath("test-npm-pm", "pnpm-workspace.yaml"),
      "utf-8",
    );
    expect(workspaceYaml).toContain("minimumReleaseAge: 0");
  });

  it("is SKIPPED when scaffolding into an existing pnpm monorepo (never nest a workspace boundary, codex-review finding), and warns the user to disable the gate in the parent workspace", async () => {
    // tempDir (cwd, set up by the outer beforeEach) stands in for a parent
    // monorepo root — e.g. scaffolding into `apps/docs/` under a workspace
    // that already owns a pnpm-workspace.yaml.
    await fs.outputFile(
      path.join(tempDir, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await scaffold({ ...baseChoices, projectName: "test-nested-ws" });
    expect(
      await fs.pathExists(projectPath("test-nested-ws", "pnpm-workspace.yaml")),
    ).toBe(false);
    // Skipping silently would leave the scaffold blocked by the parent's
    // minimumReleaseAge default — instead the user is told to disable it there
    // (codex-review #2920 follow-up).
    const warned = warnSpy.mock.calls.some((c) =>
      String(c[0]).includes("minimumReleaseAge: 0"),
    );
    expect(warned).toBe(true);
    warnSpy.mockRestore();
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

describe("scaffold — every docHistory × i18n route stub threads chrome bindings", () => {
  it.each([
    { docHistory: false, i18n: false },
    { docHistory: true, i18n: false },
    { docHistory: false, i18n: true },
    { docHistory: true, i18n: true },
  ])(
    "emits the exact merged binding shape for docHistory=$docHistory, i18n=$i18n",
    async ({ docHistory, i18n }) => {
      const projectName =
        `test-bindings-dh-${docHistory ? "on" : "off"}` +
        `-i18n-${i18n ? "on" : "off"}`;
      const features: UserChoices["features"] = [
        ...(docHistory ? ["docHistory"] : []),
        ...(i18n ? ["i18n"] : []),
      ];
      await scaffold({ ...baseChoices, projectName, features });

      const stubPaths = [
        "pages/docs/[[...slug]].tsx",
        ...(i18n ? ["pages/[locale]/docs/[[...slug]].tsx"] : []),
      ];
      for (const stubPath of stubPaths) {
        const stub = await fs.readFile(
          projectPath(projectName, stubPath),
          "utf-8",
        );
        expect(stub).toContain(
          'import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";',
        );

        const docHistoryImport =
          'import { DocHistory } from "@takazudo/zudo-doc/doc-history";';
        if (docHistory) {
          // The real component stays statically reachable by zfb's island
          // scanner, while the spread preserves every configured host slot.
          expect(stub).toContain(docHistoryImport);
          expect(stub).toContain(
            'import { defineChromeBindings } from "@takazudo/zudo-doc/chrome-bindings";',
          );
          expect(stub).toContain(
            `const { renderDocPage } = createChrome(routeCtx, {
  ...chromeBindings,
  ...defineChromeBindings({ DocHistory }),
});`,
          );
          expect(stub).not.toContain("DocHistory as unknown as");
        } else {
          expect(stub).not.toContain(docHistoryImport);
          expect(stub).toContain(
            "const { renderDocPage } = createChrome(routeCtx, chromeBindings);",
          );
        }
      }

      expect(
        await fs.pathExists(
          projectPath(projectName, "pages/[locale]/docs/[[...slug]].tsx"),
        ),
      ).toBe(i18n);
    },
  );
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

    const pkg = await fs.readJson(projectPath("test-body-foot", "package.json"));
    expect(pkg.scripts["dev:zfb:network"]).toBe("zfb dev --host 0.0.0.0");
    expect(pkg.scripts["dev:network"]).toBe(
      "run-p dev:zfb:network dev:history",
    );
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
    expect(content).toContain("defineChromeBindings");
    expect(content).toContain("headerRightComponents");
    expect(content).toContain("do not fork a route stub");
    expect(content).toContain("**Shiki**");
    expect(content).not.toContain("syntect");
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

  it("describes the two-process dev command only when docHistory is enabled (#2926)", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-claudemd-doc-history",
      features: ["docHistory"],
    });
    const withDocHistory = await fs.readFile(
      projectPath("test-claudemd-doc-history", "CLAUDE.md"),
      "utf-8",
    );
    expect(withDocHistory).toContain("doc-history API server (port 4322)");
    expect(withDocHistory).toContain("run-p");
    expect(withDocHistory).toContain("pnpm dev:zfb");
    expect(withDocHistory).toContain("pnpm dev:history");
    expect(withDocHistory).toContain("pnpm dev:network");
    expect(withDocHistory).toContain("pnpm dev:zfb:network");
    expect(withDocHistory).toContain("pnpm run dev:zfb -- <flags>");

    await scaffold(baseChoices);
    const without = await fs.readFile(
      projectPath("test-doc", "CLAUDE.md"),
      "utf-8",
    );
    expect(without).not.toContain("doc-history API server");
    expect(without).not.toContain("run-p");
    expect(without).toContain("zfb dev server (port 4321)");
    expect(without).not.toContain("dev:network");
  });

  it("documents the built-in MDX components the seed content uses (CategoryNav) (#2703)", async () => {
    await scaffold(baseChoices);
    const content = await fs.readFile(
      projectPath("test-doc", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("### Built-in MDX components");
    expect(content).toContain("CategoryNav");
    expect(content).toContain("/docs/components/");
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

  it("emits engines.node >=22 to match zfb's Node floor (#2702)", async () => {
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.engines).toEqual({ node: ">=22" });
  });

  it("seeds the installation doc with the real Node floor (>=22), both locales (#2702)", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-node-floor",
      features: ["i18n"],
    });
    const en = await fs.readFile(
      projectPath(
        "test-node-floor",
        "src/content/docs/getting-started/installation.mdx",
      ),
      "utf-8",
    );
    expect(en).toContain("Node.js 22 or later");
    expect(en).not.toContain("Node.js 18");
    const ja = await fs.readFile(
      projectPath(
        "test-node-floor",
        "src/content/docs-ja/getting-started/installation.mdx",
      ),
      "utf-8",
    );
    expect(ja).toContain("Node.js 22 以降");
    expect(ja).not.toContain("Node.js 18");
  });

  it("does NOT include html-validate in devDependencies", async () => {
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.devDependencies["html-validate"]).toBeUndefined();
  });

  it("includes the coordinated zfb family, @takazudo/zudo-doc, and @takazudo/zdtp unconditionally", async () => {
    // diff and @takazudo/zdtp are unconditional dependencies regardless of
    // docHistory/designTokenPanel selection — see the #2660 completion
    // comment: packageOwnedRoutes always bundles the doc-history-area path
    // and the chrome-derive seam always imports DesignTokenPanelBootstrap.
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.dependencies["@takazudo/zfb"]).toBe("0.1.0-next.89");
    expect(pkg.dependencies["@takazudo/zfb-runtime"]).toBe("0.1.0-next.89");
    expect(pkg.dependencies["@takazudo/zfb-adapter-cloudflare"]).toBe(
      "0.1.0-next.89",
    );
    expect(pkg.dependencies["@takazudo/zfb-md-wasm"]).toBe("0.1.0-next.89");
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

  it("wires a two-process dev script + pinned npm-run-all2 when docHistory is enabled (#2926)", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-history-dev-script",
      features: ["docHistory"],
    });
    const pkg = await fs.readJson(
      projectPath("test-history-dev-script", "package.json"),
    );
    expect(pkg.scripts.dev).toBe("run-p dev:zfb dev:history");
    expect(pkg.scripts["dev:zfb"]).toBe("zfb dev");
    expect(pkg.scripts["dev:history"]).toBe(
      "doc-history-server --port 4322 --content-dir src/content/docs",
    );
    expect(pkg.scripts["dev:zfb:network"]).toBe("zfb dev --host 0.0.0.0");
    expect(pkg.scripts["dev:network"]).toBe(
      "run-p dev:zfb:network dev:history",
    );
    expect(pkg.devDependencies["npm-run-all2"]).toBe("^7.0.2");
  });

  it("does NOT add the docHistory dev scripts or npm-run-all2 when docHistory is disabled", async () => {
    await scaffold(baseChoices);
    const pkg = await fs.readJson(projectPath("test-doc", "package.json"));
    expect(pkg.scripts.dev).toBe("zfb dev");
    expect(pkg.scripts["dev:zfb"]).toBeUndefined();
    expect(pkg.scripts["dev:history"]).toBeUndefined();
    expect(pkg.scripts["dev:zfb:network"]).toBeUndefined();
    expect(pkg.scripts["dev:network"]).toBeUndefined();
    expect(pkg.devDependencies["npm-run-all2"]).toBeUndefined();
  });

  it("appends a derived --locale flag to dev:history when i18n is also enabled", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-history-dev-script-i18n",
      features: ["docHistory", "i18n"],
    });
    const pkg = await fs.readJson(
      projectPath("test-history-dev-script-i18n", "package.json"),
    );
    expect(pkg.scripts["dev:history"]).toBe(
      "doc-history-server --port 4322 --content-dir src/content/docs --locale ja:src/content/docs-ja",
    );
  });

  it("derives the --locale flag from the secondary lang for a ja-default project (secondary is en, never hardcoded ja)", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-history-dev-script-ja-default",
      defaultLang: "ja",
      features: ["docHistory", "i18n"],
    });
    const pkg = await fs.readJson(
      projectPath("test-history-dev-script-ja-default", "package.json"),
    );
    expect(pkg.scripts["dev:history"]).toBe(
      "doc-history-server --port 4322 --content-dir src/content/docs --locale en:src/content/docs-en",
    );
  });

  it("gives a bodyFootUtil-only project (which auto-enables docHistory) the docHistory dev scripts too", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-body-foot-dev-script",
      features: ["bodyFootUtil"],
    });
    const pkg = await fs.readJson(
      projectPath("test-body-foot-dev-script", "package.json"),
    );
    expect(pkg.scripts.dev).toBe("run-p dev:zfb dev:history");
    expect(pkg.scripts["dev:history"]).toBe(
      "doc-history-server --port 4322 --content-dir src/content/docs",
    );
    expect(pkg.scripts["dev:zfb:network"]).toBe("zfb dev --host 0.0.0.0");
    expect(pkg.scripts["dev:network"]).toBe(
      "run-p dev:zfb:network dev:history",
    );
    expect(pkg.devDependencies["npm-run-all2"]).toBe("^7.0.2");
  });

  it("adds package-owned tags:audit/tags:suggest scripts without project-side tooling deps", async () => {
    await scaffold({
      ...baseChoices,
      projectName: "test-tag-gov-deps",
      features: ["tagGovernance"],
    });
    const pkg = await fs.readJson(
      projectPath("test-tag-gov-deps", "package.json"),
    );
    expect(pkg.devDependencies["string-similarity"]).toBeUndefined();
    expect(pkg.devDependencies["pluralize"]).toBeUndefined();
    expect(pkg.devDependencies["tsx"]).toBeUndefined();
    expect(pkg.scripts["tags:audit"]).toBe(
      "tags-audit --config src/config/tag-vocabulary.ts",
    );
    expect(pkg.scripts["tags:suggest"]).toBe(
      "tags-suggest --config src/config/tag-vocabulary.ts",
    );
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
      chromeBindingsModule:
        "shell passthrough — host-callables module path is hand-authored after scaffold; generated doc routes consume it automatically",
      designTokenPanelConfigModule: "shell passthrough — mirrors chromeBindingsModule's contract exactly (module-path wiring, hand-authored after scaffold)",
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

  // codex-review follow-up (#2823) — the programmatic API lacked themePack
  // support/validation entirely; the CLI and preset paths already had it.
  it("createZudoDoc() throws for an unknown theme pack slug", async () => {
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        themePack: "not-a-real-pack",
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/Unknown theme pack "not-a-real-pack"/);
  });

  it("createZudoDoc() accepts a known theme pack slug and threads it into zfb.config.ts", async () => {
    const targetDir = await createZudoDoc({
      projectName: "valid-theme-pack-test",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      themePack: "foundry",
      features: [],
      packageManager: "pnpm",
    });
    const config = await fs.readFile(path.join(targetDir, "zfb.config.ts"), "utf-8");
    expect(config).toContain('themePack: "foundry"');
  });
});

describe("createZudoDoc() — CreateOptions preset parity (#2922)", () => {
  // UserChoices/PresetJson/zfb-config-gen.ts already supported
  // headerRightItems, metaTags, cjkFriendly, and minifyHtml end to end —
  // only the programmatic CreateOptions type was missing them. Shape
  // validation for headerRightItems/metaTags is shared with the preset
  // (JSON) path via preset.ts's validateHeaderRightItems()/
  // validateMetaTags(); the "same rule as validatePreset()" tests below
  // assert both callers reject the identical input with the identical
  // message, proving the shared helper (not a duplicated allowlist) is in
  // effect.

  it("createZudoDoc() throws for an unknown headerRightItems component, same rule as validatePreset()", async () => {
    const invalidItems = [
      { type: "component", component: "not-a-real-thing" },
    ] as unknown as PresetHeaderRightItem[];
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        headerRightItems: invalidItems,
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/unknown component "not-a-real-thing"/);
    expect(validatePreset({ headerRightItems: invalidItems })).toMatch(
      /unknown component "not-a-real-thing"/,
    );
  });

  it("createZudoDoc() throws for an unsupported headerRightItems type, same message as validatePreset()", async () => {
    const invalidItems = [
      { type: "link", href: "https://example.com", label: "Custom" },
    ] as unknown as PresetHeaderRightItem[];
    const expectedMessage =
      /type "link" is not supported in presets \(v1\) — edit zfb\.config\.ts after scaffold/;
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        headerRightItems: invalidItems,
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(expectedMessage);
    expect(validatePreset({ headerRightItems: invalidItems })).toMatch(expectedMessage);
  });

  it("createZudoDoc() accepts a valid headerRightItems array and threads it into zfb.config.ts", async () => {
    const targetDir = await createZudoDoc({
      projectName: "valid-header-items-test",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      headerRightItems: [
        { type: "component", component: "github-link" },
        { type: "trigger", trigger: "ai-chat" },
      ],
      features: [],
      packageManager: "pnpm",
    });
    const config = await fs.readFile(path.join(targetDir, "zfb.config.ts"), "utf-8");
    expect(config).toContain('component: "github-link"');
    expect(config).toContain('trigger: "ai-chat"');
  });

  it("createZudoDoc() throws for a non-object metaTags value, same rule as validatePreset()", async () => {
    const invalidMetaTags = "yes" as unknown as PresetMetaTagsConfig;
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        metaTags: invalidMetaTags,
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(/"metaTags" must be an object/);
    expect(validatePreset({ metaTags: invalidMetaTags })).toMatch(
      /"metaTags" must be an object/,
    );
  });

  it("createZudoDoc() throws for an invalid metaTags.twitterCard value, same rule as validatePreset()", async () => {
    const invalidMetaTags = { twitterCard: "player" } as unknown as PresetMetaTagsConfig;
    const expectedMessage =
      /"metaTags\.twitterCard" must be "summary", "summary_large_image", or false/;
    await expect(
      createZudoDoc({
        projectName: "valid-name",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        metaTags: invalidMetaTags,
        features: [],
        packageManager: "pnpm",
      }),
    ).rejects.toThrow(expectedMessage);
    expect(validatePreset({ metaTags: invalidMetaTags })).toMatch(expectedMessage);
  });

  it("createZudoDoc() accepts a valid metaTags object and threads it into zfb.config.ts", async () => {
    const targetDir = await createZudoDoc({
      projectName: "valid-meta-tags-test",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      metaTags: { ogImage: "/img/og.png" },
      features: [],
      packageManager: "pnpm",
    });
    const config = await fs.readFile(path.join(targetDir, "zfb.config.ts"), "utf-8");
    expect(config).toContain("metaTags: {");
    expect(config).toContain('ogImage: "/img/og.png"');
  });

  it("createZudoDoc() threads cjkFriendly: true into zfb.config.ts", async () => {
    const targetDir = await createZudoDoc({
      projectName: "valid-cjk-friendly-test",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      cjkFriendly: true,
      features: [],
      packageManager: "pnpm",
    });
    const config = await fs.readFile(path.join(targetDir, "zfb.config.ts"), "utf-8");
    expect(config).toContain("cjkFriendly: true");
  });

  it("createZudoDoc() threads minifyHtml: false into zfb.config.ts", async () => {
    const targetDir = await createZudoDoc({
      projectName: "valid-minify-html-test",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      minifyHtml: false,
      features: [],
      packageManager: "pnpm",
    });
    const config = await fs.readFile(path.join(targetDir, "zfb.config.ts"), "utf-8");
    expect(config).toContain("minifyHtml: false");
  });
});
