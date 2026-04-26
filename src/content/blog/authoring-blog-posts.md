---
title: Authoring Blog Posts in zudo-doc
date: 2026-04-22
author: zudo-doc
description: A walkthrough of the frontmatter fields and conventions used by the zudo-doc blog feature.
tags:
  - content
  - type:guide
  - level:beginner
---

zudo-doc ships with a small but opinionated blog feature: a date-aware index page,
locale-aware fallbacks, and a `<!-- more -->` excerpt marker. This post is a quick
tour of how an author sets up a new entry.

<!-- more -->

## Where posts live

English posts live under `src/content/blog/`. Locale mirrors live under
`src/content/blog-{locale}/` — for example `src/content/blog-ja/`. Filenames are
kebab-case and end in `.md` or `.mdx`. Pick `.md` for prose-only posts and `.mdx`
only when you need MDX features such as JSX components.

## Required frontmatter

Two fields are required by the schema:

- `title` — the post title shown on the index card and detail page.
- `date` — an ISO-formatted date used for ordering and the "Published on" label.

Beyond that, every other field is optional but useful:

| Field | Purpose |
|---|---|
| `description` | One-liner shown in metadata and feed contexts. |
| `author` / `authors` | Single author string or array for co-authored posts. |
| `tags` | Cross-post grouping. Validated against `tag-vocabulary.ts`. |
| `excerpt` | Manual excerpt text. Wins over the `<!-- more -->` marker. |
| `slug` | Override the URL slug derived from the filename. |
| `draft` | Excluded from production builds. |
| `unlisted` | Built but hidden from the sidebar's recent list. |

## The excerpt marker

The body of this post uses the `<!-- more -->` marker. Everything above the
marker becomes the excerpt rendered on the blog index; everything below it is
only visible on the detail page. If you prefer a hand-written summary, set the
`excerpt:` frontmatter field instead — it always wins, even when a marker is
present.

## Sorting and pagination

Posts are sorted newest-first by `date`. The blog index paginates at
`postsPerPage` posts per page (defaults to 10). The sidebar surfaces the latest
`sidebarRecentCount` posts (defaults to 30) plus an "Archives" link that lists
every post.
