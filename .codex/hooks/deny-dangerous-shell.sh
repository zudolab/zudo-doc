#!/bin/sh

# Block high-impact shell commands before Codex runs them. The hook receives
# one Codex PreToolUse JSON object on stdin.

set -eu

input=$(cat)

# Keep the hook fail-open when jq is unavailable; the setup documentation calls
# out jq as a prerequisite for the guard's JSON parsing.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

command_text=$(printf '%s' "$input" | jq -r '.tool_input.command // .tool_input.cmd // .command // empty' 2>/dev/null || true)

deny() {
  jq -n --arg reason "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

# Split common shell-list separators so a dangerous command cannot hide after
# an otherwise harmless command. This intentionally does not attempt to be a
# complete shell parser; the hook is a conservative guard, not an executor.
parts=$(printf '%s\n' "$command_text" | awk '{ gsub(/&&/, "\n"); gsub(/\|\|/, "\n"); gsub(/;/, "\n"); print }')

printf '%s\n' "$parts" | while IFS= read -r part; do
  case "$part" in
    *[![:space:]]*) ;;
    *) continue ;;
  esac

  if printf '%s\n' "$part" | grep -Eq "^[[:space:]]*(sudo[[:space:]]+)?(command[[:space:]]+)?(/opt/homebrew/bin/|/usr/local/bin/)?brew[[:space:]]+install([[:space:]]|$)"; then
    deny "Blocked: Homebrew installation is not allowed. Ask the user to install the package themselves."
  fi

  if printf '%s\n' "$part" | grep -Eq "^[[:space:]]*(sudo[[:space:]]+)?(command[[:space:]]+)?(/bin/|/usr/bin/)?rm([[:space:]]|$)"; then
    arguments=$(printf '%s\n' "$part" | sed -E 's/^[[:space:]]*(sudo[[:space:]]+)?(command[[:space:]]+)?(\/bin\/|\/usr\/bin\/)?rm[[:space:]]+//')

    if printf '%s\n' "$arguments" | grep -Eq "(^|[[:space:]])[\"']?/[[:graph:]]*"; then
      has_recursive=1
      has_force=1

      if ! printf '%s\n' "$arguments" | grep -Eq "(^|[[:space:]])-[[:alnum:]]*[rR][[:alnum:]]*[fF][[:alnum:]]*([[:space:]]|$)"; then
        has_recursive=0
      fi
      if ! printf '%s\n' "$arguments" | grep -Eq "(^|[[:space:]])-[[:alnum:]]*[fF][[:alnum:]]*[rR][[:alnum:]]*([[:space:]]|$)"; then
        has_force=0
      fi

      if [ "$has_recursive" -eq 0 ] && printf '%s\n' "$arguments" | grep -Eq "(^|[[:space:]])(-[[:alnum:]]*[rR][[:alnum:]]*|--recursive)([[:space:]]|$)"; then
        has_recursive=1
      fi
      if [ "$has_force" -eq 0 ] && printf '%s\n' "$arguments" | grep -Eq "(^|[[:space:]])(-[[:alnum:]]*[fF][[:alnum:]]*|--force)([[:space:]]|$)"; then
        has_force=1
      fi

      if [ "$has_recursive" -eq 1 ] && [ "$has_force" -eq 1 ]; then
        deny "Blocked: rm with recursive and force flags must not target an absolute path. Use a scoped, relative target or ask the user to run it."
      fi
    fi
  fi
done
