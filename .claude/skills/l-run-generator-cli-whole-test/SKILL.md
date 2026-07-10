---
name: l-run-generator-cli-whole-test
description: Run all create-zudo-doc CLI generation tests and fix bugs. Invokes /l-generator-cli-tester for each pattern, collects results, fixes failures, and verifies all patterns pass. Use for comprehensive generator validation.
---

# Generator CLI Whole Test Runner

Run ALL `create-zudo-doc` generator patterns end-to-end, fix any failures, and verify everything passes.

## When to Use

- Before releasing a new version of `create-zudo-doc`
- After modifying generator source files (`scaffold.ts`, `compose.ts`, `features/*.ts`, `zfb-config-gen.ts`, `constants.ts`, `cli.ts`, `api.ts`)
- After adding/removing features from the main zudo-doc project
- User says "run all generator tests", "whole test", "l-run-generator-cli-whole-test"

### Options

- `--headless` — Pass `--headless` to each `/l-generator-cli-tester` invocation, enabling headless browser checks (visual rendering verification via `/headless-browser`). Without this flag, only process-level checks are performed.

## Prerequisites

Build the CLI before testing:

```bash
cd packages/create-zudo-doc && pnpm build
```

If the build fails, fix the TypeScript errors first before proceeding.

## Phase 1: Run All Test Patterns

Run each pattern by invoking `/l-generator-cli-tester <pattern>`. Start with `barebone` as the baseline.

### Test order

Run in this order (CLI flags and details are defined in `/l-generator-cli-tester`):

1. **`barebone`** — All optional features OFF. Must pass first — if this fails, fix it before testing others.
2. **`search`** — Only search enabled
3. **`i18n`** — Only i18n enabled
4. **`sidebar-filter`** — Only sidebar filter enabled
5. **`claude-resources`** — Only Claude Resources enabled
6. **`design-token-panel`** — Only design token panel enabled (uses `--design-token-panel` CLI flag)
7. **`light-dark`** — Light-dark color scheme mode
8. **`lang-ja`** — Japanese as default language
9. **`all-features`** — Everything ON, maximum complexity (uses the enumerated CLI invocation)

> **Note:** These 9 patterns are valid manual smoke tests. The authoritative bug-hunt pattern matrix (15 patterns across Waves 4, 5, and 5b) lives in the Wave 2 spec (`__inbox/gen-cli-audit-spec/spec.md`) and the associated bug-hunt issues. Do not delete or rename these 9 patterns — they remain useful standalone checks.

### Running each pattern

For each pattern, invoke the companion skill:

```
/l-generator-cli-tester <pattern>
/l-generator-cli-tester <pattern> --headless   # if --headless was passed to this skill
```

This skill handles scaffold generation, `pnpm install`, `pnpm build`, `pnpm dev` smoke test, feature verification, and optionally headless browser rendering checks for one pattern.

### Collect results

Track results in a summary table as you go:

```
| Pattern            | Build | Dev | Features | Status |
|--------------------|-------|-----|----------|--------|
| barebone           | PASS  | PASS| PASS     | ok     |
| search             | FAIL  | -   | -        | FAIL   |
| i18n               | PASS  | PASS| PASS     | ok     |
| ...                | ...   | ... | ...      | ...    |
```

Record the first error message for any failing pattern.

## Phase 2: Fix Bugs

For each failing pattern:

### 2a. Diagnose the failure

- Read the error output from `/l-generator-cli-tester`
- Determine which phase failed: scaffold, build, dev, or feature check
- Common failure categories:
  - **Build error: missing module** — dependency not in generated `package.json` → fix `scaffold.ts` `generatePackageJson()`
  - **Build error: import not found** — diagnose: a `postProcess` hook's string patch no longer matches the file it targets (see `docHistory`/`designTokenPanel`/`tagGovernance`/`tauri`/`tauriDev` in `src/features/*.ts`), or a genuine feature file is missing from `templates/features/<name>/files/`
  - **Build error: field/type error in `zfb.config.ts`** — a `ZudoDocConfig` field is missing/wrong → fix `zfb-config-gen.ts`'s `DEFAULT_MIRROR`/`buildDesiredConfig()`/`FIELD_ORDER`, and check the census (`packages/zudo-doc/src/config.ts`'s `ZudoDocConfig`/`DEFAULT_SETTINGS`) is in sync
  - **Build error: component/plugin not wired** — the feature's settings field exists but `packages/zudo-doc/src/preset.ts`'s `zudoDocPreset()` doesn't read it yet (package-side, not generator-side)
  - **Dev server crash** — runtime error in generated code → read the generated file and trace the issue to the source
  - **Feature check fail** — "file missing when it should exist" means `templates/features/<name>/files/` is incomplete or the feature module's genuine copy/postProcess is broken; "file present when it should be absent" almost always means a stale reference resurrected a deleted template path — check against `scaffold.test.ts`'s `NEVER_RESURRECTED` list

### 2b. Read the generator source files

The key files to examine:

| File | Role |
|------|------|
| `packages/create-zudo-doc/src/scaffold.ts` | Copies the 5-file base template, generates `package.json`/`.gitignore`/`.npmrc`/`CLAUDE.md`, seeds starter content |
| `packages/create-zudo-doc/src/compose.ts` | Composition engine: injection system (mostly unused — `ANCHOR_FILES` is `[]`), feature resolution |
| `packages/create-zudo-doc/src/features/*.ts` | Per-feature settings-field emission + the handful of genuine file copies / `postProcess` patches |
| `packages/create-zudo-doc/src/zfb-config-gen.ts` | The SINGLE config generator — emits the one `zfb.config.ts` (`defineConfig(zudoDoc({...}))`), diff-from-defaults |
| `packages/zudo-doc/src/config.ts` | The field census (`ZudoDocConfig` + `DEFAULT_SETTINGS`) `zfb-config-gen.ts`'s `DEFAULT_MIRROR` must stay in sync with |
| `packages/create-zudo-doc/src/constants.ts` | Feature definitions, supported langs, header-right labels, and the two Default color schemes (single Default light/dark pairing — the legacy multi-scheme catalog was dropped) |
| `packages/create-zudo-doc/src/cli.ts` | CLI argument parsing |
| `packages/create-zudo-doc/src/api.ts` | Programmatic API |

### 2c. Apply the fix

- Edit the appropriate generator source file
- Target the root cause in the generator, not the generated output
- Keep fixes minimal and focused

### 2d. Rebuild and re-test

After each fix:

```bash
cd packages/create-zudo-doc && pnpm build
```

Then re-run the failing pattern:

```
/l-generator-cli-tester <pattern>
```

### 2e. Commit each fix

Commit each fix individually with a descriptive message:

```
fix(create-zudo-doc): fix <pattern> generation — <brief description>
```

Examples:

- `fix(create-zudo-doc): fix barebone generation — strip remark-directive import when unused`
- `fix(create-zudo-doc): fix i18n generation — add missing content.config.ts patching`
- `fix(create-zudo-doc): fix light-dark generation — include theme-toggle.tsx in dependencies`

## Phase 3: Final Verification

After all fixes are applied:

### 3a. Re-run ALL patterns

Run every pattern again from scratch to ensure fixes didn't break other patterns:

```
/l-generator-cli-tester barebone
/l-generator-cli-tester search
/l-generator-cli-tester i18n
/l-generator-cli-tester sidebar-filter
/l-generator-cli-tester claude-resources
/l-generator-cli-tester design-token-panel
/l-generator-cli-tester light-dark
/l-generator-cli-tester lang-ja
/l-generator-cli-tester all-features
```

### 3b. Run existing unit tests

```bash
cd packages/create-zudo-doc && pnpm test
```

All tests must pass. If any fail, fix them and commit.

### 3c. Build the CLI one final time

```bash
cd packages/create-zudo-doc && pnpm build
```

## Phase 4: Summary

Output a final report:

```
## Generator CLI Whole Test Results

### Test Results

| Pattern            | First Run | After Fixes | Status |
|--------------------|-----------|-------------|--------|
| barebone           | PASS      | PASS        | ok     |
| search             | FAIL      | PASS        | fixed  |
| i18n               | PASS      | PASS        | ok     |
| sidebar-filter     | PASS      | PASS        | ok     |
| claude-resources   | FAIL      | PASS        | fixed  |
| design-token-panel  | PASS      | PASS        | ok     |
| light-dark         | PASS      | PASS        | ok     |
| lang-ja            | PASS      | PASS        | ok     |
| all-features       | FAIL      | PASS        | fixed  |

### Summary

- Patterns tested: 9
- Passed on first try: 6
- Needed fixes: 3
- Unit tests: PASS

### Fixes Applied

1. `scaffold.ts`: Added missing `minisearch` dependency for search pattern
2. `features/claude-resources.ts`: added missing import injection
3. `zfb-config-gen.ts`: fixed light-dark colorMode emission

### Final Status: ALL PASS
```

## Important Notes

- Always build the CLI (`pnpm build` in `packages/create-zudo-doc`) before testing and after each fix
- Fix the generator source code, never the generated output
- The `barebone` pattern is the baseline — if it fails, fix it before testing others
- Test directories should be placed in `__inbox/` (gitignored) to avoid polluting the repo
- Each fix should be a separate commit for clear git history
- If a fix for one pattern breaks another, investigate the interaction before committing
