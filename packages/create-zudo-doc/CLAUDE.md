# create-zudo-doc

CLI scaffold tool for creating new zudo-doc documentation sites. Generates a project with configurable features, color schemes, and i18n support.

## Architecture

The generator uses an **additive composition** approach:

1. Copy a minimal **base template** (`templates/base/`) — core files with injection anchors
2. **Generate** `astro.config.ts`, `content.config.ts`, `settings.ts`, `package.json` programmatically
3. **Compose** selected features — copy feature files + inject code into shared files at anchor points
4. Clean up unused anchors

This replaces the old "copy everything then strip" approach. Features are added, not removed — so dead code cannot remain.

## Key Files

| File | Role |
|------|------|
| `src/scaffold.ts` | Orchestrates the scaffold pipeline: copy base, generate configs, compose features |
| `src/compose.ts` | Composition engine: injection system, anchor cleanup, feature resolution |
| `src/features/*.ts` | Feature modules defining injections for each optional feature (10 modules) |
| `src/astro-config-gen.ts` | Programmatic `astro.config.ts` generator (conditional imports/integrations) |
| `src/content-config-gen.ts` | Programmatic `content.config.ts` generator (locale/version collections) |
| `src/settings-gen.ts` | Generates `src/config/settings.ts` with user-chosen options |
| `src/constants.ts` | Feature definitions, color scheme lists, light-dark pairings |
| `src/utils.ts` | Shared utilities (patchFile, patchDefaultLang, getSecondaryLang) |
| `src/cli.ts` | CLI argument parsing (commander) |
| `src/api.ts` | Programmatic API (`createZudoDoc()`) |
| `src/prompts.ts` | Interactive prompts (inquirer) |
| `src/index.ts` | Entry point |

### Template Directories

| Directory | Role |
|-----------|------|
| `templates/base/` | Minimal project with injection anchors (73 files, no optional feature code) |
| `templates/features/*/files/` | Feature-specific files copied when a feature is selected |

### Injection Anchors

Shared files in `templates/base/` have anchor comments where features inject code:

- `src/layouts/doc-layout.astro` — 16 anchors (imports, head scripts, sidebar, breadcrumb, footer, body-end)
- `src/components/header.astro` — 4 anchors (imports, actions, after-theme-toggle)
- `src/styles/global.css` — 2 anchors (theme tokens, feature styles)

## Testing

### Unit tests

```bash
pnpm test
```

Runs vitest tests in `src/__tests__/`.

### Generator CLI integration tests

Two Claude Code skills test the full scaffold-build-run cycle:

- `/l-generator-cli-tester <pattern>` — Test a single generation pattern
- `/l-run-generator-cli-whole-test` — Run all 9 patterns, fix bugs, verify everything

#### Test patterns

| Pattern | Description |
|---------|-------------|
| `barebone` | Everything OFF — minimal project |
| `search` | Only search enabled |
| `i18n` | Only i18n enabled |
| `sidebar-filter` | Only sidebar filter enabled |
| `claude-resources` | Only Claude Resources enabled |
| `color-tweak-panel` | Only color tweak panel enabled (API only, no CLI flag) |
| `light-dark` | Light-dark color scheme mode |
| `lang-ja` | Japanese as default language |
| `all-features` | Everything ON |

Always rebuild the CLI before testing:

```bash
pnpm build
```

## Adding a New Feature

When adding a feature to the main zudo-doc project that the generator should support:

1. **`src/constants.ts`** — Add feature to `FEATURES` array if it needs a CLI flag
2. **`src/features/<name>.ts`** — Create a feature module defining injections for shared files
3. **`src/features/index.ts`** — Register the feature module
4. **`templates/features/<name>/files/`** — Add feature-specific files to copy
5. **`src/scaffold.ts`** — Add dependencies in `generatePackageJson()` if needed
6. **`src/astro-config-gen.ts`** — Add conditional imports/integrations if the feature affects `astro.config.ts`
7. **`src/content-config-gen.ts`** — Add collections if the feature affects content config
8. **`src/settings-gen.ts`** — Add the setting field to generated `settings.ts`
9. **`src/__tests__/scaffold.test.ts`** — Update tests

After changes, run `/l-sync-create-zudo-doc` to verify no drift remains between the main project and the generator.
