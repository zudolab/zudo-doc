import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import type { UserChoices } from "./prompts.js";
import { generateZfbConfig } from "./zfb-config-gen.js";
import { generateCLAUDEFile } from "./claude-md-gen.js";
import { composeFeatures } from "./compose.js";
import { featureModules } from "./features/index.js";
import {
  capitalize,
  getSecondaryLang,
  hasAncestorPnpmWorkspace,
  pmRunCommand,
} from "./utils.js";

export { getSecondaryLang };

/**
 * TypeScript mirror of `DEFAULT_SKILL_NAME` in `scripts/setup-doc-skill.sh`
 * (`DEFAULT_SKILL_NAME="${PROJECT_NAME}-wisdom"`, suffix-aware since #3154).
 * The generator cannot import the shell script, so this rule is duplicated
 * here; the two are kept from drifting apart by the committed cross-artifact
 * parity test (#3158).
 *
 * If `projectName` already ends in `-wisdom` (or is exactly `wisdom`), it is
 * used verbatim — appending `-wisdom` again would double the suffix (e.g.
 * `zudo-test-wisdom` → `zudo-test-wisdom-wisdom`), which matches no
 * `.gitignore` entry and leaves the generated skill directory untracked.
 * Otherwise `-wisdom` is appended.
 */
export function deriveDocSkillName(projectName: string): string {
  if (projectName === "wisdom" || projectName.endsWith("-wisdom")) {
    return projectName;
  }
  return `${projectName}-wisdom`;
}

/**
 * Pinned `@takazudo/zudo-doc` version used by `generatePackageJson()`.
 * Hoisted as a shared constant (kept even though it now has a single
 * call site) because `scripts/check-pin-parity.mjs` resolves this exact
 * declaration below via its constant-reference regex form (see that
 * script's `readScaffoldPin()`) — keep the declaration line's shape
 * parseable (const name, `=`, a quoted literal) and do NOT repeat that
 * exact pattern anywhere earlier in this file (a comment containing the
 * literal text would false-match the same regex, since it isn't anchored
 * to a real `export const` statement).
 *
 * `.zudo-doc.json` is NO LONGER seeded here (locked decision #2653 #6 —
 * lazy-create on first `zudo-doc eject`; `packages/zudo-doc/src/eject/index.ts`
 * already tolerates its absence and writes the file on first successful eject).
 *
 * Bumped in lockstep by scripts/release-create-zudo-doc.sh.
 */
export const ZUDO_DOC_PIN = "^4.5.0";

/**
 * Files in `templates/base/**` that must not be copied by the unconditional
 * base mirror. Each entry is matched against the path relative to
 * `templates/base/` (POSIX-style, forward slashes).
 *
 * W2 spec-lock Decision 5 (#1728) — `pages/api/**` is worker-only SSR
 * (uses `@takazudo/zfb-adapter-cloudflare`, `prerender = false`) and is
 * intentionally absent from `templates/base/pages/` already. This list
 * is the explicit policy: future upstream-sync helpers that mirror more
 * of `pages/` into `templates/base/` MUST honour these patterns.
 */
const EXCLUDE_FROM_MIRROR: RegExp[] = [
  /^pages\/api(\/|$)/,
  /^scripts\/setup-doc-skill\.sh$/,
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
title: Getting Started
sidebar_position: 1
---

Welcome to ${siteName}. Choose a topic below to get started.

<CategoryNav category="getting-started" />
`;

const STARTER_CONTENT_JA = () => `---
title: はじめに
sidebar_position: 1
---

ドキュメントへようこそ。以下のトピックから始めてください。

<CategoryNav category="getting-started" />
`;

const STARTER_CHILD_INTRODUCTION_EN = (siteName: string) => `---
title: Introduction
sidebar_position: 1
---

## What is ${siteName}?

${siteName} is a documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc), a minimal documentation framework powered by zfb, MDX, and Tailwind CSS.

## Key Features

- MDX authoring with rich component support
- Fast static site generation via zfb
- Tailwind CSS v4 for styling
- Optional i18n, search, and more
`;

const STARTER_CHILD_INTRODUCTION_JA = (siteName: string) => `---
title: はじめに
sidebar_position: 1
---

## ${siteName} とは？

${siteName} は [zudo-doc](https://github.com/zudolab/zudo-doc) で構築されたドキュメントサイトです。zfb・MDX・Tailwind CSS を使ったミニマルなドキュメントフレームワークです。

## 主な機能

- MDX によるリッチなコンポーネントサポート
- zfb による高速な静的サイト生成
- スタイリングには Tailwind CSS v4
- i18n・検索などオプション機能も充実
`;

const STARTER_CHILD_INSTALLATION_EN = () => `---
title: Installation
sidebar_position: 2
---

## Requirements

- Node.js 22 or later
- pnpm (recommended), npm, yarn, or bun

## Create a New Project

Run the scaffolding tool to create a new project:

\`\`\`sh
pnpm create zudo-doc my-docs
\`\`\`

## Start the Dev Server

\`\`\`sh
cd my-docs
pnpm install
pnpm dev
\`\`\`

Open [http://localhost:4321](http://localhost:4321) to view your docs.
`;

const STARTER_CHILD_INSTALLATION_JA = () => `---
title: インストール
sidebar_position: 2
---

## 動作要件

- Node.js 22 以降
- pnpm（推奨）、npm、yarn、または bun

## 新しいプロジェクトを作成する

スキャフォールドツールを実行して新しいプロジェクトを作成します：

\`\`\`sh
pnpm create zudo-doc my-docs
\`\`\`

## 開発サーバーを起動する

\`\`\`sh
cd my-docs
pnpm install
pnpm dev
\`\`\`

[http://localhost:4321](http://localhost:4321) を開いてドキュメントを確認してください。
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
    const scriptSrc = path.join(baseDir, "scripts/setup-doc-skill.sh");
    const scriptDest = path.join(targetDir, "scripts/setup-doc-skill.sh");
    await fs.copy(scriptSrc, scriptDest);
  }

  // 2b. Copy user-facing Claude Code skills when enabled
  // Ships the curated zudo-doc-* skills (design-system, translate, version-bump)
  // from the package's own templates/ (npm `files` cannot reach outside the
  // package dir, so these are committed, scaffold-authored variants of the
  // monorepo's .claude/skills/, not read from there directly and not
  // byte-identical to it — each was rewritten to describe the scaffold-real
  // flow (no monorepo-only paths/scripts) instead of the monorepo's own
  // flow — see #2921 (original copy step) and epic #2946 (variant
  // conversion, #2947/#2948).
  if (choices.features.includes("claudeSkills")) {
    const userFacingSkills = [
      "zudo-doc-design-system",
      "zudo-doc-translate",
      "zudo-doc-version-bump",
    ];
    const skillsTemplateDir = path.join(
      featuresDir,
      "claudeSkills/files/.claude/skills",
    );
    for (const skill of userFacingSkills) {
      const skillSrc = path.join(skillsTemplateDir, skill);
      const skillDest = path.join(targetDir, ".claude/skills", skill);
      if (await fs.pathExists(skillSrc)) {
        await fs.copy(skillSrc, skillDest);
      } else {
        // Defensive only — unreachable in a healthy publish, since the
        // template files are committed alongside this source.
        console.warn(`claudeSkills: missing template source for "${skill}", skipping`);
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

  // Primary language child docs under getting-started/
  const primaryIntroductionContent =
    defaultLang === "ja"
      ? STARTER_CHILD_INTRODUCTION_JA(escapedName)
      : STARTER_CHILD_INTRODUCTION_EN(escapedName);
  await fs.outputFile(
    path.join(targetDir, "src/content/docs/getting-started/introduction.mdx"),
    primaryIntroductionContent,
  );
  const primaryInstallationContent =
    defaultLang === "ja"
      ? STARTER_CHILD_INSTALLATION_JA()
      : STARTER_CHILD_INSTALLATION_EN();
  await fs.outputFile(
    path.join(targetDir, "src/content/docs/getting-started/installation.mdx"),
    primaryInstallationContent,
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

    // Secondary language child docs under getting-started/
    const secondaryIntroductionContent =
      secondaryLang === "ja"
        ? STARTER_CHILD_INTRODUCTION_JA(escapedName)
        : STARTER_CHILD_INTRODUCTION_EN(escapedName);
    await fs.outputFile(
      path.join(
        targetDir,
        `${secondaryDir}/getting-started/introduction.mdx`,
      ),
      secondaryIntroductionContent,
    );
    const secondaryInstallationContent =
      secondaryLang === "ja"
        ? STARTER_CHILD_INSTALLATION_JA()
        : STARTER_CHILD_INSTALLATION_EN();
    await fs.outputFile(
      path.join(
        targetDir,
        `${secondaryDir}/getting-started/installation.mdx`,
      ),
      secondaryInstallationContent,
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

  // 3. Generate the one config file. There is no more src/config/settings.ts —
  // every user choice rides straight into zudoDoc({...}) in zfb.config.ts
  // (locked decision #2653 #2 — diff-from-defaults single config).
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

  // .zudo-doc.json is intentionally NOT seeded (locked decision #2653 #6 —
  // lazy-create on first `zudo-doc eject`). `packages/zudo-doc/src/eject/index.ts`
  // already tolerates its absence (defaults to `{ packageVersion: "unknown",
  // ejected: {} }`) and writes the file itself on first successful eject.

  const gitignoreLines = [
    "# Build output",
    "node_modules",
    "dist",
    ".zfb",
    ".zfb-build/",
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
    "# zudo-doc build artifact (routes-src/ staged here at build time)",
    ".zudo-doc/",
    "",
  ];

  // The doc-lookup skill is only generated when skillSymlinker is selected
  // (the setup-doc-skill.sh script and `setup:doc-skill` npm script are gated
  // on the same feature above), so only emit its ignore entries then —
  // otherwise they would be dead rules that could silently hide an unrelated
  // skill a user later installs under a matching name. The skill name is
  // deterministic (deriveDocSkillName(), matching DEFAULT_SKILL_NAME in
  // scripts/setup-doc-skill.sh), so these entries match the directory the
  // script creates. The setup script can target either .claude or .codex, so
  // ignore both possible generated directories. The docs-ja symlink only
  // exists for i18n projects (the script creates it conditionally), so gate
  // those lines on i18n.
  if (choices.features.includes("skillSymlinker")) {
    const skillName = deriveDocSkillName(choices.projectName);
    gitignoreLines.push(
      "# Generated doc-lookup skill",
      `.claude/skills/${skillName}/SKILL.md`,
      `.claude/skills/${skillName}/docs`,
      `.codex/skills/${skillName}/SKILL.md`,
      `.codex/skills/${skillName}/docs`,
    );
    if (choices.features.includes("i18n")) {
      gitignoreLines.push(
        `.claude/skills/${skillName}/docs-ja`,
        `.codex/skills/${skillName}/docs-ja`,
      );
    }
    gitignoreLines.push("");
  }

  await fs.outputFile(
    path.join(targetDir, ".gitignore"),
    gitignoreLines.join("\n"),
  );

  // Emit an .npmrc exempting undici-types from pnpm's trust-downgrade policy.
  // External pnpm supply-chain quirk (pnpm >= 10.21, https://github.com/pnpm/pnpm/issues/8889):
  // when a consumer enables `trust-policy=no-downgrade` (off by default, but a
  // common hardened posture), `pnpm install` aborts with ERR_PNPM_TRUST_DOWNGRADE
  // on undici-types@6.21.0 — a transitive dep of @types/node@^22 whose earlier
  // releases carried provenance attestation that 6.21.0 dropped. The package is a
  // type-only stub and safe; this narrow exclusion lets a fresh scaffold install
  // under a strict trust policy without disabling the guard wholesale. Pinned to
  // the exact known-safe version so a future undici-types bump is re-reviewed.
  await fs.outputFile(
    path.join(targetDir, ".npmrc"),
    "trust-policy-exclude[]=undici-types@6.21.0\n",
  );

  // Emit a pnpm-workspace.yaml disabling pnpm 11's minimumReleaseAge gate.
  // pnpm >= 11 defaults minimumReleaseAge to 1440 (1 day), which blocks
  // `pnpm install`/CI from resolving a freshly-published @takazudo bump for
  // a full day; the built-in minimumReleaseAgeExclude matcher can't be
  // pointed at this project's peer-nested lockfile keys (upstream pnpm
  // limitation), so the gate is disabled outright rather than excluded
  // per-package. As of pnpm 11, non-auth/registry settings like this one
  // live in pnpm-workspace.yaml, not .npmrc (.npmrc is auth/registry only).
  // Skipped when an ANCESTOR directory already has a pnpm-workspace.yaml
  // (e.g. scaffolding into `apps/docs/` under an existing pnpm monorepo) —
  // pnpm resolves the nearest pnpm-workspace.yaml upward from cwd as the
  // workspace root, so writing a new one here would carve the generated
  // project out of the parent workspace instead of joining it. Mirrors
  // `initGitRepo`'s "never nest" precedent (see utils.ts).
  if (!hasAncestorPnpmWorkspace(targetDir)) {
    await fs.outputFile(
      path.join(targetDir, "pnpm-workspace.yaml"),
      "# pnpm 11 defaults minimumReleaseAge to 1440min; its exclude matcher can't match this project's peer-nested lockfile keys (upstream pnpm bug), so disable the gate outright.\nminimumReleaseAge: 0\n",
    );
  } else {
    // Ancestor already has a pnpm-workspace.yaml: we deliberately do NOT write
    // our own (it would carve this project out of the parent workspace — see
    // above). But then pnpm applies the PARENT workspace's minimumReleaseAge
    // (1440min by default in pnpm 11), so freshly-published @takazudo bumps
    // still can't install for a day — the exact failure this file guards
    // against. We can't safely edit the parent's config, so instruct the user
    // to disable the gate there instead of silently leaving them blocked.
    console.warn(
      "pnpm-workspace.yaml exists in an ancestor directory — skipping the generated one to avoid nesting a second workspace. If `pnpm install` blocks freshly-published @takazudo releases, add `minimumReleaseAge: 0` to your parent pnpm-workspace.yaml.",
    );
  }

  const claudeContent = generateCLAUDEFile(choices);
  await fs.outputFile(path.join(targetDir, "CLAUDE.md"), claudeContent);

  // 4. Compose features (copy feature files + inject into shared files)
  await composeFeatures(targetDir, choices, featureModules, featuresDir);

  // Ensure content directories exist
  await fs.ensureDir(path.join(targetDir, "src/content/docs"));
}

function generatePackageJson(choices: UserChoices) {
  // Intentionally absent from scaffolded deps:
  //   @takazudo/zudo-doc-md-plugins — the legacy JS remark/rehype pipeline it
  //   would have named was retired outright (packages/md-plugins/ deleted,
  //   #2683); its parity coverage lives in e2e/smoke-markdown-features.spec.ts.
  //   Zero references in generator templates/source.
  const deps: Record<string, string> = {
    // zfb engine — distributed as published npm packages (the prebuilt binary
    // ships via an optionalDependency of @takazudo/zfb-<platform>); pinned to
    // the pre-release the scaffold targets (per #500).
    // The two literals below must match root package.json's
    // dependencies["@takazudo/zfb"] / ["@takazudo/zfb-runtime"] —
    // enforced by scripts/check-pin-parity.mjs (W4A — #1732).
    // Bumped to next.13 in S6 (#1808) — absorbs the next.12 breaking change
    // (4 former-Core features moved to opt-in markdown.features block).
    // Bumped to next.14 (#1817) — fixes the ruby SSR-500 (#1815) and the
    // tocExport indented-export build break (#1814), letting both features
    // be re-enabled in the showcase markdown.features block.
    // Bumped to next.19 (#1824) — next.18 hard-removed the built-in
    // imageEnlarge markdown feature (now re-implemented in userland via an MDX
    // p-override); next.19 adds the islands esbuild react/jsx-runtime→preact
    // alias fix (Takazudo/zudo-front-builder#633) that next.18 lacked.
    // Bumped to next.21 — next.20/next.21 are Rust-engine-internal robustness
    // releases (no SDK API change): dev cold-boot 200, dev watch-ADD discovery
    // of newly-added content files, and bounded waits fixing build/dev hangs.
    // Bumped to next.22 — additive bundler/markdown migration-parity release (no
    // breaking config change): Vite import.meta.glob eager transform, bundle.exclude
    // glob knob, opt-in markdown hardBreaks (default false), and config-eval V8
    // web polyfills + tsconfig path-alias composition fixes.
    // Bumped to next.23 — zfb/config ambient type improvements (BundleConfig +
    // bundle field in ZfbConfig; fixes Takazudo/zudo-front-builder#678).
    // Bumped to next.25 — BREAKING: removes `admonitionsPreset` (configs
    // still setting it hard-error at load). Replaced by the generic
    // `markdown.features.directives` map; host zfb.config.ts migrated
    // in zudolab/zudo-doc#1840.
    // Bumped to next.28 — next.26/next.28 are fix/feature releases (no
    // consumer-facing breaking change): UTF-8 preserved in directive
    // quoted attrs (`:::note{title="日本語"}`), `.mdx` page-source extension
    // stripped from route templates, and embedded-V8 worker console capture
    // so render failures surface `console.*` output. next.27 is unusable
    // for adapter consumers — its tarball omitted emit-worker.mjs
    // (Takazudo/zudo-front-builder#794, fixed in next.28) — so never pin 27.
    // Bumped to next.30 — adds Next.js-style `[[...slug]]` optional-catchall
    // route syntax (Takazudo/zudo-front-builder#812) and raises the zfb-runtime
    // hono floor to ^4.12.23, clearing 9 advisories (#813); also two router
    // hardening fixes (overlapping-sibling rejection #816, per-segment rank
    // sort for dev/prod parity). No consumer-facing breaking change.
    // Bumped to next.31 — CSS-pipeline and islands-scanner fixes (no
    // consumer-facing breaking change): authored-CSS path when Tailwind is
    // disabled, reproducible CSS-Modules scoped names (project-relative paths),
    // dev-mode git-restore detection, Tailwind temp-file cleanup, and a
    // near-miss `"use client"` directive scanner.
    // next.33 added hierarchical heading IDs
    // (Takazudo/zudo-front-builder#871): `markdown.features.headingIds.strategy`.
    // zudo-doc now uses that strategy unconditionally in its package preset.
    // next.35 fixes resolve_links rewriting bare same-page `[text](#anchor)` /
    // `[text](?query)` links to `/<parent-dir>/#anchor` (zudolab/zudo-doc#1948,
    // upstream Takazudo/zudo-front-builder#875).
    // next.38 adds client scripts (`.client.*` + `clientScript()`), the
    // `when="media"` island strategy, exported VNode types, and stricter
    // cross-file anchor validation. BREAKING upstream: the no-op
    // `linkValidation.allowExternal` knob was removed — neither the host nor
    // the generated config ever emitted it, so no migration is needed here.
    // next.39 is features + fixes, no breaking changes:
    // npm-dist `"use client"` island scanning, link-resolution fixes for
    // directory-style hrefs, and island-registry hardening (warns on island
    // marker-name collisions).
    // next.40 flips `zfb dev` to lazy rendering by default —
    // pages render on first request instead of on every file-change tick
    // (Takazudo/zudo-front-builder#1029); `ZFB_DEV_EAGER=1` restores eager
    // mode. Dev-server-only change, no build/config migration needed.
    // next.41 adds a URL-space fallback in resolve_links —
    // dir-style hrefs written from non-index pages now resolve against the
    // page's URL directory when the file-space lookup misses
    // (Takazudo/zudo-front-builder#1030) — and the data-file skip warning
    // (e.g. for `_category_.json`) now respects the collection's
    // include/exclude globs (#1032). No consumer-facing breaking change.
    // next.42/next.43: release-tooling + formatter-glob fixes only (npm-publish
    // idempotency, gitignored-artifact excludes). No consumer-facing change.
    // next.44: embed-as-library enhancements only — ServerBuilder::with_page_cache
    // for live content, an opt-in ExternalInvalidationHook to narrow
    // extraWatchPaths rebuilds, and TS-config-loader path canonicalization
    // (Takazudo/zudo-front-builder#1036–#1043). next.45: docs-only. next.46:
    // opt-in dev boot-lazy mode (#1057) + client-router timer lifecycle fixes —
    // dev-server-only. Historical dual light/dark theme support (themeLight/
    // themeDark on CodeHighlightConfig, --shiki-light/--shiki-dark, #1067) plus
    // stricter build-start validation that rejects unknown theme names. next.48:
    // re-export @takazudo/zfb/config from the zfb-shim.d.ts type shim — type-only
    // fix, additive. next.49: client-router WebKit bfcache fix —
    // re-sync the history index + originalLocation on a bfcache restore so
    // browser Back after an SPA navigation returns to the previous page instead
    // of skipping an entry — runtime-only bug fix, additive. next.50:
    // client-router fix to commit the SPA history entry BEFORE the View
    // Transition, so on WebKit/iOS a single browser Back after an SPA navigation
    // creates a distinct history entry instead of falling off the site —
    // runtime-only bug fix, additive. next.51: additive public-API
    // surface — VNode/VNodeArray/VNodeObject are now exported from
    // "@takazudo/zfb" (#972) — plus removal of the no-op linkValidation.allowExternal
    // knob (#925); both are non-breaking for a fresh scaffold. Highlight config
    // is package-preset-owned: fresh scaffolds delegate to zudoDoc(), whose
    // preset selects class mode without emitting theme names project-side.
    // next.52 adds the
    // `ClientRouter({ preserveHtmlAttrs })` option (zfb#1104) — consumers can
    // declare runtime `<html>` attribute names to preserve across SPA swaps so
    // e.g. `data-sidebar-hidden` / `data-theme` survive (zudolab/zudo-doc#2200).
    // Additive, non-breaking for a fresh scaffold. next.53:
    // zfb-content GFM-autolink fix — terminate the autolink path at CJK
    // boundaries (zfb#1105). Content-rendering bug fix, additive; relevant for
    // CJK (e.g. Japanese) docs. No consumer-facing / CLI breaking change.
    // next.54: bug-fix + perf release — cross-OS CSS hash stability,
    // multi-valued response headers (e.g. multiple Set-Cookie),
    // supplementary-plane CJK reading-time, plus CLI/server/runtime hardening
    // and render perf passes. No consumer-facing / CLI breaking change.
    // next.65: dev-render of package-injected routes (zfb#1227,
    // landed next.63) + islands bundler now seeds the host tsconfig `paths`
    // (e.g. `@/*`) into its synthetic tsconfig (zfb#1238) — fixes silent island
    // hydration failure under route injection. Unblocks packageOwnedRoutes.
    // No consumer-facing / CLI breaking change.
    // next.68: routine toolchain bump from next.67, adopted in
    // lockstep with the root package.json pins. No consumer-facing / CLI change.
    // next.69: routine toolchain bump from next.68, adopted in
    // lockstep with the root package.json pins. No consumer-facing / CLI change.
    // next.70: routine toolchain bump from next.69, re-aligned with the root
    // package.json pins (root was bumped in b5489acf; this scaffold pin lagged
    // at next.69 and broke check-pin-parity). No consumer-facing / CLI change.
    // next.71: routine toolchain bump from next.70, carrying the
    // zfb external-@import hoisting work. No consumer-facing / CLI change.
    // next.72: routine toolchain bump from next.71, adopted in
    // lockstep with the root package.json pins. No consumer-facing / CLI change.
    // next.74: routine toolchain bump from next.72 (next.73
    // skipped), adopted in lockstep with the root package.json pins. No
    // consumer-facing / CLI change.
    // next.75: toolchain bump from next.74 restoring Tailwind
    // class-candidate scanning through symlinked project trees
    // (zudolab/zudo-doc#2511), adopted in lockstep with the root package.json
    // pins. No consumer-facing / CLI change.
    // next.76: routine toolchain bump from next.75, adopted in
    // lockstep with the root package.json pins. No consumer-facing / CLI change.
    // next.77: router persistence/history fixes and runtime island remount
    // support. next.78 added production HTML minification. next.81 added the
    // package-root semantic highlight API plus island resource delivery
    // (zfb#1633/#1643). next.83 completes bundle.exclude dependency staging
    // for package-owned overlay routes (zfb#1645/#1649); next.84 canonicalizes
    // linked package-route identity so SSR shares one framework singleton
    // (zfb#1650/#1651). next.85 also remaps absolute project imports from
    // virtual host modules into the staged project graph, preserving that
    // singleton across host-callable wiring (zfb#1652/#1653). The zfb family
    // must stay in lockstep because the WASM browser entry depends on its
    // resource-aware island pipeline.
    // 1.1.0: container-directive fixes (multi-block bodies, unclosed-opener
    // diagnostics) plus highlighting for fences nested in MDX JSX bodies and
    // directives. Content-rendering fixes, additive.
    "@takazudo/zfb": "1.1.0",
    "@takazudo/zfb-runtime": "1.1.0",
    "@takazudo/zfb-md-wasm": "1.1.0",
    // @takazudo/zudo-doc — published from this monorepo via
    // .github/workflows/publish-zudo-doc.yml. The pin here is bumped in
    // lockstep by scripts/release-create-zudo-doc.sh whenever zudo-doc's
    // version moves, so a fresh scaffold pulls the version we just published.
    // RELEASE DEPENDENCY (zudolab/zudo-doc#2188): the base template's
    // global.css now `@import`s `@takazudo/zudo-doc/content.css`, an export
    // added alongside this pin. The pinned range MUST resolve to a PUBLISHED
    // version that ships that export — published 0.2.9 does NOT. check-pin-parity
    // ties this pin to packages/zudo-doc's version, so the lockstep release
    // bumps both together; do not cut a create-zudo-doc release until the
    // matching @takazudo/zudo-doc version (with content.css) is on npm.
    // ZUDO_DOC_PIN is the shared constant — scaffold() uses the same value
    // to seed .zudo-doc.json so the provenance and the dep can never drift.
    "@takazudo/zudo-doc": ZUDO_DOC_PIN,
    // zod — used by the generated zfb.config.ts. zfb-config-gen emits
    // `import { z } from "zod"` for the content-collection schema +
    // `z.toJSONSchema(...)` conversion. Without this dep, the consumer
    // fails at `zfb build` with esbuild "Could not resolve 'zod'" before
    // any page compiles. The Astro→zfb retarget (3f0042f7) added the
    // import without the runtime dep; W6B (#1735) consumer-build
    // verification was the first to actually exercise it.
    zod: "^4.3.6", // floor matches @takazudo/zudo-doc's peer dep (package.json peerDependencies)
    // ^10.29.1 floor satisfies @takazudo/zdtp's preact peer range so the app
    // and zdtp resolve a single preact instance — a lower floor can split into
    // two copies and crash hook-using SSR islands with "undefined reading __H".
    // See the designTokenPanel dep block below (~line 443) for the coupling.
    preact: "^10.29.1",
    // preact-render-to-string — zfb's emitted entry.mjs imports
    // `renderToString` from this package as `__zfb_renderToString` to
    // SSR each page. Without it, esbuild fails at the bundler step with
    // "Could not resolve 'preact-render-to-string'" before any page
    // compiles. Same pin as host. Caught by W6B (#1735) consumer-build
    // verification.
    "preact-render-to-string": "^6.6.6",
    // katex — server-side LaTeX renderer used by the always-on
    // pages/lib/_math-block.tsx (called from pages/_mdx-components.ts
    // for `$…$` and `$$…$$` math nodes). Caught by W6B (#1735)
    // consumer-build verification — the import lives in the mirrored
    // pages, not behind any feature gate. Same pin as host.
    katex: "^0.16.38",
    // diff — required at build time by EVERY generated project, not just
    // docHistory ones. The always-copied host base template
    // `pages/lib/_doc-history-area.tsx` statically imports the real
    // `DocHistory` from `@takazudo/zudo-doc/doc-history` (to keep zfb's island
    // scanner chain page→stub→DocHistory walkable), which pulls
    // `@takazudo/zudo-doc/dist/doc-history/index.js`'s `await import("diff")`
    // into the bundle. With packageOwnedRoutes default ON (1.0), a
    // docHistory-off project still bundles that path, so without `diff` here
    // `zfb build` fails at esbuild with "Could not resolve 'diff'" (#2342).
    // `diff` is an *optional* peerDependency of @takazudo/zudo-doc, so a
    // missing copy produces no `pnpm install` warning — which is why this gap
    // shipped silently and only surfaced at build time.
    diff: "^8.0.3",
    // @takazudo/zdtp — SAME "unconditional at build time despite being an
    // optional peer" class as `diff` above, discovered empirically while
    // verifying this generator's own barebone (designTokenPanel: OFF) output
    // (epic zudolab/zudo-doc#2651, #2660 self-review — a genuine package-level
    // coupling, not a generator bug; flagged loudly on #2660's completion
    // comment for a package-side follow-up). Since the #2658 gate-2 fix,
    // `chrome/derive.tsx`'s `deriveBodyEndIslands` statically imports the REAL
    // `DesignTokenPanelBootstrap` as the default for EVERY `createChrome`
    // consumer (so the island auto-mounts with zero host wiring when the
    // setting is on) — and that component imports `@takazudo/zdtp` at module
    // scope. So every page that goes through `createChrome` — which is every
    // page in this project — pulls the zdtp import into the esbuild bundle
    // graph, `designTokenPanel` setting or not; only RENDERING is gated on
    // the setting, not the import. Without this dep, `zfb build` fails with
    // "Could not resolve '@takazudo/zdtp'" even on a fully barebone project.
    // `preact ^10.29.1` (see the floor comment above) is required for the
    // same reason. This is the ACCEPTED, permanent contract per #2668 — see
    // the "@takazudo/zdtp dep implication" note in
    // packages/zudo-doc/docs/adr/route-injection-seam.md.
    "@takazudo/zdtp": "0.4.9",
    // (@takazudo/zudo-doc-history-server is NOT here — it is gated on the
    // docHistory feature, see the block below. It was briefly unconditional
    // (#3080) to work around doc-history-area importing its `/exclude` subpath
    // at module scope; that root cause was fixed in #3110 by moving
    // compileExclude into @takazudo/zudo-doc itself, so the workaround is gone
    // and a docHistory-OFF project no longer carries the dep. A package-side
    // reachability guard now prevents the class from returning — see
    // packages/zudo-doc/src/__tests__/optional-peer-reachability.test.ts.)
  };

  const devDeps: Record<string, string> = {
    typescript: "^5.9.0",
    "@types/node": "^22.0.0",
    // REQUIRED — do not remove (verified by experiment, #3165/#3160).
    // tsconfig.base.json sets `jsx: "preserve"`, under which TypeScript ignores
    // the `/** @jsxImportSource preact */` pragma that ejected components carry
    // and falls back to the GLOBAL `JSX` namespace — supplied only by
    // @types/react's global.d.ts. Without it, any project that ejects a component
    // (e.g. `src/components/zudo-doc/theme-toggle/`) fails `zfb check` with
    // TS7026 "no interface 'JSX.IntrinsicElements' exists".
    // (The repo-root copy of this dep IS removable — root .tsx files import
    // `JSX` from preact locally. Do not "unify" the two.)
    "@types/react": "^19.2.0",
    // html-validate dropped — check:html is no longer a default script
    // (see the scripts block below; `.htmlvalidate.json` no longer ships).
  };

  if (choices.features.includes("search")) {
    deps["minisearch"] = "^7.2.0";
    devDeps["pagefind"] = "^1.4.0";
  }

  if (choices.features.includes("docHistory")) {
    // (`diff` remains an unconditional base dep — see the `deps` block above:
    // packageOwnedRoutes always bundles the doc-history-area path, whose
    // module-scope `diff` import is pulled in regardless of this flag. #2342.)
    //
    // @takazudo/zudo-doc-history-server is gated HERE, on the feature, because
    // that is the only graph that actually reaches it: the zfb plugin
    // (@takazudo/zudo-doc/plugins/doc-history) eagerly imports
    // @takazudo/zudo-doc-history-server/git-history at plugin-init time, and the
    // plugin is only wired when docHistory is on (W8A #1739). It is an optional
    // peerDependency of @takazudo/zudo-doc and pnpm does not auto-install peers,
    // so a docHistory-ON project must declare it directly. The pin stays lockstep
    // with the root version (parity-guarded — INTERNAL_PINNED_PACKAGES in
    // scripts/check-pin-parity.mjs, and rewritten at release time by
    // scripts/release-create-zudo-doc.sh step 2d).
    //
    // It was briefly unconditional (#3080) because doc-history-area imported
    // `/exclude` at module scope from the always-bundled chrome graph; #3110
    // moved compileExclude into @takazudo/zudo-doc, so docHistory-OFF projects
    // no longer need the package at all.
    deps["@takazudo/zudo-doc-history-server"] = "^4.5.0";
    // tsx is no longer needed here: the relocated package plugin imports the
    // runner directly (no `tsx -e` spawn) since the package ships compiled
    // dist/ — package-first migration #2321 (#2337).
    // npm-run-all2 provides `run-p`, used by the docHistory `dev` script
    // (below) to run the zfb dev server and the doc-history API server
    // concurrently — otherwise the :4322 proxy target never starts and the
    // feature silently looks broken (#2926). Same maintained fork/pin this
    // monorepo's own root package.json uses.
    devDeps["npm-run-all2"] = "^7.0.2";
  }

  // claudeResources: tsx is no longer needed. The relocated package plugin
  // (@takazudo/zudo-doc/plugins/claude-resources) imports the runner directly
  // since the package ships compiled dist/ — package-first migration #2321 (#2337).

  // check:html and gen:z-index/check:z-index are DROPPED from the default
  // scaffold (locked decision, epic #2651 #2660 work item 6):
  //   - `.htmlvalidate.json` no longer ships — html-validate becomes an
  //     opt-in extend step (documented in #2664).
  //   - z-index tokens ship unconditionally from `@takazudo/zudo-doc/theme.css`
  //     (13 default tiers, epic #2655) — a project only needs its own
  //     `src/config/z-index-tokens.ts` + codegen scripts when it overrides a
  //     tier, which is an eject-time decision, not a scaffold-time one.
  const scripts: Record<string, string> = {
    dev: "zfb dev",
    build: "zfb build",
    preview: "zfb preview",
    check: "zfb check",
  };

  if (choices.features.includes("docHistory")) {
    // A docHistory-enabled project needs the zfb dev server AND the
    // doc-history API server (:4322, proxied by the zfb doc-history plugin)
    // running concurrently — otherwise the Created/Updated/Author block
    // silently never appears in dev (#2926). `doc-history-server` is the bin
    // shipped by the @takazudo/zudo-doc-history-server dep added above;
    // `run-p` (npm-run-all2, added to devDependencies above) runs both.
    scripts.dev = "run-p dev:zfb dev:history";
    scripts["dev:zfb"] = "zfb dev";
    // run-p swallows trailing args and npm-run-all2 v7's `{@}` placeholder
    // strips flag names, so `pnpm dev -- --host 0.0.0.0` is silently ignored
    // (verified in issue #2940) — dev:network is a dedicated LAN-bound script
    // instead. Only zfb binds 0.0.0.0; the history server stays loopback-only
    // and LAN clients reach it through zfb's `/doc-history/*` dev proxy.
    scripts["dev:zfb:network"] = "zfb dev --host 0.0.0.0";
    scripts["dev:network"] = "run-p dev:zfb:network dev:history";
    // Relative --content-dir/--locale paths are resolved by resolveContentPath
    // (packages/doc-history-server/src/args.ts) against INIT_CWD (falling back
    // to process.cwd()) — correct for the supported invocation (`<pm> dev` /
    // `<pm> run dev` from the project root, which is what run-p's child
    // processes inherit). It resolves against the WRONG directory only if this
    // generated project is itself nested inside a larger pnpm/npm workspace
    // and dev:history is invoked via `<pm> --filter <this-package> ...` from
    // that outer workspace root — an unsupported, non-generator invocation
    // path, not the default `<pm> dev`.
    let devHistoryScript =
      "doc-history-server --port 4322 --content-dir src/content/docs";
    if (choices.features.includes("i18n")) {
      const secondaryLang = getSecondaryLang(choices.defaultLang);
      devHistoryScript += ` --locale ${secondaryLang}:src/content/docs-${secondaryLang}`;
    }
    scripts["dev:history"] = devHistoryScript;
  }

  if (choices.features.includes("tagGovernance")) {
    // Both package-owned bins load the same explicit project config. `--`
    // supplied by pnpm/npm is preserved by the runners for forwarded options.
    scripts["tags:audit"] =
      "tags-audit --config src/config/tag-vocabulary.ts";
    scripts["tags:suggest"] =
      "tags-suggest --config src/config/tag-vocabulary.ts";
  }

  if (choices.features.includes("skillSymlinker")) {
    // Deliberately omit --no-link-tracked-skills here: automatic tracked-skill
    // linking (#3152) is the intended default for generated projects. Only the
    // zudo-doc monorepo's own root package.json passes the opt-out, because it
    // has 20 directories under `.claude/skills/` and a blanket loop would export
    // 19 project-specific skills into the maintainer's global skills dir (#3157).
    scripts["setup:doc-skill"] = "bash scripts/setup-doc-skill.sh";
    scripts["setup:doc-skill-silent"] =
      "bash scripts/setup-doc-skill.sh --silent";
    scripts["setup:doc-skill:claude"] =
      "bash scripts/setup-doc-skill.sh --target claude";
    scripts["setup:doc-skill:codex"] =
      "bash scripts/setup-doc-skill.sh --target codex";
    scripts["setup:doc-skill:both"] =
      "bash scripts/setup-doc-skill.sh --target both";
  }

  const pm = choices.packageManager;

  // claudeSkills ships the zudo-doc-version-bump skill, whose release workflow
  // calls `<pm> b4push`. Emit a minimal stub so the skill does not hit a
  // "script not found" error on freshly scaffolded projects. Consumers are
  // free to expand this into a richer pre-push pipeline later.
  if (choices.features.includes("claudeSkills")) {
    scripts["b4push"] = `${pmRunCommand(pm, "check")} && ${pmRunCommand(pm, "build")}`;
  }

  if (choices.features.includes("tauri")) {
    scripts["dev:tauri"] = "cargo tauri dev";
    scripts["build:tauri"] = `${pmRunCommand(pm, "build")} && cargo tauri build`;
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
    // @takazudo/zfb + @takazudo/zfb-runtime declare engines.node ">=22.0.0";
    // emit the floor so `<pm> install` warns early on an unsupported Node.
    engines: { node: ">=22" },
    scripts,
    dependencies: deps,
    devDependencies: devDeps,
  };
}
