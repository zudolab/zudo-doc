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

- `pnpm dev` — dev server on port 4321 (predev kills stale processes)
- `pnpm build` — static HTML export to `dist/`
- `pnpm check` — Astro type checking

## Key Directories

```
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
- Current React islands: `toc.tsx`, `mobile-toc.tsx`, `sidebar-toggle.tsx`, `sidebar-tree.tsx`, `color-scheme-picker.tsx`, `theme-toggle.tsx`, `doc-history.tsx`, `color-tweak-panel.tsx`, `color-tweak-export-modal.tsx`

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

## Design Token System

Uses a 16-color palette system.

### Three-Tier Color Strategy

**Tier 1 — Palette** (injected by `ColorSchemeProvider` on `:root`):
- `--zd-bg`, `--zd-fg`, `--zd-sel-bg`, `--zd-sel-fg`, `--zd-cursor`
- `--zd-0` through `--zd-15` (16 palette slots)

**Tier 2 — Semantic tokens** (in `global.css` `@theme`, resolved per scheme):
- Palette access: `p0`–`p15` → `bg-p0`, `text-p8`, `border-p1`, etc.
- Base: `bg`, `fg` → `bg-bg`, `text-fg`
- UI: `surface`, `muted`, `accent`, `accent-hover`, `sel-bg`, `sel-fg`
- Content: `code-bg`, `code-fg`, `success`, `danger`, `warning`, `info`

**Tier 3 — Component tokens** (scoped to specific components):
- Content: `.zd-content` direct element styling in `global.css` (consumes Tier 2)

Each tier only references the tier above it.

### Color Rules

- **NEVER** use Tailwind default colors (`bg-gray-500`, `text-blue-600`) — they are reset to `initial`
- **ALWAYS** use project tokens: `text-fg`, `bg-surface`, `border-muted`, `text-accent`, etc.
- Prefer semantic tokens (`text-accent`, `bg-code-bg`, `text-danger`) for standard UI
- Use palette tokens (`p0`–`p15`) only when no semantic token fits

### Changing Scheme

- Edit `colorScheme` in `src/config/settings.ts`
- Available: Dracula, Catppuccin Mocha, Nord, TokyoNight, Gruvbox Dark, Atom One Dark
- Add schemes in `src/config/color-schemes.ts` (22 color props + `shikiTheme`)
- `ColorRef` type: semantic overrides and `cursor`/`selectionBg`/`selectionFg` accept `number | string` — number = palette index, string = direct color

### Color Tweak Panel

- Enabled via `colorTweakPanel: true` in settings
- Interactive panel at page bottom for live color editing (palette, base, semantic tokens)
- Export button generates `ColorScheme` TypeScript code for clipboard copy
- State persisted in `localStorage` (`zudo-doc-tweak-state`)

## CSS

- Tailwind v4: imports `tailwindcss/preflight` + `tailwindcss/utilities` (no default theme)
- No `--*: initial` resets needed — default theme is simply not imported
- Content typography: `.zd-content` class in `global.css` (no prose plugin — direct element styling with `:where()` selectors)
