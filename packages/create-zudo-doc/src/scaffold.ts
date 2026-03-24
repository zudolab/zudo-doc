import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "./prompts.js";
import { generateSettingsFile } from "./settings-gen.js";
import { stripFeatures } from "./strip.js";
import { capitalize } from "./utils.js";

/** Determine the secondary language code when i18n is enabled. */
export function getSecondaryLang(defaultLang: string): string {
  return defaultLang === "en" ? "ja" : "en";
}

const STARTER_CONTENT_EN = (siteName: string) => `---
title: Welcome
sidebar_position: 1
---

# Welcome to ${siteName}

This documentation site was created with [zudo-doc](https://github.com/zudolab/zudo-doc).

## Getting Started

Edit the files in \`src/content/docs/\` to add your documentation.
`;

const STARTER_CONTENT_JA = () => `---
title: ようこそ
sidebar_position: 1
---

# ようこそ

このドキュメントサイトは [zudo-doc](https://github.com/zudolab/zudo-doc) で作成されました。
`;

export async function scaffold(choices: UserChoices): Promise<void> {
  const targetDir = path.resolve(process.cwd(), choices.projectName);

  if (await fs.pathExists(targetDir)) {
    const contents = await fs.readdir(targetDir);
    if (contents.length > 0) {
      throw new Error(
        `Directory "${choices.projectName}" already exists and is not empty`,
      );
    }
  }

  // Resolve template root using fileURLToPath for cross-platform support.
  // Check for bundled template first, fall back to monorepo root for local dev.
  const pkgRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", // from dist/ up to packages/create-zudo-doc
  );
  const bundledTemplate = path.join(pkgRoot, "template");
  const monorepoRoot = path.resolve(pkgRoot, "../..");
  const templateRoot = (await fs.pathExists(bundledTemplate))
    ? bundledTemplate
    : monorepoRoot;

  // Copy template files (exclude content — we create starter content below)
  const filesToCopy = [
    "src/components",
    "src/config",
    "src/hooks",
    "src/integrations",
    "src/layouts",
    "src/pages",
    "src/styles",
    "src/types",
    "src/utils",
    "src/content.config.ts",
    "astro.config.ts",
    "tsconfig.json",
  ];

  await fs.ensureDir(targetDir);

  for (const file of filesToCopy) {
    const src = path.join(templateRoot, file);
    const dest = path.join(targetDir, file);
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest);
    }
  }

  // Copy plugin implementations from the package (not re-exports from src/plugins/)
  const pluginsSrc = path.join(templateRoot, "packages/md-plugins/src");
  const pluginsDest = path.join(targetDir, "src/plugins");
  if (await fs.pathExists(pluginsSrc)) {
    await fs.copy(pluginsSrc, pluginsDest, {
      filter: (src) => !src.includes("__tests__") && !src.endsWith("/index.ts"),
    });
  }

  const defaultLang = choices.defaultLang;
  const escapedName = capitalize(choices.projectName.replace(/-/g, " "));

  // Place primary content in src/content/docs/
  const primaryContent =
    defaultLang === "ja"
      ? STARTER_CONTENT_JA()
      : STARTER_CONTENT_EN(escapedName);
  await fs.outputFile(
    path.join(targetDir, "src/content/docs/getting-started/index.mdx"),
    primaryContent,
  );

  // When i18n is ON, place secondary language content
  if (choices.features.includes("i18n")) {
    const secondaryLang = getSecondaryLang(defaultLang);
    const secondaryDir = `src/content/docs-${secondaryLang}`;
    await fs.ensureDir(path.join(targetDir, secondaryDir));

    const secondaryContent =
      secondaryLang === "ja"
        ? STARTER_CONTENT_JA()
        : STARTER_CONTENT_EN(escapedName);
    await fs.outputFile(
      path.join(targetDir, `${secondaryDir}/getting-started/index.mdx`),
      secondaryContent,
    );
  }

  // Generate settings.ts
  const settingsContent = generateSettingsFile(choices);
  await fs.outputFile(
    path.join(targetDir, "src/config/settings.ts"),
    settingsContent,
  );

  // Generate package.json
  const pkg = generatePackageJson(choices);
  await fs.outputFile(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );

  // Create .gitignore
  await fs.outputFile(
    path.join(targetDir, ".gitignore"),
    ["node_modules", "dist", ".astro", ""].join("\n"),
  );

  // Strip unwanted features and apply defaultLang patching
  await stripFeatures(targetDir, choices);

  // Ensure content directories exist
  await fs.ensureDir(path.join(targetDir, "src/content/docs"));
}

function generatePackageJson(choices: UserChoices) {
  const deps: Record<string, string> = {
    astro: "^5.18.0",
    "@astrojs/mdx": "^4.3.0",
    "@astrojs/react": "^4.4.0",
    react: "^19.2.0",
    "react-dom": "^19.2.0",
    "@shikijs/transformers": "^4.0.0",
    clsx: "^2.1.0",
    "gray-matter": "^4.0.0",
    "github-slugger": "^2.0.0",
    "remark-directive": "^3.0.0",
    "unist-util-visit": "^5.1.0",
  };

  const devDeps: Record<string, string> = {
    "@tailwindcss/vite": "^4.2.0",
    tailwindcss: "^4.2.0",

    typescript: "^5.9.0",
    "@astrojs/check": "^0.9.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0",
  };

  if (choices.features.includes("search")) {
    deps["minisearch"] = "^7.2.0";
    devDeps["pagefind"] = "^1.4.0";
  }

  const scripts: Record<string, string> = {
    dev: "astro dev",
    build: "astro build",
    preview: "astro preview",
    check: "astro check",
  };

  return {
    name: choices.projectName,
    version: "0.0.1",
    private: true,
    type: "module",
    scripts,
    dependencies: deps,
    devDependencies: devDeps,
  };
}
