---
name: zudo-doc-navigation-design
description: "Navigation design rules for zudo-doc documentation sites. Consult before creating new pages, restructuring directories, or designing header navigation. Covers: the recommended 3-level hierarchy (header → sidebar → nested), filesystem navigation as the default, linked versus heading-only category rows, when an editorial tree is warranted, header nav conciseness, category index pages, sidebar_position discipline, and common mistakes. Triggered by 'nav design', 'navigation structure', 'zudo-doc-navigation-design', 'structure nav', 'add category', 'add header nav'."
user-invocable: true
---

# zudo-doc Navigation Design Rules

**IMPORTANT**: Consult these rules before creating new doc pages, adding categories, or designing the site's navigation. AI tools tend to pattern-match to personal preference and produce chaotic structures; this skill encodes the correct approach.

## Reference Documentation

This skill is the short version. The authoritative guides are:

- `src/content/docs/getting-started/structuring-navigations.mdx` — choosing a pattern (decision table) and the gaming-wiki walkthrough.
- `src/content/docs/guides/sidebar.mdx` — category rows, sidebar item semantics, `initialPath`/`initialPathMode`, `scopeRoot`, and scope recipes.
- `src/content/docs/guides/editorial-navigation.mdx` — the advanced recipe for re-parenting existing pages without moving their URLs.

Link to those guides instead of copying their advanced implementation into another file.

## The 3-Level Hierarchy

Design for three levels. This is a usability recommendation, not a technical maximum — the sidebar is recursive and renders any depth — but deeper trees are harder to read:

1. **Header nav** — the biggest categories (3–6 items max)
2. **Sidebar** — all pages in the active category (generated from the filesystem)
3. **Nested sidebar categories** — subsections within a sidebar (2–3 levels of nesting max)

Each level narrows scope. Never jump levels — do not put a specific page directly in the header, and do not hide a whole category in a nested sidebar fold.

## File Structure Is the Default Navigation

**This is the single most important rule.** By default, the directory tree under `src/content/docs/` *is* the navigation, with no separate config to keep in sync. Recommend this default first.

- A directory becomes a sidebar category. Its `index.mdx` is the category landing page.
- A file becomes a sidebar item.
- Subdirectories become nested collapsible categories.
- The `headerNav` setting maps top-level directories to header items via `categoryMatch`.

## Category Shapes

Choose the category shape before writing its index:

- **Tree (default)** — a topic hierarchy that may contain subdirectories. Keep `index.mdx` to a short intro plus `<CategoryNav category="<category-path>" />`.
- **Note tray** — a top-level, flat sequence such as a journal, course, or notebook: papers on a tray, latest on top or read in order. Declare `category_shape: "note-tray"` on its visible routed `index.mdx`, allow only direct child files, and use `<NoteTrayIndex>` instead of `<CategoryNav>`.

Note trays keep the normal `sidebar_position` comparator and use `category_sort_order` everywhere. `note_tray_dated: true` requires a quoted, calendar-valid `date` on every item, including unlisted items. `note_tray_sidebar` accepts `"index"`, `"year"`, or `"month"`; year/month grouping requires a dated tray. Keep `sidebar_position` monotonic with `date` as a documented recommendation, not a validation rule.

**Consequence**: design the filesystem with navigation in mind from the start. When the wanted hierarchy differs from the directories, move the files.

Editorial trees are supported for the case where existing URLs must stay but the sidebar needs different parents, including cross-section collections. That is an advanced chrome-bindings recipe (`guides/editorial-navigation.mdx`); recommend it only when moving files is not an option.

## Linked Parents vs Heading-Only Groups

Decide for every group row whether it is a link:

- **Linked parent** — a real category node backed by a page. An authored `index.mdx` gives it intentional landing content, label, and position. Keep the real node and its native children; do not wrap it in a synthetic category and do not repeat the landing page as an "Overview" child.
- **Heading-only group** — no page of its own. Use `category_no_page: true` on the `index.mdx`, or a synthetic `{ type: "category" }` sidebar item.

A synthetic `type: "category"` never has an `href`, and `SidebarCategory` has no property that links it to a page. Putting a landing page inside one produces an unlinked heading with the landing page duplicated as its first child.

The renderer chooses linked versus heading-only by whether the row has an `href`. `hasPage` is not a navigability test: generated auto-index rows and `type: "link"` items have `hasPage: false` but still link.

## Header Navigation Rules

The header is the topmost level. It holds only the biggest categories.

- **3–6 items max.** More than 6 overwhelms users and wraps the header.
- **Each item is a broad section, not a page.** "Guides" ✓, "How to install" ✗.
- **`categoryMatch` must be a single top-level directory name.** Multi-segment values (e.g. `"platforms/xbox"`) break active-state highlighting and sidebar scoping. When dropdown children are nested under one top-level directory, keep `categoryMatch` on the parent and omit it from the children; child active state comes from `path`. Per-package changelogs (`changelog/core`, `changelog/cli`) are the canonical example. Children that represent separate top-level directories may each use their own single-segment `categoryMatch`.
- **Dropdowns are for closely related sections only.** "Learn > Guides, Components" makes sense. "Everything > 7 miscellaneous items" does not — split into separate header items instead.

## Sidebar Structure Rules

The sidebar is generated from the filesystem. The rules are about how you organize files:

- **Author an `index.mdx` for every category directory.** It supplies intentional landing content and metadata; its `sidebar_position` sets the category's position. Without one, an ordinary category that contains pages still gets a generated auto-index route and a linked row, but with a default label and position. `category_no_page: true` removes the route and the link. Note trays are stricter: they require a visible routed `index.mdx`.
- **Every page MUST set `sidebar_position`.** Without it, pages sort alphabetically — which is almost never what you want. This is the single most common AI mistake.
- **Nesting depth: prefer 2–3 levels.** Deep nesting hides content. If you need more, the header nav is probably missing a category — split it out. This is a readability rule, not an enforced limit.
- **Each sidebar section should cover one cohesive topic.** Do not mix unrelated themes in the same sidebar (e.g. "Hardware" and "Community Events" under the same section).
- **Use kebab-case directory and file names.** `my-article.mdx`, not `myArticle.mdx`.
- A header section keeps the full editorial tree unless its sidebar definition sets `scopeRoot: "configured"`. That cap is the highest Broaden can reach. It does not replace `initialPath`. Omit it to preserve the default. Do not add the cap to invent a directory boundary the filesystem does not have.

## Checklist for Adding a New Page

Before creating any new doc page, check this list:

- [ ] Which header category does it belong under? (If none fits, either add a header category or rethink whether this page is really needed.)
- [ ] Which sidebar section inside that header category?
- [ ] Does the target directory exist? If yes, does it have an `index.mdx`?
- [ ] Have you set `sidebar_position` in the frontmatter?
- [ ] Is the file name in kebab-case?
- [ ] For bilingual projects: have you created the matching file under `src/content/docs-ja/` (or added `generated: true` if it is skipped)?

## Category Top Page (index.mdx)

Every category directory should have an authored `index.mdx`. This file is the **landing page** for that category — keep it short:

- A 1–2 sentence intro describing what the category covers.
- A `<CategoryNav category="<category-path>" />` component for a tree category, or `<NoteTrayIndex />` for a declared note tray.
- **No full content or prose beyond the intro.** Real documentation lives in sibling `.mdx` files under the same directory.

The `category` prop value is the directory path relative to the docs content root. Use a single segment for a top-level category (for example, `category="reference"`) or a slash-separated path for a nested category (for example, `category="changelog/core"`). Do not include `src/content/docs/` or a leading slash.

Example `index.mdx` for a `guides/` category:

```mdx
---
title: Guides
sidebar_position: 1
---

Step-by-step guides for common zudo-doc tasks.

<CategoryNav category="guides" />
```

## Checklist for Adding a New Category

Before creating any new category directory:

- [ ] Is this really a new category, or does it belong under an existing one? Default to "fewer categories."
- [ ] Does it need a header nav entry, or is it a nested sidebar category inside an existing header entry?
- [ ] Have you chosen tree vs note-tray shape and created `index.mdx` with the matching list component, a short intro, and `sidebar_position`?
- [ ] If you added a header entry, does its `categoryMatch` value equal the new top-level directory name (single segment)?
- [ ] Does the new category have at least 3 pages? Fewer than 3 usually means the pages belong under a broader category instead.

## Common Mistakes (Do Not Do)

- **Putting specific pages in the header nav.** The header is for categories, not pages. "Getting Started" ✓, "Installation tutorial" ✗.
- **Deep nesting (4+ levels).** If you find yourself nesting deeply, the header is probably missing a category. (The sidebar renders it; readers struggle with it.)
- **Mixing unrelated topics in one sidebar section.** Split them.
- **Missing `sidebar_position` on pages.** Leads to unpredictable alphabetical order.
- **Missing `index.mdx` in category directories.** The category falls back to a generated index page with a default label and position instead of intentional landing content.
- **Wrapping a linked category in a synthetic `type: "category"`.** It produces an unlinked heading plus a duplicate landing-page child. Keep the real category node.
- **Multi-segment `categoryMatch`** (e.g. `"platforms/xbox"`). Breaks active highlighting — use a single top-level directory name.
- **Reorganizing via config instead of filesystem.** If you are tempted to add a custom sidebar config override, the underlying filesystem is probably wrong. Fix the files instead. Reach for an editorial tree only when existing URLs must stay.
- **Treating `initialPath: [0]` as a universal index.** It indexes the resolved visible tree. `autogenerated` with `dirName` hides that directory's row, so `[0]` becomes its first child.
- **Using `<CategoryNav>` for a note tray.** It loses tray-specific ranks, dates, and ordering; use `<NoteTrayIndex>`.
- **Stuffing a category `index.mdx` with full content/prose.** The index is a landing page — keep it to a short intro plus the shape-appropriate list component and put real content in sibling files.

## When in Doubt

If you are not sure whether a page belongs in header, sidebar, or nested sidebar: **ask for the current navigation tree first**, draw it out, and place the new page where it fits the hierarchy. Never add pages to "whatever directory is closest" without considering the whole structure.
