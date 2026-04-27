---
title: Writing Bilingual Blog Posts
date: 2026-04-12
author: zudo-doc
description: How locale fallbacks work for blog posts, and what changes (and what does not) when translating to a second language.
tags:
  - i18n
  - content
  - type:guide
---

When a post is missing in a non-default locale, zudo-doc falls back to the
English version automatically. That means an English-only post still appears in
the Japanese blog index — same slug, same date, same body. Translators do not
have to translate every post on day one; they translate the ones that matter
and leave the rest to fall back.

## How matching works

The locale loader matches posts by slug. Each Japanese post under
`src/content/blog-ja/` overrides the English post with the same slug or
filename, and any English post without a Japanese counterpart appears with the
"This page has not been translated yet" notice on the detail page.

## Translate prose only

Keep the frontmatter shape identical between locales. Same `date`, same `tags`,
same `slug`, same `author`. Only translate human-facing text: `title`,
`description`, the prose body, and any inline strings inside JSX or admonition
blocks. Code blocks stay verbatim.

## A worked example

Suppose you write `src/content/blog/release-notes-1-0.md`. The Japanese mirror
is `src/content/blog-ja/release-notes-1-0.md` with the same frontmatter shape.
Until that mirror exists, the post still renders on `/ja/blog/` using the
English body — readers see the post, and a fallback notice signals that a
translation is welcome.

## Excerpt fallback in action

This post deliberately omits both an `excerpt:` field and a `<!-- more -->`
marker. The blog index falls back to the first paragraph of the body, so this
opening paragraph is what a reader sees on the listing page. That fallback
behaves the same way across locales.
