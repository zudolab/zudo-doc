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

This skill only applies when this project's i18n feature is enabled. A
non-i18n scaffold has no secondary-locale content directory (e.g. no
`docs-ja/`) and no locale-prefixed routes — there's nothing to translate.
Check `zfb.config.ts`'s `zudoDoc({...})` call: if it sets a non-empty
`locales` field, i18n is on.

- Default-locale docs: `src/content/docs/` — routes at `/docs/...` (the
  default locale is never prefixed)
- Secondary-locale docs: `src/content/docs-<locale>/` — routes at
  `/<locale>/docs/...`. For the common preset (English default, Japanese
  secondary) this is `src/content/docs-ja/` at `/ja/docs/...`; the rest of
  this skill assumes that pairing, but confirm the actual locale code and
  directory from `zfb.config.ts` if this project uses a different one
- Directory structures must mirror each other exactly (same filenames, same folder hierarchy)
- Locale configuration lives in this project's `zfb.config.ts`, inside the
  `zudoDoc({...})` call: `defaultLocale` (the default locale code — always
  unprefixed, no separate flag needed) and `locales` (a map of additional
  locale code → `{ label, dir }`; each entry becomes a `/<code>/docs/...`
  route tree)

## Translation Rules

### Keep in English (do NOT translate)

- Component names: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>`, `<Tabs>`, `<TabItem>`, `<Details>`
- Code blocks — code is universal
- File paths: `src/content/docs/...`, `.claude/skills/...`, etc.
- CLI commands: `<pm> run dev`, `<pm> run build`, etc. (`<pm>` = this project's package manager)
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
   - If it exists, read it first — use it as a base and update from the English source rather than overwriting from scratch
   - If it does not exist, create the file at the equivalent path in `src/content/docs-ja/`
3. Translate the content following the rules above
4. Verify internal links point to `/ja/docs/...`

### Ja→En Translation

1. Read the Japanese source file from `src/content/docs-ja/`
2. Check if the corresponding English file already exists in `src/content/docs/`
   - If it exists, read it first — use it as a base and update from the Japanese source rather than overwriting from scratch
   - If it does not exist, create the file at the equivalent path in `src/content/docs/`
3. Translate the content following the rules above
4. Verify internal links point to `/docs/...` (no `/ja/` prefix)

### Post-Translation Checks

- Frontmatter keys are unchanged (only values translated)
- All admonition component names remain in English
- Code blocks are untouched
- Internal links use the correct locale prefix
- Directory structure mirrors the source language
