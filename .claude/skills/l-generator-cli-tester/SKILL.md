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
| `barebone` | Everything OFF — the locked 12-file minimal manifest |
| `search` | Only search enabled |
| `i18n` | Only i18n enabled |
| `sidebar-filter` | Only sidebar filter enabled |
| `claude-resources` | Only claude resources enabled |
| `design-token-panel` | Only design token panel enabled (uses --design-token-panel CLI flag) |
| `light-dark` | Light-dark color mode |
| `lang-ja` | Japanese as default language |
| `all-features` | Everything ON (except tauri/tauriDev — Rust toolchain, out of scope for this smoke pattern) |

## Architecture context (read before verifying files)

Since the minimal-scaffold cutover (epic zudolab/zudo-doc#2651), a generated
project is: one config file (`zfb.config.ts`, `zudoDoc({...only fields you
chose})`) + markdown content + a handful of unavoidable root files.
Everything else — layout, chrome, islands, default `@theme` tokens, even the
doc ROUTES themselves — ships from `@takazudo/zudo-doc` in `node_modules`.

**Consequence for this skill: almost every feature is now a pure
`zfb.config.ts` field, not a file.** Only 5 features ship or mutate real
files:

| Feature | What it touches |
|---|---|
| `i18n` | Adds `pages/[locale]/docs/[[...slug]].tsx` + `src/content/docs-<lang>/getting-started/{index,introduction,installation}.mdx` |
| `tagGovernance` | Adds `scripts/tags-audit.ts`, `scripts/tags-suggest.ts`, and (postProcess) a tiny `src/config/settings.ts` + `src/config/tag-vocabulary.ts` pair (see "Known deviation" in `/l-update-generator` — required only because the package's `tags-audit` bin still imports those exact paths) |
| `docHistory` | (postProcess) patches the doc-route stub(s) in place to thread the real `DocHistory` component — no new file |
| `designTokenPanel` | (postProcess) inserts one `@import "@takazudo/zdtp/styles.css";` line into `src/styles/global.css` — no new file |
| `tauri` / `tauriDev` | Ship `src-tauri/**` / `src-tauri-dev/**` Rust project shells |
| `skillSymlinker` | Copies `scripts/setup-doc-skill.sh` |
| `claudeSkills` | Copies `.claude/skills/{zudo-doc-design-system,zudo-doc-translate,zudo-doc-version-bump}/**` from the monorepo |
| `changelog` (scaffold.ts, not a feature module) | Adds `src/content/docs/changelog/index.mdx` (+ locale mirror if i18n is also on) |

Every other feature (`search`, `sidebarFilter`, `sidebarResizer`,
`sidebarToggle`, `claudeResources`, `versioning`, `bodyFootUtil`, `llmsTxt`,
`docTags`, `footerNavGroup`, `footerCopyright`, `footerTaglist`,
`imageEnlarge`, `dynamicPageTransition`, `noindex`) changes ONLY the emitted
`zfb.config.ts` fields (or, for `search`, the generated `package.json`
devDependencies) — verify those with a content check, not a file-presence
check.

> **Note on file extensions**: all components are `.tsx` — there are no `.astro` files anywhere in the generated project or the package it depends on.

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

**barebone** — every flag with a `default: true` in `constants.ts` (`search`, `sidebarFilter`, `imageEnlarge`, `dynamicPageTransition`, `footerCopyright`) must be EXPLICITLY turned off, or `--yes` fills it in as ON:

```bash
cd __inbox/generator-test-barebone && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --no-claude-resources \
  --no-image-enlarge --no-dynamic-page-transition --no-footer-copyright --no-tag-governance \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

> This exact invocation is the one verified against the locked 12-file
> manifest in `packages/create-zudo-doc/src/__tests__/scaffold.test.ts`
> (`BAREBONE_MANIFEST`) — do not drop `--no-dynamic-page-transition` or
> `--no-image-enlarge`; both default to `true` and, while they don't add any
> files, dropping them would emit extra fields into `zfb.config.ts` and
> defeat the "everything OFF" premise of this pattern.

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

> Note: `sidebarFilter` has NO backing file and NO `ZudoDocConfig` field —
> the filtering UI is entirely package-owned (`sidebar-tree` island ships
> from `@takazudo/zudo-doc`) and always includes filtering. `--no-sidebar-filter`
> / `--sidebar-filter` currently has zero structural effect on the generated
> project. This test only verifies the flag does not cause a CLI error.

**claude-resources:**

```bash
cd __inbox/generator-test-claude-resources && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --claude-resources \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

**design-token-panel:**

```bash
cd __inbox/generator-test-design-token-panel && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --no-claude-resources \
  --no-image-enlarge --no-tag-governance --design-token-panel \
  --color-scheme-mode single --scheme "Default Dark" --no-install
```

**light-dark:**

```bash
cd __inbox/generator-test-light-dark && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --no-claude-resources \
  --color-scheme-mode light-dark --light-scheme "Default Light" --dark-scheme "Default Dark" \
  --default-mode light --no-install
```

> `--default-mode light` is deliberate, not optional: `"Default Light"` /
> `"Default Dark"` / `defaultMode: "dark"` / `respectPrefersColorScheme: true`
> is the exact `ZudoDocConfig` package default for `colorMode` (see
> `DEFAULT_SETTINGS.colorMode` in `packages/zudo-doc/src/config.ts`, mirrored
> by `DEFAULT_MIRROR` in `zfb-config-gen.ts`). Diff-from-defaults (locked
> #2653 Decision 2, verified by `zfb-config-gen.test.ts`'s "packageDefaultChoices
> resolves colorMode/colorScheme to the exact default" case) correctly OMITS
> `colorMode` when every sub-field matches the default — dropping
> `--default-mode light` here silently degenerates this pattern into a no-op
> that never demonstrates the `colorMode` object at all (found empirically
> during the #2667 final-confirm gate).

**lang-ja:**

```bash
cd __inbox/generator-test-lang-ja && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --no-search --no-sidebar-filter --no-i18n --no-claude-resources \
  --lang ja --color-scheme-mode single --scheme "Default Dark" --no-install
```

**all-features** (mirrors `scaffold.test.ts`'s `ALL_FEATURES` minus `tauri`/`tauriDev`):

```bash
cd __inbox/generator-test-all-features && \
  node $REPO_ROOT/packages/create-zudo-doc/dist/index.js test-project --yes \
  --i18n --search --sidebar-filter --claude-resources --claude-skills \
  --design-token-panel --sidebar-resizer --sidebar-toggle --versioning \
  --doc-history --body-foot-util --llms-txt --skill-symlinker \
  --footer-nav-group --image-enlarge --footer-copyright --changelog \
  --tag-governance --doc-tags --footer-taglist \
  --color-scheme-mode light-dark --light-scheme "Default Light" \
  --dark-scheme "Default Dark" --default-mode light \
  --github-url "https://github.com/example/test-project" --no-install
```

> `--default-mode light` (not `dark`): same reason as the light-dark
> pattern's callout above — `Default Light`/`Default Dark`/`dark`/
> `respectPrefersColorScheme: true` is the exact package default, and
> diff-from-defaults omits `colorMode` entirely when every sub-field matches
> it. Using `dark` here would silently drop `colorMode` from this pattern's
> `zfb.config.ts` too (found empirically during the #2667 final-confirm gate).

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

Check that expected files exist or don't exist in `__inbox/generator-test-<pattern>/test-project/`. Use `test -e <path>` for each row.

### Baseline — PRESENT in every pattern (the locked 12-file manifest)

| File | Expected |
|------|----------|
| `.gitignore` | PRESENT |
| `.npmrc` | PRESENT |
| `CLAUDE.md` | PRESENT |
| `package.json` | PRESENT |
| `zfb.config.ts` | PRESENT |
| `tsconfig.json` | PRESENT |
| `pages/index.tsx` | PRESENT |
| `pages/docs/[[...slug]].tsx` | PRESENT |
| `src/content/docs/getting-started/index.mdx` | PRESENT |
| `src/content/docs/getting-started/introduction.mdx` | PRESENT |
| `src/content/docs/getting-started/installation.mdx` | PRESENT |
| `src/styles/global.css` | PRESENT |

### Baseline — ABSENT in every pattern (never-resurrected; see `scaffold.test.ts`'s `NEVER_RESURRECTED` for the full 52-entry table this condenses)

| File / directory | Expected |
|------|----------|
| `pages/lib/` | ABSENT (whole directory) |
| `pages/_data.ts` | ABSENT |
| `pages/404.tsx`, `pages/sitemap.xml.tsx`, `pages/docs/tags/index.tsx`, `pages/api/ai-chat.tsx` | ABSENT (package-injected routes, never emitted as files) |
| `src/components/` | ABSENT (whole directory) |
| `src/utils/` | ABSENT (whole directory) |
| `src/types/` | ABSENT (whole directory) |
| `src/config/` | ABSENT (whole directory) — **except** when `tagGovernance` is selected (see below) |
| `zfb-shim.d.ts` | ABSENT |
| `.htmlvalidate.json` | ABSENT |
| `.zfb/` | ABSENT (whole directory) |
| `.zudo-doc.json` | ABSENT (lazy-created on first `zudo-doc eject`, never seeded) |
| `scripts/run-b4push.sh` | ABSENT |

Confirm the 5 directories above (`pages/lib`, `src/components`, `src/utils`, `src/types`, `src/config`) don't exist AT ALL for barebone — `test -d <path>` should fail for each, not just the specific files listed.

### Per-pattern deltas (on top of the baseline above)

**barebone** — baseline only, nothing added:

| File | Expected |
|------|----------|
| (all baseline PRESENT rows) | PRESENT |
| (all baseline ABSENT rows) | ABSENT |
| `zfb.config.ts` content | Only `colorMode: false`, `siteName`, `headerNav`, `headerRightItems` fields (every other field matches its default and is omitted — diff-from-defaults) |

**search:**

| File | Expected |
|------|----------|
| (baseline unchanged — search has no file footprint) | — |
| `package.json` `devDependencies["pagefind"]` | PRESENT |
| `package.json` `dependencies["minisearch"]` | PRESENT |
| `zfb.config.ts` `headerRightItems` | contains `{ type: "component", component: "search" }` |

**i18n:**

| File | Expected |
|------|----------|
| `pages/[locale]/docs/[[...slug]].tsx` | PRESENT |
| `src/content/docs-ja/getting-started/index.mdx` | PRESENT |
| `src/content/docs-ja/getting-started/introduction.mdx` | PRESENT |
| `src/content/docs-ja/getting-started/installation.mdx` | PRESENT |
| `pages/[locale]/index.tsx` | ABSENT (old home-route template, never resurrected — package-injected now) |
| `zfb.config.ts` `locales` | contains a `ja` entry with `dir: "src/content/docs-ja"` |

**sidebar-filter:**

| File | Expected |
|------|----------|
| (baseline unchanged — sidebarFilter has no file footprint and no settings field) | — |

**claude-resources:**

| File | Expected |
|------|----------|
| (baseline unchanged — claudeResources has no file footprint) | — |
| `zfb.config.ts` `claudeResources` | `{ claudeDir: ".claude" }` |
| `zfb.config.ts` `defaultLocaleOnlyPrefixes` | contains the 4 `/docs/claude-*/` prefixes |
| `zfb.config.ts` `headerNav` | contains a `{ label: "Claude", path: "/docs/claude", categoryMatch: "claude" }` entry |

**design-token-panel:**

| File | Expected |
|------|----------|
| (baseline unchanged — no new file) | — |
| `src/styles/global.css` | contains `@import "@takazudo/zdtp/styles.css";` right after the `@layer zd-preflight, zd-flow;` line |
| `zfb.config.ts` `designTokenPanel` | `true` |
| `package.json` `dependencies["@takazudo/zdtp"]` | PRESENT (unconditional dep regardless of this feature — verify it's there even in `barebone` too) |

**light-dark:**

| File | Expected |
|------|----------|
| (baseline unchanged) | — |
| `zfb.config.ts` `colorMode` | an object: `{ defaultMode: "light", lightScheme: "Default Light", darkScheme: "Default Dark", respectPrefersColorScheme: true }` (note the non-default `defaultMode: "light"` — see the CLI command's callout above) |

**lang-ja:**

| File | Expected |
|------|----------|
| `src/content/docs-ja/` | ABSENT (this pattern sets the DEFAULT language to `ja`, i18n is off — content stays in `src/content/docs/`, just written in Japanese) |
| `zfb.config.ts` `defaultLocale` | `"ja"` |

**all-features:**

| File | Expected |
|------|----------|
| `pages/[locale]/docs/[[...slug]].tsx` | PRESENT |
| `src/content/docs-ja/getting-started/index.mdx` | PRESENT |
| `src/content/docs/changelog/index.mdx` | PRESENT |
| `src/content/docs-ja/changelog/index.mdx` | PRESENT (i18n is also on) |
| `scripts/tags-audit.ts` | PRESENT |
| `scripts/tags-suggest.ts` | PRESENT |
| `src/config/tag-vocabulary.ts` | PRESENT (tagGovernance's narrow postProcess exception) |
| `src/config/settings.ts` | PRESENT (tagGovernance's narrow postProcess exception — a minimal audit-only mirror, NOT the old project-wide settings object) |
| `scripts/setup-doc-skill.sh` | PRESENT (skillSymlinker) |
| `.claude/skills/zudo-doc-design-system/` | PRESENT (claudeSkills) |
| `.claude/skills/zudo-doc-translate/` | PRESENT (claudeSkills) |
| `.claude/skills/zudo-doc-version-bump/` | PRESENT (claudeSkills) |
| `src-tauri/` | ABSENT (tauri excluded from this pattern) |
| `pages/docs/tags/index.tsx` | ABSENT (docTags routes are package-injected, never a file — even with `docTags: true`) |
| `src/components/` | ABSENT (still true even with every feature on) |

## Step 7: Verify Settings

There is no more `src/config/settings.ts` to read in a fresh scaffold (except the narrow `tagGovernance` audit-mirror pair, which is NOT the field census). Read `__inbox/generator-test-<pattern>/test-project/zfb.config.ts` instead — it is the ONE config file, a `defineConfig(zudoDoc({...}))` call with only diff-from-default fields.

### zfb.config.ts Expectations per Pattern

**barebone:**

- `colorMode: false`
- No `locales` field (omitted — matches the `{}` default)
- No `imageEnlarge` / `dynamicPageTransition` field (both explicitly set to their defaults via the CLI flags, so diff-from-defaults omits them)
- No `tagGovernance` / `tagVocabulary` field (both off, matching defaults)
- No `designTokenPanel` field (off, matching default)
- No `claudeResources` field (off, matching default)

**search:**

- `headerRightItems` includes `{ type: "component", component: "search" }`
- No `colorMode` field (single-scheme mode, matches default `false`)

**i18n:**

- `locales` contains a `ja` entry with `dir: "src/content/docs-ja"`

**sidebar-filter:**

- Identical to barebone's `zfb.config.ts` — no field this flag would set

**claude-resources:**

- `claudeResources: { claudeDir: ".claude" }`

**design-token-panel:**

- `designTokenPanel: true`

**light-dark:**

- `colorMode` is an object with `defaultMode: "light"` (non-default — required for the field to emit at all, see the CLI command's callout), `lightScheme: "Default Light"`, `darkScheme: "Default Dark"`

**lang-ja:**

- `defaultLocale: "ja"` — this is the authoritative field; there is no more separate `src/config/i18n.ts` deriving it at runtime, `@takazudo/zudo-doc`'s own i18n module reads `settings.defaultLocale` directly

**all-features:**

- `colorMode` is an object (light-dark mode, `defaultMode: "light"` — non-default, required to emit)
- `locales` contains a `ja` entry
- `claudeResources: { claudeDir: ".claude" }`
- `designTokenPanel: true`
- `docTags: true`
- `tagGovernance: "warn"`, `tagVocabulary: true`, `tagVocabularyEntries: tagVocabulary` (raw import reference)
- `versions: []`
- `footer` is an object with `links`, `copyright`, and `taglist`

## Step 8: Compare Against Showcase

For the feature being tested, briefly compare the generated project's `zfb.config.ts` field against the equivalent field in this repo's own `src/config/settings.ts` (spread into the showcase's `zfb.config.ts`). This is a sanity check that the generator's emitted VALUE shape (not file layout — the showcase legitimately keeps more real files than a fresh scaffold, see `src/CLAUDE.md` and `packages/zudo-doc/CLAUDE.md`) matches what the showcase demonstrates for the same feature.

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
### zfb.config.ts Verification: PASS/FAIL
  - [list any mismatches]
### Showcase Comparison: PASS/FAIL
  - [notes]
### Headless Browser: PASS/FAIL/SKIPPED
  - [only if --headless was passed]

### Overall: PASS/FAIL
```

## Important Notes

- Always `cd` back to the repo root between major steps (use absolute paths)
- The `--yes` flag auto-fills all unspecified options with defaults. Feature defaults with `--yes`: search=true, sidebarFilter=true, imageEnlarge=true, dynamicPageTransition=true, footerCopyright=true, tagGovernance=false, i18n=false, claudeResources=false, designTokenPanel=false (all other features false)
- Use `--no-install` with CLI to prevent auto-install, then install manually for better error visibility
- `sidebarFilter` has zero structural effect in the minimal manifest (no TODO, no strip step needed — it never had a file or field to remove)
- The dev server smoke test uses `pnpm dev` (generated projects have a single `dev` script)
- If any step fails, still report all steps attempted before stopping
- The `--headless` flag enables Step 8.5 (headless browser visual check). Without it, only process-level checks are performed
- `packages/create-zudo-doc/src/__tests__/scaffold.test.ts` is the authoritative, CI-enforced version of these tables — if this skill and that test file ever disagree, the test file wins; update this skill to match
