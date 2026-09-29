# basic-blog

A zfb starter: a content collection, static routes, one client island, and
zudo-wind. Everything in here is meant to be read and edited — there is no
hidden layer.

## Quickstart

```sh
zfb dev        # dev server with live reload
zfb build      # static build into dist/
zfb preview    # serve the built output
zfb check      # TypeScript + content-schema validation
```

The same commands are available as package scripts (`dev`, `build`,
`preview`, `typecheck`).

## Structure

```
.
├── zfb.config.ts        # wind tokens, framework, collections + schema, markdown
├── mdx-components.tsx   # component map applied to every rendered entry
├── tsconfig.json        # one path alias: ~/* → project root
├── pages/
│   ├── index.tsx        # home — site intro + post list
│   ├── about.tsx        # a static route (no collection, no paths())
│   ├── 404.tsx          # emits a flat dist/404.html
│   └── blog/
│       └── [slug].tsx   # one page per collection entry, via paths()
├── layouts/
│   └── default.tsx      # <head>, header, footer, theme bootstrap script
├── components/
│   ├── callout.tsx      # Note / Tip / Important / Warning / Caution
│   ├── theme-toggle.tsx # the only "use client" island
│   └── zfb-shim.d.ts    # types for the bare `zfb/config` specifier
├── content/
│   └── blog/            # the `blog` collection (.md and .mdx)
├── lib/
│   └── types.ts         # frontmatter + entry types shared by routes
└── styles/
    └── global.css       # authored CSS, accent values, .prose styles
```

## Markdown features

zfb's markdown pipeline has a core layer that is always on, and a set of
opt-in features enabled per project. The
[markdown features index](https://zfb.takazudomodular.com/docs/markdown-features)
is the full map; `content/blog/markdown-showcase.md` renders a live example
of every row marked **on** below.

### On in this starter

| Feature | Config key | Docs |
| --- | --- | --- |
| Heading anchor links | always on | [heading-links](https://zfb.takazudomodular.com/docs/markdown-features/heading-links) |
| Syntax highlighting | always on | [syntax-highlighting](https://zfb.takazudomodular.com/docs/markdown-features/syntax-highlighting) |
| Code block title | always on | [code-title](https://zfb.takazudomodular.com/docs/markdown-features/code-title) |
| CJK-friendly emphasis | always on | [cjk-friendly](https://zfb.takazudomodular.com/docs/markdown-features/cjk-friendly) |
| Tables, strikethrough | `markdown.gfm` (default) | [gfm](https://zfb.takazudomodular.com/docs/markdown-features/gfm) |
| Task lists, footnotes | `markdown.gfm` (opted in) | [gfm](https://zfb.takazudomodular.com/docs/markdown-features/gfm) |
| GitHub alerts | `markdown.features.githubAlerts` | [github-alerts](https://zfb.takazudomodular.com/docs/markdown-features/github-alerts) |
| Code enrichment | `markdown.features.codeEnrichment` | [code-enrichment](https://zfb.takazudomodular.com/docs/markdown-features/code-enrichment) |
| Heading-marker TOC | `markdown.features.headingMarkerToc` | [heading-marker-toc](https://zfb.takazudomodular.com/docs/markdown-features/heading-marker-toc) |

### Available, not enabled here

Add any of these to `zfb.config.ts` to turn it on or configure it.

| Feature | Config key | Docs |
| --- | --- | --- |
| Code tabs | `markdown.features.codeTabs` | [code-tabs](https://zfb.takazudomodular.com/docs/markdown-features/code-tabs) |
| Mermaid diagrams | `markdown.features.mermaid` | [mermaid](https://zfb.takazudomodular.com/docs/markdown-features/mermaid) |
| Ruby annotation | `markdown.features.ruby` | [ruby](https://zfb.takazudomodular.com/docs/markdown-features/ruby) |
| Reading time | `markdown.features.readingTime` | [reading-time](https://zfb.takazudomodular.com/docs/markdown-features/reading-time) |
| Image dimensions | `markdown.features.imageDimensions` | [image-dimensions](https://zfb.takazudomodular.com/docs/markdown-features/image-dimensions) |
| Link validation | `markdown.features.linkValidation` | [link-validation](https://zfb.takazudomodular.com/docs/markdown-features/link-validation) |
| Transclusion | `markdown.features.transclude` | [transclude](https://zfb.takazudomodular.com/docs/markdown-features/transclude) |
| TOC export | `markdown.features.tocExport` | [toc-export](https://zfb.takazudomodular.com/docs/markdown-features/toc-export) |
| Custom directives | `markdown.features.directives` | [directives](https://zfb.takazudomodular.com/docs/markdown-features/directives) |
| Heading ID strategy | `markdown.features.headingIds` | [heading-links](https://zfb.takazudomodular.com/docs/markdown-features/heading-links) |
| External link attributes | `markdown.externalLinks` | [external-links](https://zfb.takazudomodular.com/docs/markdown-features/external-links) |
| Hard line breaks | `markdown.hardBreaks` | [hard-breaks](https://zfb.takazudomodular.com/docs/markdown-features/hard-breaks) |
| Strip `.md` from links | `stripMdExt` | [strip-md-ext](https://zfb.takazudomodular.com/docs/markdown-features/strip-md-ext) |
| Resolve markdown links | `resolveMarkdownLinks` | [resolve-links](https://zfb.takazudomodular.com/docs/markdown-features/resolve-links) |

## Next steps

- **Paginate the post list** — `paginate()` turns a collection into one route
  per page: [paginate reference](https://zfb.takazudomodular.com/docs/api/paginate).
- **Add tag pages** — posts already carry `tags` in their frontmatter; a
  `pages/tags/[tag].tsx` route can group them:
  [routing](https://zfb.takazudomodular.com/docs/concepts/routing).
- **Add another island** — mark a component `"use client"` and wrap it in
  `<Island>`: [islands](https://zfb.takazudomodular.com/docs/concepts/islands).
- **Override markdown elements globally** — extend `mdx-components.tsx`:
  [mdx components](https://zfb.takazudomodular.com/docs/concepts/mdx-components).
- **Deploy** — `dist/` is a plain folder of static files, so any static host
  will serve it: [guides](https://zfb.takazudomodular.com/docs/guides).
