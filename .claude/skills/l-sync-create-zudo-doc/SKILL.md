---
name: l-sync-create-zudo-doc
description: >-
  Detect and fix drift between the main zudo-doc project and the create-zudo-doc generator CLI. Use
  when adding/removing features, or to verify the generator stays in sync.
---

# Sync create-zudo-doc Generator

Detect and fix drift between the main zudo-doc project and the `create-zudo-doc` CLI generator.

## When to Use

- After adding or removing a feature from zudo-doc
- When the drift-detection test fails
- Periodically to verify generator health
- User says "sync generator", "check generator drift", "l-sync-create-zudo-doc"

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

Check for packages used in the template files (astro.config.ts, components, integrations) that are not included in the generated package.json.

### 1c. Import/strip drift

Compare astro.config.ts imports:

- **Main**: `astro.config.ts` — all imports (this is the template that gets copied)
- **Generator**: `packages/create-zudo-doc/src/strip.ts` — what gets stripped

For each conditional import in astro.config.ts (features gated by `settings.X`), verify that either:
1. The feature is always enabled in generated settings AND the dependency is in generated package.json, OR
2. The import is stripped by strip.ts AND the integration file is removed

### 1d. Integration/component drift

Check for React islands and integration files that should be stripped when their feature is disabled:

- `src/components/*.tsx` — React islands
- `src/integrations/*.ts` — Astro integrations

For each component/integration gated by a setting, verify strip.ts handles it.

## Step 2: Report Findings

Present a clear drift report:

```
## Settings Drift
- Missing in generator: fieldA, fieldB
- Extra in generator (not in main): fieldC

## Dependency Drift
- Missing from generated package.json: packageX (used by featureY)
- Unnecessary in generated package.json: packageZ (feature disabled)

## Import/Strip Drift
- Import not stripped: import X from "y" (feature disabled but import remains)
- Missing file removal: src/integrations/z.ts (feature disabled but file kept)

## No Drift Detected
(if everything is in sync)
```

## Step 3: Apply Fixes

For each drift item found:

1. **Settings drift** → Update `settings-gen.ts` to add missing fields with sensible defaults
2. **Dependency drift** → Update `scaffold.ts` `generatePackageJson()` to add/remove deps
3. **Import/strip drift** → Update `strip.ts` to add stripping patterns
4. **Component drift** → Update `strip.ts` to add `removeIfExists` calls

After fixes:

1. Run `cd packages/create-zudo-doc && pnpm build` to verify TypeScript compiles
2. Run `cd packages/create-zudo-doc && pnpm test` to verify tests pass (including drift-detection test)
3. Commit with message: `fix(create-zudo-doc): sync generator with main project`

## Key Files

| File | Role |
|------|------|
| `src/config/settings.ts` | Canonical settings (source of truth) |
| `astro.config.ts` | Template that gets copied to scaffolded projects |
| `packages/create-zudo-doc/src/settings-gen.ts` | Generates settings.ts |
| `packages/create-zudo-doc/src/scaffold.ts` | Generates package.json, copies template |
| `packages/create-zudo-doc/src/strip.ts` | Strips disabled features from template |
| `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` | Integration tests |
