---
title: Tags and the Blog Index
date: 2026-04-18
author: zudo-doc
description: How tag governance interacts with blog frontmatter, and what the blog index does with tags today.
tags:
  - content
  - customization
  - type:reference
excerpt: "Blog posts share the same tag vocabulary as docs. Reuse existing ids when you can, add a vocabulary entry when you can't, and let the audit script catch typos."
---

## Shared vocabulary

Blog posts and doc pages share a single tag vocabulary defined in
`src/config/tag-vocabulary.ts`. That keeps the namespace consistent: a post
tagged `content` lines up with doc pages tagged `content`, and the tag audit
script reports unknown ids across both collections at once.

## Governance modes

Two settings control how strictly tags are validated. `tagVocabulary` decides
whether the vocabulary file is consulted at all, and `tagGovernance` decides
the enforcement level when it is — `off`, `warn`, or `strict`. The default
combination, `tagVocabulary: true` with `tagGovernance: "warn"`, lets you
iterate quickly while still surfacing typos in the audit output.

## Adding a new tag

When you want a tag that does not yet exist, add a new entry to
`tag-vocabulary.ts` rather than dropping a one-off string into a post. The
schema is:

```ts
{
  id: "performance",
  description: "Performance tuning, profiling, build speed.",
  group: "topic",
}
```

Use the `aliases` field to absorb older spellings, and `deprecated` to phase a
tag out without breaking existing pages.

## Why this post uses a manual excerpt

The frontmatter at the top of this file sets an `excerpt:` field. That value is
what the blog index renders, and it wins over any `<!-- more -->` marker. Use a
manual excerpt when you want the summary to read differently from the opening
of the post — for example to lead with a verb or to hide a long preamble.
