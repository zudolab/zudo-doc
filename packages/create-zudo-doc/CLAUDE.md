# create-zudo-doc

CLI scaffold tool for creating new zudo-doc documentation sites. Generates a project with configurable features, a Default light/dark color scheme, and i18n support.

> **Eject CLI contract:** the per-component `zudo-doc eject <component>` swizzle CLI + `.zudo-doc.json` provenance marker are specified in `docs/eject-contract.md` (C0 #2359; implemented by C1 #2362; Decision 5 revised by S4 #2373 — the `zudo-doc` bin now ships from `@takazudo/zudo-doc`, not `create-zudo-doc`, so it is reachable in generated projects).

## Architecture (minimal-scaffold, epic zudolab/zudo-doc#2651 Wave 6 #2660)

The generator emits the **locked ~12-file minimal manifest** — one config file
(`zfb.config.ts`, `zudoDoc({ ...only fields you chose })`) plus markdown
content plus a handful of unavoidable root files. Everything else (layout,
chrome, islands, default `@theme` tokens, even the doc ROUTES themselves via
`packageOwnedRoutes`) ships from `@takazudo/zudo-doc` in `node_modules`.

1. Copy the minimal **base template** (`templates/base/`) — no injection
   anchors left; every file is either shipped verbatim or (`global.css`)
   patched by exactly one feature's `postProcess` hook.
2. **Generate** the ONE `zfb.config.ts` programmatically (`zfb-config-gen.ts`)
   — diff-from-defaults: only fields the user actually chose are emitted.
3. **Compose** selected features — copy feature files (only a few features
   still have any: `i18n`, `tagGovernance`, `tauri`, `tauriDev`,
   `skillSymlinker`) and run `postProcess` hooks for the handful of cases
   that need a small source patch (`docHistory` threads itself into the doc
   stub(s); `designTokenPanel` inserts the one conditional zdtp CSS import
   line; `tagGovernance` writes a tiny `src/config/` pair — see each
   module's header comment for why).

Both base and i18n document stubs unconditionally consume
`virtual:zudo-doc-chrome-bindings`. The doc-history post-processor spreads the
configured object first and replaces only `DocHistory`, so it must never drop
primary slots, `headerRightComponents`, or `mdxExtras`. Presentational chrome
customization is config + one typed module; it does not require a route fork.

Most feature modules are now **pure settings-field emission**: the feature
only changes what `zfb-config-gen.ts` writes into `zudoDoc({...})`, because
the corresponding UI/behavior is entirely package-owned already (package-first
migration, epics #2321/#2344/#2356). `src/features/<name>.ts`'s header
comment says, per feature, exactly why there's nothing (or almost nothing)
left to inject or copy.

## Key Files

| File | Role |
|------|------|
| `src/scaffold.ts` | Orchestrates the scaffold pipeline: copy base, seed content, generate `zfb.config.ts` + `package.json`, compose features |
| `src/compose.ts` | Composition engine: injection system (mostly unused now — see below), feature resolution |
| `src/features/*.ts` | Feature modules — settings-field emission via `zfb-config-gen.ts` + a handful of genuine file copies / `postProcess` patches (18 modules) |
| `src/zfb-config-gen.ts` | The SINGLE config generator — emits the one `zfb.config.ts` (`defineConfig(zudoDoc({...}))`), diff-from-defaults against a local mirror of `packages/zudo-doc/src/config.ts`'s `DEFAULT_SETTINGS`. Replaces the former `settings-gen.ts` + `zfb-config-gen.ts` two-file split — there is no more `src/config/settings.ts` in a fresh scaffold |
| `src/claude-md-gen.ts` | Generates the per-project `CLAUDE.md` for the scaffolded site, including current-only Shiki, chrome bindings, and binding-aware eject guidance |
| `src/preset.ts` | Resolves a JSON `--preset` file (or CLI flags) into `UserChoices` — unrelated to the package's own `@takazudo/zudo-doc/preset`, despite the similar name |
| `src/constants.ts` | Feature definitions, supported langs, header-right labels, and the current Default light/dark scheme pairing |
| `src/utils.ts` | Shared utilities (patchFile, patchDefaultLang, getSecondaryLang) |
| `src/cli.ts` | CLI argument parsing (minimist) |
| `src/api.ts` | Programmatic API (`createZudoDoc()`) |
| `src/prompts.ts` | Interactive prompts (@clack/prompts) |
| `src/index.ts` | Entry point |

### Template Directories

| Directory | Role |
|-----------|------|
| `templates/base/` | The locked ~12-file minimal manifest (barebone, EN-only): `pages/index.tsx` (1-line re-export), `pages/docs/[[...slug]].tsx` (self-contained doc stub — see its header comment for why it's required), `src/styles/global.css` (~20-line `@import` chain + token-override slot), `tsconfig.json` (5-line extends form). `zfb.config.ts`/`package.json`/`CLAUDE.md`/`.gitignore`/`.npmrc` are generated programmatically, not copied from here. |
| `templates/features/*/files/` | Feature-specific files copied when a feature is selected. Only `i18n` (locale doc stub), `tauri`, and `tauriDev` (Rust shells) have template directories. `tagGovernance` writes one explicit tag vocabulary/config module in its `postProcess`; all audit/suggest behavior comes from package-owned bins. |

### Injection anchors — mostly retired

`src/compose.ts`'s `ANCHOR_FILES` is now an **empty array**. Every anchor
target the old system targeted — `pages/lib/_body-end-islands.tsx`,
`src/config/settings-types.ts`, `src/styles/global.css`'s `@slot:global-css:*`
comments — is gone from `templates/base/` (the package owns chrome/islands/
settings-types entirely now; `global.css` shrank to a fixed `@import` chain
with no anchors). The `Injection`/`applyInjections`/`cleanAnchors` machinery
in `compose.ts` is kept as infrastructure for a future feature that
genuinely needs it, not because anything uses it today — a few feature
modules (`docHistory`, `designTokenPanel`, `tagGovernance`) instead use a
plain `postProcess` hook that does a small, targeted string patch (see each
module's source).

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
2. **`src/features/<name>.ts`** — Create a feature module. Most new features need ONLY a settings field (see step 6) — leave `injections: []` and no `postProcess` unless the feature genuinely needs a file copy or a small source patch (rare; see `docHistory`/`designTokenPanel`/`tagGovernance`/`tauri` for the current examples and why each one needs it)
3. **`src/features/index.ts`** — Register the feature module
4. **`templates/features/<name>/files/`** — Only add files here if the feature has no package-owned equivalent (a genuine gap — check whether `@takazudo/zudo-doc` already ships the component/logic before adding a host copy)
5. **`src/scaffold.ts`** — Add dependencies in `generatePackageJson()` if needed
6. **`packages/zudo-doc/src/preset.ts`** — If the feature introduces a new plugin or collection, add the settings-driven logic to `zudoDocPreset()`.
7. **`packages/zudo-doc/src/config.ts`** — Add the field to `ZudoDocConfig` (with a `@default` JSDoc — enforced by `config-jsdoc.test.ts`) and to `DEFAULT_SETTINGS`. This is the field census `zfb-config-gen.ts`'s diff-from-defaults logic reads against.
8. **`src/zfb-config-gen.ts`** — Add the field to `DEFAULT_MIRROR` (hand-kept copy of the package's `DEFAULT_SETTINGS` — see the file header comment for why it's a local mirror, not an import) and wire the user choice → field mapping in `buildDesiredConfig()` + `FIELD_ORDER`
9. **`src/__tests__/scaffold.test.ts`** — Update tests

After changes, run `/l-update-generator` to verify no drift remains between the main project and the generator.
