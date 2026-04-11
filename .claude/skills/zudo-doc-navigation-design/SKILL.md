---
name: zudo-doc-navigation-design
description: "Navigation design rules for zudo-doc documentation sites. Consult before creating new pages, restructuring directories, or designing header navigation. Covers: 3-level hierarchy (header → sidebar → nested), file-structure-is-navigation principle, header nav conciseness, category index pages, sidebar_position discipline, and common mistakes. Triggered by 'nav design', 'navigation structure', 'zudo-doc-navigation-design', 'structure nav', 'add category', 'add header nav'."
user-invocable: true
---

# zudo-doc Navigation Design Rules

**IMPORTANT**: Consult these rules before creating new doc pages, adding categories, or designing the site's navigation. AI tools tend to pattern-match to personal preference and produce chaotic structures; this skill encodes the correct approach.

## Reference Documentation

The full guide lives at `src/content/docs/getting-started/structuring-navigations.mdx`. Read it for examples and the gaming-wiki walkthrough. This skill is the short version.

## The 3-Level Hierarchy

zudo-doc has exactly three levels. Do not invent more:

1. **Header nav** — the biggest categories (3–6 items max)
2. **Sidebar** — all pages in the active category (generated from the filesystem)
3. **Nested sidebar categories** — subsections within a sidebar (2–3 levels of nesting max)

Each level narrows scope. Never jump levels — do not put a specific page directly in the header, and do not hide a whole category in a nested sidebar fold.

## File Structure IS the Navigation

**This is the single most important rule.** The directory tree under `src/content/docs/` *is* the navigation. There is no separate config to keep in sync.

- A directory becomes a sidebar category. Its `index.mdx` is the category landing page.
- A file becomes a sidebar item.
- Subdirectories become nested collapsible categories.
- The `headerNav` setting maps top-level directories to header items via `categoryMatch`.

**Consequence**: design the filesystem with navigation in mind from the start. Do not reorganize the sidebar via config hacks — reorganize the files.

## Header Navigation Rules

The header is the topmost level. It holds only the biggest categories.

- **3–6 items max.** More than 6 overwhelms users and wraps the header.
- **Each item is a broad section, not a page.** "Guides" ✓, "How to install" ✗.
- **`categoryMatch` must be a single top-level directory name.** Multi-segment values (e.g. `"platforms/xbox"`) break active-state highlighting. If you need nested grouping, use a header-level dropdown with children — not a path.
- **Dropdowns are for closely related sections only.** "Learn > Guides, Components" makes sense. "Everything > 7 miscellaneous items" does not — split into separate header items instead.

## Sidebar Structure Rules

The sidebar is generated from the filesystem. The rules are about how you organize files:

- **Every category directory MUST have an `index.mdx`.** Without it, the category has no landing page and may not appear correctly. The index's `sidebar_position` sets the category's position.
- **Every page MUST set `sidebar_position`.** Without it, pages sort alphabetically — which is almost never what you want. This is the single most common AI mistake.
- **Nesting depth: 2–3 levels max.** Deep nesting hides content. If you need more, the header nav is probably missing a category — split it out.
- **Each sidebar section should cover one cohesive topic.** Do not mix unrelated themes in the same sidebar (e.g. "Hardware" and "Community Events" under the same section).
- **Use kebab-case directory and file names.** `my-article.mdx`, not `myArticle.mdx`.

## Checklist for Adding a New Page

Before creating any new doc page, check this list:

- [ ] Which header category does it belong under? (If none fits, either add a header category or rethink whether this page is really needed.)
- [ ] Which sidebar section inside that header category?
- [ ] Does the target directory exist? If yes, does it have an `index.mdx`?
- [ ] Have you set `sidebar_position` in the frontmatter?
- [ ] Is the file name in kebab-case?
- [ ] For bilingual projects: have you created the matching file under `src/content/docs-ja/` (or added `generated: true` if it is skipped)?

## Checklist for Adding a New Category

Before creating any new category directory:

- [ ] Is this really a new category, or does it belong under an existing one? Default to "fewer categories."
- [ ] Does it need a header nav entry, or is it a nested sidebar category inside an existing header entry?
- [ ] Have you created `index.mdx` with a descriptive landing page and `sidebar_position`?
- [ ] If you added a header entry, does its `categoryMatch` value equal the new top-level directory name (single segment)?
- [ ] Does the new category have at least 3 pages? Fewer than 3 usually means the pages belong under a broader category instead.

## Common Mistakes (Do Not Do)

- **Putting specific pages in the header nav.** The header is for categories, not pages. "Getting Started" ✓, "Installation tutorial" ✗.
- **Deep nesting (4+ levels).** If you find yourself nesting deeply, the header is probably missing a category.
- **Mixing unrelated topics in one sidebar section.** Split them.
- **Missing `sidebar_position` on pages.** Leads to unpredictable alphabetical order.
- **Missing `index.mdx` in category directories.** Category has no landing page.
- **Multi-segment `categoryMatch`** (e.g. `"platforms/xbox"`). Breaks active highlighting — use a single top-level directory name.
- **Reorganizing via config instead of filesystem.** If you are tempted to add a custom sidebar config override, the underlying filesystem is probably wrong. Fix the files instead.

## When in Doubt

If you are not sure whether a page belongs in header, sidebar, or nested sidebar: **ask for the current navigation tree first**, draw it out, and place the new page where it fits the hierarchy. Never add pages to "whatever directory is closest" without considering the whole structure.
