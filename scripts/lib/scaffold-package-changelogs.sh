#!/usr/bin/env bash
set -euo pipefail

# Create the showcase's package-specific EN/JA changelog placeholders.
#
# Keeping this filesystem-only operation behind a repo-root parameter lets the
# release scripts use the same implementation that fixture tests exercise,
# without running version bumps, registry checks, snapshots, or git commands.

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <repo-root> <version>" >&2
  exit 1
fi

REPO_ROOT="$1"
VERSION="$2"

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[0-9]+)*)?$'; then
  echo "Error: Version must be semver format with an optional prerelease suffix." >&2
  exit 1
fi

# Prints the lines between the first two `---` fences of an mdx file (its
# frontmatter block), or nothing if the file has fewer than two fences.
get_frontmatter_block() {
  awk '
    /^---[[:space:]]*$/ { count++; next }
    count == 1 { print }
    count >= 2 { exit }
  ' "$1"
}

# Echoes the integer value of `sidebar_position:` from a file's frontmatter.
# Returns non-zero (with a message on stderr naming the file) when the field
# is missing or not a plain non-negative integer. Callers that invoke this
# through command substitution MUST chain `|| exit 1` at every nesting level
# — bash does not propagate `set -e` failures out of nested `$(...)`.
get_sidebar_position() {
  local file="$1"
  local raw value
  raw=$(get_frontmatter_block "$file" | grep -m1 '^sidebar_position:')
  value=$(echo "$raw" | sed -E 's/^sidebar_position:[[:space:]]*//' | tr -d '[:space:]')
  if [ -z "$value" ]; then
    echo "Error: $file is missing sidebar_position in frontmatter." >&2
    return 1
  fi
  if ! echo "$value" | grep -qE '^[0-9]+$'; then
    echo "Error: $file has a malformed sidebar_position: '$value'" >&2
    return 1
  fi
  echo "$value"
}

# Rewrites only the frontmatter `sidebar_position:` line of a file in place,
# leaving every other line (including the rest of the frontmatter and body)
# untouched.
rewrite_sidebar_position() {
  local file="$1"
  local new_position="$2"
  local tmp_file="$file.tmp.$$"
  awk -v pos="$new_position" '
    /^---[[:space:]]*$/ && fences < 2 { fences++; print; next }
    fences == 1 && /^sidebar_position:/ { print "sidebar_position: " pos; next }
    { print }
  ' "$file" > "$tmp_file"
  mv "$tmp_file" "$file"
}

# Computes max(sidebar_position of release siblings) + 1 for a changelog
# directory, where release siblings are every *.mdx file except index.mdx and
# unreleased.mdx. Echoes 1001 when there are no release siblings yet.
compute_next_position() {
  local changelog_dir="$1"
  local max=0
  local found=0
  local f base pos

  for f in "$changelog_dir"/*.mdx; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    if [ "$base" = "index.mdx" ] || [ "$base" = "unreleased.mdx" ]; then
      continue
    fi
    pos=$(get_sidebar_position "$f") || return 1
    found=1
    if [ "$pos" -gt "$max" ]; then
      max=$pos
    fi
  done

  if [ "$found" -eq 0 ]; then
    echo 1001
  else
    echo $((max + 1))
  fi
}

write_changelog() {
  local locale="$1"
  local package_slug="$2"
  local changelog_dir="$REPO_ROOT/src/content/$locale/changelog/$package_slug"
  local changelog_file="$changelog_dir/$VERSION.mdx"
  local unreleased_file="$changelog_dir/unreleased.mdx"

  mkdir -p "$changelog_dir"

  # release_position is left unset unless we either just computed it (new
  # file) or need it to reconcile an unreleased.mdx sibling — this avoids
  # ever parsing an already-existing release file's frontmatter when no
  # unreleased.mdx sibling is around to reconcile against.
  local release_position=""

  if [ -f "$changelog_file" ]; then
    echo "Warning: $changelog_file already exists — skipping"
  else
    # Each package/locale directory owns its ordering. Reading the max
    # sidebar_position of sibling release entries (rather than counting
    # them) makes the new position immune to gaps and to unreleased.mdx
    # sharing the directory.
    release_position=$(compute_next_position "$changelog_dir") || exit 1

    if [ "$locale" = "docs-ja" ]; then
      tee "$changelog_file" > /dev/null <<MDXEOF
---
title: $VERSION
description: ${VERSION}のリリースノート。
sidebar_position: $release_position
---

<!-- リリースノートをここに追加 -->

### 機能

- <!-- 新機能を記述 -->

### バグ修正

- <!-- バグ修正を記述 -->
MDXEOF
    else
      tee "$changelog_file" > /dev/null <<MDXEOF
---
title: $VERSION
description: Release notes for $VERSION.
sidebar_position: $release_position
---

<!-- Add release notes here -->

### Features

- <!-- Describe new features -->

### Bug Fixes

- <!-- Describe bug fixes -->
MDXEOF
    fi

    echo "  ✓ Created $changelog_file (sidebar_position: $release_position)"
  fi

  if [ -f "$unreleased_file" ]; then
    # Reconciling here — even when the release file already existed — lets a
    # run interrupted between creating the release entry and reconciling
    # unreleased.mdx be repaired simply by rerunning this script.
    if [ -z "$release_position" ]; then
      release_position=$(get_sidebar_position "$changelog_file") || exit 1
    fi

    local unreleased_position
    unreleased_position=$(get_sidebar_position "$unreleased_file") || exit 1

    if [ "$unreleased_position" -le "$release_position" ]; then
      local new_unreleased_position=$((release_position + 1))
      rewrite_sidebar_position "$unreleased_file" "$new_unreleased_position"
      echo "  ✓ Reconciled $unreleased_file (sidebar_position: $new_unreleased_position)"
    fi
  fi
}

echo "▶ Scaffolding package changelog entries..."
for package_slug in zudo-doc create-zudo-doc doc-history-server; do
  write_changelog "docs" "$package_slug"
  write_changelog "docs-ja" "$package_slug"
done
