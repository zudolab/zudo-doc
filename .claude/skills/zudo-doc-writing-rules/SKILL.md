---
name: zudo-doc-writing-rules
description: "Doc-writing rules for zudo-doc content (mdx files under src/content/docs/ and src/content/docs-ja/). Consult before writing or editing doc content. Covers: no h1 in content, sidebar_position is mandatory, kebab-case file names, bilingual rule, linking conventions, and admonition syntax. Triggered by 'writing rules', 'zudo-doc-writing-rules', 'doc rule', 'mdx rule', 'write a doc', 'create a page'."
user-invocable: true
---

# zudo-doc Doc-Writing Rules

**IMPORTANT**: Consult these rules before writing or editing any mdx content under `src/content/docs/` or `src/content/docs-ja/`. These rules exist to prevent common AI mistakes that silently break layout, navigation, or i18n.

## Reference

For navigation structure rules (which category, filesystem layout), see the companion skill `zudo-doc-navigation-design`. This skill covers content-level mistakes, not structural ones.

## Hard Rules (never violate)

### No h1 in content

- **Frontmatter `title` is the page h1.** It is rendered automatically by the doc layout.
- **Content MUST start with `## h2`**, not `# h1`.
- Writing `# Something` inside the body produces a duplicate h1 and breaks heading hierarchy / TOC / a11y.

```mdx
---
title: Installation
sidebar_position: 1
---

## Prerequisites      ← start here, NOT with a "# Installation" heading

...
```

### Always set `sidebar_position`

- Without it, pages sort alphabetically within their category — almost never what you want.
- Set it in the frontmatter of **every page**, including category `index.mdx` files (which control the category's position in the parent sidebar).
- Small integers are fine; leaving gaps (1, 2, 3, 10) makes later insertion easier.

### Kebab-case file names

- `my-article.mdx` ✓
- `myArticle.mdx` ✗ — breaks on case-sensitive filesystems
- `my_article.mdx` ✗ — inconsistent with the rest of the site

The URL slug is derived from the filename, so kebab-case also keeps URLs clean.

### Bilingual rule

- When creating or updating any doc page, **update both EN (`src/content/docs/`) and JA (`src/content/docs-ja/`) versions.**
- Keep **code blocks identical** — only translate prose.
- Keep `<HtmlPreview>` and other JSX blocks identical.
- The JA directory should mirror the EN directory tree exactly.
- **Exception**: pages with `generated: true` in frontmatter are skipped (they are generated at build time).

## Frontmatter Schema

The schema is defined in `src/content.config.ts` (Zod validation). Required and key optional fields:

| Field | Type | Required? | Notes |
|---|---|---|---|
| `title` | string | yes | Renders as page h1 |
| `sidebar_position` | number | recommended | Without it, pages sort alphabetically |
| `description` | string | no | Subtitle below the h1 |
| `sidebar_label` | string | no | Overrides `title` in the sidebar only |
| `tags` | string[] | no | Cross-category grouping |
| `draft` | boolean | no | Excludes the page from the build entirely |
| `unlisted` | boolean | no | Built but hidden from sidebar/nav |
| `generated` | boolean | no | Build-time generated; skip JA translation |
| `hide_sidebar` | boolean | no | Hide the left sidebar on this page |
| `hide_toc` | boolean | no | Hide the right-side table of contents |

Unknown fields are rejected by the Zod schema — do not invent new ones without updating the schema.

## Linking Between Docs

Use **relative paths with the `.mdx` extension**. The framework's link resolver rewrites them to the correct URLs at build time and validates them.

```markdown
[Link text](./sibling-page.mdx)
[Link text](../other-category/page.mdx#anchor)
```

- Do NOT use absolute paths like `/docs/foo/bar` in prose — the resolver cannot verify them.
- Do NOT omit the `.mdx` extension — the resolver needs it to find the target.

For the companion skill that audits links: `/check-docs`.

## Admonitions

Admonitions are available globally — no imports needed.

**Directive syntax** (preferred in prose-heavy content):

```mdx
:::note[Optional Title]
Body content.
:::
```

**JSX syntax** (preferred when nesting other JSX):

```mdx
<Note title="Optional Title">Body content.</Note>
<Tip>...</Tip>
<Info>...</Info>
<Warning>...</Warning>
<Danger>...</Danger>
```

All five components accept an optional `title` prop.

## Common Mistakes (Do Not Do)

- **Starting content with `# Foo`** — duplicates the h1. Start with `## Foo`.
- **Forgetting `sidebar_position`** — produces alphabetical chaos in the sidebar.
- **camelCase or PascalCase file names** — breaks on some filesystems.
- **Updating only the EN or only the JA version** — breaks the bilingual mirror.
- **Absolute `/docs/...` links in prose** — the resolver cannot verify them; use relative `./page.mdx` instead.
- **Omitting the `.mdx` extension in links** — the resolver requires it.
- **Inventing frontmatter fields** — the Zod schema will reject them at build time.
- **Translating code inside code blocks** — the bilingual rule says code stays identical.

## Recommended Workflow

1. Decide *where* the page belongs (see `zudo-doc-navigation-design` for the category decision).
2. Create the EN file under `src/content/docs/<category>/<page>.mdx` with `title` and `sidebar_position`.
3. Write content starting with `## h2` headings only.
4. Use `./` relative links with `.mdx` extension for cross-refs.
5. Create the matching JA file under `src/content/docs-ja/<category>/<page>.mdx` — same code blocks, translated prose.
6. Run `pnpm format:md` then `pnpm build` to verify — the build will catch missing required fields, broken links, and unknown frontmatter.
