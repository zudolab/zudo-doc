# create-zudo-doc

Scaffold a new [zudo-doc](https://zudo-doc.takazudomodular.com) documentation site in seconds. Generates a ready-to-run project powered by [zfb](https://github.com/zudolab/zudo-doc), MDX, Tailwind CSS v4, and Preact — with optional features (search, i18n, sidebar, doc history, design token panel, and more).

## Quick Start

```bash
# pnpm
pnpm create zudo-doc

# npm
npm create zudo-doc@latest

# yarn
yarn create zudo-doc

# bun
bunx create-zudo-doc
```

Running without arguments starts the **interactive mode**: the CLI prompts for project name, language, color scheme, and which optional features to enable, then scaffolds the project and optionally installs dependencies.

## Non-Interactive Usage

Pass `--yes` to accept all defaults and skip prompts, or provide flags to pre-answer specific questions:

```bash
# All defaults, no prompts
pnpm create zudo-doc my-docs --yes

# Fully specified, non-interactive
pnpm create zudo-doc my-docs \
  --lang ja \
  --scheme "Default Dark" \
  --no-i18n \
  --search \
  --pm pnpm \
  --install
```

## Options

### Project basics

| Flag | Description | Default |
|------|-------------|---------|
| `[project-name]` | Project name (positional arg or `--name`) | prompted |
| `--lang <code>` | Default language: `en`, `ja`, `zh-cn`, `zh-tw`, `ko`, `es`, `fr`, `de`, `pt` | `en` |
| `--pm <manager>` | Package manager: `pnpm`, `npm`, `yarn`, `bun` | detected |
| `--[no-]install` | Install dependencies after scaffolding | prompted |
| `-y, --yes` | Use defaults for all unspecified options, skip prompts | — |
| `-h, --help` | Show help | — |

### Color scheme

| Flag | Description |
|------|-------------|
| `--color-scheme-mode <mode>` | `single` (one fixed scheme) or `light-dark` (OS-aware) |
| `--scheme <name>` | Color scheme name when using `single` mode |
| `--light-scheme <name>` | Light scheme when using `light-dark` mode |
| `--dark-scheme <name>` | Dark scheme when using `light-dark` mode |
| `--default-mode <mode>` | `light` or `dark` — initial mode in `light-dark` |
| `--[no-]respect-system-preference` | Follow OS color scheme preference |

### Features

Each feature has a `--[no-]<flag>` form. Passing `--feature` enables it; `--no-feature` disables it; omitting the flag triggers the interactive prompt (or uses the default when `--yes` is set).

| Flag | Description | Default |
|------|-------------|---------|
| `--[no-]i18n` | Multi-language support (adds a secondary locale) | off |
| `--[no-]search` | Pagefind full-text search | on |
| `--[no-]sidebar-filter` | Real-time sidebar filter | on |
| `--[no-]image-enlarge` | Click-to-enlarge for oversized images | on |
| `--[no-]tag-governance` | Vocabulary-aware tag audit + suggest scripts | on |
| `--[no-]claude-resources` | Auto-generate Claude Code docs (`CLAUDE.md`, `llms.txt`) | off |
| `--[no-]claude-skills` | Ship zudo-doc Claude Code skills (design-system, translate, version-bump) | off |
| `--[no-]design-token-panel` | Interactive panel for tweaking spacing, font, color tokens | off |
| `--[no-]sidebar-resizer` | Draggable sidebar width handle | off |
| `--[no-]sidebar-toggle` | Show/hide desktop sidebar button | off |
| `--[no-]versioning` | Multi-version documentation support | off |
| `--[no-]doc-history` | Show per-page document edit history | off |
| `--[no-]body-foot-util` | Right-aligned strip below each doc (history trigger + GitHub source link) | off |
| `--[no-]llms-txt` | Generate `llms.txt` for LLM consumption | off |
| `--[no-]skill-symlinker` | Symlink documentation skills into `.claude/` | off |
| `--[no-]tauri` | Tauri desktop app — Mode 1 offline reader | off |
| `--[no-]tauri-dev` | Tauri dev wrapper — Mode 2 configurable dev wrapper | off |
| `--[no-]footer-nav-group` | Navigation links in the footer | off |
| `--[no-]footer-copyright` | Copyright notice in the footer | on |
| `--[no-]footer-taglist` | Grouped tag index in the footer (requires tag-governance) | off |
| `--[no-]changelog` | Changelog page | off |

### Advanced

| Flag | Description |
|------|-------------|
| `--github-url <url>` | GitHub repository URL — drives header link and "View source" links |
| `--preset <path>` | Load all settings from a JSON file (use `-` for stdin) |

## Examples

```bash
# Japanese docs site with search and sidebar, using pnpm
pnpm create zudo-doc my-docs \
  --lang ja \
  --search \
  --sidebar-filter \
  --pm pnpm \
  --install \
  --yes

# Light/dark color scheme with the Default pairing
pnpm create zudo-doc my-docs \
  --color-scheme-mode light-dark \
  --light-scheme "Default Light" \
  --dark-scheme "Default Dark" \
  --default-mode dark \
  --yes

# Fully featured site from a preset file
pnpm create zudo-doc my-docs --preset ./my-preset.json --install
```

## Programmatic API

```ts
import { createZudoDoc } from "create-zudo-doc";

await createZudoDoc({
  projectName: "my-docs",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Default Dark",
  features: ["search", "sidebarFilter", "tagGovernance"],
  packageManager: "pnpm",
  install: true,
});
```

## Documentation

Full documentation at [zudo-doc.takazudomodular.com](https://zudo-doc.takazudomodular.com).

## License

MIT — see [LICENSE](./LICENSE).
