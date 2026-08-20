# Doc Content (src/content/)

**Before writing or editing any `.mdx` here, invoke `/zudo-doc-writing-rules`.** That skill
is the canonical copy of the writing rules — no h1 in content, mandatory `sidebar_position`,
kebab-case file names, no horizontal rules as separators, the frontmatter schema table, the
bilingual rule, linking conventions, admonition syntax, and the content-creation workflow.
This file keeps only what is *not* in the skill.

The frontmatter schema itself is package-owned — `@takazudo/zudo-doc/docs-schema` (source:
`packages/zudo-doc/src/docs-schema/index.ts`), wired in by `zudoDoc()`. It is **not** defined
in the repo-root `zfb.config.ts`, which deliberately omits `buildDocsSchema`.

## The one rule to remember without loading the skill

**When creating or updating any doc page, update both EN (`docs/`) and JA (`docs-ja/`)
versions.** Keep code blocks and `<HtmlPreview>` blocks identical — only translate prose.
JA mirrors the EN directory tree exactly. Exceptions below.

## Bilingual carve-outs

- Pages with `generated: true` in frontmatter need no JA translation.
- Paths under `settings.defaultLocaleOnlyPrefixes` (`src/config/settings.ts`) are
  default-locale-only by design — create no JA mirror. Current entries:
  `/docs/claude-md/`, `/docs/claude-skills/`, `/docs/claude-agents/`,
  `/docs/claude-commands/`, `/docs/codex-agents-md/`, `/docs/codex-config/`,
  `/docs/codex-agents/`, `/docs/codex-hooks/`, `/docs/codex-rules/`, `/docs/codex-skills/`.
- The top-level `/docs/claude/` and `/docs/codex/` indexes **are** bilingual (JA stubs at
  `docs-ja/claude/index.mdx` and `docs-ja/codex/index.mdx`); only the ten deep prefixes above
  are default-locale-only.
- `docs-ja/claude/index.mdx` and `docs-ja/codex/index.mdx` are deliberate JA-only stubs with
  **no EN-parity obligation**: their EN counterparts are **build-generated**, so hand-editing
  the JA files to mirror EN content would be clobbered on the next generate. Keep the JA stubs
  minimal — do not attempt to translate the generated EN indexes into them.

## Navigation Structure

Navigation is filesystem-driven — directory structure becomes sidebar navigation.

- Pages ordered by `sidebar_position` (ascending)
- Category index pages (`index.mdx`) control category position via `sidebar_position`; add
  `sidebar_label` for a custom sidebar name; add `category_sort_order: "desc"` for
  newest-first ordering; add `category_no_page: true` to create a non-linked category header
  (no route/sitemap/search entry)
- `_category_.json` still works but triggers a zfb build warning; prefer `index.mdx` frontmatter
- Header nav is defined in `src/config/settings.ts` via `headerNav` with `categoryMatch`
