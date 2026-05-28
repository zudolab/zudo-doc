import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "./prompts.js";
import { generateSettingsFile } from "./settings-gen.js";
import { generateZfbConfig } from "./zfb-config-gen.js";
import { generateCLAUDEFile } from "./claude-md-gen.js";
import { composeFeatures } from "./compose.js";
import { featureModules } from "./features/index.js";
import { capitalize, getSecondaryLang } from "./utils.js";

export { getSecondaryLang };

/**
 * Files in `templates/base/**` that must never be copied into a generated
 * project. Each entry is matched against the path relative to `templates/base/`
 * (POSIX-style, forward slashes).
 *
 * W2 spec-lock Decision 5 (#1728) — `pages/api/**` is worker-only SSR
 * (uses `@takazudo/zfb-adapter-cloudflare`, `prerender = false`) and is
 * intentionally absent from `templates/base/pages/` already. This list
 * is the explicit policy: future upstream-sync helpers that mirror more
 * of `pages/` into `templates/base/` MUST honour these patterns.
 */
const EXCLUDE_FROM_MIRROR: RegExp[] = [
  /^pages\/api(\/|$)/,
];

/**
 * `fs.copy` filter for the `templates/base/` → target-dir copy. Returns
 * `false` for any path matching {@link EXCLUDE_FROM_MIRROR}. Directories
 * matching an exclusion are skipped wholesale (fs.copy honours filter on
 * directories).
 */
function shouldCopyBaseFile(srcAbs: string, baseDir: string): boolean {
  const rel = path.relative(baseDir, srcAbs).split(path.sep).join("/");
  if (rel === "") return true; // root — always include
  for (const pattern of EXCLUDE_FROM_MIRROR) {
    if (pattern.test(rel)) return false;
  }
  return true;
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

  // body-foot-util-area.tsx ships the DocHistory component inline (byte-
  // identical to main/src/components/body-foot-util-area.tsx). Selecting
  // bodyFootUtil without docHistory would leave an unresolved import, so we
  // co-enable docHistory. Warn when this overrides an explicit --no-doc-history.
  if (
    choices.features.includes("bodyFootUtil") &&
    !choices.features.includes("docHistory")
  ) {
    if (choices.explicitlyDisabledFeatures?.includes("docHistory")) {
      console.warn(
        "body-foot-util requires doc-history; enabling it despite --no-doc-history",
      );
    }
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
  // Honour EXCLUDE_FROM_MIRROR so paths like `pages/api/**` (worker-only SSR
  // endpoints) are never emitted into a generated project — see W2 spec-lock
  // Decision 5 (#1728). Today templates/base/ does not contain any excluded
  // paths, but the filter documents the policy in code that runs.
  await fs.copy(baseDir, targetDir, {
    filter: (src: string) => shouldCopyBaseFile(src, baseDir),
  });

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

  const zfbConfigContent = generateZfbConfig(choices);
  await fs.outputFile(
    path.join(targetDir, "zfb.config.ts"),
    zfbConfigContent,
  );

  const pkg = generatePackageJson(choices);
  await fs.outputFile(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );

  await fs.outputFile(
    path.join(targetDir, ".gitignore"),
    [
      "# Build output",
      "node_modules",
      "dist",
      ".zfb",
      "",
      "# macOS",
      ".DS_Store",
      "",
      "# Environment",
      ".env",
      ".env.local",
      ".env.*.local",
      "",
      "# Logs",
      "*.log",
      "npm-debug.log*",
      "yarn-debug.log*",
      "pnpm-debug.log*",
      "",
      "# Cloudflare Wrangler",
      ".wrangler/",
      "",
    ].join("\n"),
  );

  const claudeContent = generateCLAUDEFile(choices);
  await fs.outputFile(path.join(targetDir, "CLAUDE.md"), claudeContent);

  // 4. Compose features (copy feature files + inject into shared files)
  await composeFeatures(targetDir, choices, featureModules, featuresDir);

  // Ensure content directories exist
  await fs.ensureDir(path.join(targetDir, "src/content/docs"));
}

function generatePackageJson(choices: UserChoices) {
  // Intentionally absent from scaffolded deps:
  //   @takazudo/zudo-doc-md-plugins — zero references in generator templates/source
  //   @takazudo/zfb-adapter-cloudflare — zero references in generator templates/source
  const deps: Record<string, string> = {
    // zfb engine — distributed as published npm packages (the prebuilt binary
    // ships via an optionalDependency of @takazudo/zfb-<platform>); pinned to
    // the pre-release the scaffold targets (per #500).
    // The two literals below must match root package.json's
    // dependencies["@takazudo/zfb"] / ["@takazudo/zfb-runtime"] —
    // enforced by scripts/check-pin-parity.mjs (W4A — #1732).
    "@takazudo/zfb": "0.1.0-next.10",
    "@takazudo/zfb-runtime": "0.1.0-next.10",
    // @takazudo/zudo-doc — published from this monorepo via
    // .github/workflows/publish-zudo-doc.yml. The pin here is bumped in
    // lockstep by scripts/release-create-zudo-doc.sh whenever zudo-doc's
    // version moves, so a fresh scaffold pulls the version we just published.
    "@takazudo/zudo-doc": "^0.1.0",
    // zod — used by the generated zfb.config.ts. zfb-config-gen emits
    // `import { z } from "zod"` for the content-collection schema +
    // `z.toJSONSchema(...)` conversion. Without this dep, the consumer
    // fails at `zfb build` with esbuild "Could not resolve 'zod'" before
    // any page compiles. The Astro→zfb retarget (3f0042f7) added the
    // import without the runtime dep; W6B (#1735) consumer-build
    // verification was the first to actually exercise it.
    zod: "^4.0.0",
    // ^10.29.1 floor satisfies @takazudo/zdtp's preact peer range so the app
    // and zdtp resolve a single preact instance — a lower floor can split into
    // two copies and crash hook-using SSR islands with "undefined reading __H".
    preact: "^10.29.1",
    // preact-render-to-string — zfb's emitted entry.mjs imports
    // `renderToString` from this package as `__zfb_renderToString` to
    // SSR each page. Without it, esbuild fails at the bundler step with
    // "Could not resolve 'preact-render-to-string'" before any page
    // compiles. Same pin as host. Caught by W6B (#1735) consumer-build
    // verification.
    "preact-render-to-string": "^6.6.6",
    shiki: "^4.0.2",
    "@shikijs/transformers": "^4.0.0",
    clsx: "^2.1.0",
    "gray-matter": "^4.0.0",
    "github-slugger": "^2.0.0",
    mermaid: "^11.12.3",
    "remark-cjk-friendly": "^2.0.1",
    "remark-directive": "^3.0.0",
    "unist-util-visit": "^5.1.0",
    // katex — server-side LaTeX renderer used by the always-on
    // pages/lib/_math-block.tsx (called from pages/_mdx-components.ts
    // for `$…$` and `$$…$$` math nodes). Caught by W6B (#1735)
    // consumer-build verification — the import lives in the mirrored
    // pages, not behind any feature gate. Same pin as host.
    katex: "^0.16.38",
  };

  const devDeps: Record<string, string> = {
    "@tailwindcss/vite": "^4.2.0",
    tailwindcss: "^4.2.0",

    typescript: "^5.9.0",
    "@types/hast": "^3.0.4",
    "@types/mdast": "^4.0.4",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0", // needed for preact/compat type resolution
    "html-validate": "^10.0.0",
  };

  if (choices.features.includes("search")) {
    deps["minisearch"] = "^7.2.0";
    devDeps["pagefind"] = "^1.4.0";
  }

  if (choices.features.includes("docHistory")) {
    deps["diff"] = "^8.0.3";
    // @takazudo/zudo-doc has @takazudo/zudo-doc-history-server as an optional
    // peer dep. When docHistory is selected the zfb plugin
    // (plugins/doc-history-plugin.mjs) eagerly imports
    // @takazudo/zudo-doc/integrations/doc-history which in turn imports
    // @takazudo/zudo-doc-history-server/git-history. Without this dep the
    // plugin host fails at init with ERR_MODULE_NOT_FOUND — W8A (#1739).
    deps["@takazudo/zudo-doc-history-server"] = "^0.1.0";
    // W7A (#1736): doc-history-plugin.mjs spawns `tsx -e <inline-script>` to
    // run the v2 runtime in a TS-aware Node subprocess; without tsx the
    // plugin's preBuild step exits with ENOENT before zfb finishes config
    // load.
    devDeps["tsx"] = "^4.21.0";
  }

  if (choices.features.includes("claudeResources")) {
    // W7A (#1736): claude-resources-plugin.mjs spawns `tsx -e <inline-script>`
    // for the same reason as doc-history (TS-aware Node subprocess wrapping
    // the v2 runner).
    devDeps["tsx"] = "^4.21.0";
  }

  if (choices.features.includes("designTokenPanel")) {
    deps["@takazudo/zdtp"] = "0.2.0-next.2";
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
    dev: "zfb dev",
    build: "zfb build",
    preview: "zfb preview",
    check: "zfb check",
    "check:html": "html-validate \"dist/**/*.html\"",
  };

  if (choices.features.includes("tagGovernance")) {
    scripts["tags:audit"] = "tsx scripts/tags-audit.ts";
    scripts["tags:suggest"] = "tsx scripts/tags-suggest.ts";
  }

  if (choices.features.includes("skillSymlinker")) {
    scripts["setup:doc-skill"] = "bash scripts/setup-doc-skill.sh";
  }

  const runCmd = choices.packageManager === "npm" || choices.packageManager === "bun" ? `${choices.packageManager} run` : choices.packageManager;

  // claudeSkills ships the zudo-doc-version-bump skill, whose release workflow
  // calls `<pm> b4push`. Emit a minimal stub so the skill does not hit a
  // "script not found" error on freshly scaffolded projects. Consumers are
  // free to expand this into a richer pre-push pipeline later.
  if (choices.features.includes("claudeSkills")) {
    scripts["b4push"] = `${runCmd} check && ${runCmd} build`;
  }

  if (choices.features.includes("tauri")) {
    scripts["dev:tauri"] = "cargo tauri dev";
    scripts["build:tauri"] = `${runCmd} build && cargo tauri build`;
  }

  if (choices.features.includes("tauriDev")) {
    scripts["dev:tauri-dev"] = "cd src-tauri-dev && cargo tauri dev";
    scripts["build:tauri-dev"] = "cd src-tauri-dev && cargo tauri build";
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

