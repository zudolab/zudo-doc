/**
 * "Aurora Docs" — the sample documentation base.
 *
 * The API server seeds a fresh project from this, and tests reuse it as a
 * realistic fixture. Ids are literal rather than minted so a seeded project is
 * byte-identical on every machine, which is what makes snapshot assertions and
 * cross-process fixtures possible.
 *
 * Note the split the outline model enforces: `auroraDocsOutline` carries
 * structure only, and every title/description/draft flag lives in
 * `auroraDocsPages[].meta` — the frontmatter the server writes to disk.
 */

import type { OutlineDoc } from "../core/outline/types";
import type { PageMeta } from "../core/outline/site-map";

export interface SamplePage {
  id: string;
  categoryId: string;
  slug: string;
  meta: PageMeta;
  /** Page body, without the frontmatter block. */
  markdown: string;
}

export const AURORA_PROJECT_TITLE = "Aurora Docs";

/**
 * The Installation page in full — the one sample page written out properly, so
 * the editor, the preview pane and the authoring-lint rules all have real
 * content to exercise: prose, a list, a fenced block, a directive, and an
 * ordered list.
 */
export const auroraInstallationMarkdown = `Aurora Docs runs on the zudo-doc toolchain, so installing it means installing
Node, a package manager, and the framework itself. The whole setup takes about
two minutes on a machine that already has Node.

## Prerequisites

- **Node.js 22 or newer** — older releases lack the loader hooks the build depends on
- **pnpm 10 or newer** — npm and yarn work too, but every example here uses pnpm
- **Git** — the doc history panel reads commit metadata straight from the repository

## Install

Create the project and start the dev server:

\`\`\`bash
pnpm create zudo-doc aurora-docs
cd aurora-docs
pnpm install
pnpm dev
\`\`\`

:::note[Port already in use]
The dev server binds port 4321. If something else holds it, stop that process
first — the server fails fast rather than silently picking another port.
:::

## Next steps

1. Open http://localhost:4321 and confirm the starter page renders.
2. Edit \`src/content/docs/index.mdx\` and watch the page hot-reload.
3. Add a category in the outline editor, then write your first real page.
`;

export const auroraDocsPages: SamplePage[] = [
  {
    id: "page-getting-started-index",
    categoryId: "cat-getting-started",
    slug: "index",
    meta: {
      id: "page-getting-started-index",
      title: "Getting started",
      description: "Install Aurora Docs and publish your first page.",
    },
    markdown:
      "Everything you need to go from an empty directory to a running documentation site.\n",
  },
  {
    id: "page-getting-started-introduction",
    categoryId: "cat-getting-started",
    slug: "introduction",
    meta: {
      id: "page-getting-started-introduction",
      title: "Introduction",
      description: "What Aurora Docs is and who it is for.",
    },
    markdown:
      "Aurora Docs is a documentation framework for teams that would rather write markdown than maintain a site.\n",
  },
  {
    id: "page-getting-started-installation",
    categoryId: "cat-getting-started",
    slug: "installation",
    meta: {
      id: "page-getting-started-installation",
      title: "Installation",
      description: "Prerequisites, install commands, and the first run.",
      draft: true,
    },
    markdown: auroraInstallationMarkdown,
  },
  {
    id: "page-getting-started-quick-start",
    categoryId: "cat-getting-started",
    slug: "quick-start",
    meta: {
      id: "page-getting-started-quick-start",
      title: "Quick start",
      description: "A working site in five minutes.",
    },
    markdown:
      "Scaffold a project, add one page, and deploy it — the shortest path from nothing to a published site.\n",
  },
  {
    id: "page-guides-index",
    categoryId: "cat-guides",
    slug: "index",
    meta: {
      id: "page-guides-index",
      title: "Guides",
      description: "Task-shaped walkthroughs for everyday authoring.",
    },
    markdown:
      "Each guide answers one question and stops. Read them in any order.\n",
  },
  {
    id: "page-guides-writing-pages",
    categoryId: "cat-guides",
    slug: "writing-pages",
    meta: {
      id: "page-guides-writing-pages",
      title: "Writing pages",
      description: "Frontmatter, headings, directives, and code fences.",
    },
    markdown:
      "A page is markdown plus a frontmatter block. This guide covers the fields that change how a page renders.\n",
  },
  {
    id: "page-guides-sidebar-structure",
    categoryId: "cat-guides",
    slug: "sidebar-structure",
    meta: {
      id: "page-guides-sidebar-structure",
      title: "Sidebar structure",
      description: "How categories and page order shape navigation.",
    },
    markdown:
      "The sidebar mirrors your outline exactly: categories become sections, and page order is the order you set.\n",
  },
  {
    id: "page-guides-theming",
    categoryId: "cat-guides",
    slug: "theming",
    meta: {
      id: "page-guides-theming",
      title: "Theming",
      description: "Design tokens, light and dark palettes, and typography.",
      draft: true,
    },
    markdown:
      "Themes are a set of design tokens. Override the tokens you care about and leave the rest alone.\n",
  },
  {
    id: "page-guides-i18n",
    categoryId: "cat-guides",
    slug: "i18n",
    meta: {
      id: "page-guides-i18n",
      title: "Internationalization",
      description: "Serving the same documentation in several languages.",
    },
    markdown:
      "Each locale gets its own content directory and its own URL prefix; the default locale is served unprefixed.\n",
  },
  {
    id: "page-guides-publishing",
    categoryId: "cat-guides",
    slug: "publishing",
    meta: {
      id: "page-guides-publishing",
      title: "Publishing",
      description: "Building the static site and shipping it.",
    },
    markdown:
      "The build emits plain static HTML, so any static host will serve it without extra configuration.\n",
  },
  {
    id: "page-reference-index",
    categoryId: "cat-reference",
    slug: "index",
    meta: {
      id: "page-reference-index",
      title: "Reference",
      description: "Exhaustive listings of every option and command.",
    },
    markdown:
      "Look here when you already know what you want and need the exact name for it.\n",
  },
  {
    id: "page-reference-config",
    categoryId: "cat-reference",
    slug: "config",
    meta: {
      id: "page-reference-config",
      title: "Configuration",
      description: "Every configuration field and its default.",
    },
    markdown:
      "Configuration lives in a single file at the project root. Every field below is optional.\n",
  },
  {
    id: "page-reference-frontmatter",
    categoryId: "cat-reference",
    slug: "frontmatter",
    meta: {
      id: "page-reference-frontmatter",
      title: "Frontmatter fields",
      description: "The per-page metadata block, field by field.",
    },
    markdown:
      "Frontmatter owns a page's title, description, and draft state. Nothing else may set them.\n",
  },
  {
    id: "page-reference-cli",
    categoryId: "cat-reference",
    slug: "cli",
    meta: {
      id: "page-reference-cli",
      title: "CLI commands",
      description: "dev, build, preview, and check.",
    },
    markdown:
      "Four commands cover the whole lifecycle: develop, build, preview the build, and type-check.\n",
  },
];

export const auroraDocsOutline: OutlineDoc = {
  schemaVersion: 1,
  projectTitle: AURORA_PROJECT_TITLE,
  categories: [
    {
      id: "cat-getting-started",
      slug: "getting-started",
      title: "Getting started",
      pages: [
        { id: "page-getting-started-index", slug: "index" },
        { id: "page-getting-started-introduction", slug: "introduction" },
        { id: "page-getting-started-installation", slug: "installation" },
        { id: "page-getting-started-quick-start", slug: "quick-start" },
      ],
    },
    {
      id: "cat-guides",
      slug: "guides",
      title: "Guides",
      pages: [
        { id: "page-guides-index", slug: "index" },
        { id: "page-guides-writing-pages", slug: "writing-pages" },
        { id: "page-guides-sidebar-structure", slug: "sidebar-structure" },
        { id: "page-guides-theming", slug: "theming" },
        { id: "page-guides-i18n", slug: "i18n" },
        { id: "page-guides-publishing", slug: "publishing" },
      ],
    },
    {
      id: "cat-reference",
      slug: "reference",
      title: "Reference",
      pages: [
        { id: "page-reference-index", slug: "index" },
        { id: "page-reference-config", slug: "config" },
        { id: "page-reference-frontmatter", slug: "frontmatter" },
        { id: "page-reference-cli", slug: "cli" },
      ],
    },
  ],
};

/** Frontmatter for every sample page, in outline order. */
export const auroraDocsPageMeta: PageMeta[] = auroraDocsPages.map(
  (page) => page.meta,
);

export function findSamplePage(pageId: string): SamplePage | undefined {
  return auroraDocsPages.find((page) => page.id === pageId);
}
