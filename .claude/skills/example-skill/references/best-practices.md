# Best Practices

## Progressive Disclosure

Load only what is needed at each stage:

1. **Metadata** — name and description (always loaded for skill matching)
2. **SKILL.md body** — instructions (loaded when skill is invoked)
3. **References** — detailed docs (loaded on demand during execution)

## Keep SKILL.md Concise

The SKILL.md body shares the context window with the conversation. Keep it under 500 lines. Move detailed documentation to `references/` files.

## Use Scripts for Deterministic Operations

If an operation needs to be done the same way every time (file generation, validation, formatting), put it in a script rather than describing it in prose.

## Self-Contained

A skill should work without external dependencies beyond what is documented. Include all necessary context in the skill package.
