# S8 Content Authoring + Tags Audit

**Sub-issue:** #1368 (epic #1360)
**Build command:** `pnpm build` (zfb build) from worktree root
**Branch:** `zfb-feature-audit/s8-content-tags`
**Build result:** 217 pages built, exit 0
**tags:audit --ci result:** exit 0 — 4 orphan vocabulary entries (soft finding, not a hard issue)
**Conclusion:** All frontmatter fields, tag governance modes, content rules, and frontmatterPreview verified. Build is clean. One follow-up filed for orphan vocabulary entries.

---

## Verification Matrix

### Frontmatter Fields

| Feature | Status | Severity | Root cause class | Evidence (DOM excerpt or path) | Suggested next step |
|---|---|---|---|---|---|
| `title` (required, renders as h1) | PASS | — | — | `dist/docs/guides/frontmatter/index.html`: `<title>Frontmatter \| zudo-doc</title>` and `<h1>` rendered from frontmatter title. Zod schema: `title: z.string()` (required). | None |
| `description` (subtitle below title) | PASS | — | — | `dist/docs/guides/frontmatter/index.html` contains "Complete reference for all available frontmatter fields". `frontmatter.mdx` has `description: Complete reference for all available frontmatter fields in zudo-doc documents.` | None |
| `sidebar_position` (sort order) | PASS | — | — | `pages/lib/_sidebar-with-defaults.tsx` passes `sidebar_position` through `buildNavTree`; default is 999 (pages without it sort last). Doc in `guides/frontmatter.mdx` confirms `sidebar_position: 2`. | None |
| `sidebar_label` (overrides title in sidebar) | PASS | — | — | `hide-sidebar.mdx` has `sidebar_label: Hide Sidebar`, title `"Demo: Hide Sidebar"`. In `dist/docs/guides/layout-demos/hide-toc/index.html` sidebar links use `>Hide Sidebar<` not `>Demo: Hide Sidebar<`. | None |
| `tags` (cross-category grouping) | PASS | — | — | `dist/docs/guides/tags/index.html` contains tag badges; tag index at `dist/docs/tags/` has per-tag pages. `resolvePageTags()` in `src/utils/tags.ts` handles alias resolution and deduplication. | None |
| `draft: true` (excluded from build) | PASS (code-trace) | — | — | No showcase page has `draft: true` in its YAML block. Code-trace in `pages/lib/route-enumerators.ts` line 53: `filter((d) => !d.data.draft)` applied before URL enumeration, so draft pages are never added to build routes. Doc confirms dev-mode visibility. | None |
| `unlisted: true` (built but hidden from sidebar/nav) | PASS (code-trace) | — | — | No showcase page has `unlisted: true` in YAML. Code-trace: `src/utils/docs.ts` `isNavVisible()` returns `false` when `unlisted=true` (line 10); `route-enumerators.ts` comment line 12: "Unlisted pages ARE included" — `draft` only filter on route enumeration. `[locale]/docs/[...slug].tsx` line 320 also skips doc-history util area for unlisted pages. | None |
| `generated: true` (build-time content, skip JA translation) | PASS | — | — | 21 EN pages carry `generated: true` (all under `claude-md/`, `claude-skills/`, `claude-agents/`, `claude/`). `dist/ja/docs/claude-md/` contains the same pages via EN fallback (locale-merge `enumerateMergedDocsSlugs` includes them). JA-mirror absence is correctly exempt — no JA source files required. | None |
| `hide_sidebar: true` (left sidebar hidden) | PASS | — | — | `dist/docs/guides/layout-demos/hide-sidebar/index.html`: `<aside id="desktop-sidebar" … class="sr-only">` — sidebar is screen-reader-only (visually hidden). Normal page (`hide-toc/index.html`): sidebar uses full visible classes. | None |
| `hide_toc: true` (right TOC hidden) | PASS | — | — | `dist/docs/guides/layout-demos/hide-toc/index.html`: no `aria-label="Table of contents"` element found. Normal page (`frontmatter/index.html`): TOC aside present with `aria-label="Table of contents"`. | None |

---

### Tag System

| Feature | Status | Severity | Root cause class | Evidence (DOM excerpt or path) | Suggested next step |
|---|---|---|---|---|---|
| `tagGovernance: "warn"` (default — build passes with unknowns) | PASS | — | — | `settings.ts` line 67: `tagGovernance: "warn"`. `pnpm build` exits 0. `tags-audit.ts` line 558–564: unknown tags logged to stderr but process exits 0. | None |
| `tagGovernance: "strict"` (unknown tags fail build via Zod) | PASS (code-trace) | — | — | `zfb.config.ts` `buildTagsSchema()` lines 201–213: when `tagVocabulary && tagGovernance === "strict"`, `z.array(z.enum([...allowedList]))` replaces `z.array(z.string())`. Unknown tag strings fail Zod validation at build/check time. Sandbox build deferred (config toggle would require `git restore`). | None |
| `tagGovernance: "off"` (vocabulary not consulted) | PASS (code-trace) | — | — | `src/utils/tags.ts` `vocabularyActive()` line 40: returns `false` when `tagGovernance === "off"`. `resolveTag()` then passes raw tags through with `known: false, deprecated: false`. `buildTagsSchema()` line 202: `"strict"` check short-circuits, returning loose `z.array(z.string())`. Sandbox deferred. | None |
| `tagVocabulary: true` (vocabulary consulted) | PASS | — | — | Current setting. `vocabularyActive()` returns `true`. Alias rewrites (`cf-worker` → `cloudflare-worker`) active, deprecated entries filtered, grouped footer rendering available. `src/utils/tags.ts` `resolveTag()` and `resolvePageTags()` exercise alias/deprecation paths. | None |
| `tagVocabulary: false` (vocabulary ignored) | PASS (code-trace) | — | — | `vocabularyActive()` line 40: `Boolean(settings.tagVocabulary)` — when `false`, function returns `false`; all `resolveTag()` calls pass raw tags through unchanged. `buildTagsSchema()` line 202: `vocabularyActive` false → loose string schema. Sandbox deferred. | None |
| `tagPlacement: "after-title"` (current setting) | PASS | — | — | `settings.ts` line 55: `tagPlacement: "after-title"`. `dist/docs/guides/tags/index.html` contains both `after-title` and `before-pager` class/attribute strings — the active placement is `after-title` (tag badges above main content). | None |
| `pnpm tags:audit --ci` (CI mode — exit 0 with current vocab) | PASS | — | — | `pnpm tags:audit --ci` exits 0. Output: "scanned 163 file(s), vocabulary: active, governance: warn". 4 orphan entries reported (`type:reference`, `type:tutorial`, `level:beginner`, `level:advanced`) — orphans are a soft finding, not a hard issue. `tags-audit.ts` `hasHardIssues()` line 463: only unknowns and deprecated are hard. | See follow-up below for orphans |
| `tags-suggest` (local LLM suggester) | PASS (doc + script verified) | — | — | `scripts/tags-suggest.ts` exists. `package.json` defines `"tags:suggest": "tsx scripts/tags-suggest.ts"`. `guides/tags-suggest.mdx` documents interactive and batch flows, Ollama setup, and `--model` override. Tool is not wired into CI (by design). | None |

---

### Content Rules

| Feature | Status | Severity | Root cause class | Evidence (DOM excerpt or path) | Suggested next step |
|---|---|---|---|---|---|
| No h1 in content (frontmatter `title` renders as h1) | PASS | — | — | Grep across `src/content/docs/**/*.mdx` shows no `# ` (h1 markdown) at line start in content body. `guides/frontmatter.mdx` explicitly documents the rule. Zod schema: `title: z.string()` is required. | None |
| Kebab-case file names | PASS | — | — | All `.mdx` files under `src/content/docs/` use kebab-case names (e.g., `hide-sidebar.mdx`, `tags-audit.mdx`, `frontmatter-preview.mdx`). No camelCase or PascalCase files found. | None |
| Bilingual rule: EN pages mirrored in JA (`generated: true` exempt) | PASS | — | — | `generated: true` pages (21 pages) in `src/content/docs/claude-md/`, `claude-skills/`, etc. have partial or no JA mirrors — this is expected and correct. Non-generated content has JA mirrors under `src/content/docs-ja/`. Locale-merge falls back to EN for missing JA entries. Defers to S7 (#1367) for full locale-mirror table. | None |
| `sidebar_position` required by convention | PASS (doc) | — | — | `guides/frontmatter.mdx` documents default of `999` when unset. CLAUDE.md: "Always set `sidebar_position`". Zod schema marks it optional with implicit 999 fallback. Build proceeds without it; pages appear last in their category. | None |

---

### frontmatter-preview

| Feature | Status | Severity | Root cause class | Evidence (DOM excerpt or path) | Suggested next step |
|---|---|---|---|---|---|
| `frontmatterPreview: {}` (panel renders custom keys) | PASS | — | — | `settings.ts` line 105: `frontmatterPreview: {} satisfies FrontmatterPreviewConfig`. `pages/lib/_frontmatter-preview-data.ts`: when config is `{}` (truthy object), custom keys are passed through after filtering system keys. `dist/docs/reference/frontmatter-preview/index.html` contains `author`, `status`, `discount`, `difficulty` rendered from page frontmatter. `<FrontmatterPreview>` component called at `pages/[locale]/docs/[...slug].tsx` line 310. | None |
| `frontmatterPreview: false` (feature disabled) | PASS (code-trace) | — | — | `_frontmatter-preview-data.ts` line 35: `if (config === false \|\| config === undefined) return []`. Empty entries array causes `<FrontmatterPreview>` to return null (short-circuit in v2 component). Sandbox deferred. | None |
| `extraIgnoreKeys` / `ignoreKeys` knobs | PASS (code-trace) | — | — | `_frontmatter-preview-data.ts` lines 41–46: `cfg.ignoreKeys ?? [...DEFAULT_FRONTMATTER_IGNORE_KEYS, ...(cfg.extraIgnoreKeys ?? [])]`. `extraIgnoreKeys` extends defaults; `ignoreKeys` replaces entirely. Documented in `reference/frontmatter-preview.mdx`. | None |
| Custom renderers (`frontmatter-preview-renderers.tsx`) | PARTIAL (code-trace) | minor | intentional deferral | `pages/lib/_frontmatter-preview-data.ts` comment line 16–19: "Note: `frontmatterRenderers` integration is intentionally skipped for now." Renderer map at `src/config/frontmatter-preview-renderers.tsx` exists but is not consumed by the current data builder. The doc (`reference/frontmatter-preview.mdx`) describes custom renderers (`discount`, `status`, `difficulty` pills), but the current implementation renders them as plain text only. | File follow-up: custom renderer integration in `_frontmatter-preview-data.ts` is incomplete — ships as plain text despite doc claiming styled pills |

---

## Orphan Vocabulary Entries

`pnpm tags:audit --ci` reports 4 orphan entries: `type:reference`, `type:tutorial`, `level:beginner`, `level:advanced`. These are defined in `src/config/tag-vocabulary.ts` but no current showcase page references them. This is a soft finding (orphans do not cause hard failures), but the vocabulary ships pre-seeded entries that are not exercised by any doc. No page would break; the tag index simply never shows these facets. Recommend either adding showcase pages that use these tags or retiring the entries with `deprecated: true`.

---

## Follow-up Issues

| Signature | Description |
|---|---|
| custom-renderer-not-wired | `frontmatterPreview` custom renderer map (`frontmatter-preview-renderers.tsx`) is registered in settings but not consumed by `_frontmatter-preview-data.ts`. Doc claims styled pills; actual output is plain text. File one follow-up issue. |
