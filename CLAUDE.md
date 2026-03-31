# zudo-doc

Minimal documentation framework built with Astro 6, MDX, Tailwind CSS v4, and Preact islands.

## Tech Stack

- **Astro 6** — static site generator with Content Collections
- **MDX** — via `@astrojs/mdx`, content directory configurable via `docsDir` setting
- **Tailwind CSS v4** — via `@tailwindcss/vite` (not `@astrojs/tailwind`)
- **Preact** — for interactive islands only (TOC scroll spy, sidebar toggle, collapsible categories), with compat mode for React API compatibility
- **D2** — diagram language with per-element styling, rendered via `@terrastruct/d2` WASM (dev) and `astro-d2` (build)
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
- `pnpm b4push` — pre-push validation: format check → typecheck → build → link check → E2E tests

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
│   └── admonitions/     # Note, Tip, Info, Warning, Danger
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

### Content Collections

- Schema defined in `src/content.config.ts` (Zod validation)
- Uses Astro 5 `glob()` loader with configurable `base` directory from settings
- Content directories: `docsDir` (default: `src/content/docs`), `docsJaDir` (default: `src/content/docs-ja`)
- Required frontmatter: `title` (string)
- Optional: `description`, `sidebar_position` (number), `category`
- Sidebar order is driven by `sidebar_position`

### Admonitions

Available in all MDX files without imports (registered globally in doc page):
`<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>` — each accepts optional `title` prop.

### Terminology: "Update docs"

When we say "update docs" or "update our doc," it means updating the **showcase documentation** content in `src/content/docs/` (English) and `src/content/docs-ja/` (Japanese). Since zudo-doc is a documentation framework, its own content directories serve as the default showcase. These are the pages visible when running `pnpm dev`.

### i18n

- English (default): `/docs/...` — content in `docsDir` (default: `src/content/docs`)
- Japanese: `/ja/docs/...` — content in `docsJaDir` (default: `src/content/docs-ja`)
- Configured in `astro.config.ts` with `prefixDefaultLocale: false`
- Japanese docs should mirror the English directory structure

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
8. Run `/l-sync-create-zudo-doc` to verify no drift remains

## Design Tokens & CSS

See `src/CLAUDE.md` for design token system (three-tier color strategy, color rules, scheme configuration) and CSS conventions (component-first strategy, tight token strategy).
