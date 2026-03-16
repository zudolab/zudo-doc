# create-zudo-doc

Scaffold a new [zudo-doc](https://github.com/zudolab/zudo-doc) documentation site.

## Quick Start

```bash
pnpm create zudo-doc
```

Or with other package managers:

```bash
npm create zudo-doc
yarn create zudo-doc
bunx create-zudo-doc
```

## Non-Interactive Usage

Use `--yes` to accept all defaults, or pass flags directly:

```bash
# All defaults
pnpm create zudo-doc my-docs --yes

# Fully specified
pnpm create zudo-doc my-docs --lang ja --scheme Dracula --no-i18n --pm pnpm --install
```

## Options

```
--name <name>                Project name (or first positional arg)
--lang <code>                Default language (en, ja, zh-cn, zh-tw, ko, es, fr, de, pt)
--color-scheme-mode <mode>   single | light-dark
--scheme <name>              Color scheme (single mode)
--light-scheme <name>        Light scheme (light-dark mode)
--dark-scheme <name>         Dark scheme (light-dark mode)
--default-mode <mode>        light | dark (light-dark mode)
--[no-]respect-system-preference
--[no-]i18n                  Multi-language support
--[no-]search                Pagefind full-text search
--[no-]sidebar-filter        Sidebar filter
--[no-]claude-resources      Claude Code docs generation
--pm <manager>               pnpm | npm | yarn | bun
--[no-]install               Install dependencies after scaffolding
-y, --yes                    Use defaults, skip prompts
-h, --help                   Show help
```

## Programmatic API

```ts
import { createZudoDoc } from "create-zudo-doc";

await createZudoDoc({
  projectName: "my-docs",
  defaultLang: "en",
  colorSchemeMode: "single",
  singleScheme: "Dracula",
  features: ["search", "sidebarFilter"],
  packageManager: "pnpm",
  install: true,
});
```
