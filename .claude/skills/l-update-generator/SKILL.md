---
name: l-update-generator
description: "Detect and fix drift between the main zudo-doc project and the create-zudo-doc generator CLI. Use when adding/removing features, or to verify the generator stays in sync. Also triggered by \"update generator\", \"sync generator\", \"l-update-generator\", \"l-sync-create-zudo-doc\"."
---

# Update create-zudo-doc Generator

Detect and fix drift between the main zudo-doc project and the `create-zudo-doc` CLI generator.

## Architecture Overview

The generator uses **additive composition** — not copy-then-strip:

1. A minimal **base template** (`templates/base/`) is copied first
2. **Programmatic generators** create config files from user choices (`astro-config-gen.ts`, `content-config-gen.ts`, `settings-gen.ts`)
3. **Feature modules** (`src/features/*.ts`) inject code into anchor points (`@slot:`) in shared files and copy feature-specific files
4. `compose.ts` orchestrates feature file copying, injection, and anchor cleanup
5. Some features have **postProcess hooks** that mutate or remove generated files (e.g., `i18n.ts` patches locale strings and may delete `src/pages/ja/`)

## When to Use

- After adding or removing a feature from zudo-doc
- When the drift-detection test fails
- Periodically to verify generator health
- User says "update generator", "sync generator", "check generator drift", "l-update-generator", or the old name "l-sync-create-zudo-doc"

**Quick pre-check**: Run `pnpm check:template-drift` first to get an automated summary of base template drift. Then proceed with the full workflow below for settings, dependency, astro config, and feature composition drift.

## Step 1: Analyze Drift

Compare the main project's source files with what the generator produces.

### 1a. Settings drift

Read both files and extract setting field names:

- **Main**: `src/config/settings.ts` — the canonical settings object
- **Generator**: `packages/create-zudo-doc/src/settings-gen.ts` — what gets generated

Compare field names. Any field in the main settings that is missing from the generator output is drift.

### 1b. Dependency drift

Compare dependencies:

- **Main**: `package.json` — root dependencies
- **Generator**: `packages/create-zudo-doc/src/scaffold.ts` `generatePackageJson()` — generated deps

Check for packages used in base template files and feature files that are not included in the generated package.json.

### 1c. Astro config drift

Compare the main project's `astro.config.ts` with what the generator produces:

- **Main**: `astro.config.ts` — all imports and integrations
- **Generator**: `packages/create-zudo-doc/src/astro-config-gen.ts` — programmatic generation

For each integration in the main astro.config.ts, verify that either:

1. It is unconditionally included in `astro-config-gen.ts`, OR
2. It is conditionally included based on the correct feature selection

### 1d. Feature composition drift

Check that features in the main project have corresponding feature modules:

- **Main**: Feature-gated files across `src/components/`, `src/integrations/`, `src/pages/`, `src/config/`, `src/utils/`, `src/scripts/`, `src/hooks/`
- **Generator**: `packages/create-zudo-doc/src/features/*.ts` — feature modules with injections and postProcess hooks
- **Templates**: `packages/create-zudo-doc/templates/features/*/files/` — feature-specific files

For each feature-gated file in the main project, verify:

1. A feature module exists in `src/features/`
2. The feature's files are in `templates/features/<name>/files/`
3. Injection anchors (`@slot:`) exist in the base template for the feature's injections
4. If the feature has a `postProcess` hook, verify the mutations it performs still match the main project's behavior

### 1e. Base template drift

Compare shared files between the main project and the base template:

- **Main**: `src/components/`, `src/config/`, `src/hooks/`, `src/layouts/`, `src/pages/`, `src/plugins/`, `src/scripts/`, `src/styles/`, `src/types/`, `src/utils/`
- **Template**: `packages/create-zudo-doc/templates/base/`

Check that non-feature-specific files in the base template reflect the latest changes from the main project (layout updates, plugin changes, utility functions, type definitions, etc.).

**Automated first check**: Run `pnpm check:template-drift` before doing manual analysis. This runs `scripts/check-template-drift.sh` and quickly identifies files that differ between the main project and the base template.

**Allowlist note**: Some files are listed in `.template-drift-allowlist` (e.g., `global.css`, `header.astro`, `doc-layout.astro`) and are skipped entirely by the automated script because they contain slot sections that intentionally differ. These files **still require manual review** — check that any non-slot-section changes in the main project are reflected in the template counterpart.

## Step 2: Report Findings

Present a clear drift report:

```
## Settings Drift
- Missing in generator: fieldA, fieldB
- Extra in generator (not in main): fieldC

## Dependency Drift
- Missing from generated package.json: packageX (used by featureY)
- Unnecessary in generated package.json: packageZ (feature disabled)

## Astro Config Drift
- Missing integration: integrationX (present in main, absent from astro-config-gen.ts)
- Missing conditional: integrationY should be gated by feature "Z"

## Feature Composition Drift
- Missing feature module: feature "X" exists in main but has no feature module
- Missing template files: feature "X" module exists but templates/features/X/files/ is missing
- Missing anchor: feature "X" injects at @slot:Y but anchor not found in base template

## Base Template Drift
- Stale file: templates/base/src/components/foo.astro differs from main src/components/foo.astro

## No Drift Detected
(if everything is in sync)
```

## Step 3: Apply Fixes

For each drift item found:

1. **Settings drift** → Update `settings-gen.ts` to add missing fields with sensible defaults
2. **Dependency drift** → Update `scaffold.ts` `generatePackageJson()` to add/remove deps
3. **Astro config drift** → Update `astro-config-gen.ts` to add/remove imports and integrations
4. **Feature composition drift** → Create/update feature module in `src/features/`, add template files, add anchors to base template
5. **Base template drift** → Update the stale file in `templates/base/`

After fixes:

1. Run `cd packages/create-zudo-doc && pnpm build` to verify TypeScript compiles
2. Run `cd packages/create-zudo-doc && pnpm test` to verify tests pass (including drift-detection test)
3. Commit with message: `fix(create-zudo-doc): sync generator with main project`

## Key Files

| File | Role |
|------|------|
| `src/config/settings.ts` | Canonical settings (source of truth) |
| `astro.config.ts` | Main project astro config (reference for generator) |
| `packages/create-zudo-doc/src/settings-gen.ts` | Generates settings.ts |
| `packages/create-zudo-doc/src/astro-config-gen.ts` | Generates astro.config.ts programmatically |
| `packages/create-zudo-doc/src/content-config-gen.ts` | Generates content.config.ts programmatically |
| `packages/create-zudo-doc/src/compose.ts` | Additive composition engine (injections, anchors) |
| `packages/create-zudo-doc/src/features/*.ts` | Feature modules (injections + file lists) |
| `packages/create-zudo-doc/src/scaffold.ts` | Orchestrates generation pipeline, generates package.json |
| `packages/create-zudo-doc/templates/base/` | Minimal base template with `@slot:` anchors |
| `packages/create-zudo-doc/templates/features/` | Feature-specific files copied when feature is enabled |
| `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` | Integration tests |
