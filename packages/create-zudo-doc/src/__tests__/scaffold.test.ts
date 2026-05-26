import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
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

  it("creates zfb.config.ts (not astro.config.ts)", async () => {
    expect(
      await fs.pathExists(projectPath("test-minimal", "zfb.config.ts")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-minimal", "astro.config.ts")),
    ).toBe(false);
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

  // W6A (#1734): ai-chat-modal stays always-on with a no-op stub in base so
  // the mirrored pages/lib/_body-end-islands import closure resolves in every
  // scaffold variant. The stub returns null; a future feature flag can swap
  // it out. Spec-lock §1.5.
  it("ships ai-chat-modal as a no-op stub (W6A — base template)", async () => {
    const stubPath = projectPath(
      "test-minimal",
      "src/components/ai-chat-modal.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
  });

  // W6A (#1734): doc-history component stays always-on with a no-op stub in
  // base. The docHistory feature template overwrites the stub with the real
  // island when enabled. Spec-lock Decision 5.
  it("ships doc-history as a no-op stub when docHistory feature is off (W6A)", async () => {
    const stubPath = projectPath(
      "test-minimal",
      "src/components/doc-history.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
    expect(content).toContain("DocHistory");
  });

  // Depends on: topic-template-files (JSX layout from E5) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("doc-layout does not reference MockInit, AiChatModal, or DocHistory (disabled by default)", async () => {
    const layout = await fs.readFile(
      projectPath("test-minimal", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("MockInit");
    expect(layout).not.toContain("AiChatModal");
    expect(layout).not.toContain("DocHistory");
  });

  // Depends on: topic-template-files (JSX layout from E5) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("doc-layout does not reference sidebar resizer (disabled by default)", async () => {
    const layout = await fs.readFile(
      projectPath("test-minimal", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("initSidebarResizer");
    expect(layout).not.toContain("zudo-doc-sidebar-width");
  });

  // W6A (#1734): desktop-sidebar-toggle stays always-on with a no-op stub in
  // base. The sidebarToggle feature template overwrites the stub with the real
  // island when enabled. Spec-lock Decision 5.
  it("ships desktop-sidebar-toggle as a no-op stub when sidebarToggle feature is off (W6A)", async () => {
    const stubPath = projectPath(
      "test-minimal",
      "src/components/desktop-sidebar-toggle.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
  });

  // Depends on: topic-template-files (JSX layout from E5) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("doc-layout does not reference sidebar toggle (disabled by default)", async () => {
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
    expect(gitignore).toContain(".zfb");
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

describe("scaffold — sidebarToggle feature", () => {
  // W4A (#1732): @zudo-doc/zudo-doc-v2 is now a runtime dep of every scaffold
  // (published via .github/workflows/publish-zudo-doc-v2.yml), so the
  // desktop-sidebar-toggle component imports BEFORE_NAVIGATE_EVENT /
  // AFTER_NAVIGATE_EVENT from @zudo-doc/zudo-doc-v2/transitions directly
  // instead of inlining them as string literals. The two tests below were
  // previously asserting the inverse (v2 absent), which encoded the
  // "v2 is workspace-private/unpublished" constraint that W4A removes.
  it("desktop-sidebar-toggle.tsx imports lifecycle events from @zudo-doc/zudo-doc-v2/transitions", async () => {
    const choices: UserChoices = {
      projectName: "test-sidebar-toggle-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarToggle"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath(
        "test-sidebar-toggle-on",
        "src/components/desktop-sidebar-toggle.tsx",
      ),
      "utf-8",
    );
    expect(content).toMatch(
      /from\s+['"]@zudo-doc\/zudo-doc-v2\/transitions['"]/,
    );
    expect(content).toContain("BEFORE_NAVIGATE_EVENT");
    expect(content).toContain("AFTER_NAVIGATE_EVENT");
  });

  it("generated package.json pins @zudo-doc/zudo-doc-v2 (W4A — runtime dep)", async () => {
    const choices: UserChoices = {
      projectName: "test-sidebar-toggle-deps",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarToggle"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-sidebar-toggle-deps", "package.json"),
    );
    expect(pkg.dependencies["@zudo-doc/zudo-doc-v2"]).toBeDefined();
    expect(pkg.dependencies["@zudo-doc/zudo-doc-v2"]).toMatch(/^\^?0\.1\./);
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

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("creates [locale] pages directory (i18n on)", async () => {
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

  it("includes zdtp bootstrap and config when designTokenPanel is enabled", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/lib/design-token-panel-bootstrap.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/config/design-token-panel-config.ts"),
      ),
    ).toBe(true);
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/config/design-tokens-manifest.ts"),
      ),
    ).toBe(true);
    // W3B (#1730): design-token-types.ts moved into @zudo-doc/zudo-doc-v2/theme,
    // no longer scaffolded into the generated project. Verify the legacy
    // path is absent so a regression that resurrects the duplicate trips.
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/utils/design-token-types.ts"),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/utils/design-token-serde.ts"),
      ),
    ).toBe(false);
  });

  it("does NOT include legacy design-token-tweak panel component", async () => {
    expect(
      await fs.pathExists(
        projectPath("test-full", "src/components/design-token-tweak"),
      ),
    ).toBe(false);
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

  it("does NOT include @takazudo/zdtp when designTokenPanel is disabled", async () => {
    const pkg = await fs.readJson(
      projectPath("test-deps", "package.json"),
    );
    expect(pkg.dependencies["@takazudo/zdtp"]).toBeUndefined();
  });
});

describe("scaffold — designTokenPanel package.json wiring", () => {
  it("includes @takazudo/zdtp dep at the pinned npm version when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-zdtp-deps",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-zdtp-deps", "package.json"),
    );
    expect(pkg.dependencies["@takazudo/zdtp"]).toBe("0.1.0-next.1");
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

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("keeps doc-history integration when enabled", async () => {
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
    // Depends on: topic-config-generators (zfb-config-gen.ts)
    const config = await fs.readFile(
      projectPath("test-dh-int", "zfb.config.ts"),
      "utf-8",
    );
    expect(config).toContain("docHistoryPlugin");
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

describe("scaffold — headerRightItems preset override (sub #440)", () => {
  it("emits user-supplied headerRightItems verbatim and in chosen order", async () => {
    const choices: UserChoices = {
      projectName: "test-hri-override",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
      headerRightItems: [
        { type: "component", component: "theme-toggle" },
        { type: "trigger", trigger: "design-token-panel" },
        { type: "component", component: "github-link" },
        { type: "trigger", trigger: "ai-chat" },
        { type: "component", component: "search" },
      ],
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-override", "src/config/settings.ts"),
      "utf-8",
    );
    // Extract the headerRightItems block to assert exact order.
    const blockMatch = content.match(
      /headerRightItems:\s*\[([\s\S]*?)\]\s*as\s+HeaderRightItem\[\],/,
    );
    expect(blockMatch).not.toBeNull();
    const block = blockMatch![1]!;
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toEqual([
      `{ type: "component", component: "theme-toggle" },`,
      `{ type: "trigger", trigger: "design-token-panel" },`,
      `{ type: "component", component: "github-link" },`,
      `{ type: "trigger", trigger: "ai-chat" },`,
      `{ type: "component", component: "search" },`,
    ]);
  });

  it("falls back to hardcoded default when headerRightItems is omitted", async () => {
    const choices: UserChoices = {
      projectName: "test-hri-fallback",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-fallback", "src/config/settings.ts"),
      "utf-8",
    );
    // The legacy hardcoded fallback gates designTokenPanel on the feature.
    expect(content).toContain('trigger: "design-token-panel"');
    expect(content).toContain('component: "github-link"');
    expect(content).toContain('component: "theme-toggle"');
    // ai-chat is not in the legacy fallback path.
    expect(content).not.toContain('trigger: "ai-chat"');
  });

  it("honors an explicit empty headerRightItems array (no items)", async () => {
    // Empty array means "user wants no header-right items at all" — must not
    // silently fall back to the hardcoded default. validatePreset accepts [],
    // and presetToChoices forwards it; settings-gen must honor it too.
    const choices: UserChoices = {
      projectName: "test-hri-empty",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "designTokenPanel"],
      packageManager: "pnpm",
      headerRightItems: [],
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-empty", "src/config/settings.ts"),
      "utf-8",
    );
    const match = content.match(
      /headerRightItems:\s*\[([\s\S]*?)\]\s*as\s+HeaderRightItem\[\],/,
    );
    expect(match).toBeTruthy();
    // Block should be empty (whitespace only) — no fallback entries leaked in.
    expect(match![1].trim()).toBe("");
    // Specifically, the legacy fallback's design-token-panel trigger must not
    // appear even though designTokenPanel is in the features list.
    expect(content).not.toContain('trigger: "design-token-panel"');
    expect(content).not.toContain('component: "github-link"');
  });

  it("emits ai-chat verbatim when explicitly listed in the preset", async () => {
    // The runtime filter (filterHeaderRightItems) hides ai-chat when
    // aiAssistant is false in the scaffold, but emission must still preserve
    // the entry so the preset round-trips and so users can flip aiAssistant
    // later without re-editing headerRightItems.
    const choices: UserChoices = {
      projectName: "test-hri-aichat",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
      headerRightItems: [
        { type: "trigger", trigger: "ai-chat" },
        { type: "component", component: "theme-toggle" },
      ],
    };
    await scaffold(choices);
    const content = await fs.readFile(
      projectPath("test-hri-aichat", "src/config/settings.ts"),
      "utf-8",
    );
    expect(content).toContain('trigger: "ai-chat"');
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

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("keeps llms-txt integration when enabled", async () => {
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
    // Depends on: topic-config-generators (zfb-config-gen.ts)
    const config = await fs.readFile(
      projectPath("test-llms-int", "zfb.config.ts"),
      "utf-8",
    );
    expect(config).toContain("llmsTxtPlugin");
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

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("sets footer: false and strips component when disabled", async () => {
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
    // Depends on: topic-template-files (JSX layout from E5) + topic-feature-modules
    const layout = await fs.readFile(
      projectPath("test-footer-off", "src/layouts/doc-layout.astro"),
      "utf-8",
    );
    expect(layout).not.toContain("Footer");
  });

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("keeps footer component when footer is enabled", async () => {
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
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("generates src-tauri/ and find-in-page when tauri is enabled", async () => {
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

    // Depends on: topic-template-files (JSX layout from E5) + topic-feature-modules
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

describe("scaffold — tauri-dev feature (Mode 2)", () => {
  it("generates src-tauri-dev/ when tauriDev is enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-tauri-dev",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "tauriDev"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    // src-tauri-dev/ directory exists with key files
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/Cargo.toml")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/src/main.rs")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/tauri.conf.json")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/capabilities/default.json")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/frontend/index.html")),
    ).toBe(true);
    expect(
      await fs.pathExists(projectPath("test-tauri-dev", "src-tauri-dev/icons/icon.png")),
    ).toBe(true);

    // package.json has tauri-dev scripts that cd into the src-tauri-dev crate
    const pkg = await fs.readJson(projectPath("test-tauri-dev", "package.json"));
    expect(pkg.scripts["dev:tauri-dev"]).toBe(
      "cd src-tauri-dev && cargo tauri dev",
    );
    expect(pkg.scripts["build:tauri-dev"]).toBe(
      "cd src-tauri-dev && cargo tauri build",
    );
    // Mode 1 tauri scripts must NOT be present (only tauriDev enabled)
    expect(pkg.scripts["dev:tauri"]).toBeUndefined();

    // Cargo.toml package name patched with "-dev" suffix to avoid Mode 1 collision
    const cargo = await fs.readFile(
      projectPath("test-tauri-dev", "src-tauri-dev/Cargo.toml"),
      "utf-8",
    );
    expect(cargo).toContain('name = "test-tauri-dev-dev"');
    expect(cargo).not.toContain('name = "zudo-doc-dev"');

    // tauri.conf.json identity is NOT patched (Mode 2 fixed identity)
    const conf = await fs.readFile(
      projectPath("test-tauri-dev", "src-tauri-dev/tauri.conf.json"),
      "utf-8",
    );
    expect(conf).toContain('"productName": "zudo-doc dev"');

    // .gitignore has src-tauri-dev entries
    const gitignore = await fs.readFile(
      projectPath("test-tauri-dev", ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain("src-tauri-dev/target");
    expect(gitignore).toContain("src-tauri-dev/gen");
  });

  it("does NOT generate src-tauri-dev/ when tauriDev is disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-no-tauri-dev",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    expect(
      await fs.pathExists(projectPath("test-no-tauri-dev", "src-tauri-dev/Cargo.toml")),
    ).toBe(false);

    const pkg = await fs.readJson(projectPath("test-no-tauri-dev", "package.json"));
    expect(pkg.scripts["dev:tauri-dev"]).toBeUndefined();
    expect(pkg.scripts["build:tauri-dev"]).toBeUndefined();
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

  it("includes html-validate in devDependencies", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.devDependencies["html-validate"]).toBeDefined();
  });

  it("includes check:html script", async () => {
    const pkg = await fs.readJson(
      projectPath("test-minimal", "package.json"),
    );
    expect(pkg.scripts["check:html"]).toBe(
      'html-validate "dist/**/*.html"',
    );
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
    expect(content).toContain("**zfb**");
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

  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("frontmatter-preview.astro component exists in base template", async () => {
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

  // W6A (#1734): image-enlarge stays always-on with a no-op stub in base
  // (carries both the default export and the ImageEnlargeSsrFallback named
  // export the body-end Island wrapper imports). The imageEnlarge feature
  // template overwrites the stub with the real island when enabled.
  it("ships image-enlarge as a no-op stub when imageEnlarge feature is off (W6A)", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-island-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const stubPath = projectPath(
      "test-ie-island-off",
      "src/components/image-enlarge.tsx",
    );
    expect(await fs.pathExists(stubPath)).toBe(true);
    const content = await fs.readFile(stubPath, "utf-8");
    expect(content).toContain("W6A stub");
    expect(content).toContain("return null");
    expect(content).toContain("export default");
    expect(content).toContain("ImageEnlargeSsrFallback");
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

  it("zfb.config.ts does not contain Astro-specific rehype symbols (imageEnlarge is a layout island)", async () => {
    const choices: UserChoices = {
      projectName: "test-ie-zfb-on",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "imageEnlarge"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const config = await fs.readFile(
      projectPath("test-ie-zfb-on", "zfb.config.ts"),
      "utf-8",
    );
    // imageEnlarge is a layout island — it is not wired via the zfb config.
    expect(config).not.toContain("rehypeImageEnlarge");
  });

  // Depends on: topic-template-files (JSX layout from E5) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("doc-layout references ImageEnlarge when enabled", async () => {
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

  // Depends on: topic-template-files (JSX layout from E5) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("doc-layout does not reference ImageEnlarge when disabled", async () => {
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

describe("scaffold — versioning feature (sub #468)", () => {
  // Depends on: topic-template-files (E7a JSX header port) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("declares versionAvailability prop in scaffolded header.tsx when enabled", async () => {
    const choices: UserChoices = {
      projectName: "test-versioning-header-prop",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "versioning"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const header = await fs.readFile(
      projectPath(
        "test-versioning-header-prop",
        "src/components/header.astro",
      ),
      "utf-8",
    );

    // Type import for VersionAvailability is present
    expect(header).toContain(
      'import type { VersionAvailability } from "@/utils/version-availability"',
    );
    // Props interface declares versionAvailability
    expect(header).toMatch(/versionAvailability\?:\s*VersionAvailability;/);
    // Destructure pulls versionAvailability out of component props
    expect(header).toMatch(
      /const\s*\{[\s\S]*versionAvailability[\s\S]*\}\s*=/,
    );
    // No leftover @slot anchor lines after composition
    expect(header).not.toContain("@slot:header:props");
    expect(header).not.toContain("@slot:header:props-destructure");
  });

  // Depends on: topic-template-files (E7a JSX header port) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("does NOT add versionAvailability prop when versioning is disabled", async () => {
    const choices: UserChoices = {
      projectName: "test-versioning-header-prop-off",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search"],
      packageManager: "pnpm",
    };
    await scaffold(choices);

    const header = await fs.readFile(
      projectPath(
        "test-versioning-header-prop-off",
        "src/components/header.astro",
      ),
      "utf-8",
    );

    expect(header).not.toContain("versionAvailability");
    expect(header).not.toContain("VersionAvailability");
    // Anchor cleanup removes the unused props anchors
    expect(header).not.toContain("@slot:header:props");
  });
});

describe("scaffold — footerTaglist feature", () => {
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("emits taglist block inside footer when enabled (with tagGovernance)", async () => {
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
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("frontmatter-preview.astro casts value to NonNullable<unknown> before JSX slot", async () => {
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

  // Depends on: topic-template-files (E7a JSX header port) + topic-feature-modules
  // S5 retired Astro: this assertion targeted .astro fixtures or generator
  // pathways that have not yet been ported to the post-cutover .tsx layout.
  // Re-enable in the create-zudo-doc S5 follow-up sub-task.
  it.skip("i18n header injection no longer passes the dead `locales` prop to LanguageSwitcher", async () => {
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
    // `locales` triggers a type error: "{ ... } is not assignable to IntrinsicAttributes & Props".
    expect(header).toMatch(/<LanguageSwitcher lang=\{lang\} \/>/);
    expect(header).not.toMatch(/locales=\{locales\}/);
    // The accompanying `import { locales } from "@/config/i18n"` must also go,
    // otherwise tsc flags it as "declared but never used".
    expect(header).not.toMatch(
      /import \{ locales \} from "@\/config\/i18n";/,
    );
  });
});

// ---------------------------------------------------------------------------
// zfb.config.ts shape — ≥ 3 representative feature combinations
//
// ALL tests in this describe block depend on:
//   - topic-config-generators  (zfb-config-gen.ts that emits zfb.config.ts)
//   - topic-template-files     (base template retarget to zfb layout)
//
// They will fail until those sibling topics merge into base/astro-zfb-migration-scaffold.
// ---------------------------------------------------------------------------

describe("scaffold — zfb.config.ts shape (topic-config-generators)", () => {
  // Pattern 1: minimal (search + sidebarFilter, no i18n, single scheme)
  describe("minimal", () => {
    const choices: UserChoices = {
      projectName: "test-zfb-minimal",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "sidebarFilter"],
      packageManager: "pnpm",
    };

    beforeEach(async () => {
      await scaffold(choices);
    });

    it("creates zfb.config.ts with defineConfig from zfb/config", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-minimal", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain('from "zfb/config"');
      expect(config).toContain("defineConfig(");
      expect(config).not.toContain('from "astro/config"');
    });

    it("zfb.config.ts declares framework: preact and tailwind", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-minimal", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain('framework: "preact"');
      expect(config).toContain("tailwind:");
    });

    it("zfb.config.ts declares docs collection derived from settings.docsDir", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-minimal", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain('"docs"');
      expect(config).toContain("settings.docsDir");
    });

    it("zfb.config.ts has a plugins array", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-minimal", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain("plugins:");
    });

    it("src/content.config.ts is NOT emitted (content config lives in zfb.config.ts)", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-zfb-minimal", "src/content.config.ts"),
        ),
      ).toBe(false);
    });

    // Post-S5: the root package.json has dropped astro/@astrojs/* and the
    // generator now lists @takazudo/zfb directly as the runtime dependency.
    // (Replaces the Phase-A assertion that astro was still present.)
    // W4A (#1732): @zudo-doc/zudo-doc-v2 is now also a runtime dep — pinned
    // to the v2 publish version that release-create-zudo-doc.sh keeps in
    // lockstep with the generator's own version.
    it("package.json lists @takazudo/zfb and @zudo-doc/zudo-doc-v2 as runtime dependencies (post-S5, post-W4A)", async () => {
      const pkg = await fs.readJson(
        projectPath("test-zfb-minimal", "package.json"),
      );
      expect(pkg.dependencies["@takazudo/zfb"]).toBeDefined();
      expect(pkg.dependencies["astro"]).toBeUndefined();
      expect(pkg.dependencies["@zudo-doc/zudo-doc-v2"]).toBeDefined();
      expect(pkg.dependencies["@zudo-doc/zudo-doc-v2"]).toMatch(/^\^?0\.1\./);
    });

    // W6B (#1735) — runtime deps required by always-on scaffolded
    // pages/lib code or by the zfb engine bundler. Each was caught by
    // the consumer-build verification gate (one missing-dep error per
    // round). Without these, `zfb build` fails before any page compiles:
    //   - zod                       → zfb-config-gen emits
    //                                 `import { z } from "zod"` for the
    //                                 collection schema + z.toJSONSchema()
    //   - preact-render-to-string   → zfb's emitted entry.mjs SSR's pages
    //                                 via `renderToString` from this pkg
    //   - katex                     → pages/lib/_math-block.tsx renders
    //                                 LaTeX server-side via katex.renderToString()
    it("package.json lists zod, preact-render-to-string, katex as runtime deps (W6B — needed by always-on scaffolded code)", async () => {
      const pkg = await fs.readJson(
        projectPath("test-zfb-minimal", "package.json"),
      );
      expect(pkg.dependencies["zod"]).toBeDefined();
      expect(pkg.dependencies["preact-render-to-string"]).toBeDefined();
      expect(pkg.dependencies["katex"]).toBeDefined();
    });
  });

  // Pattern 2: barebone — everything off (no features, single scheme)
  describe("barebone (everything off)", () => {
    const choices: UserChoices = {
      projectName: "test-zfb-barebone",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };

    beforeEach(async () => {
      await scaffold(choices);
    });

    it("zfb.config.ts exists without any optional plugin imports", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-barebone", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain('from "zfb/config"');
      expect(config).not.toContain("docHistory");
      expect(config).not.toContain("llmsTxt");
      expect(config).not.toContain("claudeResources");
    });

    it("src/content.config.ts is NOT emitted", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-zfb-barebone", "src/content.config.ts"),
        ),
      ).toBe(false);
    });

    it("no locale collections in zfb.config.ts (i18n off)", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-barebone", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).not.toContain("docs-ja");
    });
  });

  // Pattern 3: most features on (i18n, search, docHistory, llmsTxt, claudeResources)
  describe("most features on", () => {
    const choices: UserChoices = {
      projectName: "test-zfb-full",
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
        "docHistory",
        "llmsTxt",
        "claudeResources",
        "imageEnlarge",
      ],
      packageManager: "pnpm",
    };

    beforeEach(async () => {
      await scaffold(choices);
    });

    it("zfb.config.ts contains locale collection entries for i18n", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-full", "zfb.config.ts"),
        "utf-8",
      );
      // Locale collections are derived at zfb-load time from
      // settings.locales, so the literal locale ids (docs-ja, etc.)
      // do not appear in the emitted file. Assert the loop is wired.
      expect(config).toContain("Object.entries(settings.locales)");
    });

    it("zfb.config.ts wires docHistory, llmsTxt, and claudeResources plugins", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-full", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).toContain("docHistory");
      expect(config).toContain("llmsTxt");
      expect(config).toContain("claudeResources");
    });

    // imageEnlarge is a layout island, not a markdown rehype plugin in
    // the zfb.config.ts pipeline. Make the negative assertion explicit
    // so a future regression that re-introduces it gets caught.
    it("zfb.config.ts does NOT wire rehypeImageEnlarge (it is a layout island)", async () => {
      const config = await fs.readFile(
        projectPath("test-zfb-full", "zfb.config.ts"),
        "utf-8",
      );
      expect(config).not.toContain("rehypeImageEnlarge");
    });

    it("src/content.config.ts is NOT emitted", async () => {
      expect(
        await fs.pathExists(
          projectPath("test-zfb-full", "src/content.config.ts"),
        ),
      ).toBe(false);
    });
  });
});

// W6A (#1734) — page mirror parity assertions. The 29 unconditional pages
// from the host repo's pages/ tree are mirrored into templates/base/pages/
// and must show up in every scaffold variant; pages/api/** is excluded as
// worker-only per spec-lock Decision 5.
describe("scaffold — W6A page mirror (templates/base/pages)", () => {
  const UNCONDITIONAL_PAGES = [
    "pages/index.tsx",
    "pages/404.tsx",
    "pages/sitemap.xml.tsx",
    "pages/_data.ts",
    "pages/_mdx-components.ts",
    "pages/docs/[...slug].tsx",
    "pages/lib/_body-end-islands.tsx",
    "pages/lib/_category-nav.tsx",
    "pages/lib/_category-tree-nav.tsx",
    "pages/lib/_compose-meta-title.ts",
    "pages/lib/_details.tsx",
    "pages/lib/_doc-history-area.tsx",
    "pages/lib/_doc-metainfo-area.tsx",
    "pages/lib/_doc-tags-area.tsx",
    "pages/lib/_extract-headings.ts",
    "pages/lib/_footer-with-defaults.tsx",
    "pages/lib/_frontmatter-preview-data.ts",
    "pages/lib/_head-with-defaults.tsx",
    "pages/lib/_header-with-defaults.tsx",
    "pages/lib/_inline-version-switcher.tsx",
    "pages/lib/_math-block.tsx",
    "pages/lib/_nav-source-docs.ts",
    "pages/lib/_preset-generator.tsx",
    "pages/lib/_search-widget-script.ts",
    "pages/lib/_search-widget.tsx",
    "pages/lib/_sidebar-with-defaults.tsx",
    "pages/lib/_site-tree-nav.tsx",
    "pages/lib/locale-merge.ts",
    "pages/lib/route-enumerators.ts",
  ];

  const BAREBONE: UserChoices = {
    projectName: "test-pages-barebone",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: [],
    packageManager: "pnpm",
  };

  const ALL_FEATURES: UserChoices = {
    projectName: "test-pages-all",
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
      "sidebarToggle",
      "sidebarResizer",
      "docHistory",
      "llmsTxt",
      "claudeResources",
      "claudeSkills",
      "designTokenPanel",
      "imageEnlarge",
      "bodyFootUtil",
      "footerNavGroup",
      "footerCopyright",
      "changelog",
      "skillSymlinker",
      "tagGovernance",
    ],
    packageManager: "pnpm",
  };

  it("emits all 29 unconditional page files in a barebone scaffold", async () => {
    await scaffold(BAREBONE);
    for (const rel of UNCONDITIONAL_PAGES) {
      expect(
        await fs.pathExists(projectPath("test-pages-barebone", rel)),
        `expected ${rel} to exist in barebone scaffold`,
      ).toBe(true);
    }
  });

  it("emits all 29 unconditional page files in an all-features scaffold", async () => {
    await scaffold(ALL_FEATURES);
    for (const rel of UNCONDITIONAL_PAGES) {
      expect(
        await fs.pathExists(projectPath("test-pages-all", rel)),
        `expected ${rel} to exist in all-features scaffold`,
      ).toBe(true);
    }
  });

  it("does not emit pages/api/ai-chat.tsx in any scaffold variant (W6A spec-lock Decision 5)", async () => {
    // Worker-only SSR endpoint — explicit exclusion via EXCLUDE_FROM_MIRROR
    // in src/scaffold.ts. Asserts both variants: a barebone with no features
    // and an all-features scaffold. Neither should ship pages/api/**.
    for (const choices of [BAREBONE, ALL_FEATURES]) {
      await scaffold(choices);
      const apiDir = projectPath(choices.projectName, "pages/api");
      expect(
        await fs.pathExists(apiDir),
        `pages/api/ must not be emitted in ${choices.projectName}`,
      ).toBe(false);
      const aiChat = projectPath(choices.projectName, "pages/api/ai-chat.tsx");
      expect(await fs.pathExists(aiChat)).toBe(false);
    }
  });

  it("ships the #doc-history-meta seed JSON in every scaffold variant", async () => {
    // The mirrored pages import "#doc-history-meta" — the tsconfig alias
    // resolves to .zfb/doc-history-meta.json. The seed file containing
    // exactly {} ships in templates/base/.zfb/ so the import resolves
    // even when docHistory is disabled. The doc-history prebuild step
    // overwrites it at build time when the feature is enabled.
    await scaffold(BAREBONE);
    const seedPath = projectPath(
      "test-pages-barebone",
      ".zfb/doc-history-meta.json",
    );
    expect(await fs.pathExists(seedPath)).toBe(true);
    expect(await fs.readFile(seedPath, "utf-8")).toBe("{}\n");
  });

  it("tsconfig.json carries the #doc-history-meta path alias", async () => {
    await scaffold(BAREBONE);
    const tsconfig = await fs.readJson(
      projectPath("test-pages-barebone", "tsconfig.json"),
    );
    expect(tsconfig.compilerOptions.paths["#doc-history-meta"]).toEqual([
      ".zfb/doc-history-meta.json",
    ]);
  });

  // W6B (#1735) — react → preact/compat alias at the tsconfig layer.
  // Lets the mirrored pages and feature templates `import ... from
  // "react"` and have TypeScript + zfb's FsResolver (which walks up to
  // the nearest tsconfig.json and resolves compilerOptions.paths at
  // build time, per upstream zfb PR #139) route the import to
  // preact/compat.
  //
  // Spec deviations from #1735 W2 §1.2:
  //
  // 1. Trailing slash on `react` + `react-dom` is load-bearing. Without
  //    it, esbuild (running in `platform: "neutral"` mode in zfb's
  //    islands bundler) resolves the alias to the bare path
  //    `node_modules/preact/compat`, then refuses to read the package's
  //    `main` field and errors with "Main fields must be configured
  //    explicitly when using the 'neutral' platform". With trailing
  //    slash, esbuild treats the alias as a package-directory and
  //    resolves correctly. Confirmed empirically by the consumer-build
  //    gate; matches the host's tsconfig shape verbatim.
  // 2. `react-dom/*` (subpath wildcard) is intentionally omitted —
  //    the host doesn't ship it and no scaffolded code imports a
  //    react-dom subpath.
  // 3. The spec also asked for a `vite.resolve.alias` belt-and-braces
  //    layer in zfb.config.ts. zfb's `ZfbConfig` type (verified in
  //    node_modules/@takazudo/zfb/dist/config.d.ts) has no `vite`
  //    field — adding one breaks `pnpm check`. The host builds with
  //    tsconfig paths only.
  it("tsconfig.json aliases react/react-dom to preact/compat (matches host shape verbatim)", async () => {
    await scaffold(BAREBONE);
    const tsconfig = await fs.readJson(
      projectPath("test-pages-barebone", "tsconfig.json"),
    );
    expect(tsconfig.compilerOptions.paths["react"]).toEqual([
      "./node_modules/preact/compat/",
    ]);
    expect(tsconfig.compilerOptions.paths["react/jsx-runtime"]).toEqual([
      "./node_modules/preact/jsx-runtime",
    ]);
    expect(tsconfig.compilerOptions.paths["react-dom"]).toEqual([
      "./node_modules/preact/compat/",
    ]);
  });
});

// ---------------------------------------------------------------------------
// W7A (#1736) — zfb-config-gen reconcile: the generated zfb.config.ts must
// reference plugin `.mjs` files actually shipped by the templates, otherwise
// `zfb build` fails at config bundling (the W6B-flagged blocker). These
// tests assert the import-resolution chain end-to-end at scaffold time so
// the consumer build only fails for *new* drift, not for known-broken state.
// ---------------------------------------------------------------------------

describe("scaffold — W7A zfb plugin .mjs files exist after composition (#1736)", () => {
  it("barebone scaffold ships base/plugins/{search-index,copy-public,connect-adapter}.mjs", async () => {
    const choices: UserChoices = {
      projectName: "test-w7a-plugins-barebone",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: [],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    for (const file of [
      "plugins/search-index-plugin.mjs",
      "plugins/copy-public-plugin.mjs",
      "plugins/connect-adapter.mjs",
    ]) {
      expect(
        await fs.pathExists(
          projectPath("test-w7a-plugins-barebone", file),
        ),
        `expected ${file} to ship in every scaffold`,
      ).toBe(true);
    }
    // Optional-feature plugins must NOT ship when the feature is off,
    // otherwise the generated zfb.config.ts (which lacks the matching
    // inline entry) would leave the `.mjs` files as orphans and any
    // future bare-grep validator could flag them.
    for (const file of [
      "plugins/doc-history-plugin.mjs",
      "plugins/llms-txt-plugin.mjs",
      "plugins/claude-resources-plugin.mjs",
    ]) {
      expect(
        await fs.pathExists(
          projectPath("test-w7a-plugins-barebone", file),
        ),
        `expected ${file} to be absent from barebone scaffold`,
      ).toBe(false);
    }
  });

  it("all-features scaffold ships every plugin .mjs the zfb config references", async () => {
    const choices: UserChoices = {
      projectName: "test-w7a-plugins-all",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["search", "docHistory", "llmsTxt", "claudeResources"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const config = await fs.readFile(
      projectPath("test-w7a-plugins-all", "zfb.config.ts"),
      "utf-8",
    );
    // For every `./plugins/<name>.mjs` reference in zfb.config.ts, the
    // file must actually exist at that path. This is the precise gate
    // the W6B verification was hitting: imports without files = bundler
    // failure at config load.
    const matches = [
      ...config.matchAll(/"\.\/plugins\/([\w-]+\.mjs)"/g),
    ];
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      const relPath = `plugins/${match[1]!}`;
      expect(
        await fs.pathExists(
          projectPath("test-w7a-plugins-all", relPath),
        ),
        `zfb.config.ts references ${relPath} but the file was not shipped`,
      ).toBe(true);
    }
  });

  it("doc-history scaffold ships tsx devDep (plugin spawns `tsx -e`)", async () => {
    const choices: UserChoices = {
      projectName: "test-w7a-dh-tsx",
      defaultLang: "en",
      colorSchemeMode: "single",
      singleScheme: "Default Dark",
      features: ["docHistory"],
      packageManager: "pnpm",
    };
    await scaffold(choices);
    const pkg = await fs.readJson(
      projectPath("test-w7a-dh-tsx", "package.json"),
    );
    expect(pkg.devDependencies?.tsx).toBeTruthy();
  });
});

// W7B (#1737) — i18n feature emits the locale-prefixed page set
// (pages/[locale]/index.tsx + pages/[locale]/docs/[...slug].tsx) when
// selected, and zero pages/[locale]/** files when not selected. Both
// emitted files must be byte-identical to their feature templates.
//
// Cross-feature note: versioning + docTags also emit pages/[locale]/**
// files (versions.tsx, tags/[tag].tsx, tags/index.tsx) — those are W7C
// scope and live in different feature template dirs. The "off" assertion
// below uses a feature set that selects neither i18n, versioning, nor
// docTags so the [locale]/** namespace is provably empty.
describe("scaffold — W7B i18n feature pages (templates/features/i18n)", () => {
  const I18N_PAGE_FILES = [
    "pages/[locale]/index.tsx",
    "pages/[locale]/docs/[...slug].tsx",
  ];

  const I18N_ON: UserChoices = {
    projectName: "test-w7b-i18n-on",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["i18n", "search"],
    packageManager: "pnpm",
  };

  const I18N_OFF: UserChoices = {
    projectName: "test-w7b-i18n-off",
    defaultLang: "en",
    colorSchemeMode: "single",
    singleScheme: "Default Dark",
    features: ["search", "sidebarFilter"],
    packageManager: "pnpm",
  };

  // Absolute path to the feature-template source files, relative to this
  // test file. Used by the byte-identical assertion.
  const FEATURE_PAGES_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "templates/features/i18n/files/pages",
  );

  it("emits pages/[locale]/index.tsx + pages/[locale]/docs/[...slug].tsx when i18n is selected", async () => {
    await scaffold(I18N_ON);
    for (const rel of I18N_PAGE_FILES) {
      expect(
        await fs.pathExists(projectPath("test-w7b-i18n-on", rel)),
        `expected ${rel} to exist when i18n is selected`,
      ).toBe(true);
    }
  });

  it("does NOT emit any pages/[locale]/** files when i18n is not selected", async () => {
    await scaffold(I18N_OFF);
    const localeDir = projectPath("test-w7b-i18n-off", "pages/[locale]");
    expect(
      await fs.pathExists(localeDir),
      "pages/[locale]/ must not exist when i18n is off",
    ).toBe(false);
  });

  it("emitted pages/[locale]/index.tsx is byte-identical to the feature template", async () => {
    await scaffold(I18N_ON);
    const emitted = await fs.readFile(
      projectPath("test-w7b-i18n-on", "pages/[locale]/index.tsx"),
      "utf-8",
    );
    const template = await fs.readFile(
      path.join(FEATURE_PAGES_DIR, "[locale]/index.tsx"),
      "utf-8",
    );
    expect(emitted).toEqual(template);
  });

  it("emitted pages/[locale]/docs/[...slug].tsx is byte-identical to the feature template", async () => {
    await scaffold(I18N_ON);
    const emitted = await fs.readFile(
      projectPath("test-w7b-i18n-on", "pages/[locale]/docs/[...slug].tsx"),
      "utf-8",
    );
    const template = await fs.readFile(
      path.join(FEATURE_PAGES_DIR, "[locale]/docs/[...slug].tsx"),
      "utf-8",
    );
    expect(emitted).toEqual(template);
  });
});
