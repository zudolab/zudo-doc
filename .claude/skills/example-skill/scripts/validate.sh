#!/bin/bash
# Validate skill directory structure
set -e

SKILL_DIR="$1"

if [ -z "$SKILL_DIR" ]; then
  echo "Usage: validate.sh <skill-directory>"
  exit 1
fi

if [ ! -f "$SKILL_DIR/SKILL.md" ]; then
  echo "ERROR: Missing SKILL.md in $SKILL_DIR"
  exit 1
fi

echo "Checking frontmatter..."
head -20 "$SKILL_DIR/SKILL.md" | grep -q "^name:" || { echo "ERROR: Missing 'name' in frontmatter"; exit 1; }
head -20 "$SKILL_DIR/SKILL.md" | grep -q "^description:" || { echo "ERROR: Missing 'description' in frontmatter"; exit 1; }

echo "OK: Skill structure is valid"
