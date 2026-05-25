# zudo-doc

Documentation base framework built with [zfb](https://www.npmjs.com/package/@takazudo/zfb), MDX, Tailwind CSS v4, and Preact islands.

This repository is both the framework's source and its own showcase: the content under `src/content/` is the live documentation you see when running the dev server.

> Originally built on Astro; migrated to zfb. If you find lingering references to Astro tooling in long-form prose, they describe legacy state, not the current authoring target.

## Tech Stack

- **[zfb](https://www.npmjs.com/package/@takazudo/zfb)** (`@takazudo/zfb`) — static site generator with MDX content collections, file-routed `pages/`, and a built-in dev/build/preview/check CLI
- **MDX** — content authored under `src/content/`; pipeline configured in `zfb.config.ts`
- **Tailwind CSS v4** — via `@tailwindcss/vite`, with a three-tier design token system
- **Preact** — interactive islands (TOC scroll spy, sidebar toggle, theme switch, search) and server-rendered typography components
- **TypeScript** — strict mode throughout

## Quick Start

zfb and the shared layout package (`@takazudo/zdtp`) are consumed as published npm packages — a plain install pulls everything, including zfb's prebuilt platform binary:

```sh
pnpm install   # requires pnpm (see packageManager in package.json)
pnpm dev       # zfb dev server on http://localhost:4321
```

## Common Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server (zfb on :4321) + doc-history server (:4322) + `.claude/` watcher |
| `pnpm dev:zfb` | zfb dev server only |
| `pnpm dev:network` | Dev server bound to `0.0.0.0` for LAN access |
| `pnpm build` | Static HTML export to `dist/` |
| `pnpm preview` | Serve the built `dist/` |
| `pnpm check` | Type checking (`zfb check` → `tsc --noEmit`) |
| `pnpm format` | Format MDX/Markdown content |
| `pnpm b4push` | Pre-push validation (format, drift, tags, tokens, typecheck, build, links, smoke) |

## Internationalization

- English (default): `/docs/...` — content in `src/content/docs/`
- Japanese: `/ja/docs/...` — content in `src/content/docs-ja/` (mirrors the English tree)

When creating or updating any doc page, update both the English and Japanese versions. See `src/content/CLAUDE.md` for the full content-writing workflow.

## Project Structure

```
zfb.config.ts          # zfb engine config (content collections, MDX pipeline, plugins)
plugins/               # zfb engine plugins (doc-history, llms-txt, search-index, ...)
pages/                 # File-routed pages (.tsx)
packages/              # Workspace packages (layout, workers, generator, doc-history-server)
src/
├── components/        # Preact components (islands and server-rendered overrides)
├── config/            # Settings, color schemes, tag vocabulary
├── content/           # MDX content — docs/ (EN) and docs-ja/ (JA)
└── styles/            # Design tokens (@theme) & Tailwind config
```

## Documentation

The framework documents itself. Run `pnpm dev` and browse the site, or read the MDX sources under `src/content/docs/`.

## License

MIT
