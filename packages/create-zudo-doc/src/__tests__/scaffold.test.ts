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
