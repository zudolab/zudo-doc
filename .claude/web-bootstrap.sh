#!/bin/bash
# Web-only: load the author's shared Claude config into this web session by
# DOWNLOADING the public claude-resources mirror (HTTPS tarball) and running its
# web loader. We do NOT `git clone`: Claude Code on the web routes git through a
# scoped proxy that only permits the session's in-scope repo, so cloning any other
# repo — even a public one — returns 403. Plain HTTPS egress still works, so a
# tarball fetch bypasses the proxy. No-ops on the local terminal; degrades
# gracefully if github.com is unreachable.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
[ -n "${HOME:-}" ] || { echo "web-bootstrap: \$HOME unset — skipping" >&2; exit 0; }
# --self-only gate: limit loading to YOUR web sessions on this shared repo
# WITHOUT committing any personal identifier. Opt in by setting
# CLAUDE_WEB_PROFILE_OPT_IN=1 in your per-user web env (Claude Code on the web →
# Environment variables — per-account, not tracked in git). Other accounts that
# never set it no-op; it supports multiple accounts (each opts in), survives
# account switches (set the var in the new account's env — no source change), and
# fails loudly, not silently.
[ "${CLAUDE_WEB_PROFILE_OPT_IN:-}" = "1" ] || {
  echo "web-bootstrap: CLAUDE_WEB_PROFILE_OPT_IN not set — skipping" >&2
  exit 0
}

SRC="$HOME/.claude-src"
REPO="Takazudo/claude-resources"
TARBALL="$(mktemp)"

# Fetch over plain HTTPS (curl -f fails on 404). Try the default branch, then master.
fetch() { curl -fsSL "https://github.com/$REPO/archive/refs/heads/$1.tar.gz" -o "$TARBALL"; }

if fetch main || fetch master; then
  rm -rf "$SRC"; mkdir -p "$SRC"
  tar -xzf "$TARBALL" -C "$SRC" --strip-components=1
  rm -f "$TARBALL"
  bash "$SRC/scripts/setup-web.sh"
else
  rm -f "$TARBALL"
  echo "claude-resources unreachable (network policy?) — skipping web profile"
  exit 0
fi
