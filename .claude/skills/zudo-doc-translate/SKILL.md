---
name: zudo-doc-translate
description: Translate zudo-doc documentation between English and Japanese with project-specific conventions.
triggers:
  - translate
  - 翻訳
  - i18n
  - en to ja
  - ja to en
  - translate docs
  - ドキュメント翻訳
---

# zudo-doc Translation Skill

Translate documentation between English and Japanese following project-specific conventions.

## i18n Structure

- English docs: `src/content/docs/` — routes at `/docs/...`
- Japanese docs: `src/content/docs-ja/` — routes at `/ja/docs/...`
- Directory structures must mirror each other exactly (same filenames, same folder hierarchy)
- Locale settings: `locales` in `src/config/settings.ts`
- Astro i18n config: `astro.config.ts` with `prefixDefaultLocale: false` (English has no prefix, Japanese uses `/ja/`)

## Translation Rules

### Keep in English (do NOT translate)

- Component names: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>`
- Code blocks — code is universal
- File paths: `src/content/docs/...`, `.claude/skills/...`, etc.
- CLI commands: `pnpm dev`, `pnpm build`, etc.
- Technical terms that are standard in English (e.g., component, props, frontmatter, slug)
- Frontmatter field keys (`title`, `description`, `sidebar_position`, `category`)

### Translate

- Frontmatter field values (e.g., the `title` value, the `description` value)
- The `title` prop of admonition components (e.g., `<Note title="注意">`)
- Prose content, headings, list items, table cells (except as noted below)

### Table conventions

- In tables with a "Required" column: use **"Yes"** / **"No"** directly, NOT "はい" / "いいえ" — Japanese conversational yes/no is unnatural in technical documentation

### Internal links

- Adjust link paths when translating:
  - En→Ja: `/docs/getting-started` → `/ja/docs/getting-started`
  - Ja→En: `/ja/docs/getting-started` → `/docs/getting-started`

## File Naming

- Japanese files use the **same filenames** as English (e.g., `writing-docs.mdx`)
- Only the parent directory differs: `docs/` vs `docs-ja/`
- Example: `src/content/docs/guides/writing-docs.mdx` → `src/content/docs-ja/guides/writing-docs.mdx`

## Workflow

### En→Ja Translation

1. Read the English source file from `src/content/docs/`
2. Check if the corresponding Japanese file already exists in `src/content/docs-ja/`
3. Copy the English file to the equivalent path in `src/content/docs-ja/`
4. Translate the content following the rules above
5. Verify internal links point to `/ja/docs/...`

### Ja→En Translation

1. Read the Japanese source file from `src/content/docs-ja/`
2. Check if the corresponding English file already exists in `src/content/docs/`
3. Copy the Japanese file to the equivalent path in `src/content/docs/`
4. Translate the content following the rules above
5. Verify internal links point to `/docs/...` (no `/ja/` prefix)

### Post-Translation Checks

- Frontmatter keys are unchanged (only values translated)
- All admonition component names remain in English
- Code blocks are untouched
- Internal links use the correct locale prefix
- Directory structure mirrors the source language
