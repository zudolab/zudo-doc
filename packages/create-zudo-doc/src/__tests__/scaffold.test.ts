import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import type { UserChoices } from "../prompts.js";
import { scaffold } from "../scaffold.js";

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

/** Helper: check that a path exists inside the scaffolded project */
function projectPath(...segments: string[]): string {
  return path.join(tempDir, segments[0]!, ...segments.slice(1));
}

describe("scaffold — minimal (no i18n, search only, single dark scheme)", () => {
  const choices: UserChoices = {
    projectName: "test-minimal",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  beforeEach(async () => {
    await scaffold(choices);
  });

  it("creates package.json with correct name", async () => {
    const pkgPath = projectPath("test-minimal", "package.json");
    expect(await fs.pathExists(pkgPath)).toBe(true);
    const pkg = await fs.readJson(pkgPath);
    expect(pkg.name).toBe("test-minimal");
  });

  it("creates astro.config.ts", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "astro.config.ts")),
    ).toBe(true);
  });

  it("creates src/config/settings.ts", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/config/settings.ts"),
      ),
    ).toBe(true);
  });

  it("creates starter content", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-minimal",
          "src/content/docs/getting-started/index.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("does NOT create [locale] pages directory (i18n off)", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "src/pages/[locale]")),
    ).toBe(false);
  });

  it("does NOT create docs-ja content directory (i18n off)", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "src/content/docs-ja")),
    ).toBe(false);
  });

  it("does NOT include mock-init component (aiAssistant off by default)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/components/mock-init.tsx"),
      ),
    ).toBe(false);
  });

  it("does NOT include ai-chat-modal component (aiAssistant off by default)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/components/ai-chat-modal.tsx"),
      ),
    ).toBe(false);
  });

  it("does NOT include doc-history component (docHistory off by default)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/components/doc-history.tsx"),
      ),
    ).toBe(false);
  });

  it("doc-layout does not reference MockInit, AiChatModal, or DocHistory (disabled by default)", async () => {
    const layout = await fs.readFile(
      projectPath("test-minimal", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("MockInit");
    expect(layout).not.toContain("AiChatModal");
    expect(layout).not.toContain("DocHistory");
  });

  it("doc-layout does not reference sidebar resizer (disabled by default)", async () => {
    const layout = await fs.readFile(
      projectPath("test-minimal", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("initSidebarResizer");
    expect(layout).not.toContain("zudo-doc-sidebar-width");
  });

  it("does NOT include desktop-sidebar-toggle component (sidebarToggle off by default)", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/components/desktop-sidebar-toggle.tsx"),
      ),
    ).toBe(false);
  });

  it("doc-layout does not reference sidebar toggle (disabled by default)", async () => {
    const layout = await fs.readFile(
      projectPath("test-minimal", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("DesktopSidebarToggle");
    expect(layout).not.toContain("zudo-doc-sidebar-visible");
  });

  it(".gitignore includes standard Node + macOS + Cloudflare entries", async () => {
    const gitignore = await fs.readFile(
      projectPath("test-minimal", ".gitignore"),
      "utf-8",
    );
    // Build output (existing entries preserved)
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain("dist");
    expect(gitignore).toContain(".astro");
    // macOS
    expect(gitignore).toContain(".DS_Store");
    // Environment
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.local");
    expect(gitignore).toContain(".env.*.local");
    // Logs
    expect(gitignore).toContain("*.log");
    expect(gitignore).toContain("npm-debug.log*");
    expect(gitignore).toContain("yarn-debug.log*");
    expect(gitignore).toContain("pnpm-debug.log*");
    // Cloudflare Wrangler
    expect(gitignore).toContain(".wrangler/");
  });

  it(".gitignore does NOT include Tauri entries when tauri is disabled", async () => {
    const gitignore = await fs.readFile(
      projectPath("test-minimal", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).not.toContain("src-tauri/target");
    expect(gitignore).not.toContain("src-tauri/gen");
  });
});

describe("scaffold — full features (i18n, light-dark, all features)", () => {
  const choices: UserChoices = {
    projectName: "test-full",
    defaultLang: "en",
    colorSchemeMode: "light-dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
    defaultMode: "dark",
    features: [
      "i18n",
      "search",
      "sidebarFilter",
      "claudeResources",
      "designTokenPanel",
    ],
    packageManager: "pnpm",
  };

  beforeEach(async () => {
    await scaffold(choices);
  });

  it("creates [locale] pages directory (i18n on)", async () => {
    expect(
      await fs.pathExists(projectPath("test-full", "src/pages/[locale]")),
    ).toBe(true);
  });

  it("creates docs-ja starter content", async () => {
    expect(
      await fs.pathExists(
        projectPath(
          "test-full",
          "src/content/docs-ja/getting-started/index.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("includes Claude Resources integration", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/integrations/claude-resources"),
      ),
    ).toBe(true);
  });

  it("includes design token tweak panel component", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/components/design-token-tweak/index.tsx"),
      ),
    ).toBe(true);
  });
});

describe("scaffold — generated package.json dependencies", () => {
  const choices: UserChoices = {
    projectName: "test-deps",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  beforeEach(async () => {
    await scaffold(choices);
  });

  it("includes remark-directive in dependencies", async () => {
    const pkg = await fs.readJson(
      projectPath("test-deps", "package.json"),
    );
    expect(pkg.dependencies["remark-directive"]).toBeDefined();
  });

  it("includes pagefind in devDependencies when search is enabled", async () => {
    const pkg = await fs.readJson(
      projectPath("test-deps", "package.json"),
    );
    expect(pkg.devDependencies["pagefind"]).toBeDefined();
  });
});

describe("scaffold — generated settings.ts content", () => {
  it("single scheme: settings reflect chosen scheme", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-single",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Dracula",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-single", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('"Dracula"');
    expect(content).toContain("colorMode: false");
    expect(content).toContain('"Test Settings Single"');
  });

  it("light-dark scheme: settings reflect both schemes and mode config", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-ld",
      defaultLang: "en",
      colorSchemeMode: "light-dark",
      lightScheme: "GitHub Light",
      darkScheme: "GitHub Dark",
      respectPrefersColorScheme: true,
      defaultMode: "dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-ld", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('"GitHub Light"');
    expect(content).toContain('"GitHub Dark"');
    expect(content).toContain('defaultMode: "dark"');
    expect(content).toContain("respectPrefersColorScheme: true");
  });

  it("i18n enabled: settings include locales config", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-i18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["i18n", "search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-i18n", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("locales:");
    expect(content).toContain("ja:");
    expect(content).toContain("docs-ja");
  });

  it("cjkFriendly: defaults to false when not specified", async () => {
    const choices: UserChoices = {
      projectName: "test-cjk-default",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-cjk-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("cjkFriendly: false");
  });

  it("cjkFriendly: true flows through from preset into generated settings.ts", async () => {
    const choices: UserChoices = {
      projectName: "test-cjk-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      cjkFriendly: true,
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-cjk-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("cjkFriendly: true");
    expect(content).not.toContain("cjkFriendly: false");
  });

  it("cjkFriendly: false from preset emits false in generated settings.ts", async () => {
    const choices: UserChoices = {
      projectName: "test-cjk-off-explicit",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      cjkFriendly: false,
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-cjk-off-explicit", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("cjkFriendly: false");
  });

  it("tagPlacement: generated settings default to after-title", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-tag-placement",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-tag-placement", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('tagPlacement: "after-title"');
  });

  it("designTokenPanel: settings reflect panel enabled and keep the deprecated alias", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-tweak",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-tweak", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("designTokenPanel: true");
    // Back-compat alias should still be emitted for one release so existing
    // projects that reference `settings.colorTweakPanel` keep compiling.
    expect(content).toContain("colorTweakPanel: undefined");
  });
});

describe("scaffold — docHistory feature", () => {
  it("settings have docHistory: true when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-dh-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-dh-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: true");
  });

  it("keeps doc-history integration when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-dh-int",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-dh-int", "src/integrations/doc-history.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-dh-int", "src/components/doc-history.tsx"),
      ),
    ).toBe(true);
    const config = await fs.readFile(
      projectPath("test-dh-int", "astro.config.ts"),
      "utf-8",
    );
    expect(config).toContain("docHistoryIntegration");
  });

  it("settings have docHistory: false when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-dh-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-dh-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: false");
  });

  it("emits bodyFootUtilArea defaults and headerRightItems", async () => {
    const choices: UserChoices = {
      projectName: "test-header-footer-tweak",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory", "designTokenPanel", "bodyFootUtil"],
      githubUrl: "https://github.com/example/demo",
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-header-footer-tweak", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain(
      'githubUrl: "https://github.com/example/demo"',
    );
    expect(content).toContain("bodyFootUtilArea: {");
    expect(content).toContain("viewSourceLink: true");
    expect(content).toContain('trigger: "design-token-panel"');
    expect(content).toContain('component: "github-link"');
  });

  it("omits bodyFootUtilArea when bodyFootUtil feature is not selected", async () => {
    const choices: UserChoices = {
      projectName: "test-no-body-foot-util",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-no-body-foot-util", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("bodyFootUtilArea: false");
    expect(content).toContain("githubUrl: false");
  });

  it("auto-enables docHistory when bodyFootUtil is selected without it", async () => {
    const choices: UserChoices = {
      projectName: "test-body-foot-util-auto",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "bodyFootUtil"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-body-foot-util-auto", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("docHistory: true");
    expect(content).toContain("bodyFootUtilArea: {");
  });
});

describe("scaffold — llmsTxt feature", () => {
  it("settings have llmsTxt: true when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-llms-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "llmsTxt"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-llms-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("llmsTxt: true");
  });

  it("keeps llms-txt integration when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-llms-int",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "llmsTxt"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-llms-int", "src/integrations/llms-txt.ts"),
      ),
    ).toBe(true);
    const config = await fs.readFile(
      projectPath("test-llms-int", "astro.config.ts"),
      "utf-8",
    );
    expect(config).toContain("llmsTxtIntegration");
  });

  it("settings have llmsTxt: false when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-llms-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-llms-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("llmsTxt: false");
  });
});

describe("scaffold — footer features", () => {
  it("generates footer with links when footerNavGroup is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-nav",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "footerNavGroup"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-footer-nav", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("footer: {");
    expect(content).toContain('title: "Docs"');
    expect(content).toContain("Getting Started");
    expect(content).not.toContain("copyright:");
  });

  it("generates footer with copyright when footerCopyright is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-cr",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "footerCopyright"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-footer-cr", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("footer: {");
    expect(content).toContain("copyright:");
    expect(content).toContain("links: [],");
  });

  it("generates footer with both links and copyright", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-both",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "footerNavGroup", "footerCopyright"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-footer-both", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("footer: {");
    expect(content).toContain('title: "Docs"');
    expect(content).toContain("copyright:");
  });

  it("sets footer: false and strips component when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-footer-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("footer: false");
    expect(
      await fs.pathExists(
        projectPath("test-footer-off", "src/components/footer.astro"),
      ),
    ).toBe(false);
    const layout = await fs.readFile(
      projectPath("test-footer-off", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("Footer");
  });

  it("keeps footer component when footer is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-keep",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "footerNavGroup"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-footer-keep", "src/components/footer.astro"),
      ),
    ).toBe(true);
  });
});

describe("scaffold — changelog feature", () => {
  it("headerNav includes Changelog and creates starter content when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-changelog-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "changelog"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-changelog-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("Changelog");
    expect(content).toContain("/docs/changelog");
    expect(
      await fs.pathExists(
        projectPath(
          "test-changelog-on",
          "src/content/docs/changelog/index.mdx",
        ),
      ),
    ).toBe(true);
  });

  it("headerNav does NOT include Changelog when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-no-clog",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-no-clog", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).not.toContain("/docs/changelog");
  });
});

describe("scaffold — skillSymlinker feature", () => {
  it("copies setup-doc-skill.sh and adds npm script when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-symlinker-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "skillSymlinker"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-symlinker-on", "scripts/setup-doc-skill.sh"),
      ),
    ).toBe(true);
    const pkg = await fs.readJson(
      projectPath("test-symlinker-on", "package.json"),
    );
    expect(pkg.scripts["setup:doc-skill"]).toBe(
      "bash scripts/setup-doc-skill.sh",
    );
  });

  it("does NOT include setup-doc-skill.sh when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-symlinker-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-symlinker-off", "scripts/setup-doc-skill.sh"),
      ),
    ).toBe(false);
    const pkg = await fs.readJson(
      projectPath("test-symlinker-off", "package.json"),
    );
    expect(pkg.scripts["setup:doc-skill"]).toBeUndefined();
  });
});

describe("scaffold — claudeSkills feature", () => {
  it("ships user-facing zudo-doc-* skills when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-claude-skills-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "claudeSkills"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    // The three user-facing skill dirs are present
    for (const skill of [
      "zudo-doc-design-system",
      "zudo-doc-translate",
      "zudo-doc-version-bump",
    ]) {
      expect(
        await fs.pathExists(
          projectPath("test-claude-skills-on", `.claude/skills/${skill}/SKILL.md`),
        ),
      ).toBe(true);
    }
  });

  it("emits b4push stub script when enabled (sub #414)", async () => {
    const choices: UserChoices = {
      projectName: "test-claude-skills-b4push-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "claudeSkills"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-claude-skills-b4push-on", "package.json"),
    );
    expect(pkg.scripts.b4push).toBe("pnpm check && pnpm build");
  });

  it.each([
    ["npm", "npm run check && npm run build"],
    ["yarn", "yarn check && yarn build"],
    ["bun", "bun run check && bun run build"],
  ])(
    "emits b4push script using %s run when package manager is %s",
    async (pm, expected) => {
      const choices: UserChoices = {
        projectName: `test-b4push-${pm}`,
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search", "claudeSkills"],
        packageManager: pm as UserChoices["packageManager"],
      };
      await scaffold(choices);
      const pkg = await fs.readJson(
        projectPath(`test-b4push-${pm}`, "package.json"),
      );
      expect(pkg.scripts.b4push).toBe(expected);
    },
  );

  it("does NOT ship zudo-doc-* skills when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-claude-skills-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath(
          "test-claude-skills-off",
          ".claude/skills/zudo-doc-design-system",
        ),
      ),
    ).toBe(false);
  });

  it("does NOT emit b4push script when disabled (sub #414)", async () => {
    const choices: UserChoices = {
      projectName: "test-claude-skills-b4push-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-claude-skills-b4push-off", "package.json"),
    );
    expect(pkg.scripts.b4push).toBeUndefined();
  });
});

describe("scaffold — tauri feature", () => {
  it("generates src-tauri/ and find-in-page when tauri is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-tauri",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tauri"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    // src-tauri/ directory exists with key files
    expect(
      await fs.pathExists(projectPath("test-tauri", "src-tauri/Cargo.toml")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri", "src-tauri/src/main.rs")),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-tauri", "src-tauri/tauri.conf.json"),
      ),
    ).toBe(true);

    // Find-in-page components exist
    expect(
      await fs.pathExists(
        projectPath("test-tauri", "src/utils/find-in-page.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-tauri", "src/components/find-in-page-init.tsx"),
      ),
    ).toBe(true);

    // package.json has tauri scripts
    const pkg = await fs.readJson(
      projectPath("test-tauri", "package.json"),
    );
    expect(pkg.scripts["dev:tauri"]).toBe("cargo tauri dev");
    expect(pkg.scripts["build:tauri"]).toContain("cargo tauri build");

    // Cargo.toml has project name patched
    const cargo = await fs.readFile(
      projectPath("test-tauri", "src-tauri/Cargo.toml"),
      "utf-8",
    );
    expect(cargo).toContain('name = "test-tauri"');

    // tauri.conf.json has patched productName
    const conf = await fs.readFile(
      projectPath("test-tauri", "src-tauri/tauri.conf.json"),
      "utf-8",
    );
    expect(conf).not.toContain('"ZudoDoc"');

    // Layout has FindInPageInit
    const layout = await fs.readFile(
      projectPath("test-tauri", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).toContain("FindInPageInit");

    // .gitignore has tauri entries + standard entries
    const gitignore = await fs.readFile(
      projectPath("test-tauri", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain("src-tauri/target");
    expect(gitignore).toContain("src-tauri/gen");
    // Standard entries still present when tauri is on
    expect(gitignore).toContain(".DS_Store");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.local");
    expect(gitignore).toContain(".env.*.local");
    expect(gitignore).toContain("*.log");
    expect(gitignore).toContain("pnpm-debug.log*");
    expect(gitignore).toContain(".wrangler/");
  });

  it("does NOT generate src-tauri/ when tauri is disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-no-tauri",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    expect(
      await fs.pathExists(
        projectPath("test-no-tauri", "src-tauri/Cargo.toml"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-no-tauri", "src/utils/find-in-page.ts"),
      ),
    ).toBe(false);

    const pkg = await fs.readJson(
      projectPath("test-no-tauri", "package.json"),
    );
    expect(pkg.scripts["dev:tauri"]).toBeUndefined();
  });
});

describe("scaffold — plugin copying and settings", () => {
  const choices: UserChoices = {
    projectName: "test-minimal",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  beforeEach(async () => {
    await scaffold(choices);
  });

  it("copies plugin files to src/plugins/", async () => {
    const pluginFiles = [
      "remark-resolve-markdown-links.ts",
      "docs-source-map.ts",
      "remark-admonitions.ts",
      "url-utils.ts",
      "hast-utils.ts",
      "rehype-code-title.ts",
      "rehype-heading-links.ts",
      "rehype-mermaid.ts",
      "rehype-strip-md-extension.ts",
    ];
    for (const file of pluginFiles) {
      expect(
        await fs.pathExists(
          projectPath("test-minimal", "src/plugins", file),
        ),
        `expected src/plugins/${file} to exist`,
      ).toBe(true);
    }
  });

  it("does NOT copy __tests__/ directory to src/plugins/", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/plugins/__tests__"),
      ),
    ).toBe(false);
  });

  it("does NOT copy index.ts to src/plugins/", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-minimal", "src/plugins/index.ts"),
      ),
    ).toBe(false);
  });

  it("generated settings.ts contains onBrokenMarkdownLinks set to warn", async () => {
    const content = await fs.readFile(
      projectPath("test-minimal", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("onBrokenMarkdownLinks");
    expect(content).toContain('"warn"');
  });

  it("includes github-slugger in dependencies", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.dependencies["github-slugger"]).toBeDefined();
  });

  it("includes @types/hast in devDependencies", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.devDependencies["@types/hast"]).toBeDefined();
  });

  it("includes @types/mdast in devDependencies", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.devDependencies["@types/mdast"]).toBeDefined();
  });
});

describe("scaffold — CLAUDE.md generation", () => {
  it("creates CLAUDE.md with project name and tech stack", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarFilter"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("# Test Claudemd");
    expect(content).toContain("zudo-doc");
    expect(content).toContain("**Astro**");
    expect(content).toContain("pnpm dev");
    expect(content).toContain("pnpm build");
    expect(content).toContain("docs/            # MDX content");
  });

  it("includes i18n section when i18n is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd-i18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["i18n", "search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd-i18n", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("## i18n");
    expect(content).toContain("docs-ja");
  });

  it("does NOT include i18n section when i18n is disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd-noi18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd-noi18n", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).not.toContain("## i18n");
  });

  it("lists enabled features", async () => {
    const choices: UserChoices = {
      projectName: "test-claudemd-features",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory", "llmsTxt"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
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
    const choices: UserChoices = {
      projectName: "test-claudemd-npm",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "npm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-claudemd-npm", "CLAUDE.md"),
      "utf-8",
    );
    expect(content).toContain("npm run dev");
    expect(content).toContain("npm run build");
    expect(content).not.toContain("pnpm");
  });
});

describe("scaffold — frontmatterPreview setting", () => {
  it("generated settings.ts contains frontmatterPreview: false by default", async () => {
    const choices: UserChoices = {
      projectName: "test-fp-default",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-fp-default", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("frontmatterPreview:");
    expect(content).toContain("FrontmatterPreviewConfig | false");
  });

  it("frontmatter-preview.astro component exists in base template", async () => {
    const choices: UserChoices = {
      projectName: "test-fp-component",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath(
          "test-fp-component",
          "src/components/frontmatter-preview.astro",
        ),
      ),
    ).toBe(true);
  });

  it("frontmatter-preview-defaults.ts exists in base template", async () => {
    const choices: UserChoices = {
      projectName: "test-fp-defaults",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath(
          "test-fp-defaults",
          "src/config/frontmatter-preview-defaults.ts",
        ),
      ),
    ).toBe(true);
  });
});

describe("scaffold — imageEnlarge feature", () => {
  it("settings have imageEnlarge: true when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "imageEnlarge"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-ie-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("imageEnlarge: true");
  });

  it("settings have imageEnlarge: false when feature not selected", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-ie-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("imageEnlarge: false");
  });

  it("island file src/components/image-enlarge.tsx exists when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-island-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "imageEnlarge"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-ie-island-on", "src/components/image-enlarge.tsx"),
      ),
    ).toBe(true);
  });

  it("island file src/components/image-enlarge.tsx absent when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-island-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-ie-island-off", "src/components/image-enlarge.tsx"),
      ),
    ).toBe(false);
  });

  it("rehype-image-enlarge.ts always present in src/plugins/ (base template file)", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-plugin",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    expect(
      await fs.pathExists(
        projectPath("test-ie-plugin", "src/plugins/rehype-image-enlarge.ts"),
      ),
    ).toBe(true);
  });

  it("astro.config.ts wires rehypeImageEnlarge when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-astro-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "imageEnlarge"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const config = await fs.readFile(
      projectPath("test-ie-astro-on", "astro.config.ts"),
      "utf-8",
    );
    expect(config).toContain("rehypeImageEnlarge");
    expect(config).toContain("settings.imageEnlarge");
  });

  it("astro.config.ts does not wire rehypeImageEnlarge when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-astro-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const config = await fs.readFile(
      projectPath("test-ie-astro-off", "astro.config.ts"),
      "utf-8",
    );
    expect(config).not.toContain("rehypeImageEnlarge");
  });

  it("doc-layout references ImageEnlarge when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-layout-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "imageEnlarge"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const layout = await fs.readFile(
      projectPath("test-ie-layout-on", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).toContain("ImageEnlarge");
  });

  it("doc-layout does not reference ImageEnlarge when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-layout-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const layout = await fs.readFile(
      projectPath("test-ie-layout-off", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("ImageEnlarge");
  });
});

describe("scaffold — tagGovernance feature", () => {
  it("settings emit warn + tagVocabulary=true when enabled, and scripts+devDeps are added", async () => {
    const choices: UserChoices = {
      projectName: "test-tag-gov-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tagGovernance"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const settings = await fs.readFile(
      projectPath("test-tag-gov-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain('tagGovernance: "warn"');
    expect(settings).toContain("tagVocabulary: true");

    // Scripts shipped by the feature
    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-on", "scripts/tags-audit.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-on", "scripts/tags-suggest.ts"),
      ),
    ).toBe(true);

    // package.json has scripts + devDeps
    const pkg = await fs.readJson(
      projectPath("test-tag-gov-on", "package.json"),
    );
    expect(pkg.scripts["tags:audit"]).toBe("tsx scripts/tags-audit.ts");
    expect(pkg.scripts["tags:suggest"]).toBe("tsx scripts/tags-suggest.ts");
    for (const dep of [
      "string-similarity",
      "pluralize",
      "picocolors",
      "@inquirer/prompts",
      "tsx",
    ]) {
      expect(pkg.devDependencies[dep], `expected devDep ${dep}`).toBeDefined();
    }
    // gray-matter ships unconditionally as a runtime dep
    expect(pkg.dependencies["gray-matter"]).toBeDefined();
  });

  it("settings emit off + tagVocabulary=false when disabled, no scripts emitted", async () => {
    const choices: UserChoices = {
      projectName: "test-tag-gov-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const settings = await fs.readFile(
      projectPath("test-tag-gov-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain('tagGovernance: "off"');
    expect(settings).toContain("tagVocabulary: false");

    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-off", "scripts/tags-audit.ts"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-tag-gov-off", "scripts/tags-suggest.ts"),
      ),
    ).toBe(false);

    const pkg = await fs.readJson(
      projectPath("test-tag-gov-off", "package.json"),
    );
    expect(pkg.scripts["tags:audit"]).toBeUndefined();
    expect(pkg.scripts["tags:suggest"]).toBeUndefined();
    expect(pkg.devDependencies["string-similarity"]).toBeUndefined();
    expect(pkg.devDependencies["pluralize"]).toBeUndefined();
    expect(pkg.devDependencies["@inquirer/prompts"]).toBeUndefined();
  });
});

describe("scaffold — footerTaglist feature", () => {
  it("emits taglist block inside footer when enabled (with tagGovernance)", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-taglist-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tagGovernance", "footerTaglist"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const settings = await fs.readFile(
      projectPath("test-footer-taglist-on", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain("footer: {");
    expect(settings).toContain("taglist: {");
    expect(settings).toContain("enabled: true");
    expect(settings).toContain('groupBy: "group"');

    // Footer component is installed because footerTaglist activates the pseudo-feature.
    expect(
      await fs.pathExists(
        projectPath(
          "test-footer-taglist-on",
          "src/components/footer.astro",
        ),
      ),
    ).toBe(true);
  });

  it("does NOT emit taglist block when disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-footer-taglist-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tagGovernance"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const settings = await fs.readFile(
      projectPath("test-footer-taglist-off", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).not.toContain("taglist: {");
  });
});

describe("scaffold — vanilla output (both tag flags off)", () => {
  it("produces footer: false and tagGovernance: off", async () => {
    const choices: UserChoices = {
      projectName: "test-vanilla-tags",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const settings = await fs.readFile(
      projectPath("test-vanilla-tags", "src/config/settings.ts"),
      "utf-8",
    );
    expect(settings).toContain('tagGovernance: "off"');
    expect(settings).toContain("tagVocabulary: false");
    expect(settings).toContain("footer: false");
    expect(settings).not.toContain("taglist: {");
  });
});

describe("scaffold — always emits framework-required settings fields (sub #408)", () => {
  /**
   * Regression guard for sub-issue #408. These five fields are read by
   * framework components and must always be declared in the generated
   * settings.ts — otherwise `pnpm check` on a fresh scaffold fails with
   * ts(2339) "Property X does not exist" errors.
   *
   * The test exercises several preset shapes (barebone, feature-heavy,
   * i18n + light-dark, github URL) to confirm the fields are emitted for
   * every code path, not only the default one.
   */
  const REQUIRED_FIELDS = [
    "githubUrl",
    "tagPlacement",
    "frontmatterPreview",
    "tagVocabulary",
    "tagGovernance",
  ] as const;

  const presets: ReadonlyArray<{ name: string; choices: UserChoices }> = [
    {
      name: "barebone (no features, single scheme)",
      choices: {
        projectName: "test-req-barebone",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: [],
        packageManager: "pnpm",
      },
    },
    {
      name: "search only (common minimal preset)",
      choices: {
        projectName: "test-req-search",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search"],
        packageManager: "pnpm",
      },
    },
    {
      name: "tag-governance enabled",
      choices: {
        projectName: "test-req-tag-gov",
        defaultLang: "en",
        colorSchemeMode: "single",
        singleScheme: "Default Dark",
        features: ["search", "tagGovernance"],
        packageManager: "pnpm",
      },
    },
    {
      name: "feature-heavy (i18n + light-dark + many features)",
      choices: {
        projectName: "test-req-heavy",
        defaultLang: "en",
        colorSchemeMode: "light-dark",
        lightScheme: "Default Light",
        darkScheme: "Default Dark",
        respectPrefersColorScheme: true,
        defaultMode: "dark",
        features: [
          "i18n",
          "search",
          "designTokenPanel",
          "docHistory",
          "tagGovernance",
          "footerTaglist",
          "bodyFootUtil",
        ],
        githubUrl: "https://github.com/example/demo",
        packageManager: "pnpm",
      },
    },
  ];

  for (const preset of presets) {
    it(`declares all 5 framework-required fields: ${preset.name}`, async () => {
      await scaffold(preset.choices);
      const content = await fs.readFile(
        projectPath(preset.choices.projectName, "src/config/settings.ts"),
        "utf-8",
      );
      const missing = REQUIRED_FIELDS.filter(
        (field) => !new RegExp(`^\\s{2}${field}\\s*:`, "m").test(content),
      );
      expect(
        missing,
        `Generated settings.ts for "${preset.choices.projectName}" is missing ` +
          `required fields: ${missing.join(", ")}. These fields are read by ` +
          `framework components and must always be declared.`,
      ).toEqual([]);
    });
  }

  it("explicitly types each required field so framework consumers compile", async () => {
    // Guard against accidental narrowing (e.g., emitting `tagPlacement: "after-title"`
    // as a string literal rather than `as TagPlacement`), which would prevent
    // downstream projects from setting alternate values without a type assertion.
    const choices: UserChoices = {
      projectName: "test-req-typing",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-req-typing", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toMatch(/githubUrl:\s*(?:"[^"]*"|false)\s+as\s+string\s*\|\s*false,/);
    expect(content).toMatch(/tagPlacement:\s*"[^"]+"\s+as\s+TagPlacement,/);
    expect(content).toMatch(
      /frontmatterPreview:[\s\S]*?as\s+FrontmatterPreviewConfig\s*\|\s*false,/,
    );
    expect(content).toMatch(/tagVocabulary:\s*(?:true|false)\s+as\s+boolean,/);
    expect(content).toMatch(/tagGovernance:\s*"[^"]+"\s+as\s+TagGovernanceMode,/);
  });
});

describe("drift detection — generator vs main project settings", () => {
  /**
   * This test catches feature drift between the main project's settings.ts
   * and what the generator produces. If a new setting is added to the main
   * project but not to settings-gen.ts, this test will fail.
   */
  it("generated settings.ts has all fields from the main settings.ts", async () => {
    // Read the main project's settings.ts to extract field names
    const mainSettingsPath = path.resolve(
      __dirname,
      "../../../../src/config/settings.ts",
    );
    const mainSettings = await fs.readFile(mainSettingsPath, "utf-8");

    // Extract top-level field names from `export const settings = { ... }`
    const settingsBlock = mainSettings.slice(
      mainSettings.indexOf("export const settings = {"),
    );
    // Match field names at 2-space indent (top-level settings object keys)
    const fieldPattern = /^ {2}(\w+)\s*:/gm;
    const mainFields: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = fieldPattern.exec(settingsBlock)) !== null) {
      mainFields.push(match[1]!);
    }

    expect(mainFields.length).toBeGreaterThan(10); // Sanity check

    // Scaffold a minimal project and read generated settings
    const choices: UserChoices = {
      projectName: "test-drift",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarFilter"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const generated = await fs.readFile(
      projectPath("test-drift", "src/config/settings.ts"),
      "utf-8",
    );

    // Check that every field in the main settings exists in the generated output
    const missingFields = mainFields.filter(
      (field) => !generated.includes(`${field}:`),
    );
    expect(
      missingFields,
      `Generator is missing settings fields: ${missingFields.join(", ")}. ` +
        `Update packages/create-zudo-doc/src/settings-gen.ts or run /l-update-generator`,
    ).toEqual([]);
  });
});

describe("scaffold — framework TS error fixes (sub #410)", () => {
  /**
   * Regression guards for sub-issue #410. Before this fix, a fresh scaffold's
   * pnpm check emitted four framework-level TS errors:
   *   1. frontmatter-preview.astro line ~76: `unknown` not assignable to `{}`
   *      when piping the iterated `value` into a `<Renderer>` JSX slot whose
   *      props are typed `NonNullable<unknown>`.
   *   2. frontmatter-preview.astro: `cfg === false` no-overlap (mitigated in
   *      sub #408 by typing `frontmatterPreview` as
   *      `FrontmatterPreviewConfig | false`).
   *   3. mermaid-init.astro: `Cannot find module 'mermaid'` — strategy (a):
   *      mermaid stays an unconditional dependency in every scaffolded
   *      package.json.
   *   4. header.astro (i18n feature): LanguageSwitcher rejects a `locales`
   *      prop it does not declare. Strategy: drop the dead prop at the call
   *      site (and stop importing `locales`).
   *
   * These tests assert the emitted scaffold no longer contains the
   * problematic patterns, so a future generator change cannot silently
   * reintroduce them without flagging.
   */
  it("frontmatter-preview.astro casts value to NonNullable<unknown> before JSX slot", async () => {
    const choices: UserChoices = {
      projectName: "test-410-fp",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-410-fp", "src/components/frontmatter-preview.astro"),
      "utf-8",
    );
    // The Renderer slot must receive a narrowed value, not the raw `unknown`
    // that Object.entries returns. Without the cast astro check ts(2322) errors.
    expect(content).toMatch(/value=\{value as NonNullable<unknown>\}/);
    expect(content).not.toMatch(/<Renderer\s+value=\{value\}/);
  });

  it("mermaid stays an unconditional dependency in scaffolded package.json (strategy a)", async () => {
    const choices: UserChoices = {
      projectName: "test-410-mermaid",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-410-mermaid", "package.json"),
    );
    expect(
      pkg.dependencies?.mermaid,
      "mermaid must stay an unconditional runtime dependency so the dynamic " +
        "import in src/components/mermaid-init.astro resolves at type-check time",
    ).toBeTruthy();
  });

  it("i18n header injection no longer passes the dead `locales` prop to LanguageSwitcher", async () => {
    const choices: UserChoices = {
      projectName: "test-410-i18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["i18n"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const header = await fs.readFile(
      projectPath("test-410-i18n", "src/components/header.astro"),
      "utf-8",
    );
    // LanguageSwitcher's Props interface only declares `lang`. Passing
    // `locales` triggers ts(2322): "{ ... } is not assignable to IntrinsicAttributes & Props".
    expect(header).toMatch(/<LanguageSwitcher lang=\{lang\} \/>/);
    expect(header).not.toMatch(/locales=\{locales\}/);
    // The accompanying `import { locales } from "@/config/i18n"` must also go,
    // otherwise tsc flags it as ts(6133) "declared but never used".
    expect(header).not.toMatch(
      /import \{ locales \} from "@\/config\/i18n";/,
    );
  });
});

describe("scaffold — blog feature", () => {
  describe("with blog ON, i18n OFF", () => {
    const choices: UserChoices = {
      projectName: "test-blog-no-i18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "blog"],
      packageManager: "pnpm",
    };

    beforeEach(async () => {
      await scaffold(choices);
    });

    it("creates the EN blog route pages", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/pages/blog/index.astro"),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/pages/blog/[...slug].astro"),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/pages/blog/archives.astro"),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-no-i18n",
            "src/pages/blog/page/[page].astro",
          ),
        ),
      ).toBe(true);
    });

    it("creates the blog listing components", async () => {
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-no-i18n",
            "src/components/blog-post-card.astro",
          ),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-no-i18n",
            "src/components/blog-pagination.astro",
          ),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-no-i18n",
            "src/components/blog-post-meta.astro",
          ),
        ),
      ).toBe(true);
    });

    it("creates the blog utilities, types, and inlined remark-excerpt plugin", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/utils/blog.ts"),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/utils/blog-listing.ts"),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/types/blog-entry.ts"),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/plugins/remark-excerpt.ts"),
        ),
      ).toBe(true);
    });

    it("creates the EN starter blog post (single sample)", async () => {
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-no-i18n",
            "src/content/blog/hello-world.md",
          ),
        ),
      ).toBe(true);
    });

    it("emits the blog setting block in settings.ts", async () => {
      const settings = await fs.readFile(
        projectPath("test-blog-no-i18n", "src/config/settings.ts"),
        "utf-8",
      );
      expect(settings).toMatch(/blog:\s*\{/);
      expect(settings).toMatch(/enabled:\s*true/);
    });

    it("adds the runtime deps required by remark-excerpt to package.json", async () => {
      const pkg = await fs.readJson(
        projectPath("test-blog-no-i18n", "package.json"),
      );
      expect(pkg.dependencies).toHaveProperty("mdast-util-to-hast");
      expect(pkg.dependencies).toHaveProperty("hast-util-to-html");
      expect(pkg.dependencies).toHaveProperty("mdast-util-from-markdown");
    });

    it("emits the blog content collection in content.config.ts", async () => {
      const config = await fs.readFile(
        projectPath("test-blog-no-i18n", "src/content.config.ts"),
        "utf-8",
      );
      expect(config).toMatch(/blogSchema/);
      expect(config).toMatch(/const blog = defineCollection/);
      expect(config).toMatch(/collections\s*=\s*\{[^}]*\bblog\b/);
    });

    it("does NOT create [locale] blog routes when i18n is off", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/pages/[locale]/blog"),
        ),
      ).toBe(false);
    });

    it("does NOT create blog-{lang} secondary content when i18n is off", async () => {
      // secondaryLang for defaultLang=en would be "ja"
      expect(
        await fs.pathExists(
          projectPath("test-blog-no-i18n", "src/content/blog-ja"),
        ),
      ).toBe(false);
    });
  });

  describe("with blog ON, i18n ON", () => {
    const choices: UserChoices = {
      projectName: "test-blog-i18n",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "blog", "i18n"],
      packageManager: "pnpm",
    };

    beforeEach(async () => {
      await scaffold(choices);
    });

    it("creates BOTH the EN and locale-aware blog index routes", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-blog-i18n", "src/pages/blog/index.astro"),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-i18n",
            "src/pages/[locale]/blog/index.astro",
          ),
        ),
      ).toBe(true);
    });

    it("creates the locale-aware blog detail / archives / paginated routes", async () => {
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-i18n",
            "src/pages/[locale]/blog/[...slug].astro",
          ),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-i18n",
            "src/pages/[locale]/blog/archives.astro",
          ),
        ),
      ).toBe(true);
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-i18n",
            "src/pages/[locale]/blog/page/[page].astro",
          ),
        ),
      ).toBe(true);
    });

    it("creates the JA secondary-locale starter post (defaultLang=en → blog-ja/)", async () => {
      expect(
        await fs.pathExists(
          projectPath(
            "test-blog-i18n",
            "src/content/blog-ja/hello-world.md",
          ),
        ),
      ).toBe(true);
    });

    it("emits a blog-{code} locale collection in content.config.ts", async () => {
      const config = await fs.readFile(
        projectPath("test-blog-i18n", "src/content.config.ts"),
        "utf-8",
      );
      expect(config).toMatch(/blogLocaleCollections/);
      expect(config).toMatch(/blog-\$\{code\}/);
    });
  });

  describe("without blog feature", () => {
    const choices: UserChoices = {
      projectName: "test-no-blog",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };

    beforeEach(async () => {
      await scaffold(choices);
    });

    it("does NOT create src/pages/blog when blog is disabled", async () => {
      expect(
        await fs.pathExists(projectPath("test-no-blog", "src/pages/blog")),
      ).toBe(false);
    });

    it("does NOT emit a blog: { … } block in settings.ts", async () => {
      const settings = await fs.readFile(
        projectPath("test-no-blog", "src/config/settings.ts"),
        "utf-8",
      );
      // The generator emits `blog: false as BlogConfig | false` when the
      // blog feature is OFF, so the literal "blog: {" header must not appear.
      expect(settings).not.toMatch(/blog:\s*\{/);
    });
  });
});
