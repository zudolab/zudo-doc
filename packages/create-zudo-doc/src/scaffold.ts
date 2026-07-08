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
 * Pinned `@takazudo/zudo-doc` version used in both `generatePackageJson()`
 * and the `.zudo-doc.json` seed written by `scaffold()`. Hoisted as a shared
 * constant so the dep pin and the provenance seed can never drift.
 *
 * Strip the caret from this string to get the bare version for provenance:
 *   ZUDO_DOC_PIN.replace(/^\^/, "")   →  "1.0.0"
 *
 * Bumped in lockstep by scripts/release-create-zudo-doc.sh.
 */
export const ZUDO_DOC_PIN = "^3.0.0";

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

- Node.js 18 or later
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

- Node.js 18 以降
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

  // Seed .zudo-doc.json — provenance marker for `zudo-doc eject <component>`.
  // packageVersion is the bare version string (caret stripped from ZUDO_DOC_PIN)
  // so it records the concrete version the scaffold targets; the eject CLI
  // records the actually-installed version on first eject.
  await fs.outputFile(
    path.join(targetDir, ".zudo-doc.json"),
    JSON.stringify(
      {
        packageVersion: ZUDO_DOC_PIN.replace(/^\^/, ""),
        ejected: {},
      },
      null,
      2,
    ) + "\n",
  );

  const gitignoreLines = [
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
    "# zudo-doc build artifact (routes-src/ staged here at build time)",
    ".zudo-doc/",
    "",
  ];

  // The doc-lookup skill is only generated when skillSymlinker is selected
  // (the setup-doc-skill.sh script and `setup:doc-skill` npm script are gated
  // on the same feature above), so only emit its ignore entries then —
  // otherwise they would be dead rules that could silently hide an unrelated
  // skill a user later installs under a matching name. The skill name is
  // deterministic (always `<projectName>-wisdom`, matching DEFAULT_SKILL_NAME
  // in scripts/setup-doc-skill.sh and the package name), so these entries match
  // the directory the script creates. The setup script can target either
  // .claude or .codex, so ignore both possible generated directories. The
  // docs-ja symlink only exists for i18n projects (the script creates it
  // conditionally), so gate those lines on i18n.
  if (choices.features.includes("skillSymlinker")) {
    gitignoreLines.push(
      "# Generated doc-lookup skill",
      `.claude/skills/${choices.projectName}-wisdom/SKILL.md`,
      `.claude/skills/${choices.projectName}-wisdom/docs`,
      `.codex/skills/${choices.projectName}-wisdom/SKILL.md`,
      `.codex/skills/${choices.projectName}-wisdom/docs`,
    );
    if (choices.features.includes("i18n")) {
      gitignoreLines.push(
        `.claude/skills/${choices.projectName}-wisdom/docs-ja`,
        `.codex/skills/${choices.projectName}-wisdom/docs-ja`,
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

  const claudeContent = generateCLAUDEFile(choices);
  await fs.outputFile(path.join(targetDir, "CLAUDE.md"), claudeContent);

  // 4. Compose features (copy feature files + inject into shared files)
  await composeFeatures(targetDir, choices, featureModules, featuresDir);

  // Ensure content directories exist
  await fs.ensureDir(path.join(targetDir, "src/content/docs"));
}

function generatePackageJson(choices: UserChoices) {
  // Intentionally absent from scaffolded deps:
  //   @takazudo/zudo-doc-md-plugins — private fixture/parity-test asset; not published,
  //   not for app import. Zero references in generator templates/source.
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
    // next.33 added the opt-in hierarchical heading-ID strategy
    // (Takazudo/zudo-front-builder#871): `markdown.features.headingIds.strategy`.
    // The generated config + TOC builder use it via settings.headingIdStrategy.
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
    // dev-server-only. next.47: dual light/dark syntect themes (themeLight/
    // themeDark on CodeHighlightConfig, --shiki-light/--shiki-dark, #1067) plus
    // stricter build-start validation that rejects unknown theme names. next.48:
    // re-export @takazudo/zfb/config from the zfb-shim.d.ts type shim — type-only
    // fix, additive. next.49: client-router WebKit bfcache fix —
    // re-sync the history index + originalLocation on a bfcache restore so
    // browser Back after an SPA navigation returns to the previous page instead
    // of skipping an entry — runtime-only bug fix, additive. next.50 (current
    // pin): client-router fix to commit the SPA history entry BEFORE the View
    // Transition, so on WebKit/iOS a single browser Back after an SPA navigation
    // creates a distinct history entry instead of falling off the site —
    // runtime-only bug fix, additive. next.51 (current pin): additive public-API
    // surface — VNode/VNodeArray/VNodeObject are now exported from
    // "@takazudo/zfb" (#972) — plus removal of the no-op linkValidation.allowExternal
    // knob (#925); both are non-breaking for a fresh scaffold. A fresh scaffold
    // sets codeHighlight.themeLight/themeDark for dual-theme syntect output. No
    // consumer-facing / CLI breaking change. next.52: adds the
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
    // next.77 (current pin): router persistence/history fixes and runtime
    // island remount support, adopted in lockstep with the root package.json
    // pins. No scaffold API change.
    "@takazudo/zfb": "0.1.0-next.77",
    "@takazudo/zfb-runtime": "0.1.0-next.77",
    // zfb-adapter-cloudflare — required for any route with `prerender = false`.
    // Pinned in lockstep with @takazudo/zfb.
    "@takazudo/zfb-adapter-cloudflare": "0.1.0-next.77",
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
    shiki: "^4.0.2",
    "@shikijs/transformers": "^4.0.0",
    "gray-matter": "^4.0.0",
    mermaid: "^11.12.3",
    "remark-cjk-friendly": "^2.0.1",
    "remark-directive": "^3.0.0",
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
  };

  const devDeps: Record<string, string> = {
    "@tailwindcss/vite": "^4.2.0",
    tailwindcss: "^4.2.0",

    typescript: "^5.9.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0", // needed for preact/compat type resolution
    "html-validate": "^10.0.0",
  };

  if (choices.features.includes("search")) {
    deps["minisearch"] = "^7.2.0";
    devDeps["pagefind"] = "^1.4.0";
  }

  if (choices.features.includes("docHistory")) {
    // (diff is now an unconditional base dep — see the `deps` block above:
    // packageOwnedRoutes always bundles the doc-history-area path, so diff is
    // required regardless of this feature flag.)
    // @takazudo/zudo-doc has @takazudo/zudo-doc-history-server as an optional
    // peer dep. When docHistory is selected the zfb plugin
    // (@takazudo/zudo-doc/plugins/doc-history) eagerly imports
    // @takazudo/zudo-doc/integrations/doc-history which in turn imports
    // @takazudo/zudo-doc-history-server/git-history. Without this dep the
    // plugin host fails at init with ERR_MODULE_NOT_FOUND — W8A (#1739).
    deps["@takazudo/zudo-doc-history-server"] = "^3.0.0";
    // tsx is no longer needed here: the relocated package plugin imports the
    // runner directly (no `tsx -e` spawn) since the package ships compiled
    // dist/ — package-first migration #2321 (#2337).
  }

  // claudeResources: tsx is no longer needed. The relocated package plugin
  // (@takazudo/zudo-doc/plugins/claude-resources) imports the runner directly
  // since the package ships compiled dist/ — package-first migration #2321 (#2337).

  if (choices.features.includes("designTokenPanel")) {
    // @takazudo/zdtp requires preact >= 10.29.1 — see the preact floor comment
    // above (~line 382) for why the floor is set there and the coupling this creates.
    deps["@takazudo/zdtp"] = "0.4.5";
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
    // NOTE: no `check:pages` here — the host repo's pages/ typecheck
    // (tsconfig.pages.json, #2018) is host-only for now. The base template's
    // no-op feature stubs (e.g. doc-history.tsx) are not type-clean against
    // the pages/lib call sites, so emitting the script would fail on a fresh
    // scaffold. Revisit once the template stubs carry typed props.
    "check:html": "html-validate \"dist/**/*.html\"",
    // Z-index token codegen (#2148): regenerate the GENERATED:Z_INDEX @theme
    // block in src/styles/global.css from src/config/z-index-tokens.ts, and a
    // drift check for pre-push/CI. Both ship in base — the z-index token system
    // is part of every scaffold. Bin provided by @takazudo/zudo-doc (S9b #2334).
    "gen:z-index": "gen-z-index",
    "check:z-index": "gen-z-index --check",
  };

  if (choices.features.includes("tagGovernance")) {
    // tags-audit bin is provided by @takazudo/zudo-doc (S9b #2334);
    // tsx is still required as a devDep because the bin's runner imports
    // the project's TypeScript config files at runtime via tsx.
    scripts["tags:audit"] = "tags-audit";
    scripts["tags:suggest"] = "tsx scripts/tags-suggest.ts";
  }

  if (choices.features.includes("skillSymlinker")) {
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
