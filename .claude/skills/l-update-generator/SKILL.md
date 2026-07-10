---
name: l-update-generator
description: "Detect and fix drift between the main zudo-doc project and the create-zudo-doc generator CLI. Use when adding/removing features, or to verify the generator stays in sync. Also triggered by \"update generator\", \"sync generator\", \"l-update-generator\", \"l-sync-create-zudo-doc\"."
---

# Update create-zudo-doc Generator

Detect and fix drift between the main zudo-doc project and the `create-zudo-doc` CLI generator.

## Architecture Overview (minimal-scaffold, epic zudolab/zudo-doc#2651)

The generator emits the **locked ~12-file minimal manifest** — one config
file (`zfb.config.ts`, `zudoDoc({ ...only fields the user chose })`) plus
markdown content plus a handful of unavoidable root files. Everything else
(layout, chrome, islands, default `@theme` tokens, even the doc ROUTES
themselves via `packageOwnedRoutes`) ships from `@takazudo/zudo-doc` in
`node_modules`. There is no more copy-then-strip and no more `@slot:`
injection anchors:

1. Copy the minimal **base template** (`templates/base/`) — 5 files, no
   anchors: `pages/index.tsx`, `pages/docs/[[...slug]].tsx`,
   `src/styles/global.css`, `tsconfig.json`, `scripts/setup-doc-skill.sh`
   (the last is excluded from the unconditional mirror and copied only when
   `skillSymlinker` is selected — see `scaffold.ts`'s `EXCLUDE_FROM_MIRROR`).
2. **Generate** the ONE `zfb.config.ts` programmatically (`zfb-config-gen.ts`)
   — diff-from-defaults: only fields whose value differs from the matching
   `ZudoDocConfig` `@default` are emitted (`siteName` is always emitted).
   There is no more `settings-gen.ts` and no more `src/config/settings.ts`
   in a fresh scaffold.
3. **Compose** selected features (`compose.ts` + `src/features/*.ts`) — most
   feature modules are now **pure settings-field emission** (`injections: []`,
   no `postProcess`) because the corresponding UI/behavior is entirely
   package-owned (package-first migration, epics #2321/#2344/#2356). Only a
   handful still do real work:
   - **Genuine file copies**: `i18n` (locale doc-route stub), `tagGovernance`
     (`scripts/tags-audit.ts` / `scripts/tags-suggest.ts`), `tauri` /
     `tauriDev` (Rust shells under `src-tauri*/`), `skillSymlinker`
     (`scripts/setup-doc-skill.sh`, copied in `scaffold.ts` directly, not a
     `templates/features/` dir), `claudeSkills` (copies curated
     `zudo-doc-*` Claude Code skills from the monorepo, also in
     `scaffold.ts` directly).
   - **`postProcess` patches** (small, targeted string patches to an
     already-generated file — never new files): `docHistory` (patches the
     doc-route stub(s) to statically import the real `DocHistory` and thread
     it through `createChrome`), `designTokenPanel` (inserts the one
     conditional `@import "@takazudo/zdtp/styles.css";` line into
     `global.css` — the one thing that can't ship unconditionally from
     `@takazudo/zudo-doc/theme.css`, since it pulls in zdtp's own bytes),
     `tagGovernance` (also writes a tiny `src/config/settings.ts` +
     `tag-vocabulary.ts` pair — see "Known deviation" below), `tauri`
     (patches `Cargo.toml`/`tauri.conf.json` names + appends `.gitignore`
     entries), `tauriDev` (similar name patching).

**Known deviation (not a bug — verify it stays true, don't "fix" it):**
`tagGovernance`'s `postProcess` writes `src/config/settings.ts` +
`src/config/tag-vocabulary.ts` even though there is no more project-wide
settings file. This exists ONLY because `@takazudo/zudo-doc`'s `tags-audit`
bin (`packages/zudo-doc/bin/tags-audit-runner.ts`) still dynamically
`import()`s those exact paths by string — a legacy coupling that predates
the single-`zfb.config.ts` model and is out of the generator's scope to fix
(a package-side follow-up would remove it). See `src/features/tag-governance.ts`'s
header comment.

## When to Use

- After adding or removing a feature from zudo-doc
- When the drift-detection test fails
- Periodically to verify generator health
- User says "update generator", "sync generator", "check generator drift", "l-update-generator", or the old name "l-sync-create-zudo-doc"

**Quick pre-check**: Run `pnpm check:template-drift` first to get an automated summary of base template drift. Then proceed with the full workflow below for the config census, dependency, and feature composition drift.

## Step 1: Analyze Drift

Compare the main project's source files with what the generator produces.

### 1a. Settings/config-field drift

The field census now lives in ONE place — the package, not this repo's own
`src/config/settings.ts`:

- **Census (source of truth)**: `packages/zudo-doc/src/config.ts` —
  `ZudoDocConfig` (the documented field surface, every field carries a
  `@default` JSDoc) and `DEFAULT_SETTINGS` (the actual default values).
- **Generator**: `packages/create-zudo-doc/src/zfb-config-gen.ts` —
  `DEFAULT_MIRROR` (a hand-kept local copy of `DEFAULT_SETTINGS`, only for
  fields the generator can ever set — it can't `import` the package, see the
  file's header comment for why) + `buildDesiredConfig()` (user-choice →
  field mapping) + `FIELD_ORDER` (cosmetic emission order).

Compare field names between `ZudoDocConfig` and `zfb-config-gen.ts`'s
`DEFAULT_MIRROR`/`FIELD_ORDER`/`buildDesiredConfig()`. A field the generator
can plausibly set (has a CLI flag or prompt) but is missing from
`DEFAULT_MIRROR`/`FIELD_ORDER` is drift. A field `DEFAULT_MIRROR` carries
whose default value no longer matches `DEFAULT_SETTINGS` is also drift
(stale mirror).

This repo's OWN `src/config/settings.ts` (the showcase's real settings
object, spread into `zfb.config.ts`'s `zudoDoc({ ...settings, ... })`) is a
secondary, informal cross-check — useful for spotting a field the showcase
demonstrates but the generator never learned to emit — but it is NOT the
census. Don't chase drift against it that isn't also drift against
`ZudoDocConfig`.

### 1b. Dependency drift

Compare dependencies:

- **Main**: `package.json` — root dependencies
- **Generator**: `packages/create-zudo-doc/src/scaffold.ts` `generatePackageJson()` — generated deps

Check for packages used in base template files and feature files that are not included in the generated package.json. Remember: `zod`, `preact`, `preact-render-to-string`, `diff`, and `@takazudo/zdtp` are unconditional base deps now (each has a header comment explaining the "optional peer that's actually required at build time" trap — see `generatePackageJson()`).

### 1c. zfb config / preset drift

Compare the main project's `zfb.config.ts` (`zudoDoc({ ...settings, chromeBindingsModule: "./src/chrome-bindings" })`) with what the generator produces:

- **Main**: `zfb.config.ts` — spreads `settings` from `src/config/settings.ts` into `zudoDoc({...})`
- **Generator**: `packages/create-zudo-doc/src/zfb-config-gen.ts` — programmatic diff-from-defaults generation, same `zudoDoc()` entry point

Both sides go through the SAME `zudoDoc()` function
(`packages/zudo-doc/src/config.ts`), so there is no separate "integration
wiring" to check field-by-field anymore — `zudoDocPreset()` (the internal
fragment builder `zudoDoc()` calls) is the one place collections/plugins/
markdown logic lives. Only check `packages/zudo-doc/src/preset.ts` when a
NEW plugin or collection needs wiring from a settings field (see 1d).

### 1d. Feature composition drift

Check that features in the main project have corresponding feature modules:

- **Main**: does the showcase demonstrate a behavior with no `ZudoDocConfig` field and no generator feature module backing it?
- **Generator**: `packages/create-zudo-doc/src/features/*.ts` — feature modules (mostly settings-field emission now; injections/postProcess only for the handful of genuine gaps listed in "Architecture Overview" above)
- **Templates**: `packages/create-zudo-doc/templates/features/*/files/` — feature-specific files (only `i18n`, `tagGovernance`, `tauri`, `tauriDev` still have any)

For each feature-gated behavior in the main project, verify:

1. A feature module exists in `src/features/` and is registered in `src/features/index.ts`
2. If the feature ships genuine files, they exist in `templates/features/<name>/files/`
3. If the feature introduces a new plugin/collection, `packages/zudo-doc/src/preset.ts`'s `zudoDocPreset()` wires it from the matching settings field — NOT the generator (the generator only ever emits the field value)
4. If the feature has a `postProcess` hook, verify the string patch it applies still matches the current shape of the file it patches (e.g. `docHistory`'s patch targets the exact `createChrome(routeCtx);` / `import { createChrome } from "@takazudo/zudo-doc/chrome";` lines in the doc-route stub — a stub rewrite elsewhere breaks this silently since the patch is a literal string match, not an AST edit)

### 1e. Base template drift

Compare the 5 base template files against their showcase / package counterparts (there is very little to compare now — most showcase behavior is package-owned, not template-mirrored):

- `templates/base/pages/index.tsx` — 1-line re-export
- `templates/base/pages/docs/[[...slug]].tsx` — self-contained doc-route stub (compare against the showcase's `pages/docs/[[...slug]].tsx`, which the `.template-drift-allowlist` allows to diverge — the showcase adds `chromeBindingsModule` wiring the minimal stub doesn't need)
- `templates/base/src/styles/global.css` — fixed ~20-line `@import` chain (compare against the showcase's `src/styles/global.css`, also allowlisted — the showcase's is a superset)
- `templates/base/tsconfig.json` — 5-line extends form (compare against the showcase's `tsconfig.json`, allowlisted — the showcase's is a superset per the `paths`/`baseUrl` GOTCHA documented in `packages/zudo-doc/CLAUDE.md`)
- `templates/base/scripts/setup-doc-skill.sh` — should be byte-identical to the root `scripts/setup-doc-skill.sh` (the root copy IS the source template; not allowlisted, must match exactly)

**Automated first check**: Run `pnpm check:template-drift` before doing manual analysis. This runs `scripts/check-template-drift.sh` and quickly identifies files that differ between the main project and the base template.

**Allowlist note**: The 6 pairs in `.template-drift-allowlist` (`global.css`, `tsconfig.json`, `pages/index.tsx`, the two doc-route stubs, and the `tauri` feature's orphaned find-in-page files) are skipped by the automated script's whole-file content check because they intentionally differ (the showcase carries wiring the minimal template doesn't need). These files **still require manual review** — check that any non-slot-section changes in the main project are reflected in the template counterpart. `global.css` also has a dedicated automated guard (`check_global_css_legacy_tokens` in `scripts/check-template-drift.sh`) that fails if the template regresses to a pre-ramp-restructure token or drops the `@import "@takazudo/zudo-doc/theme.css"` line — that one drift class stays automated even though the rest of the file needs manual review.

## Step 2: Report Findings

Present a clear drift report:

```
## Config-Field Drift
- Missing in generator: fieldA, fieldB (present in ZudoDocConfig, absent from DEFAULT_MIRROR/FIELD_ORDER)
- Stale default in DEFAULT_MIRROR: fieldC (generator default no longer matches DEFAULT_SETTINGS)

## Dependency Drift
- Missing from generated package.json: packageX (used unconditionally, or by featureY)
- Unnecessary in generated package.json: packageZ (feature disabled / no longer needed)

## Preset Drift
- Missing plugin wiring: pluginX in packages/zudo-doc/src/preset.ts for settings.fieldY

## Feature Composition Drift
- Missing feature module: feature "X" has a ZudoDocConfig field but no src/features/<name>.ts
- Missing template files: feature "X" module exists but templates/features/X/files/ is missing a file it should copy
- Stale postProcess patch: feature "X"'s string-replace target no longer exists in the file it patches

## Base Template Drift
- Stale file: templates/base/<path> differs from its showcase/package counterpart

## No Drift Detected
(if everything is in sync)
```

## Step 3: Apply Fixes

For each drift item found:

1. **Config-field drift** → Update `zfb-config-gen.ts`'s `DEFAULT_MIRROR` + `buildDesiredConfig()` + `FIELD_ORDER`. If the field doesn't exist yet on `ZudoDocConfig`, add it there first (with a `@default` JSDoc — enforced by `config-jsdoc.test.ts`) and to `DEFAULT_SETTINGS`.
2. **Dependency drift** → Update `scaffold.ts` `generatePackageJson()` to add/remove deps
3. **Preset drift** → Update `packages/zudo-doc/src/preset.ts`'s `zudoDocPreset()` to wire the plugin/collection from the settings field
4. **Feature composition drift** → Create/update feature module in `src/features/`, register it in `src/features/index.ts`, add template files only if there's a genuine gap (check whether `@takazudo/zudo-doc` already ships the behavior first)
5. **Base template drift** → Update the stale file in `templates/base/`

After fixes:

1. Run `cd packages/create-zudo-doc && pnpm build` to verify TypeScript compiles
2. Run `cd packages/create-zudo-doc && pnpm test` to verify tests pass (including the settings-drift guard, which asserts `ZudoDocConfig` is a subset of `FIELD_ORDER` ∪ a reasoned allowlist)
3. Commit with message: `fix(create-zudo-doc): sync generator with main project`

## Key Files

| File | Role |
|------|------|
| `packages/zudo-doc/src/config.ts` | Canonical field census — `ZudoDocConfig` (documented, `@default`-tagged) + `DEFAULT_SETTINGS`. Source of truth for every generated project's field surface. |
| `src/config/settings.ts` | This repo's own showcase settings (informal cross-check only — see Step 1a) |
| `zfb.config.ts` | Main project zfb config — `zudoDoc({ ...settings, chromeBindingsModule: "./src/chrome-bindings" })` |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | The SINGLE config generator — emits `defineConfig(zudoDoc({...}))`, diff-from-defaults against `DEFAULT_MIRROR` (a local, hand-kept copy of `DEFAULT_SETTINGS`) |
| `packages/create-zudo-doc/src/compose.ts` | Composition engine (injection system mostly unused — `ANCHOR_FILES` is `[]`; kept as infra), feature resolution |
| `packages/create-zudo-doc/src/features/*.ts` | Feature modules — settings-field emission via `zfb-config-gen.ts`, plus a handful of genuine file copies / `postProcess` patches |
| `packages/create-zudo-doc/src/features/index.ts` | Registers every feature module |
| `packages/create-zudo-doc/src/scaffold.ts` | Orchestrates generation pipeline, generates `package.json`, `.gitignore`, `.npmrc`, seeds starter content |
| `packages/create-zudo-doc/src/claude-md-gen.ts` | Generates the per-project `CLAUDE.md` |
| `packages/create-zudo-doc/templates/base/` | The locked ~12-file (barebone) minimal manifest's static half — 5 files, no `@slot:` anchors |
| `packages/create-zudo-doc/templates/features/` | Feature-specific files copied when a feature is enabled — only `i18n`, `tagGovernance`, `tauri`, `tauriDev` still have any |
| `packages/zudo-doc/src/preset.ts` | `zudoDocPreset()` — wires plugins/collections/markdown from settings fields; the generator never wires plugins directly |
| `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` | Manifest-shape assertions (exact 12-file barebone list, exact all-on list, settings-drift guard) |
| `packages/create-zudo-doc/src/__tests__/zfb-config-gen.test.ts` | Field-mapping / diff-from-defaults unit tests |
