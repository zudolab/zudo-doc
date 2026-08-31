---
name: zudo-doc-translate
description: Translate zudo-doc documentation between the locales configured in this project, with Japanese conventions applied only to the `ja` locale.
triggers:
  - translate
  - 翻訳
  - i18n
  - translate docs
  - ドキュメント翻訳
---

# zudo-doc Translation Skill

Translate documentation between the locales configured in this project. Do not
assume that a project has only English and Japanese content.

## i18n Structure

This skill applies only when this project's i18n feature is enabled. A
non-i18n scaffold has no non-empty `locales` map in `zfb.config.ts` and no
additional-locale content directory — there is nothing to translate. Read the
`zudoDoc({...})` call in `zfb.config.ts` before choosing any source or target:

- `defaultLocale` identifies the default locale. Its content is in `docsDir`
  (normally `src/content/docs/`) and its routes are unprefixed (`/docs/...`).
- `locales` is the exact map of additional locale code → `{ label, dir }`.
  Translate into every requested map entry at its configured `dir`, rather than
  guessing a directory from the locale code.
- Each configured additional locale is routed at `/<locale-code>/docs/...`.

Never discover current locales with a `src/content/docs-*` glob. Versioned
trees such as `src/content/docs-v1` or `src/content/docs-v1-ja` are snapshots,
not current locale roots.

The scaffold's starter content is language-specific: the `ja` locale receives
Japanese starter prose when it is configured, while arbitrary non-EN locales
start with English placeholder prose pending translation. Do not describe a
non-JA locale as already translated.

## Translation Rules

### Keep in English (do NOT translate)

- Component names: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>`, `<Tabs>`, `<TabItem>`, `<Details>`
- Code blocks — code is universal
- File paths and configured directory names
- CLI commands: `<pm> run dev`, `<pm> run build`, etc. (`<pm>` = this project's package manager)
- Technical terms that are standard in English (e.g., component, props, frontmatter, slug)
- Frontmatter field keys (`title`, `description`, `sidebar_position`, `category`)

### Translate

- Frontmatter field values (for example, the `title` and `description` values)
- The `title` prop of admonition components (for example, `<Note title="注意">`)
- Prose content, headings, list items, and table cells (except as noted below)

### Japanese-only conventions

Apply these conventions only when the source or target locale code is `ja`:

- In tables with a "Required" column, use **"Yes"** / **"No"** directly,
  rather than Japanese conversational yes/no.
- Preserve the project's Japanese technical terminology and natural prose.

For every locale code other than `ja`, follow that language's conventions when
known; do not infer Japanese guidance or claim that its starter content is
translated.

### Internal links

Adjust link paths when translating between locale trees:

- Default → an additional locale: `/docs/getting-started` →
  `/<locale-code>/docs/getting-started`
- An additional locale → default: `/<locale-code>/docs/getting-started` →
  `/docs/getting-started`
- Between additional locales: replace the source locale prefix with the target
  locale prefix.

## File Naming

Every locale uses the same filenames. Only the configured parent directory
differs. For example, a file under `src/content/docs/guides/writing-docs.mdx`
maps to the same relative path under the `dir` configured for the target
locale.

## Workflow

### Default → an additional locale

1. Read the source file from the configured default `docsDir`.
2. Read the corresponding target file under the target locale's configured
   `dir`, if it exists. Use it as a base instead of overwriting it from scratch.
3. Translate the content following the rules above. Apply Japanese conventions
   only when the target locale code is `ja`.
4. Create the target file at the equivalent relative path when it does not yet
   exist.
5. Verify internal links use the target locale prefix.

### An additional locale → default

1. Read the source file under that locale's configured `dir`.
2. Read the corresponding file under the configured default `docsDir`, if it
   exists; otherwise create it at the equivalent relative path.
3. Translate the content and remove the source locale prefix from internal
   links.

### Between additional locales

Use the exact `dir` entries from `locales` for both source and target. Preserve
the relative file path and code blocks, and replace the source route prefix
with the target route prefix. Japanese conventions apply only if one of those
locale codes is `ja`.

## Post-Translation Checks

- `defaultLocale`, `docsDir`, and every `locales` map entry are unchanged
- Frontmatter keys are unchanged; only values are translated
- All admonition component names remain in English
- Code blocks are untouched
- Internal links use the correct configured locale prefix
- The target directory mirrors the source relative file structure
