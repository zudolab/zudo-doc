# zudo-doc

Minimal documentation framework built with zfb, MDX, Tailwind CSS v4, and Preact islands.

(Originally built on Astro 6; migrated to zfb in epic zudolab/zudo-doc#1333. Some historical references to Astro tooling may still surface in long-form prose elsewhere — they describe legacy state, not the current authoring target.)

## Tech Stack

- **zfb** (`@takazudo/zfb`) — static site generator with MDX content collections, file-routed `pages/`, and a built-in dev/build/preview/check CLI
- **MDX** — authored under `src/content/`, content directory configurable via `docsDir` setting; pipeline configured in `zfb.config.ts`
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **Preact** — for interactive islands (TOC scroll spy, sidebar toggle, collapsible categories) and server-rendered content typography components; runs in compat mode for React API compatibility
- **syntect** — built-in code highlighting, run by zfb's Rust pipeline at build time (single fixed theme: `base16-ocean-dark`); the `shikiTheme` field on each color scheme is a separate runtime-only setting consumed by the zdtp panel's client-side Shiki preview
- **@takazudo/zdtp (zdtp)** — external npm package that owns the Design Token Panel UI; wired via `configurePanel(designTokenPanelConfig)` in `src/lib/design-token-panel-bootstrap.ts`; self-mounts as a side-effect (no Preact island registration needed)
- **TypeScript** — strict mode (project `tsconfig.json` sets `strict: true` plus the full set of `strict*` flags directly)

## Commands

- `pnpm dev` — runs zfb dev (port 4321), doc-history-server (port 4322), a `.claude/` watcher, and tsup `--watch` for `@takazudo/zudo-doc` concurrently via `run-p`; edits to `.claude/` files regenerate the corresponding MDX live, and edits to `packages/zudo-doc/src/**` auto-rebuild `dist/` so zfb HMR picks them up. If a previous dev process is still bound to 4321 / 4322, the new launch fails fast with `EADDRINUSE` — kill it manually before retrying (no automatic `lsof | xargs kill`, since that historically wiped unrelated processes on the same ports)
- `pnpm dev:zfb` — zfb dev server only (port 4321)
- `pnpm dev:history` — doc history API server only (port 4322)
- `pnpm dev:zudo-doc` — tsup `--watch` for `@takazudo/zudo-doc` only; host imports resolve through `dist/` because the package now ships compiled JS (W8 Blocker-2 fix — Node 24 rejects raw `.ts` in `node_modules`, so the package's source is private and dist is the API surface)
- `pnpm dev:stable` — alternative build-then-serve dev mode (avoids HMR crashes on content file add/remove)
- `pnpm dev:network` — zfb dev with `--host 0.0.0.0` for LAN access
- `pnpm build` — static HTML export to `dist/` (runs `zfb build`)
- `pnpm preview` — serve the built `dist/` (runs `zfb preview`)
- `pnpm check` — type checking (runs `zfb check`, which delegates to `tsc --noEmit`)
- `pnpm b4push` — pre-push validation: format check → template drift check → tags audit (`tags:audit --ci`) → design token lint → typecheck → build → link check → preview smoke (E2E parity is parked under E9b until the post-cutover migration window closes)

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

```
zfb.config.ts            # zfb engine config (content collections, MDX pipeline, plugins)
plugins/                 # zfb engine plugins (doc-history, llms-txt, search-index, ...)
pages/                   # File-routed pages (.tsx) — zfb resolves these
├── docs/[...slug]       # English doc routes
├── [locale]/docs/[...slug] # Locale-prefixed doc routes (e.g. /ja/docs/...)
├── api/                 # API routes (e.g. ai-chat)
└── sitemap.xml.tsx      # Sitemap generator
packages/
├── ai-chat-worker/       # CF Worker for AI chat API (deprecated; superseded by pages/api/ai-chat.tsx)
├── md-plugins/           # Shared remark/rehype plugins (link resolver, admonitions, etc.)
├── search-worker/        # CF Worker for search API
├── doc-history-server/   # Doc history REST API + CLI generator
├── zudo-doc/          # Shared layout + integration package (header, doc-layout, ...)
└── create-zudo-doc/      # CLI scaffold tool

src/
├── components/          # Preact components (.tsx) — islands and server-rendered overrides
│   └── content/         # MDX element overrides (server-rendered, no client JS)
├── config/              # Settings, color schemes, tag vocabulary
├── content/
│   ├── docs/            # English MDX content
│   └── docs-ja/         # Japanese MDX content (mirrors docs/)
├── hooks/               # Preact hooks (scroll spy)
└── styles/
    └── global.css       # Design tokens (@theme) & Tailwind config
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

### 3. Verify DOCS_SITE_URL

`wrangler.toml` already sets `DOCS_SITE_URL = "https://zudo-doc.takazudomodular.com"`. For preview deploys, override per-deploy:

```sh
wrangler deploy --var DOCS_SITE_URL=<preview-url>
```

Or override via the Cloudflare dashboard per environment to avoid preview workers pointing at production docs.

> **Search worker (optional, opt-in deployment).** The showcase site does NOT deploy `packages/search-worker/` — on-site search is served by the client-side MiniSearch island (`pages/lib/_search-widget.tsx`) reading `search-index.json` from `dist/`. The worker exists as a template/example for downstream users who want a server-side search API for huge doc bases or programmatic API consumers. If you choose to deploy it, two caveats apply:
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

When adding or removing a feature from zudo-doc, update the `create-zudo-doc` generator to stay in sync:

1. **`src/config/settings.ts`** — Add/remove the setting field
2. **`packages/create-zudo-doc/src/settings-gen.ts`** — Add/remove the setting in generated output
3. **`packages/create-zudo-doc/src/features/<name>.ts`** — Create/update feature module with injections
4. **`packages/create-zudo-doc/templates/features/<name>/files/`** — Add/remove feature-specific files
5. **`packages/create-zudo-doc/src/zfb-config-gen.ts`** — Add/remove conditional imports/plugins if feature affects the generated `zfb.config.ts`
6. **`packages/create-zudo-doc/src/scaffold.ts`** — Add/remove dependencies in `generatePackageJson()`
7. **`packages/create-zudo-doc/src/__tests__/scaffold.test.ts`** — Update tests
8. Run `/l-update-generator` to verify no drift remains

**Important**: This checklist also applies to incremental improvements (CSS token migrations, icon sizing, spacing changes, etc.) — not just new features. If you change a file that has a template counterpart, update the template too. Run `pnpm check:template-drift` to verify (note: allowlisted files such as `src/styles/global.css`, plugin re-exports, and other slot-based files listed in `.template-drift-allowlist` are excluded from automated checks and need manual review).

## Tauri (two modes)

zudo-doc ships two independent Tauri apps:

### Mode 1 — Standalone offline reader (`src-tauri/`)

Bundles zudo-doc's own pre-built `dist/` into a self-contained desktop app.

- **Build (shipped product):** `cargo tauri build`
  Embeds `dist/` via `frontendDist`; WebView loads `WebviewUrl::App`.
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

## Directory-scoped CLAUDE.md files

These auto-load when working in the corresponding directory — read them when relevant work is in scope:

- `src/CLAUDE.md` — components, design tokens, three-tier color/font-size strategy, CSS rules
- `src/config/CLAUDE.md` — tag vocabulary and tag governance
- `src/content/CLAUDE.md` — doc-writing rules (frontmatter, admonitions, linking, bilingual workflow)
- `e2e/CLAUDE.md` — Playwright fixture architecture and test patterns
- `packages/*/CLAUDE.md` — per-package architecture notes (workers, generator, doc-history-server)
- `vendor/design-token-lint/CLAUDE.md` — design-token-lint linter package
