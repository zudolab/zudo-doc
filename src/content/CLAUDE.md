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

- Files with `generated: true` in frontmatter are generator-owned; do not hand-edit or
  translate them.
- The Claude/Codex resource generators own their overview and category `index.mdx` targets in
  the default content directory and every configured locale directory. They generate localized
  indexes from the `resource.*` translations, so do not create hand-written locale stubs.
- If an authored file already occupies one of those generator target paths, the generator
  refuses to overwrite it; it does not silently replace the file. Remove or rename the authored
  index, then express its title, description, and labels through `ZudoDocConfig.translations`.
- Claude/Codex resource detail files remain in the default content directory and are exposed at
  other locale routes through body fallback. Do not copy those generated detail files into locale
  directories.
- Paths explicitly configured under `settings.defaultLocaleOnlyPrefixes`
  (`src/config/settings.ts`) are default-locale-only by design — create no locale mirror. This
  repository currently configures no such prefixes; the legacy resource prefixes are not
  package or showcase defaults.

## Navigation Structure

Navigation is filesystem-driven — directory structure becomes sidebar navigation.

- Pages ordered by `sidebar_position` (ascending)
- Category index pages (`index.mdx`) control category position via `sidebar_position`; add
  `sidebar_label` for a custom sidebar name; add `category_sort_order: "desc"` for
  newest-first ordering; add `category_no_page: true` to create a non-linked category header
  (no route/sitemap/search entry)
- Categories have two shapes: the default nested tree uses `<CategoryNav>` on its index;
  a top-level, flat note tray declares `category_shape: "note-tray"` and uses
  `<NoteTrayIndex>`. A tray requires a visible routed `index.mdx`; `note_tray_dated: true`
  requires `date` on every child (including unlisted children), and `note_tray_sidebar`
  accepts `"index"`, `"year"`, or `"month"` (the grouped styles require a dated tray).
- Note-tray order always comes from `sidebar_position` plus `category_sort_order`; rank is
  derived and must not be authored. Keep positions monotonic with `date` in dated trays.
- `_category_.json` still works but triggers a zfb build warning; prefer `index.mdx` frontmatter
- Header nav is defined in `src/config/settings.ts` via `headerNav` with `categoryMatch`
