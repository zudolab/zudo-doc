# Doc Content (src/content/)

Writing rules for MDX content under `docs/` (English) and `docs-ja/` (Japanese). This file auto-loads when working on content files.

## Bilingual Pairing

- English: `docs/...` (default locale, served at `/docs/...`)
- Japanese: `docs-ja/...` (served at `/ja/docs/...`)
- JA must mirror the EN directory structure.
- **When creating or updating any doc page, update both EN and JA versions.** Keep code blocks identical — only translate prose.

### Exceptions to bilingual rule

- Pages with `generated: true` in frontmatter do not require Japanese translations.
- Pages whose paths fall under `settings.defaultLocaleOnlyPrefixes` are default-locale-only by design — no JA mirror should be created for them. Current entries: `/docs/claude-md/`, `/docs/claude-skills/`, `/docs/claude-agents/`, `/docs/claude-commands/`.
- Note: the top-level `/docs/claude/` index is bilingual (JA stub at `docs-ja/claude/index.mdx`); only the four deep prefixes above are default-locale-only.
- `docs-ja/claude/index.mdx` is a deliberate JA-only stub with no EN-parity obligation: its EN counterpart `docs/claude/index.mdx` is **build-generated**, so hand-editing the JA file to mirror EN content would be clobbered on the next generate. Keep the JA stub minimal — do not attempt to translate the generated EN index into it.

## Frontmatter Fields

Schema in repo-root `zfb.config.ts` (`docsSchema`). Required: `title` (string). Key optional fields:

| Field              | Type     | Description                                                                  |
| ------------------ | -------- | ---------------------------------------------------------------------------- |
| `sidebar_position` | number   | Sort order within category (lower = higher). Always set this                 |
| `description`      | string   | Subtitle below the title                                                     |
| `sidebar_label`    | string   | Custom sidebar text (overrides `title`)                                      |
| `tags`             | string[] | Cross-category grouping (must exist in `src/config/tag-vocabulary.ts`)       |
| `draft`            | boolean  | Exclude from build entirely                                                  |
| `unlisted`         | boolean  | Built but hidden from sidebar/nav                                            |
| `generated`        | boolean  | Build-time generated content (skip translation)                              |
| `hide_sidebar`     | boolean  | Hide left sidebar                                                            |
| `hide_toc`         | boolean  | Hide right-side TOC                                                          |

## Content Rules

- **No h1 in content**: The frontmatter `title` renders as the page h1. Start with `## h2`.
- **Always set `sidebar_position`**: Without it, pages sort alphabetically.
- **Kebab-case file names**: Use `my-article.mdx`, not `myArticle.mdx`.

## Admonitions

Available in all MDX files without imports (registered globally).

**Directive syntax**: `:::note[Title]` ... `:::`

**JSX syntax**: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>` — each accepts optional `title` prop.

## Linking Between Docs

Use relative file paths with `.mdx` extension:

```markdown
[Link text](./sibling-page.mdx)
[Link text](../other-category/page.mdx#anchor)
```

## Navigation Structure

Navigation is filesystem-driven. Directory structure becomes sidebar navigation.

- Pages ordered by `sidebar_position` (ascending)
- Category index pages (`index.mdx`) control category position via `sidebar_position`; add `sidebar_label` for a custom sidebar name; add `category_sort_order: "desc"` for newest-first ordering; add `category_no_page: true` to create a non-linked category header (no route/sitemap/search entry)
- `_category_.json` still works but triggers a zfb build warning; prefer `index.mdx` frontmatter
- Header nav defined in `src/config/settings.ts` via `headerNav` with `categoryMatch`

## Content Creation Workflow

1. Create English `.mdx` file under `docs/` with `title` and `sidebar_position`
2. Write content starting with `## h2` headings (not `# h1`)
3. Create matching Japanese file under `docs-ja/`
4. Keep code blocks and `<HtmlPreview>` blocks identical — only translate prose
5. Run `pnpm format` then `pnpm build` to verify
