# Codex guidance

`CLAUDE.md` is the canonical source of project instructions. Read it, and any
more specific nested `CLAUDE.md`, before changing files; this document adds
Codex workflow guidance without duplicating the project handbook.

## Codex resources

This repository keeps its Codex resources under `.codex/`:

- `config.toml` contains project-scoped Codex settings.
- `agents/` contains reusable role profiles, `rules/` contains command safety
  rules, and `hooks.json` plus `hooks/` contains shell-tool checks.
- `skills/` links to the shared project skills maintained under `.claude/`.

When the documentation skill needs to be refreshed, run
`pnpm setup:doc-skill:codex`. The generated `zudo-doc-wisdom` output is
machine-local and remains ignored.

## Working in this repository

- Worktree agents commit locally and report their commit to the manager; do
  not push from a worktree. The manager merges and pushes from the main
  checkout.
- Use `pnpm` for package management and repository scripts. Prefer the
  existing `package.json` script over invoking an equivalent tool directly.
