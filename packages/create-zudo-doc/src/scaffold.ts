import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "./prompts.js";
import { generateSettingsFile } from "./settings-gen.js";
import { generateAstroConfig } from "./astro-config-gen.js";
import { generateContentConfig } from "./content-config-gen.js";
import { generateCLAUDEFile } from "./claude-md-gen.js";
import { composeFeatures } from "./compose.js";
import { featureModules } from "./features/index.js";
import { capitalize, getSecondaryLang, patchDefaultLang } from "./utils.js";

export { getSecondaryLang };

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

const CHANGELOG_CONTENT_EN = () => `---
title: Changelog
sidebar_position: 99
---

# Changelog

## Unreleased

- Initial release
`;

const CHANGELOG_CONTENT_JA = () => `---
title: 変更履歴
sidebar_position: 99
---

# 変更履歴

## 未リリース

- 初回リリース
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

  // body-foot-util-area.astro ships the DocHistory component inline (byte-
  // identical to main/src/components/body-foot-util-area.astro). Selecting
  // bodyFootUtil without docHistory would leave an unresolved import, so we
  // silently co-enable docHistory.
  if (
    choices.features.includes("bodyFootUtil") &&
    !choices.features.includes("docHistory")
  ) {
    choices.features = [...choices.features, "docHistory"];
  }

  // Resolve template directories
  const pkgRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", // from dist/ up to packages/create-zudo-doc
  );
  const templatesDir = path.join(pkgRoot, "templates");
  const baseDir = path.join(templatesDir, "base");
  const featuresDir = path.join(templatesDir, "features");

  // For skillSymlinker, we still need the monorepo root for the script
  const monorepoRoot = path.resolve(pkgRoot, "../..");

  await fs.ensureDir(targetDir);

  // 1. Copy base template
  await fs.copy(baseDir, targetDir);

  // 2. Copy skill symlinker script when enabled
  if (choices.features.includes("skillSymlinker")) {
    const scriptSrc = path.join(monorepoRoot, "scripts/setup-doc-skill.sh");
    const scriptDest = path.join(targetDir, "scripts/setup-doc-skill.sh");
    if (await fs.pathExists(scriptSrc)) {
      await fs.copy(scriptSrc, scriptDest);
    }
  }

  // 2b. Copy user-facing Claude Code skills when enabled
  // Ships the curated zudo-doc-* skills (design-system, translate, version-bump)
  // from the monorepo's .claude/skills/ into the user's .claude/skills/.
  if (choices.features.includes("claudeSkills")) {
    const userFacingSkills = [
      "zudo-doc-design-system",
      "zudo-doc-translate",
      "zudo-doc-version-bump",
    ];
    for (const skill of userFacingSkills) {
      const skillSrc = path.join(monorepoRoot, ".claude/skills", skill);
      const skillDest = path.join(targetDir, ".claude/skills", skill);
      if (await fs.pathExists(skillSrc)) {
        await fs.copy(skillSrc, skillDest);
      }
    }
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

  // When changelog is ON, create a starter changelog page
  if (choices.features.includes("changelog")) {
    const changelogContent =
      defaultLang === "ja" ? CHANGELOG_CONTENT_JA() : CHANGELOG_CONTENT_EN();
    await fs.outputFile(
      path.join(targetDir, "src/content/docs/changelog/index.mdx"),
      changelogContent,
    );

    if (choices.features.includes("i18n")) {
      const secondaryLang = getSecondaryLang(defaultLang);
      const secondaryChangelogContent =
        secondaryLang === "ja"
          ? CHANGELOG_CONTENT_JA()
          : CHANGELOG_CONTENT_EN();
      await fs.outputFile(
        path.join(
          targetDir,
          `src/content/docs-${secondaryLang}/changelog/index.mdx`,
        ),
        secondaryChangelogContent,
      );
    }
  }

  // 3. Generate programmatic files
  const settingsContent = generateSettingsFile(choices);
  await fs.outputFile(
    path.join(targetDir, "src/config/settings.ts"),
    settingsContent,
  );

  const astroConfigContent = generateAstroConfig(choices);
  await fs.outputFile(
    path.join(targetDir, "astro.config.ts"),
    astroConfigContent,
  );

  const contentConfigContent = generateContentConfig(choices);
  await fs.outputFile(
    path.join(targetDir, "src/content.config.ts"),
    contentConfigContent,
  );

  const pkg = generatePackageJson(choices);
  await fs.outputFile(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );

  await fs.outputFile(
    path.join(targetDir, ".gitignore"),
    ["node_modules", "dist", ".astro", ""].join("\n"),
  );

  const claudeContent = generateCLAUDEFile(choices);
  await fs.outputFile(path.join(targetDir, "CLAUDE.md"), claudeContent);

  // 4. Compose features (copy feature files + inject into shared files)
  await composeFeatures(targetDir, choices, featureModules, featuresDir);

  // 5. Handle default language patching for non-i18n projects
  if (!choices.features.includes("i18n") && choices.defaultLang !== "en") {
    // The i18n feature handles its own language patching via postProcess.
    // For non-i18n projects, we still need to patch the default locale.
    await patchDefaultLang(targetDir, choices.defaultLang);
  }

  // Ensure content directories exist
  await fs.ensureDir(path.join(targetDir, "src/content/docs"));
}

function generatePackageJson(choices: UserChoices) {
  const deps: Record<string, string> = {
    astro: "^5.18.0",
    "@astrojs/mdx": "^4.3.0",
    "@astrojs/preact": "^4.1.0",
    preact: "^10.26.0",
    shiki: "^4.0.2",
    "@shikijs/transformers": "^4.0.0",
    clsx: "^2.1.0",
    "gray-matter": "^4.0.0",
    "github-slugger": "^2.0.0",
    mermaid: "^11.12.3",
    "remark-cjk-friendly": "^2.0.1",
    "remark-directive": "^3.0.0",
    "unist-util-visit": "^5.1.0",
  };

  const devDeps: Record<string, string> = {
    "@tailwindcss/vite": "^4.2.0",
    tailwindcss: "^4.2.0",

    typescript: "^5.9.0",
    "@astrojs/check": "^0.9.0",
    "@types/hast": "^3.0.4",
    "@types/mdast": "^4.0.4",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0", // needed for preact/compat type resolution
  };

  if (choices.features.includes("search")) {
    deps["minisearch"] = "^7.2.0";
    devDeps["pagefind"] = "^1.4.0";
  }

  if (choices.features.includes("docHistory")) {
    deps["diff"] = "^8.0.3";
  }

  if (choices.features.includes("tagGovernance")) {
    // gray-matter is already in `deps` unconditionally (base template uses it),
    // so we only add the tooling deps specific to tags:audit / tags:suggest.
    devDeps["string-similarity"] = "^4.0.4";
    devDeps["@types/string-similarity"] = "^4.0.2";
    devDeps["pluralize"] = "^8.0.0";
    devDeps["@types/pluralize"] = "^0.0.33";
    devDeps["picocolors"] = "^1.1.1";
    devDeps["@inquirer/prompts"] = "^8.4.2";
    devDeps["tsx"] = "^4.21.0";
  }

  const scripts: Record<string, string> = {
    dev: "astro dev",
    build: "astro build",
    preview: "astro preview",
    check: "astro check",
  };

  if (choices.features.includes("tagGovernance")) {
    scripts["tags:audit"] = "tsx scripts/tags-audit.ts";
    scripts["tags:suggest"] = "tsx scripts/tags-suggest.ts";
  }

  if (choices.features.includes("skillSymlinker")) {
    scripts["setup:doc-skill"] = "bash scripts/setup-doc-skill.sh";
  }

  // claudeSkills ships the zudo-doc-version-bump skill, whose release workflow
  // calls `pnpm b4push`. Emit a minimal stub so the skill does not hit a
  // "script not found" error on freshly scaffolded projects. Consumers are
  // free to expand this into a richer pre-push pipeline later.
  if (choices.features.includes("claudeSkills")) {
    scripts["b4push"] = "pnpm check && pnpm build";
  }

  if (choices.features.includes("tauri")) {
    scripts["dev:tauri"] = "cargo tauri dev";
    const runCmd = choices.packageManager === "npm" || choices.packageManager === "bun" ? `${choices.packageManager} run` : choices.packageManager;
    scripts["build:tauri"] = `${runCmd} build && cargo tauri build`;
  }

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

