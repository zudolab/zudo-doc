---
name: l-generator-cli-tester
description: Test a single create-zudo-doc CLI generation pattern. Scaffolds a project, builds it, starts dev server, and verifies expected features. Use when testing generator output for a specific pattern.
---

# Generator CLI Pattern Tester

Test a single `create-zudo-doc` CLI generation pattern by scaffolding a project, building it, running the dev server briefly, and verifying the expected files and settings.

## Usage

```
/l-generator-cli-tester <pattern>
/l-generator-cli-tester <pattern> --headless
```

Where `<pattern>` is one of the test patterns listed below.

### Options

- `--headless` — After standard checks, also run headless browser verification using `/headless-browser` to confirm pages actually render (Step 8.5). Without this flag, headless checks are skipped.

## Test Patterns

| Pattern | Description |
|---------|-------------|
| `barebone` | Everything OFF — minimal project |
| `search` | Only search enabled |
| `i18n` | Only i18n enabled |
| `sidebar-filter` | Only sidebar filter enabled |
| `claude-resources` | Only claude resources enabled |
| `design-token-panel` | Only design token panel enabled (uses API) |
| `light-dark` | Light-dark color mode |
| `lang-ja` | Japanese as default language |
| `all-features` | Everything ON |

## Step 0: Build the CLI

Before running any test, set `REPO_ROOT` and build the CLI:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
cd packages/create-zudo-doc && pnpm build
```

If the build fails, stop and report the error.

## Step 1: Create Temp Directory

```bash
mkdir -p __inbox/generator-test-<pattern>
```

## Step 2: Run the Generator

Set `REPO_ROOT` to the repository root (absolute path). Run the generator from within the temp directory. Always use `--no-install` to handle installation separately.

### CLI Commands per Pattern

**barebone:**

```bash
cd __inbox/generator-test-barebone && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --no-claude-resources \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

**search:**

```bash
cd __inbox/generator-test-search && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --search --no-sidebar-filter --no-i18n --no-claude-resources \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

**i18n:**

```bash
cd __inbox/generator-test-i18n && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --i18n --no-claude-resources \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

**sidebar-filter:**

```bash
cd __inbox/generator-test-sidebar-filter && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --sidebar-filter --no-i18n --no-claude-resources \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

> Note: Sidebar filter stripping is not yet implemented (TODO in strip.ts). The filter is built into `sidebar-tree.tsx` and is always included regardless of the flag. This test mainly verifies the flag doesn't cause errors.

**claude-resources:**

```bash
cd __inbox/generator-test-claude-resources && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --claude-resources \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

**design-token-panel:**

> `designTokenPanel` has NO CLI flag. Use the programmatic API instead:

```bash
cd __inbox/generator-test-design-token-panel && \
  node --input-type=module -e "
import { createZudoDoc } from '$REPO_ROOT/packages/create-zudo-doc/dist/api.js';
await createZudoDoc({
  projectName: 'test-project',
  colorSchemeMode: 'single',
  singleScheme: 'Default Dark',
  features: ['designTokenPanel'],
  packageManager: 'pnpm',
  install: false,
});
console.log('Scaffolding complete.');
"
```

**light-dark:**

```bash
cd __inbox/generator-test-light-dark && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --no-claude-resources \
  --color-scheme-mode light-dark --light-scheme "Default Light" --dark-scheme "Default Dark" \
  --no-install
```

**lang-ja:**

```bash
cd __inbox/generator-test-lang-ja && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --no-claude-resources \
  --lang ja --color-scheme-mode single --scheme "Default Dark" --no-install
```

**all-features:**

```bash
cd __inbox/generator-test-all-features && \
  node --input-type=module -e "
import { createZudoDoc } from '$REPO_ROOT/packages/create-zudo-doc/dist/api.js';
await createZudoDoc({
  projectName: 'test-project',
  colorSchemeMode: 'light-dark',
  lightScheme: 'Default Light',
  darkScheme: 'Default Dark',
  defaultMode: 'dark',
  respectPrefersColorScheme: true,
  features: ['i18n', 'search', 'sidebarFilter', 'claudeResources', 'designTokenPanel'],
  packageManager: 'pnpm',
  install: false,
});
console.log('Scaffolding complete.');
"
```

> Note: `all-features` uses the API because `designTokenPanel` has no CLI flag.

## Step 3: Install Dependencies

```bash
cd __inbox/generator-test-<pattern>/test-project && pnpm install
```

If installation fails, report the error and stop.

## Step 4: Build

```bash
cd __inbox/generator-test-<pattern>/test-project && pnpm build
```

If the build fails, report the error and stop.

## Step 5: Dev Server Smoke Test

Start the dev server, wait for startup, check it didn't crash, then kill it:

```bash
cd __inbox/generator-test-<pattern>/test-project && \
  timeout 15 pnpm dev 2>&1 &
DEV_PID=$!
sleep 8
if kill -0 $DEV_PID 2>/dev/null; then
  echo "DEV_SERVER: OK — process still running"
  kill $DEV_PID 2>/dev/null
  wait $DEV_PID 2>/dev/null
else
  wait $DEV_PID
  EXIT_CODE=$?
  echo "DEV_SERVER: FAILED — process exited with code $EXIT_CODE"
fi
```

If the dev server crashed, report the error.

## Step 6: Verify Files

Check that expected files exist or don't exist in `__inbox/generator-test-<pattern>/test-project/`.

### File Expectations per Pattern

Use these tables to verify. Check each file with `test -e <path>`.

> **Note on `theme-toggle.tsx`**: this component always ships on disk as part of the base template — whether it renders at runtime is gated by the `colorMode` setting. The expectation tables below therefore only assert PRESENT for the `light-dark` and `all-features` patterns and do not assert ABSENT elsewhere.
>
> **Note on file extensions**: all components are `.tsx` — there are no `.astro` files in the generated project. The generator uses zfb/Preact, not Astro.

**barebone** — minimal, no optional features:

| File | Expected |
|------|----------|
| `src/content/docs-ja/` | ABSENT |
| `src/integrations/claude-resources/` | ABSENT |
| `src/components/doc-history.tsx` | ABSENT |
| `src/lib/design-token-panel-bootstrap.ts` | ABSENT |
| `src/config/design-token-panel-config.ts` | ABSENT |
| `src/utils/design-token-serde.ts` | ABSENT |
| `src/content/docs/` | PRESENT |
| `src/config/settings.ts` | PRESENT |
| `zfb.config.ts` | PRESENT |

**search:**

| File | Expected |
|------|----------|
| `src/integrations/claude-resources/` | ABSENT |
| `src/config/design-token-panel-config.ts` | ABSENT |
| `src/content/docs/` | PRESENT |
| `src/config/settings.ts` | PRESENT |

> Note: the `search` feature wires Pagefind via the zfb config and `package.json` deps; it does not copy a dedicated search component file to `src/components/`. Verify search is enabled by checking `package.json` for `"@pagefind/default-ui"` or checking `zfb.config.ts` for pagefind plugin wiring.

**i18n:**

| File | Expected |
|------|----------|
| `src/content/docs-ja/` | PRESENT |
| `src/content/docs-ja/getting-started/index.mdx` | PRESENT |
| `src/content/docs/` | PRESENT |
| `src/integrations/claude-resources/` | ABSENT |
| `src/config/design-token-panel-config.ts` | ABSENT |

**sidebar-filter:**

| File | Expected |
|------|----------|
| `src/components/sidebar-tree.tsx` | PRESENT |
| `src/integrations/claude-resources/` | ABSENT |
| `src/config/design-token-panel-config.ts` | ABSENT |

> Note: `sidebar-tree.tsx` always ships with the base template; the `sidebarFilter` flag controls whether filtering UI is active at runtime. Check the `sidebarFilter` setting in `src/config/settings.ts` to confirm the flag was applied.

**claude-resources:**

| File | Expected |
|------|----------|
| `src/integrations/claude-resources/generate.ts` | PRESENT |
| `src/integrations/claude-resources/escape-for-mdx.ts` | PRESENT |
| `src/integrations/claude-resources/__tests__/generate.test.ts` | PRESENT |
| `src/config/design-token-panel-config.ts` | ABSENT |

**design-token-panel:**

| File | Expected |
|------|----------|
| `src/config/design-token-panel-config.ts` | PRESENT |
| `src/config/design-tokens-manifest.ts` | PRESENT |
| `src/lib/design-token-panel-bootstrap.ts` | PRESENT |
| `src/utils/design-token-serde.ts` | PRESENT |
| `src/utils/design-token-types.ts` | PRESENT |
| `src/integrations/claude-resources/` | ABSENT |

**light-dark:**

| File | Expected |
|------|----------|
| `src/components/theme-toggle.tsx` | PRESENT |
| `src/integrations/claude-resources/` | ABSENT |
| `src/config/design-token-panel-config.ts` | ABSENT |

**lang-ja:**

| File | Expected |
|------|----------|
| `src/content/docs/` | PRESENT |
| `src/config/settings.ts` | PRESENT |
| `src/content/docs-ja/` | ABSENT |

**all-features:**

| File | Expected |
|------|----------|
| `src/content/docs-ja/getting-started/index.mdx` | PRESENT |
| `src/content/docs/getting-started/index.mdx` | PRESENT |
| `src/integrations/claude-resources/generate.ts` | PRESENT |
| `src/integrations/claude-resources/escape-for-mdx.ts` | PRESENT |
| `src/components/theme-toggle.tsx` | PRESENT |
| `src/config/design-token-panel-config.ts` | PRESENT |
| `src/lib/design-token-panel-bootstrap.ts` | PRESENT |
| `src/utils/design-token-serde.ts` | PRESENT |
| `src/components/doc-history.tsx` | PRESENT |
| `src/components/desktop-sidebar-toggle.tsx` | PRESENT |
| `src/scripts/sidebar-resizer.ts` | PRESENT |
| `src/components/image-enlarge.tsx` | PRESENT |
| `src/utils/github.ts` | PRESENT |

## Step 7: Verify Settings

Read `__inbox/generator-test-<pattern>/test-project/src/config/settings.ts` and check:

### Settings Expectations per Pattern

**barebone:**

- `colorScheme: "Default Dark"`
- `colorMode: false`
- `locales: {}` (empty)
- `designTokenPanel: false`
- `claudeResources: false`

**search:**

- `colorScheme: "Default Dark"`
- `colorMode: false`

**i18n:**

- `locales:` should contain `ja` entry with `dir: "src/content/docs-ja"`

**sidebar-filter:**

- Same as barebone but with `sidebarFilter` defaulting to included

**claude-resources:**

- `claudeResources:` should be truthy (object with `claudeDir`)

**design-token-panel:**

- `designTokenPanel: true`

**light-dark:**

- `colorMode:` should be an object with `defaultMode`, `lightScheme: "Default Light"`, `darkScheme: "Default Dark"`

**lang-ja:**

- `colorScheme: "Default Dark"`
- Check `src/config/settings.ts` for `defaultLocale: "ja"` — this is the authoritative field emitted by settings-gen.ts; `src/config/i18n.ts` derives `defaultLocale` from `settings.defaultLocale` at runtime and does not hardcode it

**all-features:**

- `colorMode:` should be an object (light-dark mode)
- `locales:` should contain `ja` entry
- `claudeResources:` should be truthy
- `designTokenPanel: true`

## Step 8: Compare Against Showcase

For the feature being tested, briefly compare the generated project against the main zudo-doc showcase:

- Read the equivalent component/config in `src/` (the showcase) and in the generated project
- Verify they share the same structure (the generated version may have stripped imports/features, but the enabled feature's code should match)

This is a sanity check, not a full diff. Focus on the feature under test.

## Step 8.5: Headless Browser Check (only with `--headless`)

**Skip this step unless `--headless` was passed.**

Start the dev server and use `/headless-browser` (Tier 1: headless-check.js) to verify pages actually render in a browser.

### 8.5a. Start dev server

```bash
cd __inbox/generator-test-<pattern>/test-project
pnpm dev --port 14350 &
DEV_PID=$!
sleep 6
```

### 8.5b. Check pages with headless browser

Check the index page and a docs page:

```bash
HC=~/.claude/skills/headless-browser/scripts/headless-check.js
node $HC --url "http://localhost:14350/" --screenshot viewport --no-block-resources
node $HC --url "http://localhost:14350/docs/getting-started" --screenshot viewport --no-block-resources
```

For **i18n** and **all-features** patterns, also check the Japanese page:

```bash
node $HC --url "http://localhost:14350/ja/docs/getting-started" --screenshot viewport --no-block-resources
```

### 8.5c. Verify results

- All pages should return `statusCode: 200`
- `pageErrors` should be empty (no JS errors)
- `networkErrors.failedRequests` — ignore `net::ERR_ABORTED` (Vite HMR re-optimization, normal in dev). Flag any other failures.
- **Read the screenshots** with the Read tool and visually confirm:
  - **search**: search icon (magnifying glass) visible in header
  - **i18n**: "EN / JA" language switcher in header
  - **light-dark**: theme toggle icon in header
  - **design-token-panel**: design token icon in header
  - **claude-resources**: page renders without errors
  - **all-features**: all icons present (search, theme toggle, language switcher, color tweak)
  - **barebone**: no extra icons in header (no search, no theme toggle, no language switcher)
  - **lang-ja**: Japanese content ("ようこそ" title)

### 8.5d. Kill dev server

```bash
kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null
```

## Step 9: Clean Up

```bash
rm -rf ./__inbox/generator-test-<pattern>
```

Always use relative path with `./` prefix for cleanup.

## Step 10: Report Results

Provide a clear pass/fail report:

```
## Pattern: <pattern>

### Scaffold: PASS/FAIL
### Install: PASS/FAIL
### Build: PASS/FAIL
### Dev Server: PASS/FAIL
### File Verification: PASS/FAIL
  - [list any unexpected files present/absent]
### Settings Verification: PASS/FAIL
  - [list any mismatches]
### Showcase Comparison: PASS/FAIL
  - [notes]
### Headless Browser: PASS/FAIL/SKIPPED
  - [only if --headless was passed]

### Overall: PASS/FAIL
```

## Important Notes

- Always `cd` back to the repo root between major steps (use absolute paths)
- The `--yes` flag auto-fills all unspecified options with defaults. Feature defaults with `--yes`: search=true, sidebarFilter=true, i18n=false, claudeResources=false, designTokenPanel=false
- Use `--no-install` with CLI to prevent auto-install, then install manually for better error visibility
- Sidebar filter stripping is TODO — the filter is always included regardless of the `--sidebar-filter` flag
- `designTokenPanel` has no CLI flag — use the API approach for `design-token-panel` and `all-features` patterns
- The dev server smoke test uses `pnpm dev` (generated projects have a single `dev` script)
- If any step fails, still report all steps attempted before stopping
- The `--headless` flag enables Step 8.5 (headless browser visual check). Without it, only process-level checks are performed
