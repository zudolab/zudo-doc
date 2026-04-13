#!/usr/bin/env bash
set -euo pipefail

# ── setup-zudo-doc-wisdom.sh ───────────────────────────────
# Non-interactive script that creates the zudo-doc-wisdom skill
# for Claude Code, providing lookup-only access to zudo-doc's
# own documentation and concentrated rule files.
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

SKILL_NAME="zudo-doc-wisdom"

# Resolve the main repo root (handles git worktrees correctly)
# Use the main worktree path so symlinks survive worktree removal
REPO_ROOT="$(git -C "$ROOT_DIR" worktree list | head -1 | awk '{print $1}')"

SKILL_DIR="$REPO_ROOT/.claude/skills/$SKILL_NAME"
DOCS_DIR="$REPO_ROOT/src/content/docs"
DOCS_JA_DIR="$REPO_ROOT/src/content/docs-ja"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

# Validate docs directory exists
if [ ! -d "$DOCS_DIR" ]; then
  echo "Error: Documentation directory not found at $DOCS_DIR"
  exit 1
fi

# Helper: replace a symlink or file at the given path
ensure_symlink() {
  local link_path="$1"
  local target="$2"
  if [ -L "$link_path" ] || [ -e "$link_path" ]; then
    rm -rf "$link_path"
  fi
  ln -s "$target" "$link_path"
}

echo ""
echo "=== zudo-doc-wisdom Skill Setup ==="
echo ""

# Create skill directory
mkdir -p "$SKILL_DIR"

# Create symlink to docs directory inside the skill
ensure_symlink "$SKILL_DIR/docs" "$REPO_ROOT/src/content/docs"
echo "  Created docs symlink -> $REPO_ROOT/src/content/docs"

# Create symlink to Japanese docs directory
if [ -d "$DOCS_JA_DIR" ]; then
  ensure_symlink "$SKILL_DIR/docs-ja" "$REPO_ROOT/src/content/docs-ja"
  echo "  Created docs-ja symlink -> $REPO_ROOT/src/content/docs-ja"
fi

# Create symlinks to concentrated rule skill files
WRITING_RULES_SKILL="$REPO_ROOT/.claude/skills/zudo-doc-writing-rules/SKILL.md"
if [ -f "$WRITING_RULES_SKILL" ]; then
  ensure_symlink "$SKILL_DIR/skill-writing-rules.md" "$WRITING_RULES_SKILL"
  echo "  Created skill-writing-rules.md symlink"
fi

DESIGN_SYSTEM_SKILL="$REPO_ROOT/.claude/skills/zudo-doc-design-system/SKILL.md"
if [ -f "$DESIGN_SYSTEM_SKILL" ]; then
  ensure_symlink "$SKILL_DIR/skill-design-system.md" "$DESIGN_SYSTEM_SKILL"
  echo "  Created skill-design-system.md symlink"
fi

NAVIGATION_SKILL="$REPO_ROOT/.claude/skills/zudo-doc-navigation-design/SKILL.md"
if [ -f "$NAVIGATION_SKILL" ]; then
  ensure_symlink "$SKILL_DIR/skill-navigation-design.md" "$NAVIGATION_SKILL"
  echo "  Created skill-navigation-design.md symlink"
fi

# Generate SKILL.md
cat > "$SKILL_DIR/SKILL.md" << 'SKILLEOF'
---
name: zudo-doc-wisdom
description: >-
  Search and reference documentation from the zudo-doc documentation framework project.
  Use when answering questions about zudo-doc features, configuration, components, or usage patterns.
user-invocable: true
argument-hint: "[topic keyword, e.g., 'configuration', 'sidebar', 'i18n']"
---

# zudo-doc Documentation Reference

Look up documentation from the zudo-doc project — a minimal documentation framework built with Astro 6, MDX, Tailwind CSS v4, and Preact islands.

Documentation base path: `src/content/docs` (relative to repo root)

## How to Use

1. Find the relevant article(s) from the `docs/` directory based on the topic
2. Read ONLY the specific article(s) you need — do NOT load all articles at once
3. Apply the information from the article when answering the user's question
4. Mention the source article path so the user can find it for further reading

## Category Index

| Category | Description |
|---|---|
| `getting-started/` | Installation, project setup, writing docs, navigation structure |
| `guides/` | Configuration, i18n, sidebar, header nav, search, color schemes, doc history, deployment, dev workflow |
| `components/` | Admonitions, HtmlPreview, tabs, details, math, Mermaid, nav components |
| `reference/` | Design system, color system, create-zudo-doc CLI, API references |
| `develop/` | Development workflows, generator testing, link checker |
| `changelog/` | Version history |

## Concentrated Rule Files

For specific rule domains, refer to the dedicated rule files (symlinked):

- `skill-writing-rules.md` — Doc-writing rules: frontmatter, content structure, bilingual workflow, linking
- `skill-design-system.md` — CSS design tokens, color strategy, component styling rules
- `skill-navigation-design.md` — Navigation hierarchy, sidebar structure, header nav design

Read the relevant rule file BEFORE writing or modifying code that touches these domains.

## Japanese Documentation

Japanese translations are available under `docs-ja/`. When the user is working in Japanese or asks for Japanese content, prefer articles from `docs-ja/`.
SKILLEOF

echo "  Generated SKILL.md"

# Symlink into global skills directory
mkdir -p "$GLOBAL_SKILLS_DIR"
ensure_symlink "$GLOBAL_SKILLS_DIR/$SKILL_NAME" "$SKILL_DIR"
echo "  Created global symlink -> $GLOBAL_SKILLS_DIR/$SKILL_NAME"

echo ""
echo "Done! Skill '$SKILL_NAME' is ready."
echo ""
echo "  Project skill: $SKILL_DIR"
echo "  Global symlink: $GLOBAL_SKILLS_DIR/$SKILL_NAME"
echo ""
echo "You can now use it in Claude Code with: /$SKILL_NAME <topic>"
echo ""
