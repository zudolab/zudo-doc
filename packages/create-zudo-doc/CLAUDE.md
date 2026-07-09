# create-zudo-doc

CLI scaffold tool for creating new zudo-doc documentation sites. Generates a project with configurable features, a Default light/dark color scheme, and i18n support.

> **Eject CLI contract:** the per-component `zudo-doc eject <component>` swizzle CLI + `.zudo-doc.json` provenance marker are specified in `docs/eject-contract.md` (C0 #2359; implemented by C1 #2362; Decision 5 revised by S4 #2373 — the `zudo-doc` bin now ships from `@takazudo/zudo-doc`, not `create-zudo-doc`, so it is reachable in generated projects).

## Architecture

The generator uses an **additive composition** approach:

1. Copy a minimal **base template** (`templates/base/`) — core files with injection anchors
2. **Generate** `zfb.config.ts`, `settings.ts`, `package.json` programmatically
3. **Compose** selected features — copy feature files + inject code into shared files at anchor points
4. Clean up unused anchors

This replaces the old "copy everything then strip" approach. Features are added, not removed — so dead code cannot remain.

## Key Files

| File | Role |
|------|------|
| `src/scaffold.ts` | Orchestrates the scaffold pipeline: copy base, generate configs, compose features |
| `src/compose.ts` | Composition engine: injection system, anchor cleanup, feature resolution |
| `src/features/*.ts` | Feature modules defining injections for each optional feature (15 modules) |
| `src/zfb-config-gen.ts` | Programmatic `zfb.config.ts` generator — S5b: now emits a thin preset-based config that spreads `zudoDocPreset()` from `@takazudo/zudo-doc/preset`; feature-agnostic (same output for all feature combinations) |
| `src/settings-gen.ts` | Generates `src/config/settings.ts` with user-chosen options |
| `src/claude-md-gen.ts` | Generates the per-project `CLAUDE.md` for the scaffolded site |
| `src/preset.ts` | Resolves the user-chosen preset into a concrete feature set |
| `src/constants.ts` | Feature definitions, supported langs, header-right labels, and the two Default color schemes (single Default light/dark pairing — the legacy multi-scheme catalog was dropped) |
| `src/utils.ts` | Shared utilities (patchFile, patchDefaultLang, getSecondaryLang) |
| `src/cli.ts` | CLI argument parsing (minimist) |
| `src/api.ts` | Programmatic API (`createZudoDoc()`) |
| `src/prompts.ts` | Interactive prompts (@clack/prompts) |
| `src/index.ts` | Entry point |

### Template Directories

| Directory | Role |
|-----------|------|
| `templates/base/` | Minimal project with injection anchors (post-cutover: only `.tsx`, `.ts`, `.css`, `.json` — no `.astro`) |
| `templates/features/*/files/` | Feature-specific files copied when a feature is selected |

### Injection Anchors

The files shipped with anchors in `templates/base/` today are:

- `pages/_mdx-components.ts` — anchors consumed by the imageEnlarge feature
- `pages/lib/_body-end-islands.tsx` — anchors consumed by the tauri and designTokenPanel features
- `src/config/settings-types.ts` — replace-range anchors (`@slot:settings-types:trigger-names:start`/`:end`) consumed by the designTokenPanel feature to inject `"design-token-panel"` into `HeaderRightTriggerName`

`src/styles/global.css` no longer carries `@slot:global-css:*` anchors (zudolab/zudo-doc#2655, epic #2651 Wave 3): the file shrank to a fixed ~22-line `@import`-chain + token-override contract, and the boilerplate `@theme` block it used to hand-carry now ships from `@takazudo/zudo-doc/theme.css`. The now-dead CSS injections in `src/features/design-token-panel.ts` (zdtp `@import`), `src/features/doc-history.ts` (diff-viewer CSS), and `src/features/dynamic-page-transition.ts` (page-loading `@theme` token + view-transition CSS) silently no-op (`applyInjections` skips an anchor it can't find) — removal of that dead code, and conditional stripping of the now-unconditional zdtp `@import` line for non-`designTokenPanel` projects, is tracked separately in the generator-rewrite sub-issue (#2660). Until #2660 lands, do not rely on those three feature modules' CSS injections; `features.css` already ships the diff-viewer and view-transition CSS unconditionally (epic #2344 S4), and the zdtp import ships as the always-present (pending #2660's gating) literal line in the template.

The `ANCHOR_FILES` list in `src/compose.ts` is the source of truth for which files are anchor-cleaned after composition. Feature-specific files are copied wholesale from `templates/features/<name>/files/`; no anchor injection into doc-layout/header is required post-zfb-cutover.

`src/compose.ts` `ANCHOR_LINE_RE` accepts JSX-comment (`{/* @slot:… */}`), block-comment, line-comment, HTML-comment, and shell-comment forms so anchors work across `.tsx`, `.ts`, and `.css`.

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
| `design-token-panel` | Only design token panel enabled (uses `--design-token-panel` CLI flag) |
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
4. **`templates/features/<name>/files/`** — Add feature-specific files to copy (use `.tsx` for components, `.ts` for utilities — no `.astro`)
5. **`src/scaffold.ts`** — Add dependencies in `generatePackageJson()` if needed
6. **`packages/zudo-doc/src/preset.ts`** — If the feature introduces a new plugin or collection, add the settings-driven logic to `zudoDocPreset()`. The generated `zfb.config.ts` is a thin preset-based file (S5b #2329) — it does NOT need updating for features that are settings-driven (the preset reads the new `settings.*` field directly). Only update `src/zfb-config-gen.ts` if the generated config shape itself must change (rare).
7. **`src/settings-gen.ts`** — Add the setting field to generated `settings.ts`
8. **`src/__tests__/scaffold.test.ts`** — Update tests

After changes, run `/l-update-generator` to verify no drift remains between the main project and the generator.
