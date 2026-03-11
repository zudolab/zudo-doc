---
name: example-skill
description: An example skill that demonstrates the skill format for zudo-doc documentation.
---

# Example Skill

This is a sample skill to verify that the Claude Resources integration generates skill documentation correctly.

## When to Use

- When testing the `claude-resources` integration
- As a template for creating new skills

## How It Works

1. The skill is discovered from `.claude/skills/example-skill/SKILL.md`
2. Frontmatter (`name`, `description`) is extracted
3. The body content is rendered as an MDX page

## Example Usage

```bash
/example-skill
```

## Notes

- Skills can include `scripts/`, `assets/`, and `references/` subdirectories
- The `description` frontmatter is shown in the skills index page
