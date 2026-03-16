# Skill Anatomy

A Claude Code skill is a directory containing:

## Required

- `SKILL.md` — The main skill file with YAML frontmatter and markdown instructions

## Optional Subdirectories

### `references/`

Markdown files loaded into context as needed. Used for detailed documentation, API specs, or domain knowledge that the skill consults during execution.

### `scripts/`

Executable files (Python, Bash, Node.js) for deterministic operations. Scripts are run directly rather than being loaded into the context window.

### `assets/`

Template or output files not loaded into context. Used for boilerplate code, HTML templates, CSS files, or other artifacts that the skill copies or modifies for output.

## Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier (lowercase, hyphens) |
| `description` | Yes | What the skill does and when to use it |
| `user-invocable` | No | Whether users can invoke directly |
| `allowed-tools` | No | Restrict which tools the skill can use |
| `model` | No | Override the model for this skill |
