# create-zudo-doc

CLI scaffold tool for creating new zudo-doc documentation sites. Generates a project with configurable features, a Default light/dark color scheme, and i18n support.

> **Eject CLI contract:** the per-component `zudo-doc eject <component>` swizzle CLI + `.zudo-doc.json` provenance marker are specified in `docs/eject-contract.md` (C0 #2359; implemented by C1 #2362; Decision 5 revised by S4 #2373 — the `zudo-doc` bin now ships from `@takazudo/zudo-doc`, not `create-zudo-doc`, so it is reachable in generated projects).

## Architecture (minimal-scaffold, epic zudolab/zudo-doc#2651 Wave 6 #2660)

The generator emits the **locked ~13-file minimal manifest** — one config file
(`zfb.config.ts`, `zudoDoc({ ...only fields you chose })`) plus markdown
content plus a handful of unavoidable root files. Everything else (layout,
chrome, islands, default `@theme` tokens, even the doc ROUTES themselves via
`packageOwnedRoutes`) ships from `@takazudo/zudo-doc` in `node_modules`.

1. Copy the minimal **base template** (`templates/base/`) — no injection
   anchors left; every file is either shipped verbatim or (`global.css`)
   patched by exactly one feature's `postProcess` hook.
2. **Generate** the ONE `zfb.config.ts` programmatically (`zfb-config-gen.ts`)
   — diff-from-defaults: only fields the user actually chose are emitted.
3. **Compose** selected features — copy feature files (only four features have
   a `templates/features/<name>/files/` directory: `claudeSkills`, `i18n`,
   `tauri`, `tauriDev`) and run `postProcess` hooks for the handful of cases
   that need a small source patch (`docHistory` threads itself into the doc
   stub(s); `designTokenPanel` inserts the one conditional zdtp CSS import
   line; `tagGovernance` writes a tiny `src/config/` pair *inline* — it has no
   template directory — see each module's header comment for why).

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
| `src/features/*.ts` | Feature modules — settings-field emission via `zfb-config-gen.ts` + a handful of genuine file copies / `postProcess` patches. 19 module files, 19 `featureModules` keys in `index.ts` — one of which (`footer`) is a pseudo-feature triggered by `footerNavGroup`/`footerCopyright`/`footerTaglist`. `sidebarFilter` has no module (built into the package's sidebar tree); `skillSymlinker`, `claudeSkills`, and `changelog` are handled directly in `scaffold.ts` |
| `src/zfb-config-gen.ts` | The SINGLE config generator — emits the one `zfb.config.ts` (`defineConfig(zudoDoc({...}))`), diff-from-defaults against a local mirror of `packages/zudo-doc/src/config.ts`'s `DEFAULT_SETTINGS`. Replaces the former `settings-gen.ts` + `zfb-config-gen.ts` two-file split — there is no more `src/config/settings.ts` in a fresh scaffold |
| `src/claude-md-gen.ts` | Generates the per-project `CLAUDE.md` for the scaffolded site, including the current zfb semantic-highlighting contract, chrome bindings, and binding-aware eject guidance |
| `src/preset.ts` | Resolves a JSON `--preset` file (or CLI flags) into `UserChoices` — unrelated to the package's own `@takazudo/zudo-doc/preset`, despite the similar name |
| `src/constants.ts` | Feature definitions, supported langs, header-right labels, and the current Default light/dark scheme pairing |
| `src/utils.ts` | Shared utilities (patchFile, patchDefaultLang, getSecondaryLang) |
| `src/cli.ts` | CLI argument parsing (minimist) |
| `src/api.ts` | Programmatic API (`createZudoDoc()`). `CreateOptions` must stay in sync with `PresetJson` (`preset.ts`) — a field added to one and not the other is a type-level parity gap (#2922). Shape validation for `headerRightItems`/`metaTags` is shared via `preset.ts`'s exported `validateHeaderRightItems()`/`validateMetaTags()` — extend those, don't re-implement the allowlists here. |
| `src/prompts.ts` | Interactive prompts (@clack/prompts) |
| `src/index.ts` | Entry point |

### Template Directories

| Directory | Role |
|-----------|------|
| `templates/base/` | The locked ~13-file minimal manifest (barebone, EN-only): `pages/index.tsx` (1-line re-export), `pages/docs/[[...slug]].tsx` (self-contained doc stub — see its header comment for why it's required), `src/styles/global.css` (~20-line `@import` chain + token-override slot), `tsconfig.json` (5-line extends form). `zfb.config.ts`/`package.json`/`CLAUDE.md`/`.gitignore`/`.npmrc`/`pnpm-workspace.yaml` are generated programmatically, not copied from here. |
| `templates/features/*/files/` | Feature-specific files copied when a feature is selected. Exactly four have a template directory: `claudeSkills` (skill copies, driven from `scaffold.ts`), `i18n` (locale doc stub), `tauri` and `tauriDev` (Rust shells). `tagGovernance` has **no** template directory — it writes one explicit tag vocabulary/config module inline in its `postProcess`; all audit/suggest behavior comes from package-owned bins. |

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

**Follow the "Feature Change Checklist" in the repo-root `CLAUDE.md`** — that is the single
canonical ordering, and it starts at `packages/zudo-doc/src/config.ts` (the ONE field census)
rather than at this package. This file deliberately keeps no second copy: the two orderings
used to be hand-maintained side by side and drifted (they disagreed about which features have
a `templates/features/` directory).

Generator-side touchpoints, for orientation only — the root checklist has the authoritative
order and the reasons: `src/constants.ts` (CLI flag), `src/features/<name>.ts` +
`src/features/index.ts` (module + registration), `src/zfb-config-gen.ts` (`DEFAULT_MIRROR` +
`buildDesiredConfig()` + `FIELD_ORDER`), `src/scaffold.ts` (deps), `src/__tests__/scaffold.test.ts`.

After changes, run `/l-update-generator` to verify no drift remains between the main project and the generator.
