# zudo-doc

Minimal documentation framework built with Astro 6, MDX, Tailwind CSS v4, and Preact islands.

## Tech Stack

- **Astro 6** — static site generator with Content Collections
- **MDX** — via `@astrojs/mdx`, content directory configurable via `docsDir` setting
- **Tailwind CSS v4** — via `@tailwindcss/vite` (not `@astrojs/tailwind`)
- **Preact** — for interactive islands (TOC scroll spy, sidebar toggle, collapsible categories) and server-rendered content typography components, with compat mode for React API compatibility
- **Shiki** — built-in code highlighting, theme set from active color scheme
- **TypeScript** — strict mode via `astro/tsconfigs/strict`

## Commands

- `pnpm dev` — runs Astro dev server (port 4321) and doc-history-server (port 4322) concurrently via `run-p` (predev kills stale processes)
- `pnpm dev:astro` — Astro dev server only (port 4321)
- `pnpm dev:history` — doc history API server only (port 4322)
- `pnpm dev:stable` — alternative build-then-serve dev mode (avoids HMR crashes on content file add/remove)
- `pnpm dev:network` — Astro dev server with `--host 0.0.0.0` for LAN access
- `pnpm build` — static HTML export to `dist/`
- `pnpm check` — Astro type checking
- `pnpm b4push` — pre-push validation: format check → template drift check → typecheck → build → link check → E2E tests

## Key Directories

```
packages/
├── ai-chat-worker/       # CF Worker for AI chat API
├── md-plugins/           # Shared remark/rehype plugins (link resolver, admonitions, etc.)
├── search-worker/        # CF Worker for search API
├── doc-history-server/   # Doc history REST API + CLI generator
└── create-zudo-doc/      # CLI scaffold tool

src/
├── components/          # Astro + Preact components
│   ├── admonitions/     # Note, Tip, Info, Warning, Danger
│   └── content/         # MDX element overrides (server-rendered, no client JS)
├── config/              # Settings, color schemes
├── content/
│   ├── docs/            # English MDX content
│   └── docs-ja/         # Japanese MDX content (mirrors docs/)
├── hooks/               # Preact hooks (scroll spy)
├── layouts/             # Astro layouts (doc-layout)
├── pages/               # File-based routing
│   ├── docs/[...slug]   # English doc routes
│   └── ja/docs/[...slug] # Japanese doc routes
└── styles/
    └── global.css       # Design tokens (@theme) & Tailwind config
```

## Conventions

### Components: Astro vs Preact

- Default to **Astro components** (`.astro`) — zero JS, server-rendered
- Use **Preact islands** (`client:load`) only when client-side interactivity is needed
- Preact runs in compat mode (`@astrojs/preact` with `compat: true`), so components can use React-style imports and APIs
- Current Preact islands: `toc.tsx`, `mobile-toc.tsx`, `sidebar-toggle.tsx`, `sidebar-tree.tsx`, `theme-toggle.tsx`, `doc-history.tsx`, `color-tweak-panel.tsx`, `color-tweak-export-modal.tsx`
- Content typography components (`src/components/content/`): Preact function components (no `client:` directive — server-rendered, zero JS) that override HTML elements in MDX via `<Content components={...} />`. Includes: headings (h2-h4), paragraph, link, strong, blockquote, lists (ul/ol), table.

### Content Collections

- Schema defined in `src/content.config.ts` (Zod validation)
- Uses Astro 5 `glob()` loader with configurable `base` directory from settings
- Content directories: `docsDir` (default: `src/content/docs`), `docsJaDir` (default: `src/content/docs-ja`)

### Terminology: "Update docs"

When we say "update docs" or "update our doc," it means updating the **showcase documentation** content in `src/content/docs/` (English) and `src/content/docs-ja/` (Japanese). Since zudo-doc is a documentation framework, its own content directories serve as the default showcase. These are the pages visible when running `pnpm dev`.

### i18n

- English (default): `/docs/...` — content in `docsDir` (default: `src/content/docs`)
- Japanese: `/ja/docs/...` — content in `docsJaDir` (default: `src/content/docs-ja`)
- Configured in `astro.config.ts` with `prefixDefaultLocale: false`
- Japanese docs should mirror the English directory structure
- **Bilingual rule**: When creating or updating any doc page, update both EN and JA versions. Keep code blocks identical -- only translate prose.
- **Exception**: Pages with `generated: true` in frontmatter do not require Japanese translations.

## Writing Docs

### Frontmatter Fields

Schema in `src/content.config.ts`. Required: `title` (string). Key optional fields:

| Field | Type | Description |
|---|---|---|
| `sidebar_position` | number | Sort order within category (lower = higher). Always set this |
| `description` | string | Subtitle below the title |
| `sidebar_label` | string | Custom sidebar text (overrides `title`) |
| `tags` | string[] | Cross-category grouping |
| `draft` | boolean | Exclude from build entirely |
| `unlisted` | boolean | Built but hidden from sidebar/nav |
| `generated` | boolean | Build-time generated content (skip translation) |
| `hide_sidebar` | boolean | Hide left sidebar |
| `hide_toc` | boolean | Hide right-side TOC |

### Content Rules

- **No h1 in content**: The frontmatter `title` renders as the page h1. Start with `## h2`.
- **Always set `sidebar_position`**: Without it, pages sort alphabetically.
- **Kebab-case file names**: Use `my-article.mdx`, not `myArticle.mdx`.

### Admonitions

Available in all MDX files without imports (registered globally in doc page).

**Directive syntax**: `:::note[Title]` ... `:::`

**JSX syntax**: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>` — each accepts optional `title` prop.

### Linking Between Docs

Use relative file paths with `.mdx` extension:

```markdown
[Link text](./sibling-page.mdx)
[Link text](../other-category/page.mdx#anchor)
```

### Navigation Structure

Navigation is filesystem-driven. Directory structure becomes sidebar navigation.

- Pages ordered by `sidebar_position` (ascending)
- Category index pages (`index.mdx`) control category position
- `_category_.json` for category-level metadata (label, position, noPage)
- Header nav defined in `src/config/settings.ts` via `headerNav` with `categoryMatch`

### Content Creation Workflow

1. Create English `.mdx` file under `src/content/docs/` with `title` and `sidebar_position`
2. Write content starting with `## h2` headings (not `# h1`)
3. Create matching Japanese file under `src/content/docs-ja/`
4. Keep code blocks and `<HtmlPreview>` blocks identical -- only translate prose
5. Run `pnpm format:md` then `pnpm build` to verify

## Doc Skill (setup-doc-skill)

The doc-skill (`scripts/setup-doc-skill.sh`) generates `.claude/skills/<name>/SKILL.md` and symlinks docs into it. It is gitignored -- do NOT track the generated SKILL.md in git. Run `pnpm setup:doc-skill` to regenerate. To update the skill template, edit `scripts/setup-doc-skill.sh`.

This script is also the **source template** copied to downstream projects by `create-zudo-doc` when the `skillSymlinker` feature is enabled.

## Doc History Architecture

Document git history is handled by a standalone package `@zudo-doc/doc-history-server` (at `packages/doc-history-server/`). It is intentionally decoupled from the Astro build pipeline so that expensive `git log --follow` calls do not block the main build.

It runs in two modes:

- **Server mode** (local dev) — HTTP server on port 4322, started by `pnpm dev:history`. The Astro integration at `src/integrations/doc-history.ts` proxies `/doc-history/*` requests to it.
- **CLI mode** (CI) — batch-generates JSON files into `dist/doc-history/`. Used by the `build-history` CI job in parallel with the main Astro build.

### `SKIP_DOC_HISTORY` env var

When `SKIP_DOC_HISTORY=1` is set, the Astro integration skips inline history generation at build time. This is the default for the CI `build-site` job — history is generated by the separate `build-history` job and merged in at deploy time. For local `pnpm build` runs, leave it unset so history is embedded inline.

## CI Pipeline

Production (`main-deploy.yml`) and PR (`pr-checks.yml`) workflows use parallel build jobs:

- **build-site** — shallow clone (`fetch-depth: 1`), `SKIP_DOC_HISTORY=1 pnpm build`
- **build-history** — full clone (`fetch-depth: 0`), `@zudo-doc/doc-history-server generate`
- **deploy/preview** — merges both artifacts, deploys to Cloudflare Pages

E2E tests run with full clone and inline doc-history generation (no `SKIP_DOC_HISTORY`).

## Feature Change Checklist

When adding or removing a feature from zudo-doc, update the `create-zudo-doc` generator to stay in sync:

1. **`src/config/settings.ts`** — Add/remove the setting field
2. **`packages/create-zudo-doc/src/settings-gen.ts`** — Add/remove the setting in generated output
3. **`packages/create-zudo-doc/src/features/<name>.ts`** — Create/update feature module with injections
4. **`packages/create-zudo-doc/templates/features/<name>/files/`** — Add/remove feature-specific files
5. **`packages/create-zudo-doc/src/astro-config-gen.ts`** — Add/remove conditional imports/integrations if feature affects astro config
6. **`packages/create-zudo-doc/src/scaffold.ts`** — Add/remove dependencies in `generatePackageJson()`
7. **`packages/create-zudo-doc/src/__tests__/scaffold.test.ts`** — Update tests
8. Run `/l-update-generator` to verify no drift remains

**Important**: This checklist also applies to incremental improvements (CSS token migrations, icon sizing, spacing changes, etc.) — not just new features. If you change a file that has a template counterpart, update the template too. Run `pnpm check:template-drift` to verify (note: allowlisted files like `global.css`, `header.astro`, and `doc-layout.astro` are excluded from automated checks and need manual review).

## Design Tokens & CSS

See `src/CLAUDE.md` for design token system (three-tier color strategy, color rules, scheme configuration) and CSS conventions (component-first strategy, tight token strategy).
