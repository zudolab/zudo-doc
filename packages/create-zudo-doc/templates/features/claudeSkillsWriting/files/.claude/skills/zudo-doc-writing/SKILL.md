---
name: zudo-doc-writing
description: "Doc-writing and navigation-structure guide for this zudo-doc project. Consult BEFORE creating pages, adding categories, designing header navigation, or writing/editing mdx content under src/content/. Covers: plan-the-nav-tree-first workflow, 3-level hierarchy (header → sidebar → nested), file-structure-is-navigation, category index pages, sidebar_position discipline, frontmatter schema, no-h1 rule, relative .mdx links, and admonition syntax. Triggered by 'write docs', 'add a page', 'create a page', 'add category', 'structure navigation', 'nav design', 'zudo-doc-writing'."
user-invocable: true
---

# zudo-doc Writing & Navigation Guide

**IMPORTANT**: Follow this guide strictly when creating or editing documentation in this project. AI tools that skip the navigation-planning step produce chaotic, hard-to-navigate doc structures almost every time — this skill exists to prevent exactly that.

## Step 0 — Plan the Navigation Tree BEFORE Writing Anything

Never create pages one by one "wherever seems closest." Before writing the first page:

1. List every topic the site must cover.
2. Draw the full navigation tree (header items → sidebar categories → pages) as a plain-text outline.
3. Only then create directories and files matching that tree exactly.

When adding to an existing site, read the current tree under `src/content/docs/` first, draw it out, and place the new page where it fits the hierarchy — never skip this step.

## The 3-Level Hierarchy

zudo-doc has exactly three navigation levels. Do not invent more:

1. **Header nav** — the broadest categories (3–6 items max)
2. **Sidebar** — all pages of the active category (generated from the filesystem)
3. **Nested sidebar categories** — subsections within a sidebar (2–3 levels of nesting max)

Each level narrows scope. Never jump levels — do not put a specific page directly in the header, and do not bury a whole category inside a deep sidebar fold.

## File Structure IS the Navigation

**This is the single most important rule.** The directory tree under `src/content/docs/` *is* the navigation. There is no separate navigation config to maintain:

- A directory becomes a sidebar category. Its `index.mdx` is the category landing page.
- A file becomes a sidebar item.
- Subdirectories become nested collapsible categories.
- The `headerNav` setting maps top-level directories to header items via `categoryMatch`.

**Consequence**: design the filesystem with navigation in mind from the start. Do not reorganize the sidebar via config hacks — reorganize the files.

## Header Navigation Rules

Header navigation is the `headerNav` field of the `zudoDoc({...})` call in this project's `zfb.config.ts`:

```ts
// zfb.config.ts
export default defineConfig(
  zudoDoc({
    headerNav: [
      { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },
      {
        label: "Learn",
        path: "/docs/guides",
        categoryMatch: "guides",
        children: [
          { label: "Guides", path: "/docs/guides", categoryMatch: "guides" },
          { label: "Components", path: "/docs/components", categoryMatch: "components" },
        ],
      },
      { label: "Reference", path: "/docs/reference", categoryMatch: "reference" },
    ],
  }),
);
```

- **3–6 items max.** More than 6 overwhelms users and wraps the header.
- **Each item is a broad section, not a page.** "Guides" ✓, "How to install" ✗.
- **`categoryMatch` MUST be a single top-level directory name.** Multi-segment values (e.g. `"platforms/xbox"`) break active-state highlighting. For nested grouping, use a header-level dropdown with `children` — not a path.
- **Dropdowns are for closely related sections only.** "Learn > Guides, Components" makes sense. "Everything > 7 miscellaneous items" does not — split into separate header items instead.
- **`categoryMatch` values must match actual directory names** — `categoryMatch: "guides"` requires a `guides/` directory under the docs content root.

For a large navigation tree, the home page's category grid can opt into a wider layout with `home: { wide: true }` in the same `zudoDoc({...})` call.

## Sidebar Structure Rules

The sidebar is generated from the filesystem. The rules are about how you organize files:

- **Every category directory MUST have an `index.mdx`.** Without it, the category has no landing page and may not appear correctly. The index's `sidebar_position` sets the category's position in the parent sidebar.
- **Every page MUST set `sidebar_position`.** Without it, pages sort alphabetically — almost never what you want. This is the single most common AI mistake. Small integers are fine; leaving gaps (1, 2, 3, 10) makes later insertion easier.
- **Nesting depth: 2–3 levels max.** Deep nesting hides content. If you need more, the header nav is probably missing a category — split it out.
- **Each sidebar section covers one cohesive topic.** Do not mix unrelated themes in the same section (e.g. "Hardware" and "Community Events").
- **Use kebab-case directory and file names.** `my-article.mdx`, not `myArticle.mdx` (breaks on case-sensitive filesystems) or `my_article.mdx`. The URL slug derives from the filename, so kebab-case also keeps URLs clean.

## Category Top Page (index.mdx)

Every category directory must have an `index.mdx` — the **landing page** for that category. Keep it short:

- A 1–2 sentence intro describing what the category covers.
- A `<CategoryNav category="<dir>" />` component that auto-renders links to sibling pages.
- **No full content beyond the intro.** Real documentation lives in sibling `.mdx` files under the same directory.

```mdx
---
title: Guides
sidebar_position: 1
---

Step-by-step guides for common tasks.

<CategoryNav category="guides" />
```

The `category` prop value is the category's **slug relative to the docs content root** — for a top-level directory this is just the directory name (e.g. `"guides"`), and for a nested category the slash-joined path (e.g. `"guides/advanced"`). It is a slug, never a filesystem path — no `src/content/` prefix, no trailing slash.

## Worked Example — Nav Plan First, Then Files

Building a gaming wiki? Plan the tree first:

```
Header Nav:                       Sidebar (Xbox section):
├── Home                          ├── Overview (index)
├── Platforms        ← dropdown   ├── Hardware
│   ├── Xbox                      │   ├── Xbox Series X
│   ├── PlayStation               │   └── Accessories
│   └── Nintendo                  ├── Games
├── Genres           ← dropdown   │   ├── Halo Infinite
│   ├── RPG                       │   └── Starfield
│   └── Action                    └── Services
└── Community                         └── Game Pass
```

Then the directory structure follows mechanically — each platform and genre gets its own top-level directory so `categoryMatch` matches the first URL segment:

```
src/content/docs/
├── home/
│   └── index.mdx
├── xbox/
│   ├── index.mdx                  ← "Overview" (short intro + <CategoryNav>)
│   ├── hardware/
│   │   ├── index.mdx
│   │   ├── xbox-series-x.mdx
│   │   └── accessories.mdx
│   ├── games/
│   │   └── ...
│   └── services/
│       └── ...
├── playstation/
│   └── index.mdx
├── rpg/
│   └── ...
└── community/
    └── index.mdx
```

## Writing Rules (per page)

### Frontmatter

```mdx
---
title: My Page
description: A brief summary of this page.
sidebar_position: 1
---

## First Section

Your content here.
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Page title — automatically rendered as the page h1 |
| `sidebar_position` | number | Strongly recommended | Sort order within category (lower = first) |
| `description` | string | No | Subtitle shown below the title |
| `sidebar_label` | string | No | Override the sidebar display label |
| `tags` | string[] | No | Cross-category grouping |
| `draft` | boolean | No | Exclude the page from the build entirely |
| `unlisted` | boolean | No | Built but hidden from sidebar/nav |

Frontmatter is Zod-validated at build time. The table above covers the framework-known fields; custom keys (e.g. `author`, `status`) pass through and are preserved for your own use — they just carry no built-in behavior.

### No h1 in content

The frontmatter `title` IS the page h1, rendered automatically. **Content must start with `## h2` headings.** Writing `# Something` in the body produces a duplicate h1 and breaks the heading hierarchy, TOC, and accessibility.

### Linking between documents

Use **relative file paths with the `.md`/`.mdx` extension** — they are resolved to correct URLs and validated at build time:

```mdx
[Installation guide](./installation.mdx)
[Frontmatter fields](../guides/frontmatter.mdx#anchor)
```

- Do NOT use absolute paths like `/docs/foo/bar` in prose — the resolver cannot verify them.
- Do NOT omit the extension — the resolver needs it to distinguish file links from URL links.
- External links use regular URLs as usual.

### Admonitions

Available globally — no imports needed. Two syntaxes:

```mdx
:::note[Optional Title]
Directive syntax — preferred in prose-heavy content.
:::

<Warning title="Be Careful">JSX syntax — preferred when nesting other JSX.</Warning>
```

Six types: `note`/`<Note>`, `tip`/`<Tip>`, `info`/`<Info>`, `warning`/`<Warning>`, `danger`/`<Danger>`, `caution`/`<Caution>`. All accept an optional title. (JSX additionally registers `<Important>`, used by GitHub-alert conversion.)

## i18n (only when this project's i18n feature is enabled)

Check `zfb.config.ts`: if the `zudoDoc({...})` call sets a non-empty `locales` field, i18n is on. Then every page must exist in BOTH the default-locale directory (`src/content/docs/`) and each secondary-locale directory (e.g. `src/content/docs-ja/`), mirroring the same tree — same filenames, translated prose, identical code blocks. A non-i18n scaffold has no secondary content directory; skip this section entirely.

Two carve-outs — do NOT create secondary-locale mirrors for these:

- Pages with `generated: true` in frontmatter (build-generated content).
- Paths listed in the `defaultLocaleOnlyPrefixes` setting in `zfb.config.ts` — default-locale-only by design (the Claude Resources feature, when enabled, registers its four `/docs/claude-*` prefixes there).

## Common Mistakes (Do Not Do)

- **Writing pages before planning the nav tree** — the root cause of chaotic structures.
- **Putting specific pages in the header nav.** The header is for broad categories only.
- **Missing `sidebar_position`** — unpredictable alphabetical ordering.
- **Missing `index.mdx` in category directories** — category has no landing page.
- **Stuffing a category `index.mdx` with full content** — keep it to intro + `<CategoryNav>`.
- **Multi-segment `categoryMatch`** (e.g. `"platforms/xbox"`) — breaks header active-state highlighting.
- **Deep nesting (4+ levels)** — the header nav is probably missing a category.
- **Starting content with `# h1`** — duplicates the auto-rendered title.
- **Absolute `/docs/...` links or extension-less links in prose** — the resolver can't verify them.
- **camelCase/PascalCase file names** — break on case-sensitive filesystems.
- **Reorganizing navigation via config instead of moving files** — the filesystem is the navigation.

## Checklist Before Creating Any Page

- [ ] Have you drawn (or re-read) the full navigation tree?
- [ ] Which header category does the page belong under? (If none fits, add a header category or reconsider the page.)
- [ ] Which sidebar section inside that header category?
- [ ] Does the target directory exist, with an `index.mdx`?
- [ ] Is `sidebar_position` set in the frontmatter?
- [ ] Is the file name kebab-case?
- [ ] Does the content start with `## h2` (no h1)?
- [ ] If i18n is enabled: is the secondary-locale mirror file created too?

## Full Guides

The complete versions of this guidance (with more examples) are published in the zudo-doc showcase docs:

- Writing docs: https://zudo-doc.takazudomodular.com/docs/getting-started/writing-docs/
- Structuring navigations: https://zudo-doc.takazudomodular.com/docs/getting-started/structuring-navigations/
