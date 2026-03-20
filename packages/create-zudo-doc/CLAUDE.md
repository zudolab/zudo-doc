# create-zudo-doc

CLI scaffold tool for creating new zudo-doc documentation sites. Generates a project with configurable features, color schemes, and i18n support.

## Key Files

| File | Role |
|------|------|
| `src/scaffold.ts` | Copies template from main project, generates `package.json` with appropriate dependencies |
| `src/strip.ts` | Removes files, imports, and code for disabled features |
| `src/settings-gen.ts` | Generates `src/config/settings.ts` with user-chosen options |
| `src/constants.ts` | Feature definitions, color scheme lists, light-dark pairings |
| `src/cli.ts` | CLI argument parsing (commander) |
| `src/api.ts` | Programmatic API (`createZudoDoc()`) |
| `src/prompts.ts` | Interactive prompts (inquirer) |
| `src/index.ts` | Entry point |

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

1. **`src/scaffold.ts`** — Add/remove dependencies in `generatePackageJson()`
2. **`src/strip.ts`** — Add stripping logic for files and imports when the feature is disabled
3. **`src/settings-gen.ts`** — Add the setting field to generated `settings.ts`
4. **`src/constants.ts`** — Add feature to definitions if needed
5. **`src/__tests__/scaffold.test.ts`** — Update tests

After changes, run `/l-sync-create-zudo-doc` to verify no drift remains between the main project and the generator.
