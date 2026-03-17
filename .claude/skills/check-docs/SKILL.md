---
name: check-docs
description: Check documentation for broken links and formatting issues
---

# Check Docs

Scan documentation files for common issues and report problems found.

## When to Use

- Before publishing or merging documentation changes
- As part of a review workflow to catch broken links
- When reorganizing docs structure to verify no links broke

## How It Works

1. Build the site with `pnpm build`
2. Run the link checker with `pnpm check:links` to verify all internal links in the built output
3. Scan all `.mdx` and `.md` files in the configured `docsDir`
4. Check for broken internal links (references to pages that don't exist)
5. Check for missing frontmatter fields (`title` is required)
6. Report findings as a summary

The recommended command to run all checks:

```bash
pnpm build && pnpm check:links
```

## Example Usage

```bash
/check-docs
```

This skill runs `pnpm build && pnpm check:links` to build the site and verify all links.

## Checks Performed

- **Broken links (build output)** — `pnpm check:links` scans the built HTML for broken internal links
- **Broken links (source)** — Internal `[text](./path)` links that point to non-existent files
- **Missing title** — MDX files without a `title` in frontmatter
- **Empty files** — Files with no content after frontmatter
- **Duplicate sidebar_position** — Multiple files in the same category with the same position value
