---
name: l-run-generator-cli-whole-test
description: >-
  Run all create-zudo-doc CLI generation tests and fix bugs. Invokes /l-generator-cli-tester for
  each pattern, collects results, fixes failures, and verifies all patterns pass. Use for
  comprehensive generator validation.
---

# Generator CLI Whole Test Runner

Run ALL `create-zudo-doc` generator patterns end-to-end, fix any failures, and verify everything passes.

## When to Use

- Before releasing a new version of `create-zudo-doc`
- After modifying generator source files (`scaffold.ts`, `strip.ts`, `settings-gen.ts`)
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
6. **`color-tweak-panel`** — Only color tweak panel enabled (uses API, no CLI flag)
7. **`light-dark`** — Light-dark color scheme mode
8. **`lang-ja`** — Japanese as default language
9. **`all-features`** — Everything ON, maximum complexity (uses API)

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
  - **Build error: import not found** — import not stripped for disabled feature → fix `strip.ts`
  - **Build error: type error in settings.ts** — settings field missing/wrong → fix `settings-gen.ts`
  - **Build error: component references stripped component** — template usage not stripped → fix `strip.ts` patch patterns
  - **Dev server crash** — runtime error in generated code → read the generated file and trace the issue to the source
  - **Feature check fail** — feature file exists when it should be removed, or missing when it should exist → fix `strip.ts`

### 2b. Read the generator source files

The key files to examine:

| File | Role |
|------|------|
| `packages/create-zudo-doc/src/scaffold.ts` | Copies template, generates `package.json` |
| `packages/create-zudo-doc/src/strip.ts` | Removes features/imports based on options |
| `packages/create-zudo-doc/src/settings-gen.ts` | Generates `settings.ts` |
| `packages/create-zudo-doc/src/constants.ts` | Feature definitions and color schemes |
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
/l-generator-cli-tester color-tweak-panel
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
| color-tweak-panel  | PASS      | PASS        | ok     |
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
2. `strip.ts`: Fixed claude-resources import stripping regex
3. `strip.ts`: Fixed all-features light-dark theme-toggle handling

### Final Status: ALL PASS
```

## Important Notes

- Always build the CLI (`pnpm build` in `packages/create-zudo-doc`) before testing and after each fix
- Fix the generator source code, never the generated output
- The `barebone` pattern is the baseline — if it fails, fix it before testing others
- Test directories should be placed in `__inbox/` (gitignored) to avoid polluting the repo
- Each fix should be a separate commit for clear git history
- If a fix for one pattern breaks another, investigate the interaction before committing
