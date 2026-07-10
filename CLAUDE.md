# zudo-doc

Minimal documentation framework built with zfb, MDX, Tailwind CSS v4, and Preact islands.

(Originally built on Astro 6; migrated to zfb in epic zudolab/zudo-doc#1333. Some historical references to Astro tooling may still surface in long-form prose elsewhere — they describe legacy state, not the current authoring target.)

## Tech Stack

- **zfb** (`@takazudo/zfb`) — static site generator with MDX content collections, file-routed `pages/`, and a built-in dev/build/preview/check CLI
- **MDX** — authored under `src/content/`, content directory configurable via `docsDir` setting; pipeline configured in `zfb.config.ts`
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **Preact** — for interactive islands (TOC scroll spy, sidebar toggle, collapsible categories) and server-rendered content typography components; runs in compat mode for React API compatibility
- **syntect** — built-in code highlighting, run by zfb's Rust pipeline at build time, configured for **dual-theme** output in `zfb.config.ts` (`codeHighlight.themeLight`/`themeDark` = `base16-ocean.light`/`base16-ocean.dark`). Tokens are emitted as `--shiki-light`/`--shiki-dark` CSS custom properties (not inline colors) and `src/styles/global.css` resolves them via `light-dark()`, so code follows the light/dark toggle with no client JS. The `shikiTheme` field on each color scheme is unrelated and vestigial — it rides along in zdtp's color-scheme config envelope (optional since zdtp 0.2.3) but has no visible effect: zdtp's Shiki preview is a no-op stub, and page highlighting is syntect's.
- **@takazudo/zdtp (zdtp)** — external npm package that owns the Design Token Panel UI; wired via `configurePanel(designTokenPanelConfig)` in `src/lib/design-token-panel-bootstrap.ts`; self-mounts as a side-effect (no Preact island registration needed)
- **TypeScript** — strict mode (project `tsconfig.json` sets `strict: true` plus the full set of `strict*` flags directly)

## Commands

- `pnpm dev` — runs zfb dev (port 4321), doc-history-server (port 4322), a `.claude/` watcher, and tsup `--watch` for `@takazudo/zudo-doc` concurrently via `run-p`; edits to `.claude/` files regenerate the corresponding MDX live, and edits to `packages/zudo-doc/src/**` auto-rebuild `dist/` so zfb HMR picks them up. If a previous dev process is still bound to 4321 / 4322, the new launch fails fast with `EADDRINUSE` — kill it manually before retrying (e.g. `lsof -ti :4321 -ti :4322 | xargs -r kill`, after confirming the matched PIDs are actually yours). The hook used to do this automatically, but matching by port alone meant `pnpm dev` would silently kill unrelated apps on the same port (4321 is the Vite default), which is the bug we're trading away.
- `pnpm dev:zfb` — zfb dev server only (port 4321)
- `pnpm dev:history` — doc history API server only (port 4322)
- `pnpm dev:zudo-doc` — tsup `--watch` for `@takazudo/zudo-doc` only; host imports resolve through `dist/` because the package now ships compiled JS (W8 Blocker-2 fix — Node 24 rejects raw `.ts` in `node_modules`, so the package's source is private and dist is the API surface)
- `pnpm dev:stable` — alternative build-then-serve dev mode (avoids HMR crashes on content file add/remove)
- `pnpm dev:network` — zfb dev with `--host 0.0.0.0` for LAN access
- `pnpm build` — static HTML export to `dist/` (runs `zfb build`)
- `pnpm preview` — serve the built `dist/` (runs `zfb preview`)
- `pnpm check` — type checking (runs `zfb check`, which delegates to `tsc --noEmit`)
- `pnpm b4push` — pre-push validation: 22-step suite (format check → template drift → no-host-alias guard → pin parity → fixture drift → tags audit → token lint → z-index drift → component-tokens drift → e2e spec naming guard → @flaky tracking-issue guard → wait-debt guard → b4push/CI parity → typecheck → root unit tests → package tests → safelist check → build → link check → html validation → preview smoke → manual smoke); each step's elapsed time is recorded and printed as a breakdown in the final summary. Playwright E2E runs in CI (pr-checks e2e job) and is intentionally excluded from b4push for time-budget reasons — see `TESTING.md` for the full tier rationale
- `pnpm test` — unified test entry point: builds `@takazudo/zudo-doc` dist/ then runs root unit tests (`test:unit`) and workspace package tests (`test:packages`); does not include e2e

## First-time setup on a new machine

zfb and zdtp are consumed as published npm packages — there is no sibling-checkout build step. A plain install pulls everything, including zfb's prebuilt platform binary (shipped via a platform-specific npm optionalDependency, e.g. `@takazudo/zfb-linux-x64-gnu`):

```sh
pnpm install
```

Versions are pinned in `package.json` (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-adapter-cloudflare`, and `@takazudo/zdtp`) — that file is the single source of truth for which upstream versions this project builds against.

### Editing zfb / zdtp from source (escape hatch)

When you need to develop against a local zfb or zdtp checkout (e.g. fixing an upstream bug), use a temporary `pnpm.overrides` entry in `package.json` pointing the package at a local path, then `pnpm install`:

```jsonc
"pnpm": {
  "overrides": {
    "@takazudo/zfb": "link:../zfb/packages/zfb"
  }
}
```

Run `pnpm install` to wire the link, do your work, then remove the override and re-run `pnpm install` to restore the published version. Do not commit the override.

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

Package-first migration (epic #2321) + the minimal-scaffold cutover (epic
#2651) moved engine plugins, chrome/routes/islands, and most host wiring into
`@takazudo/zudo-doc` — there is no root-level `plugins/` directory anymore
(plugins resolve as `@takazudo/zudo-doc/plugins/*` bare specifiers), and most
of what a *fresh* `create-zudo-doc` scaffold ships lives in `node_modules`,
not the project tree. This repo's own showcase still keeps a handful of real,
project-specific files (`src/chrome-bindings.tsx`, `pages/lib/*`,
`src/config/*`) because it demonstrates every feature with real data — a
fresh scaffold has none of them by default. See the Feature Change Checklist
below for the generated-project shape.

```
zfb.config.ts             # zfb engine config — zudoDoc({ ...settings, chromeBindingsModule })
                           # single-entry API (@takazudo/zudo-doc/config); collections/plugins/
                           # markdown logic is package-owned (zudoDocPreset(), which zudoDoc() calls)
pages/                    # File-routed pages (.tsx) — zfb resolves these
├── docs/[[...slug]].tsx        # English doc route (self-contained stub)
├── [locale]/docs/[[...slug]].tsx # Locale-prefixed doc route (e.g. /ja/docs/...)
├── v/                     # Versioned doc routes
├── api/                   # API routes (e.g. ai-chat)
└── lib/                   # Showcase-only real host bindings (SearchWidget, DocHistory data,
                            # frontmatter renderers, ...) — threaded into zfb.config.ts via
                            # src/chrome-bindings.tsx + the chromeBindingsModule setting.
                            # NOT present in a fresh create-zudo-doc scaffold (package-owned there).
packages/
├── md-plugins/           # Legacy JS remark/rehype plugins (superseded by zfb Rust pipeline; kept for fixture/unit-test coverage)
├── search-worker/        # CF Worker for search API
├── doc-history-server/   # Doc history REST API + CLI generator
├── zudo-doc/             # Shared layout + integration package — owns chrome/routes/islands/plugins/preset (@takazudo/zudo-doc)
└── create-zudo-doc/      # CLI scaffold tool — emits the locked ~12-file minimal manifest

src/
├── chrome-bindings.tsx   # Real ChromeHostBindings implementation, wired via zfb.config.ts's chromeBindingsModule
├── components/           # Preact components (.tsx) — the showcase's own remaining islands/overrides
│   └── content/          # MDX element overrides (server-rendered, no client JS)
├── config/               # Settings, tag vocabulary, sidebars, i18n (showcase-owned — see Feature Change Checklist; color schemes moved to the package, see src/CLAUDE.md)
├── content/
│   ├── docs/             # English MDX content
│   └── docs-ja/          # Japanese MDX content (mirrors docs/)
└── styles/
    └── global.css        # @theme tokens, feature styles, slots; @imports the
                          # shared @takazudo/zudo-doc/theme.css + content.css
```

## Content Collections

- Schema and collection wiring live in `zfb.config.ts` (Zod validation)
- Loaded via zfb's MDX content pipeline with a configurable `base` directory from settings
- Content directories: `docsDir` (default: `src/content/docs`), `docsJaDir` (default: `src/content/docs-ja`)

## Terminology: "Update docs"

When we say "update docs" or "update our doc," it means updating the **showcase documentation** content in `src/content/docs/` (English) and `src/content/docs-ja/` (Japanese). Since zudo-doc is a documentation framework, its own content directories serve as the default showcase. These are the pages visible when running `pnpm dev`.

## i18n

- English (default): `/docs/...` — content in `docsDir` (default: `src/content/docs`)
- Japanese: `/ja/docs/...` — content in `docsJaDir` (default: `src/content/docs-ja`)
- Configured in `zfb.config.ts` with `prefixDefaultLocale: false`
- **Bilingual rule**: when creating or updating any doc page, update both EN and JA versions. Detailed exceptions and the content-writing workflow live in `src/content/CLAUDE.md` (auto-loaded when working on content).

## Doc Skill (setup-doc-skill)

The doc-skill (`scripts/setup-doc-skill.sh`) generates `.claude/skills/<name>/SKILL.md` and symlinks docs into it. It is gitignored — do NOT track the generated SKILL.md in git. Run `pnpm setup:doc-skill` to regenerate. To update the skill template, edit `scripts/setup-doc-skill.sh`.

This script is also the **source template** copied to downstream projects by `create-zudo-doc` when the `skillSymlinker` feature is enabled.

## Doc History Architecture

Document git history is handled by a standalone package `@takazudo/zudo-doc-history-server` (at `packages/doc-history-server/`). It is intentionally decoupled from the main build pipeline so that expensive `git log --follow` calls do not block the main build.

It runs in two modes:

- **Server mode** (local dev) — HTTP server on port 4322, started by `pnpm dev:history`. The zfb plugin at `plugins/doc-history-plugin.mjs` proxies `/doc-history/*` requests to it.
- **CLI mode** (CI) — batch-generates JSON files into `dist/doc-history/`. Used by the `build-history` CI job in parallel with the main site build.

### `SKIP_DOC_HISTORY` env var

When `SKIP_DOC_HISTORY=1` is set, the doc-history plugin short-circuits and writes an empty manifest (`{}`), skipping all git history calls. This causes the visible Created/Updated/Author block to be absent from every SSG page. Use only when intentionally bypassing git-based meta generation (e.g. a truly shallow clone or a custom CI variant).

### `GEN_DOC_HISTORY` env var (local postBuild opt-in)

The plugin's **postBuild** step (which writes the per-page history-dropdown JSON into `dist/doc-history/`) is **skipped by default on local builds** and opt-in via `GEN_DOC_HISTORY=1` (#1986). It defaults off locally because that step runs one `git log --follow` chain per content file, which on a large corpus exceeds zfb's 120s postBuild lifecycle-hook budget and fails a plain `pnpm build`. The JSON is redundant for the normal paths anyway: dev reads it live from the `:4322` server, and CI generates it in the dedicated parallel `build-history` job. The decision table (in `runDocHistoryPostBuild` / `shouldGeneratePostBuild`):

- `SKIP_DOC_HISTORY=1` → never generate (wins over everything).
- `GEN_DOC_HISTORY=1` → generate (local opt-in — e.g. before `pnpm preview` of a locally-built `dist/`).
- CI (`CI` / `GITHUB_ACTIONS`) → generate (keeps the CI build-site artifact identical; the async generator stays within budget).
- otherwise (plain local build) → skip.

This gates **only** the postBuild dropdown JSON. The **preBuild** Created/Updated/Author manifest (gated by `SKIP_DOC_HISTORY` alone) still runs locally, so a plain `pnpm build` keeps real page metadata.

## CI Pipeline

All three workflows (`main-deploy.yml`, `pr-checks.yml`, `preview-deploy.yml`) use parallel build jobs:

- **build-site** — full clone (`fetch-depth: 0`), `pnpm build` — preBuild populates `.zfb/doc-history-meta.json` with real git dates so the SSG HTML contains the visible Created/Updated/Author block
- **build-history** — full clone (`fetch-depth: 0`), `@takazudo/zudo-doc-history-server generate` — generates per-page dropdown JSON files for the DocHistory island
- **deploy/preview** — merges both artifacts, deploys via `wrangler deploy` to Cloudflare Workers static assets at `zudo-doc.takazudomodular.com`

E2E tests also run with full clone (no `SKIP_DOC_HISTORY`).

## Workers Cutover Runbook

One-time setup steps required before the first `wrangler deploy` succeeds for this project (epic zudolab/zudo-doc#1691). Run from the repo root with Wrangler authenticated.

### 1. Create the RATE_LIMIT KV namespace

```sh
wrangler kv namespace create RATE_LIMIT
```

Copy the returned `id` value and paste it into `wrangler.toml` under `[[kv_namespaces]]`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<paste-id-here>"
```

### 2. Add the Anthropic API key as a secret

```sh
wrangler secret put ANTHROPIC_API_KEY
```

Paste the key when prompted. The value is stored in Cloudflare's secret store and never appears in `wrangler.toml`.

### 2b. (Optional) Add the IP-hash HMAC secret

```sh
wrangler secret put IP_HASH_SECRET
```

Optional and non-breaking. When set, the ai-chat rate limiter and 7-day audit log key client IPs with **HMAC-SHA-256(ip)** instead of unsalted `SHA-256(ip)`, which defeats reversing the stored hashes by enumerating the (small) IPv4 space (#2038). When the secret is absent the worker falls back to the original unsalted SHA-256, so existing deployments behave identically and the step can be skipped.

> **Rotation caveat.** Setting or rotating `IP_HASH_SECRET` changes every derived key. In-flight rate-limit buckets reset (acceptable — 60s windows) and audit-entry hash continuity breaks for the current 7-day window (acceptable — entries age out).

### 3. Verify DOCS_SITE_URL

`wrangler.toml` already sets `DOCS_SITE_URL = "https://zudo-doc.takazudomodular.com"`. For preview deploys, override per-deploy:

```sh
wrangler deploy --var DOCS_SITE_URL=<preview-url>
```

Or override via the Cloudflare dashboard per environment to avoid preview workers pointing at production docs.

> **Search worker (optional, opt-in deployment).** The showcase site does NOT deploy `packages/search-worker/` — on-site search is a custom-scorer widget (`pages/lib/_search-widget.tsx`) that fetches `search-index.json` from `dist/` and runs a built-in word-match scoring loop (MiniSearch is **not** imported by the host; the worker package has its own `minisearch` dep). The worker exists as a template/example for downstream users who want a server-side search API for huge doc bases or programmatic API consumers. If you choose to deploy it, two caveats apply:
>
> - `packages/search-worker/wrangler.toml` carries its **own** `DOCS_SITE_URL` (used for CORS/referrer). A Cloudflare **dashboard environment-variable override** on the search Worker **shadows** the file value and persists across deploys, so if you've ever set one, clear/replace it when redeploying.
> - The search worker also has its **own `RATE_LIMIT` KV namespace** (separate from the main worker's). `packages/search-worker/wrangler.toml` ships with a placeholder id — see `packages/search-worker/README.md` for the creation runbook (`wrangler kv namespace create RATE_LIMIT` run from that directory). Deploying without replacing the placeholder produces error code 10042.

### 4. Bind the custom domain

`wrangler.toml` already contains:

```toml
[[routes]]
pattern = "zudo-doc.takazudomodular.com"
custom_domain = true
```

The domain binding is activated on first `wrangler deploy`. Ensure the DNS record for `zudo-doc.takazudomodular.com` exists in the Cloudflare zone (CNAME or proxied A record pointing at the Worker). Cloudflare will issue a certificate automatically.

### 5. Pages project deletion (Wave 5 — #1698)

The legacy `zudo-doc` Cloudflare Pages project and its `zudo-doc.pages.dev` subdomain remain active until Wave 5 (#1698). Do not delete the Pages project until that wave is explicitly greenlit.

## Feature Change Checklist

Since the minimal-scaffold cutover (epic zudolab/zudo-doc#2651), a feature's
field census lives in ONE place (`packages/zudo-doc/src/config.ts`) and a
generated project's config is a SINGLE file (`zfb.config.ts`, diff-from-defaults
`zudoDoc({...})`). The old `settings-gen.ts` + `zfb-config-gen.ts` two-file
split, and the per-project `src/config/settings.ts` a fresh scaffold used to
ship, are both gone from the generator's output — this repo's own showcase
still has a real `src/config/settings.ts` (spread into `zudoDoc({...settings})`)
because it demonstrates every feature with real data, but that's a showcase
choice, not something a fresh scaffold gets. When adding or removing a
feature from zudo-doc, update these in order:

1. **`packages/zudo-doc/src/config.ts`** — Add/remove the field on `ZudoDocConfig` (with a `@default` JSDoc — enforced by `config-jsdoc.test.ts`) and `DEFAULT_SETTINGS`. This is the ONE census every other step reads against.
2. **`packages/zudo-doc/src/preset.ts`** — If the feature introduces a new plugin or collection, update `zudoDocPreset()` to wire it from the settings field you just added. `zudoDoc()` (step 1's `config.ts`) calls this internally — a generated project's `zfb.config.ts` never wires plugins directly.
3. **`packages/create-zudo-doc/src/zfb-config-gen.ts`** — Add/remove the field in `DEFAULT_MIRROR` (a hand-kept local copy of step 1's `DEFAULT_SETTINGS` — the generator can't `import` the package, see the file's header comment) + `buildDesiredConfig()` (user-choice → field mapping) + `FIELD_ORDER` (cosmetic emission order).
4. **`packages/create-zudo-doc/src/features/<name>.ts`** — Create/update the feature module. Register a new module in `packages/create-zudo-doc/src/features/index.ts`. Most features need ONLY step 3's field mapping (leave `injections: []`, no `postProcess`) — only add a `postProcess` patch or `templates/features/<name>/files/` copy if the feature genuinely has no package-owned equivalent (rare; see `docHistory`/`designTokenPanel`/`tagGovernance`/`tauri`/`tauriDev` for the current examples and why each one needs it).
5. **`packages/create-zudo-doc/templates/features/<name>/files/`** — Add/remove feature-specific files (only when there's a genuine gap — most features ship zero files now; only `i18n`, `tagGovernance`, `tauri`, `tauriDev` currently do).
6. **`packages/create-zudo-doc/src/scaffold.ts`** — Add/remove dependencies in `generatePackageJson()`.
7. **`packages/create-zudo-doc/src/__tests__/scaffold.test.ts`** — Update the manifest-shape assertions (`BAREBONE_MANIFEST`/`ALL_FEATURES`/`NEVER_RESURRECTED`) and the settings-drift guard.
8. **This repo's own `src/config/settings.ts`** — Add/remove the field so the showcase demonstrates it (optional relative to the generator, but keep it in sync so the showcase stays a faithful reference).
9. Run `/l-update-generator` to verify no drift remains.

**Template counterpart rule**: this checklist also applies to incremental
improvements (CSS token migrations, icon sizing, spacing changes, etc.) — not
just new features. The rule now covers far fewer files than before the
minimal-scaffold cutover: only the ~5 files in
`packages/create-zudo-doc/templates/base/` (`pages/index.tsx`,
`pages/docs/[[...slug]].tsx`, `src/styles/global.css`, `tsconfig.json`,
`scripts/setup-doc-skill.sh`) have a showcase counterpart to keep in sync —
if you change one of the showcase's matching files, update the template too.
Run `pnpm check:template-drift` to verify (allowlisted files in
`.template-drift-allowlist` — `global.css`, `tsconfig.json`, `pages/index.tsx`,
the two doc-route stubs, and the `tauri` feature's orphaned find-in-page
files — are excluded from the automated whole-file check and need manual
review instead).

**e2e fixture sync**: adding a field to `src/config/settings.ts` also
requires mirroring it into all five `e2e/fixtures/*/src/config/settings.ts`
files — or adding an allowlist entry in `.fixture-settings-drift-allowlist`
with a `# reason:` comment. This is enforced in CI by the `Fixture Settings
Drift Check` job (`scripts/check-fixture-settings-drift.mjs`). The check's
`CANONICAL_PATH` deliberately stays `src/config/settings.ts`, not
`zfb.config.ts` — every fixture's (and the host's) `zfb.config.ts` is a
byte-identical `zudoDoc({ ...settings, chromeBindingsModule, ... })` shell
carrying no field names, so `settings.ts` remains the only place individual
field names appear as literal keys to diff.

**Content typography (`.zd-content`) is NOT per-project — it ships from the package.** The content/markdown stylesheet lives once at `packages/zudo-doc/src/content.css` (shipped as `@takazudo/zudo-doc/content.css`) and is `@import`ed by both `src/styles/global.css` and the generator template. Change content typography there — do NOT re-inline `.zd-content` rules into either `global.css` (that copy-drift is exactly what zudolab/zudo-doc#2188 retired). Both `global.css` files keep only `@theme` tokens, feature styles, and slots. When editing `content.css`, rebuild the package (`pnpm --filter @takazudo/zudo-doc build`) so `dist/content.css` updates for consumers. Note: generated projects only pick up `content.css` changes after a new `@takazudo/zudo-doc` version is published and `create-zudo-doc`'s pinned dependency is bumped (the lockstep release handles this).

## Tauri (two modes)

zudo-doc ships two independent Tauri apps:

### Mode 1 — Standalone offline reader (`src-tauri/`)

Bundles zudo-doc's own pre-built `dist/` into a self-contained desktop app.

- **Build (shipped product):** `cargo tauri build`
  Embeds `dist/` via `frontendDist`; WebView loads `WebviewUrl::App`. There is no
  `beforeBuildCommand`, so build the embedded `dist/` first — and use
  **`GEN_DOC_HISTORY=1 pnpm build`** so the offline reader includes the per-page
  history-dropdown JSON (postBuild JSON is opt-in for local builds, #1986; a plain
  `pnpm build` would silently ship a `dist/` without it).
- **`cargo tauri dev` (contributor convenience only):**
  Runs `pnpm dev` via `beforeDevCommand` and opens the WebView at
  `http://localhost:4321/` (the zfb dev server). This is NOT a shipped product — it exists
  solely for zudo-doc contributors who want to work on both the Tauri shell and site content
  at the same time. The `beforeDevCommand` / `devUrl` fields in `src-tauri/tauri.conf.json`
  must be kept for this workflow.

### Mode 2 — Configurable dev wrapper for end users (`src-tauri-dev/`)

A standalone Tauri app that any project can use as a desktop dev wrapper. It reads the
target project URL and settings from a per-user config file rather than hard-coding anything.

- **Build (shipped product):** `cd src-tauri-dev && cargo tauri build`
- **Config file (macOS):**
  `~/Library/Application Support/com.takazudo.zudo-doc-dev/config.json`
  (Windows/Linux paths differ; see `src-tauri-dev/` for details.)

### Key distinction

Mode 1 `cargo tauri dev` and Mode 2 are both "dev wrappers" superficially, but they target
completely different audiences. Mode 1 dev is a repo-internal contributor convenience
(hard-coded to this project, not shipped). Mode 2 is a product delivered to end users of
any project (configurable, shipped as a standalone installer).

See `src-tauri/README.md` for a full comparison table.

## Testing

See `TESTING.md` (repo root) for the full testing strategy — levels (L1 vitest through L6 test-flow skills), tiers (T0 local fast pass / T1 CI gates / T3 nightly exam), tag taxonomy (`@flaky` quarantine rules), retry budgets, anti-gaming rules, and wait-pattern rules.

## Directory-scoped CLAUDE.md files

These auto-load when working in the corresponding directory — read them when relevant work is in scope:

- `src/CLAUDE.md` — components, design tokens, three-tier color/font-size strategy, CSS rules
- `src/config/CLAUDE.md` — tag vocabulary and tag governance
- `src/content/CLAUDE.md` — doc-writing rules (frontmatter, admonitions, linking, bilingual workflow)
- `e2e/CLAUDE.md` — Playwright fixture architecture and how-to (policy in TESTING.md)
- `packages/*/CLAUDE.md` — per-package architecture notes (workers, generator, doc-history-server)
