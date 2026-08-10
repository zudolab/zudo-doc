/**
 * Static content-authoring conventions for zudo-doc, taught to an agent via
 * the `authoring_guide` tool.
 *
 * This is knowledge that lives outside this codebase — the zudo-doc markdown
 * dialect and content contract — modeled on how a real zudo-doc project's own
 * CLAUDE.md teaches the same rules to Claude. Keeping it here as one static
 * string, rather than scattering rule fragments across tool descriptions,
 * means an agent can load the whole contract in one call before writing
 * anything.
 */
export const AUTHORING_GUIDE = `# zudo-doc authoring guide

Read this once at the start of a session, before writing pages. It covers the
conventions the zudo-doc renderer expects — following them avoids
\`authoring-lint\` warnings from \`write_page\` and produces pages that render
correctly.

## Frontmatter contract

Every page has exactly three frontmatter fields, set via \`write_page\`'s
\`frontmatter\` argument:

- \`title\` (required) — the page's only h1. The renderer prints this as the
  page heading; do not repeat it as a heading in the body.
- \`description\` (recommended) — a one-sentence summary used in listings and
  previews.
- \`draft\` (optional boolean) — marks a page as not ready for readers.

There is no \`order\` or \`position\` field. A page's place in the navigation is
structural, not frontmatter, and is set with outline commands
(\`add-page\`, \`move-page\`, \`reorder-pages\`) via \`apply_outline_command\` — never
by editing the page content.

## Body starts at h2, never h1

Because the frontmatter \`title\` renders as the page's h1, the body's first
heading — and every heading after it — must start at \`##\`. A body that opens
with \`# Heading\` produces two h1s on the same page.

\`\`\`markdown
---
title: Deploying
description: Ship a build to production.
---

## Overview

Some intro text.

## Configuration

...
\`\`\`

## Admonitions

Seven directives are supported: \`:::note\`, \`:::tip\`, \`:::info\`,
\`:::warning\`, \`:::danger\`, \`:::caution\`, \`:::details\`. Any other directive
name renders as plain text, not a callout.

A custom title uses **bracket syntax**, never the brace/attribute form:

\`\`\`markdown
:::note[Before you start]
Make sure the API server is running on port 4324.
:::
\`\`\`

\`:::note{title="Before you start"}\` is NOT supported — it will not render as a
titled note.

## GFM tables and task lists

Standard GitHub-flavored markdown tables and task lists both work:

\`\`\`markdown
| Field   | Type    | Required |
| ------- | ------- | -------- |
| title   | string  | yes      |
| draft   | boolean | no       |

- [x] Draft the outline
- [ ] Write the first page
\`\`\`

## Code fences need a language tag

\`\`\`markdown
\`\`\`ts
export const answer = 42;
\`\`\`
\`\`\`

An untagged fence still renders, but loses syntax highlighting — always tag
the language (\`ts\`, \`bash\`, \`json\`, \`markdown\`, ...).

## Slugs

Page and category slugs are kebab-case: lowercase letters, digits and hyphens
only, no leading/trailing hyphen. \`add-page\`, \`add-category\` and
\`set-page-slug\` derive a valid slug from a title automatically when you omit
\`slug\`; if you pass one explicitly it is validated as-is and never silently
renamed.

## The read → command → re-read loop

1. Call \`get_project\` (or \`outline_overview\` for a compact view) to read the
   current structure and \`revision\`.
2. Call \`apply_outline_command\` or \`write_page\` with that \`revision\` as
   \`expectedRevision\`.
3. A \`stale-revision\` error means something else changed the project first —
   re-read and retry with the new revision. Never retry with the same
   \`expectedRevision\`.
4. \`write_page\`'s response includes \`warnings\` — read them; they name the
   exact rule above that the body broke.
`;
