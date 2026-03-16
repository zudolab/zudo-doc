#!/usr/bin/env bash
set -euo pipefail

# ── setup-doc-skill.sh ─────────────────────────────────
# Creates a Claude Code skill that exposes your zudo-doc
# documentation as a knowledge base, then symlinks it into
# the user-scope skills directory (~/.claude/skills/).
# ────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Read project name from package.json
PROJECT_NAME=$(node -e "console.log(require('$ROOT_DIR/package.json').name || 'my-project')")
DEFAULT_SKILL_NAME="${PROJECT_NAME}-wisdom"

# Prompt for skill name
echo ""
echo "=== zudo-doc Skill Setup ==="
echo ""
read -rp "Skill name [$DEFAULT_SKILL_NAME]: " SKILL_NAME
SKILL_NAME="${SKILL_NAME:-$DEFAULT_SKILL_NAME}"

# Resolve the main repo root (handles git worktrees correctly)
REPO_ROOT="$(git -C "$ROOT_DIR" rev-parse --show-toplevel)"

SKILL_DIR="$ROOT_DIR/.claude/skills/$SKILL_NAME"
DOCS_DIR="$ROOT_DIR/src/content/docs"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

# Validate docs directory exists
if [ ! -d "$DOCS_DIR" ]; then
  echo "Error: Documentation directory not found at $DOCS_DIR"
  exit 1
fi

# Create skill directory
mkdir -p "$SKILL_DIR"

# Create symlink to docs directory inside the skill
DOCS_LINK="$SKILL_DIR/docs"
if [ -L "$DOCS_LINK" ] || [ -e "$DOCS_LINK" ]; then
  rm "$DOCS_LINK"
fi
ln -s "$REPO_ROOT/src/content/docs" "$DOCS_LINK"

echo "  Created docs symlink: $DOCS_LINK -> $REPO_ROOT/src/content/docs"

# Check if Japanese docs exist
DOCS_JA_DIR="$ROOT_DIR/src/content/docs-ja"
if [ -d "$DOCS_JA_DIR" ]; then
  DOCS_JA_LINK="$SKILL_DIR/docs-ja"
  if [ -L "$DOCS_JA_LINK" ] || [ -e "$DOCS_JA_LINK" ]; then
    rm "$DOCS_JA_LINK"
  fi
  ln -s "$REPO_ROOT/src/content/docs-ja" "$DOCS_JA_LINK"
  echo "  Created docs-ja symlink: $DOCS_JA_LINK -> $REPO_ROOT/src/content/docs-ja"
fi

# Generate SKILL.md
HAS_JA=""
if [ -d "$DOCS_JA_DIR" ]; then
  HAS_JA="true"
fi

cat > "$SKILL_DIR/SKILL.md" << SKILLEOF
---
name: $SKILL_NAME
description: >-
  Search and reference documentation from the $PROJECT_NAME project.
  Use when answering questions about $PROJECT_NAME features, configuration,
  components, or usage patterns.
user-invocable: true
argument-hint: "[topic keyword, e.g., 'configuration', 'sidebar', 'i18n']"
---

# $PROJECT_NAME Documentation Reference

Look up documentation from the $PROJECT_NAME project.
Documentation base path: \`$REPO_ROOT/src/content/docs\`

## How to Use

1. Find the relevant article(s) from the \`docs/\` directory based on the topic
2. Read ONLY the specific article(s) you need — do NOT load all articles at once
3. Apply the information from the article when answering the user's question
4. Mention the source article path so the user can find it for further reading

## Documentation Structure

The documentation is organized in MDX files under \`docs/\`:

\`\`\`
docs/
├── getting-started/   # Introduction and setup
├── guides/            # Feature guides and configuration
├── components/        # Component documentation
└── reference/         # API and reference docs
\`\`\`

Browse the \`docs/\` directory to discover available articles. Each \`.mdx\` file
has YAML frontmatter with \`title\` and \`description\` fields that help identify
the right article to read.
SKILLEOF

if [ "$HAS_JA" = "true" ]; then
  cat >> "$SKILL_DIR/SKILL.md" << JAEOF

## Japanese Documentation

Japanese translations are available under \`docs-ja/\`. When the user is working
in Japanese or asks for Japanese content, prefer articles from \`docs-ja/\`.
JAEOF
fi

echo "  Generated SKILL.md"

# Symlink into global skills directory
mkdir -p "$GLOBAL_SKILLS_DIR"
GLOBAL_LINK="$GLOBAL_SKILLS_DIR/$SKILL_NAME"
if [ -L "$GLOBAL_LINK" ] || [ -e "$GLOBAL_LINK" ]; then
  rm "$GLOBAL_LINK"
fi
ln -sfn "$SKILL_DIR" "$GLOBAL_LINK"

echo ""
echo "Done! Skill '$SKILL_NAME' is ready."
echo ""
echo "  Project skill: $SKILL_DIR"
echo "  Global symlink: $GLOBAL_LINK"
echo ""
echo "You can now use it in Claude Code with: /$SKILL_NAME <topic>"
echo ""
