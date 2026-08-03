# zudo-doc

Minimal documentation framework built with zfb, MDX, Tailwind CSS v4, and Preact islands.

The current repository contract targets zfb exclusively.

Setup on a new machine and the local-zfb/zdtp escape hatch live in `CONTRIBUTING.md`.

## Tech Stack

- **zfb** (`@takazudo/zfb`) — static site generator with MDX content collections, file-routed `pages/`, and a built-in dev/build/preview/check CLI
- **MDX** — authored under `src/content/`, content directory configurable via the `docsDir` setting; pipeline configured in `zfb.config.ts`
- **Tailwind CSS v4** — compiled by zfb's embedded Tailwind engine; `@import "tailwindcss/preflight"` / `"tailwindcss/utilities"` in `src/styles/global.css` are intercepted by zfb's internal resolver and never reach `node_modules`, so neither `tailwindcss` nor `@tailwindcss/vite` is a dependency of this project
- **Preact** — for interactive islands (TOC scroll spy, sidebar toggle, collapsible categories) and server-rendered content typography components; runs in compat mode for React API compatibility
- **zfb semantic highlighting** — document fences use zfb's native build-time renderer; HtmlPreview lazily imports the public `@takazudo/zfb-md-wasm` root for browser-time HTML/CSS/JavaScript. Both emit `pre.hi-root` / `hi-*` classes and resolve through `--zd-syntax-*` design tokens. Do not add Shiki, theme-name config, inline token colors, or package-internal WASM paths.
- **@takazudo/zdtp (zdtp)** — external npm package that owns the Design Token Panel UI; the package-owned `DesignTokenPanelBootstrap` island configures it from a mode-scoped builder and self-mounts it as a side effect
- **TypeScript** — strict mode via `@takazudo/zudo-doc/tsconfig.base.json`, which the project `tsconfig.json` extends. The project file adds exactly one extra compiler flag of its own, `noUncheckedIndexedAccess`, plus `include`/`exclude`/`baseUrl`/`paths` (`exclude` drops `src/**/__tests__`; the `paths` block is required, not cosmetic — see the GOTCHA in `packages/zudo-doc/CLAUDE.md`).

## Commands

- `pnpm dev` — runs zfb dev (port 4321), doc-history-server (port 4322), a `.claude/` watcher, and `@takazudo/zudo-doc`'s own paired JS + declarations watchers concurrently via `run-p`; edits to `.claude/` files regenerate the corresponding MDX live, and edits to `packages/zudo-doc/src/**` auto-rebuild `dist/` so zfb HMR picks them up. If a previous dev process is still bound to 4321 / 4322, the new launch fails fast with `EADDRINUSE` — kill it manually before retrying (e.g. `lsof -ti :4321 -ti :4322 | xargs -r kill`, after confirming the matched PIDs are actually yours). A hook used to do this automatically; it was removed because matching by port alone meant `pnpm dev` would silently kill unrelated apps on the same port (4321 is the Vite default) — do not re-add one. **A fatal exit in any one of those processes tears down all of them** — for why, the inotify `EMFILE`-vs-`ENOSPC` distinction, and why `--continue-on-error` is the wrong remedy, see the `#3129` section in `packages/zudo-doc/CLAUDE.md`.
- `pnpm dev:zfb` — zfb dev server only (port 4321)
- `pnpm dev:history` — doc history API server only (port 4322)
- `pnpm dev:zudo-doc` — `@takazudo/zudo-doc`'s watchers only: tsup `--watch` for the JS plus `tsc -p tsconfig.build.json --watch` for the `.d.ts`, run in parallel (#3113); host imports resolve through `dist/` because the package now ships compiled JS (W8 Blocker-2 fix — Node 24 rejects raw `.ts` in `node_modules`, so the package's source is private and dist is the API surface)
- `pnpm dev:stable` — alternative build-then-serve dev mode (avoids HMR crashes on content file add/remove)
- `pnpm dev:network` — zfb dev with `--host 0.0.0.0` for LAN access
- `pnpm build` — static HTML export to `dist/` (runs `zfb build`)
- `pnpm preview` — serve the built `dist/` (runs `zfb preview`)
- `pnpm check` — type checking (runs `zfb check`, which delegates to `tsc --noEmit`)
- `pnpm b4push` — pre-push validation: 24-step suite (format check → template drift → no-host-alias guard → pin parity → fixture drift → tags audit → current-only compatibility contract → token lint → component-tokens drift → e2e spec naming guard → @flaky tracking-issue guard → wait-debt guard → b4push/CI parity → typecheck → Worker contract proof → root unit tests → package tests → safelist check → build → content-fallback allowlist scan → link check → html validation → preview smoke → manual smoke); each step's elapsed time is recorded and printed as a breakdown in the final summary. The content-fallback step (`scripts/check-content-fallback.mjs`) is the **allowlist-gated** half of the content-bridge guard — the **non-allowlisted** half, `strictContentBridge: true` in `zfb.config.ts`, fails plain `pnpm build`/CI directly and never runs as a b4push step; see the script's header for why both exist. Playwright E2E runs in CI (pr-checks e2e job) and is intentionally excluded from b4push for time-budget reasons — see `TESTING.md` for the full tier rationale
- `pnpm test` — unified test entry point: runs `build:workspace` (a full rebuild of both workspace packages) then root unit tests (`test:unit`) and workspace package tests (`test:packages`); does not include e2e
- `pnpm build:workspace` — force-rebuild the workspace packages consumers compile against, in dependency order: `@takazudo/zudo-doc-history-server` then `@takazudo/zudo-doc`
- `pnpm ensure:workspace-build` — the same list, but builds only what is *missing*; a no-op on a warm tree

### Workspace build prerequisite (#3053)

`dev`, `build`, `check`, `check:pages`, `test:unit`, and `test:packages` each run `ensure:workspace-build` first (b4push runs it as a preflight), so an `--ignore-scripts` tree self-heals. Two facts that cost real debugging time if forgotten:

- **Order is mandatory.** `@takazudo/zudo-doc`'s `tsc` pass needs `@takazudo/zudo-doc-history-server`'s declarations (`pre-build.ts` imports its `git-history` subpath), so building `zudo-doc` alone on a cold tree fails with TS2307. `scripts/ensure-workspace-build.mjs` owns that order.
- **The guard checks existence, not freshness** — it never rebuilds a stale `dist/`, so a deleted or renamed source file leaves a stale artifact it happily accepts. Run `pnpm build:workspace` after a delete, rename, or `exports`-map removal.

**Don't run `pnpm test`, `pnpm build:workspace`, or `pnpm b4push` while `pnpm dev` is live** — those rebuild unconditionally and would write `dist/` under the watchers. `pnpm check` is safe alongside `pnpm dev`. The #3113 `clean: !options.watch` history is in `packages/zudo-doc/CLAUDE.md`.

## Automation

These run automatically — be aware when working in this repo:

- **lefthook pre-commit** (`lefthook.yml`): on commit, staged `*.md` and `*.mdx` files are formatted with `@takazudo/mdx-formatter` and re-added. You do not need to manually `pnpm format` markdown before committing.
- **prepare**: `pnpm install` runs `lefthook install` and `scripts/install-git-hooks.sh` (the worktree push-guard hook). zfb and zdtp come straight from npm — there is no link/build postinstall step anymore.

## Worktree push policy (enforced)

This repo uses `/x-wt-teams` for multi-topic development. Child agents work in git worktrees under `worktrees/`. **Pushing from a worktree is forbidden.** Only the manager session — running from the main repo at the repo root — pushes, after merging topic branches into the base branch locally.

### Why

- CI runs on every push. Children pushing pre-empt the manager's merge + review step, multiplying CI cost across intermediate state.
- Topic branches in `worktrees/*/` are intermediate by design — they shouldn't appear as standalone PRs unless the manager creates them.

### How it's enforced

`.git/hooks/pre-push` is a direct script (not managed via `lefthook.yml`) that blocks any push from a git worktree. It is auto-installed by `pnpm install` (via the `prepare` lifecycle script) and can be re-installed manually with:

```sh
pnpm init-worktree
```

The installer source lives at `scripts/install-git-hooks.sh`; the hook itself at `scripts/hooks/pre-push`.

### Emergency bypass (human use)

```sh
ALLOW_WORKTREE_PUSH=1 git push ...
```

Use only when you genuinely need to push from a worktree (rare). Never set this in agent prompts.

### Guidance for agents

- **Child agents working in `worktrees/*/`:** commit locally only. Pushing will fail with the message above — do not retry, do not invoke the bypass. Report back to the manager with the branch name and commit SHAs; the manager merges and pushes from the main repo.
- **`/x-wt-teams` manager session:** the hook does not affect you. Your `git push` runs from the main repo (the cwd is the repo root, not `worktrees/...`). After every wave's local merges, push as usual. Do not pass `ALLOW_WORKTREE_PUSH` to children.

## Key Directories

Package-first migration (epic #2321) + the minimal-scaffold cutover (epic #2651) moved engine plugins, chrome/routes/islands, and most host wiring into `@takazudo/zudo-doc`. **There is no root-level `plugins/` directory** — plugins resolve as `@takazudo/zudo-doc/plugins/*` bare specifiers. Most of what a *fresh* `create-zudo-doc` scaffold ships lives in `node_modules`, not the project tree; the entries marked SHOWCASE below exist here because this repo demonstrates every feature with real data, and a fresh scaffold has none of them.

```
zfb.config.ts             # The ONE config entry — zudoDoc({ ...settings, chromeBindingsModule })
                          # (@takazudo/zudo-doc/config). Collections/plugins/markdown logic is
                          # package-owned via zudoDocPreset(), which zudoDoc() calls.
pages/                    # File-routed pages (.tsx): docs/, [locale]/docs/, v/ (versioned), api/
└── lib/                  # SHOWCASE host bindings (SearchWidget, DocHistory data, frontmatter
                          # renderers, …), threaded in via src/chrome-bindings.tsx
packages/
├── search-worker/        # CF Worker search API (opt-in; the showcase does not deploy it)
├── doc-history-server/   # Doc history REST API + CLI generator
├── zudo-doc/             # Shared layout + integration package — owns chrome/routes/islands/plugins/preset
└── create-zudo-doc/      # CLI scaffold tool — emits the locked ~17-file minimal manifest
src/
├── chrome-bindings.tsx   # SHOWCASE ChromeHostBindings impl, wired via chromeBindingsModule
├── components/           # SHOWCASE client islands: client-router-bootstrap, preset-generator
├── config/               # SHOWCASE settings, tag vocabulary, sidebars, i18n, contrast utils,
│                         # frontmatter preview renderers (color schemes moved to the package)
├── content/{docs,docs-ja}/  # English + Japanese MDX content (JA mirrors EN)
├── lib/                  # SHOWCASE island logic (preset-generator-logic.ts)
├── types/                # SHOWCASE types + ambient decls (locale.ts, doc-history-meta.d.ts)
├── utils/                # SHOWCASE helpers (base.ts, docs.ts, tags.ts)
└── styles/global.css     # @theme tokens, feature styles, slots; @imports the shared
                          # @takazudo/zudo-doc/theme.css + content.css
```

`chromeBindingsModule` is the supported callable/markup seam for package-owned chrome. `defineChromeBindings` accepts partial objects (omitted slots keep package defaults); its six primary replacement keys are `Header`, `Footer`, `Sidebar`, `Toc`, `Breadcrumb`, `DocPager`, and serializable custom `headerRightItems` names resolve through `headerRightComponents`. Do not add a legacy host DesignTokenPanel override or resurrect removed public aliases. Full contract: `packages/zudo-doc/CLAUDE.md`.

## Content Collections

- Schema ships from the package (`@takazudo/zudo-doc/docs-schema`, Zod validation) and is wired by `zudoDocPreset()`. `zfb.config.ts` deliberately OMITS `buildDocsSchema` — override it there only when the showcase genuinely needs to diverge.
- Loaded via zfb's MDX content pipeline with a configurable `base` directory from settings
- Content directories: `docsDir` (default: `src/content/docs`) for the default locale; every other locale declares its own `dir` under `locales` (this showcase: `locales.ja.dir = "src/content/docs-ja"`)

## Terminology: "Update docs"

When we say "update docs" or "update our doc," it means updating the **showcase documentation** content in `src/content/docs/` (English) and `src/content/docs-ja/` (Japanese). Since zudo-doc is a documentation framework, its own content directories serve as the default showcase. These are the pages visible when running `pnpm dev`.

## i18n

- English (default): `/docs/...` — content in `docsDir` (`src/content/docs`)
- Japanese: `/ja/docs/...` — content in `locales.ja.dir` (`src/content/docs-ja`)
- The **default locale is served unprefixed** — that falls out of `defaultLocale: "en"` plus the route split in `pages/` (`pages/docs/[[...slug]].tsx` vs `pages/[locale]/docs/[[...slug]].tsx`). There is no `prefixDefaultLocale` option; don't look for one.
- **Bilingual rule**: when creating or updating any doc page, update both EN and JA versions. Detailed exceptions and the content-writing workflow live in `src/content/CLAUDE.md` (auto-loaded when working on content).

## Doc Skill (setup-doc-skill)

The doc-skill (`scripts/setup-doc-skill.sh`) generates `.claude/skills/<name>/SKILL.md` and symlinks docs into it. It is gitignored — do NOT track the generated SKILL.md in git. Run `pnpm setup:doc-skill` to regenerate. To update the skill template, edit `scripts/setup-doc-skill.sh`.

This script is also the **source template** copied to downstream projects by `create-zudo-doc` when the `skillSymlinker` feature is enabled.

## Doc History Architecture

Document git history is handled by a standalone package `@takazudo/zudo-doc-history-server` (at `packages/doc-history-server/`), intentionally decoupled from the main build pipeline so expensive `git log --follow` calls do not block it. Two modes:

- **Server mode** (local dev) — HTTP server on port 4322, started by `pnpm dev:history`. The zfb plugin at `packages/zudo-doc/src/plugins/internal/doc-history/index.ts` proxies `/doc-history/*` requests to it.
- **CLI mode** (CI) — batch-generates JSON files into `dist/doc-history/`. Used by the `build-history` CI job in parallel with the main site build.

### postBuild JSON: the env-var decision table

Two artifacts, gated differently. The **preBuild** Created/Updated/Author manifest (the visible per-page metadata block) is gated by `SKIP_DOC_HISTORY` alone — set `SKIP_DOC_HISTORY=1` and the plugin writes an empty manifest (`{}`), making that block absent from every SSG page; use it only when intentionally bypassing git-based meta generation (a truly shallow clone, a custom CI variant).

The **postBuild** step (per-page history-dropdown JSON in `dist/doc-history/`) is **skipped by default on local builds**, opt-in via `GEN_DOC_HISTORY=1` (#1986). It defaults off because it runs one `git log --follow` chain per content file, which on a large corpus exceeds zfb's 120s postBuild lifecycle-hook budget and fails a plain `pnpm build` — and the JSON is redundant locally anyway (dev reads it live from `:4322`; CI generates it in the parallel `build-history` job). The table (in `runDocHistoryPostBuild` / `shouldGeneratePostBuild`):

- `SKIP_DOC_HISTORY=1` → never generate (wins over everything).
- `DOC_HISTORY_SKIP_POSTBUILD=1` → never generate (wins over `GEN_DOC_HISTORY` and CI, loses only to `SKIP_DOC_HISTORY`).
- `GEN_DOC_HISTORY=1` → generate (local opt-in — e.g. before `pnpm preview` of a locally-built `dist/`).
- CI (`CI` / `GITHUB_ACTIONS`) → generate (keeps the CI build-site artifact identical; the async generator stays within budget).
- otherwise (plain local build) → skip.

`DOC_HISTORY_SKIP_POSTBUILD=1` therefore skips **only** the dropdown JSON, leaving preBuild metadata intact — for a shallow-clone CI variant that keeps enough git history for the cheap preBuild walk but opts out of the heavier chain (#2927). Its name deliberately avoids the substring `SKIP_DOC_HISTORY` so `scripts/check-compatibility-contract.ts`'s literal survivor scan for that marker needs no allowlist update.

## CI Pipeline

All three workflows (`main-deploy.yml`, `pr-checks.yml`, `preview-deploy.yml`) use parallel build jobs:

- **build-site** — full clone (`fetch-depth: 0`), `pnpm build` — preBuild populates `.zfb/doc-history-meta.json` with real git dates so the SSG HTML contains the visible Created/Updated/Author block
- **build-history** — full clone (`fetch-depth: 0`), `@takazudo/zudo-doc-history-server generate` — generates per-page dropdown JSON files for the DocHistory island
- **deploy/preview** — merges both artifacts, deploys via `wrangler deploy` to Cloudflare Workers static assets at `zudo-doc.takazudomodular.com`

E2E tests also run with full clone (no `SKIP_DOC_HISTORY`).

## Workers Cutover Runbook

One-time Cloudflare operator setup (KV namespace, secrets, the `AiChatDailySpendCap` Durable Object migration, `DOCS_SITE_URL`, custom domain) is **already done** for this project. The runbook, its `IP_HASH_SECRET` rotation caveat, and the preview-vs-Durable-Objects note live in `docs/ops/workers-cutover.md` — read it before a fresh cutover or a Cloudflare account change.

## Feature Change Checklist

**This is the ONE canonical ordering.** `packages/create-zudo-doc/CLAUDE.md` points here
rather than keeping a second copy — do not re-fork it.

Since the minimal-scaffold cutover (epic zudolab/zudo-doc#2651), a feature's field census lives in ONE place (`packages/zudo-doc/src/config.ts`) and a generated project's config is a SINGLE file (`zfb.config.ts`, diff-from-defaults `zudoDoc({...})`). The old `settings-gen.ts` + `zfb-config-gen.ts` two-file split, and the per-project `src/config/settings.ts` a fresh scaffold used to ship, are both gone from the generator's output — this repo's own showcase still has a real `src/config/settings.ts` (spread into `zudoDoc({...settings})`) because it demonstrates every feature with real data, but that's a showcase choice, not something a fresh scaffold gets. When adding or removing a feature from zudo-doc, update these in order:

1. **`packages/zudo-doc/src/config.ts`** — Add/remove the field on `ZudoDocConfig` (with a `@default` JSDoc — enforced by `config-jsdoc.test.ts`) and `DEFAULT_SETTINGS`. This is the ONE census every other step reads against.
2. **`packages/zudo-doc/src/preset.ts`** — If the feature introduces a new plugin or collection, update `zudoDocPreset()` to wire it from the settings field you just added. `zudoDoc()` (step 1's `config.ts`) calls this internally — a generated project's `zfb.config.ts` never wires plugins directly.
3. **`packages/create-zudo-doc/src/zfb-config-gen.ts`** — Add/remove the field in `DEFAULT_MIRROR` (a hand-kept local copy of step 1's `DEFAULT_SETTINGS` — the generator can't `import` the package, see the file's header comment) + `buildDesiredConfig()` (user-choice → field mapping) + `FIELD_ORDER` (cosmetic emission order).
4. **`packages/create-zudo-doc/src/features/<name>.ts`** — Create/update the feature module. Register a new module in `packages/create-zudo-doc/src/features/index.ts` (or, for the scaffold.ts-handled features `skillSymlinker`/`claudeSkills`/`changelog`, in `scaffold.ts`). Most features need ONLY step 3's field mapping (leave `injections: []`, no `postProcess`) — only add a `postProcess` patch or `templates/features/<name>/files/` copy if the feature genuinely has no package-owned equivalent (rare; see `docHistory`/`designTokenPanel`/`tagGovernance`/`tauri`/`tauriDev` for the current examples and why each one needs it). Also add the feature to `FEATURES` in `packages/create-zudo-doc/src/constants.ts` if it needs a CLI flag.
5. **`packages/create-zudo-doc/templates/features/<name>/files/`** — Add/remove feature-specific files, only when there's a genuine gap. Most features ship zero files; the only four with a template directory are `claudeSkills`, `i18n`, `tauri`, and `tauriDev`. (`tagGovernance` has **no** template dir — it writes `src/config/tag-vocabulary.ts` inline from its `postProcess`.)
6. **`packages/create-zudo-doc/src/scaffold.ts`** — Add/remove dependencies in `generatePackageJson()`.
7. **`packages/create-zudo-doc/src/__tests__/scaffold.test.ts`** — Update the manifest-shape assertions (`BAREBONE_MANIFEST`/`ALL_FEATURES`/`NEVER_RESURRECTED`) and the settings-drift guard.
8. **This repo's own `src/config/settings.ts`** — Add/remove the field so the showcase demonstrates it (optional relative to the generator, but keep it in sync so the showcase stays a faithful reference).
9. Run `/l-update-generator` to verify no drift remains.

**Template counterpart rule**: this checklist also applies to incremental improvements (CSS token migrations, icon sizing, spacing changes, etc.) — not just new features. The rule now covers far fewer files than before the minimal-scaffold cutover: only the ~5 files in `packages/create-zudo-doc/templates/base/` (`pages/index.tsx`, `pages/docs/[[...slug]].tsx`, `src/styles/global.css`, `tsconfig.json`, `scripts/setup-doc-skill.sh`) have a showcase counterpart to keep in sync — if you change one of the showcase's matching files, update the template too. Run `pnpm check:template-drift` to verify (allowlisted files in `.template-drift-allowlist` — `global.css`, `tsconfig.json`, `pages/index.tsx`, the two doc-route stubs, and the `tauri` feature's orphaned find-in-page files — are excluded from the automated whole-file check and need manual review instead).

**e2e fixture sync**: adding a field to `src/config/settings.ts` also requires mirroring it into all five `e2e/fixtures/*/src/config/settings.ts` files — or adding an allowlist entry in `.fixture-settings-drift-allowlist` with a `# reason:` comment. This is enforced in CI by the `Fixture Settings Drift Check` job (`scripts/check-fixture-settings-drift.mjs`). The check's `CANONICAL_PATH` deliberately stays `src/config/settings.ts`, not `zfb.config.ts` — every fixture's (and the host's) `zfb.config.ts` is a byte-identical `zudoDoc({ ...settings, chromeBindingsModule, ... })` shell carrying no field names, so `settings.ts` remains the only place individual field names appear as literal keys to diff.

**Content typography (`.zd-content`) is NOT per-project — it ships once from
`packages/zudo-doc/src/content.css`.** Never re-inline `.zd-content` rules into any
`global.css`. Canonical rules (consumer contract, import order, rebuild duty) are in
`packages/zudo-doc/CLAUDE.md#shipped-css-artifacts-five`. Note the propagation lag:
generated projects only pick up a `content.css` change after a new `@takazudo/zudo-doc`
is published and `create-zudo-doc`'s pinned dependency is bumped (the lockstep release
handles this).

## Testing

See `TESTING.md` (repo root) for the full testing strategy — levels (L1 vitest through L6 test-flow skills), tiers (T0 local fast pass / T1 CI gates / T3 nightly exam), tag taxonomy (`@flaky` quarantine rules), retry budgets, anti-gaming rules, and wait-pattern rules.

## Directory-scoped CLAUDE.md files

These auto-load when working in the corresponding directory — read them when relevant work is in scope:

- `src/CLAUDE.md` — components, design tokens, three-tier color/font-size strategy, CSS rules
- `src/config/CLAUDE.md` — tag vocabulary and tag governance
- `src/content/CLAUDE.md` — doc-writing rules (frontmatter, admonitions, linking, bilingual workflow)
- `e2e/CLAUDE.md` — Playwright fixture architecture and how-to (policy in TESTING.md)
- `src-tauri/CLAUDE.md` — the two Tauri apps (Mode 1 offline reader, Mode 2 dev wrapper) and their build prerequisites
- `packages/*/CLAUDE.md` — per-package architecture notes (workers, generator, doc-history-server)
