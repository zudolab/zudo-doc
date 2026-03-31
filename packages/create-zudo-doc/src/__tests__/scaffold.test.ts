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

  it("does NOT create Japanese pages directory (i18n off)", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "src/pages/ja")),
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
      "colorTweakPanel",
    ],
    packageManager: "pnpm",
  };

  beforeEach(async () => {
    await scaffold(choices);
  });

  it("creates Japanese pages directory (i18n on)", async () => {
    expect(
      await fs.pathExists(projectPath("test-full", "src/pages/ja")),
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

  it("includes color tweak panel component", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/components/color-tweak-panel.tsx"),
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

  it("colorTweakPanel: settings reflect panel enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-settings-tweak",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "colorTweakPanel"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-settings-tweak", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain("colorTweakPanel: true");
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
        `Update packages/create-zudo-doc/src/settings-gen.ts or run /l-sync-create-zudo-doc`,
    ).toEqual([]);
  });
});
