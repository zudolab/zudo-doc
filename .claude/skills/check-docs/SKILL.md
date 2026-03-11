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

1. Scan all `.mdx` and `.md` files in the configured `docsDir`
2. Check for broken internal links (references to pages that don't exist)
3. Check for missing frontmatter fields (`title` is required)
4. Report findings as a summary

## Example Usage

```bash
/check-docs
```

## Checks Performed

- **Broken links** — Internal `[text](./path)` links that point to non-existent files
- **Missing title** — MDX files without a `title` in frontmatter
- **Empty files** — Files with no content after frontmatter
- **Duplicate sidebar_position** — Multiple files in the same category with the same position value
