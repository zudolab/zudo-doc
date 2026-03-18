# zudo-doc

Minimal documentation framework built with Astro 6, MDX, Tailwind CSS v4, and React islands.

## Tech Stack

- **Astro 6** — static site generator with Content Collections
- **MDX** — via `@astrojs/mdx`, content directory configurable via `docsDir` setting
- **Tailwind CSS v4** — via `@tailwindcss/vite` (not `@astrojs/tailwind`)
- **React 19** — for interactive islands only (TOC scroll spy, sidebar toggle, collapsible categories)
- **Shiki** — built-in code highlighting, theme set from active color scheme
- **TypeScript** — strict mode via `astro/tsconfigs/strict`

## Commands

- `pnpm dev` — runs Astro dev server (port 4321) and doc-history-server (port 4322) concurrently (predev kills stale processes)
- `pnpm dev:astro` — Astro dev server only (port 4321)
- `pnpm dev:history` — doc history API server only (port 4322)
- `pnpm build` — static HTML export to `dist/`
- `pnpm check` — Astro type checking

## Key Directories

```
packages/
├── ai-chat-worker/       # CF Worker for AI chat API
├── search-worker/        # CF Worker for search API
├── doc-history-server/   # Doc history REST API + CLI generator
└── create-zudo-doc/      # CLI scaffold tool

src/
├── components/          # Astro + React components
│   └── admonitions/     # Note, Tip, Info, Warning, Danger
├── config/              # Settings, color schemes
├── content/
│   ├── docs/            # English MDX content
│   └── docs-ja/         # Japanese MDX content (mirrors docs/)
├── hooks/               # React hooks (scroll spy)
├── layouts/             # Astro layouts (doc-layout)
├── pages/               # File-based routing
│   ├── docs/[...slug]   # English doc routes
│   └── ja/docs/[...slug] # Japanese doc routes
└── styles/
    └── global.css       # Design tokens (@theme) & Tailwind config
```

## Conventions

### Components: Astro vs React

- Default to **Astro components** (`.astro`) — zero JS, server-rendered
- Use **React islands** (`client:load`) only when client-side interactivity is needed
- Current React islands: `toc.tsx`, `mobile-toc.tsx`, `sidebar-toggle.tsx`, `sidebar-tree.tsx`, `theme-toggle.tsx`, `doc-history.tsx`, `color-tweak-panel.tsx`, `color-tweak-export-modal.tsx`

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

### i18n

- English (default): `/docs/...` — content in `docsDir` (default: `src/content/docs`)
- Japanese: `/ja/docs/...` — content in `docsJaDir` (default: `src/content/docs-ja`)
- Configured in `astro.config.ts` with `prefixDefaultLocale: false`
- Japanese docs should mirror the English directory structure

## Design Tokens & CSS

See `src/CLAUDE.md` for design token system (three-tier color strategy, color rules, scheme configuration) and CSS conventions (component-first strategy, tight token strategy).
